#!/usr/bin/env node
/* ============================================================================
   fetch-fandom.mjs — pull chapter/episode titles + short summaries from the
   One Piece fandom wiki, into block-chunked static JSON the app lazy-loads.

   Why the MediaWiki API and not HTML: fandom blocks plain page fetches (402),
   but api.php returns clean wikitext and BATCHES up to 50 pages per request,
   so ~1150 chapters is ~23 requests, not 1150. Wikitext is also far more
   stable to parse than rendered HTML.

   Data shape — data/<kind>/<block>.json, 100 units per block (block = n/100):
     data/chapters/0.json  -> chapters 1..99
     data/chapters/1.json  -> chapters 100..199
   { "1": { "t": "Romance Dawn —The Dawn of the Adventure—", "s": "During..." } }

   Usage:
     node scripts/fetch-fandom.mjs                 # chapters, incremental (max+1 → end)
     node scripts/fetch-fandom.mjs --kind episode  # episodes
     node scripts/fetch-fandom.mjs --from 1 --to 5 # explicit range
     node scripts/fetch-fandom.mjs --all           # full rebuild from 1
     node scripts/fetch-fandom.mjs --refetch --from 1044 --to 1044  # overwrite one

   Node 18+ (native fetch). No dependencies — keeps the project buildless.
   ============================================================================ */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://onepiece.fandom.com/api.php';
const UA = 'GrandLineChart/1.0 (https://github.com/rodrigopecci/one-piece-tracker; personal hobby project)';
const BATCH = 50;               // MediaWiki caps titles= at 50 per query
const PAUSE_MS = 400;           // be polite between batches

const KINDS = {
  chapter: { prefix: 'Chapter_', dir: 'data/chapters', box: 'Chapter Box', title: ['title', 'ename'] },
  episode: { prefix: 'Episode_', dir: 'data/episodes', box: 'Episode Box', title: ['Translation', 'crunchyTitle'] },
};

/* ---------- CLI ---------- */
function parseArgs(argv){
  const a = { kind: 'chapter', from: null, to: null, all: false, refetch: false };
  for (let i = 0; i < argv.length; i++){
    const k = argv[i];
    if (k === '--kind') a.kind = argv[++i];
    else if (k === '--from') a.from = parseInt(argv[++i], 10);
    else if (k === '--to') a.to = parseInt(argv[++i], 10);
    else if (k === '--all') a.all = true;
    else if (k === '--refetch') a.refetch = true;
    else { console.error(`Unknown arg: ${k}`); process.exit(1); }
  }
  if (!KINDS[a.kind]){ console.error(`--kind must be one of: ${Object.keys(KINDS).join(', ')}`); process.exit(1); }
  return a;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const blockOf = n => Math.floor(n / 100);
const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/* ---------- wikitext helpers ---------- */

// Pull a whole {{Template ...}} with balanced-brace matching (jname etc. nest
// templates, so the first "}}" is not the box's close).
function extractTemplate(wt, name){
  const start = wt.indexOf('{{' + name);
  if (start < 0) return null;
  let i = start + 2, depth = 1;
  while (i < wt.length && depth > 0){
    if (wt.startsWith('{{', i)){ depth++; i += 2; }
    else if (wt.startsWith('}}', i)){ depth--; i += 2; }
    else i++;
  }
  return depth === 0 ? wt.slice(start, i) : null;
}

// Split a template body into "| field = value" pairs, respecting nested
// {{...}} and [[...]] so a "|" inside a link/template doesn't split a field.
function parseFields(tpl){
  const body = tpl.slice(2, -2);
  const parts = []; let buf = '', bd = 0, ld = 0;
  for (let i = 0; i < body.length; i++){
    if (body.startsWith('{{', i)){ bd++; buf += '{{'; i++; continue; }
    if (body.startsWith('}}', i)){ bd--; buf += '}}'; i++; continue; }
    if (body.startsWith('[[', i)){ ld++; buf += '[['; i++; continue; }
    if (body.startsWith(']]', i)){ ld--; buf += ']]'; i++; continue; }
    if (body[i] === '|' && bd === 0 && ld === 0){ parts.push(buf); buf = ''; continue; }
    buf += body[i];
  }
  parts.push(buf);
  const fields = {};
  for (let k = 1; k < parts.length; k++){          // parts[0] is the template name
    const eq = parts[k].indexOf('=');
    if (eq < 0) continue;
    fields[parts[k].slice(0, eq).trim()] = parts[k].slice(eq + 1).trim();
  }
  return fields;
}

// The content of a ==Level 2== section, up to the next level-2 heading.
function extractSection(wt, heading){
  const re = new RegExp('^==\\s*' + heading + '\\s*==\\s*$', 'm');
  const m = re.exec(wt);
  if (!m) return null;
  const rest = wt.slice(m.index + m[0].length);
  const next = rest.search(/^==[^=]/m);            // next level-2 heading
  return (next < 0 ? rest : rest.slice(0, next));
}

// Strip wiki/HTML markup down to plain prose, keeping paragraph breaks.
function stripMarkup(s){
  if (!s) return '';
  let t = s;
  t = t.replace(/<ref[^>]*\/>/gi, '');
  t = t.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  t = t.replace(/\{\{Ruby\|([^{}|]*)\|[^{}]*\}\}/gi, '$1'); // {{Ruby|kanji|reading}} -> kanji
  let prev;                                                 // drop remaining templates, innermost first
  do { prev = t; t = t.replace(/\{\{[^{}]*\}\}/g, ''); } while (t !== prev);
  t = t.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1');        // [[a|b]] -> b
  t = t.replace(/\[\[([^\]]*)\]\]/g, '$1');                 // [[a]] -> a
  t = t.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1');    // [url text] -> text
  t = t.replace(/\[https?:\/\/\S+\]/g, '');
  t = t.replace(/'''''|'''|''/g, '');                       // bold/italic
  t = t.replace(/<br\s*\/?>/gi, ' ');                        // line breaks -> space (don't glue words)
  t = t.replace(/<[^>]+>/g, '');                            // stray HTML tags
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
       .replace(/&#39;|&apos;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
       .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  t = t.replace(/[ \t]+/g, ' ')
       .split('\n').map(l => l.trim()).join('\n')
       .replace(/\n{3,}/g, '\n\n')
       .trim();
  return t;
}

/* ---------- fetching ---------- */
async function apiGet(params, tries = 4){
  const url = API + '?' + new URLSearchParams(params).toString();
  for (let attempt = 1; ; attempt++){
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.status === 429 || res.status === 503) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e){
      if (attempt >= tries) throw e;
      const wait = 800 * attempt;
      console.warn(`  retry ${attempt}/${tries - 1} after ${wait}ms (${e.message})`);
      await sleep(wait);
    }
  }
}

/* Fetch a batch of numbers. Returns num -> {t,s} (valid) | null (page exists but
   has no title/summary) | absent (page genuinely missing).
   The API caps how much page *content* it returns per request, so a 50-page
   batch of long pages comes back partial with a `continue` token — we follow it
   until every existing page's content has arrived. Without this, later pages in
   a batch look "missing" and a naive loop stops early. */
async function fetchBatch(nums, cfg){
  const base = {
    action: 'query', prop: 'revisions', rvslots: 'main', rvprop: 'content',
    titles: nums.map(n => cfg.prefix + n).join('|'),
    format: 'json', formatversion: '2', maxlag: '5',
  };
  const out = {};
  let cont = {};
  do {
    const data = await apiGet({ ...base, ...cont });
    for (const page of data?.query?.pages || []){
      const num = parseInt((page.title.match(/(\d+)/) || [])[1], 10);
      if (!num || page.missing) continue;               // leave absent => "missing"
      const c = page.revisions?.[0]?.slots?.main?.content;
      if (c) out[num] = parsePage(c, cfg);              // fill it (parsePage may return null = invalid)
      // no content this round: a continue round carries it
    }
    cont = data.continue || null;
  } while (cont);
  return out;
}

function parsePage(wt, cfg){
  const tpl = extractTemplate(wt, cfg.box);
  const fields = tpl ? parseFields(tpl) : {};
  let title = '';
  for (const f of cfg.title){ if (fields[f]){ title = stripMarkup(fields[f]); if (title) break; } }
  if (!title) return null;                 // no title → not a real content page (missing/future stub)
  // Some pages have a title but only an {{Empty section}} placeholder summary
  // (older filler episodes) — keep the title, just omit the empty summary.
  const summary = stripMarkup(extractSection(wt, 'Short Summary'));
  return summary ? { t: title, s: summary } : { t: title };
}

/* ---------- block storage ---------- */
async function loadBlock(dir, block){
  const path = join(ROOT, dir, `${block}.json`);
  if (!existsSync(path)) return {};
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch { return {}; }
}

// One unit per line — compact but git-diff-friendly.
async function writeBlock(dir, block, obj){
  const keys = Object.keys(obj).map(Number).sort((a, b) => a - b);
  const body = keys.map(k => `  ${JSON.stringify(String(k))}: ${JSON.stringify(obj[k])}`).join(',\n');
  await mkdir(join(ROOT, dir), { recursive: true });
  await writeFile(join(ROOT, dir, `${block}.json`), `{\n${body}\n}\n`);
}

async function storedKeys(dir){
  const abs = join(ROOT, dir);
  const keys = new Set(); let max = 0;
  if (!existsSync(abs)) return { keys, max };
  for (const f of await readdir(abs)){
    if (!f.endsWith('.json')) continue;
    for (const k of Object.keys(JSON.parse(await readFile(join(abs, f), 'utf8')))){
      const n = Number(k); keys.add(n); if (n > max) max = n;
    }
  }
  return { keys, max };
}
const maxStored = async dir => (await storedKeys(dir)).max;

// A big batch can occasionally drop a page (the API's per-request content cap),
// leaving a sub-max gap. Re-fetch gaps in tiny batches, which never hit the cap
// — so a full run always self-heals to contiguous. Returns how many were fixed.
async function repairGaps(cfg){
  const { keys, max } = await storedKeys(cfg.dir);
  const gaps = [];
  for (let i = 1; i <= max; i++) if (!keys.has(i)) gaps.push(i);
  if (!gaps.length) return 0;
  console.log(`\nrepairing ${gaps.length} gap(s): ${gaps.slice(0, 25).join(', ')}${gaps.length > 25 ? ' …' : ''}`);
  const blocks = new Map();
  const getBlock = async b => { if (!blocks.has(b)) blocks.set(b, await loadBlock(cfg.dir, b)); return blocks.get(b); };
  let fixed = 0;
  for (let i = 0; i < gaps.length; i += 5){
    const chunk = gaps.slice(i, i + 5);
    const got = await fetchBatch(chunk, cfg);
    for (const num of chunk){
      const rec = got[num];
      if (!rec) continue;                              // still missing/invalid → genuinely absent (stub)
      (await getBlock(blockOf(num)))[String(num)] = rec; fixed++;
    }
    for (const [b, obj] of blocks) await writeBlock(cfg.dir, b, obj);
    await sleep(PAUSE_MS);
  }
  console.log(`repaired ${fixed}/${gaps.length}.`);
  return fixed;
}

/* ---------- main ---------- */
async function main(){
  const args = parseArgs(process.argv.slice(2));
  const cfg = KINDS[args.kind];
  const existingMax = await maxStored(cfg.dir);

  const from = args.from ?? (args.all ? 1 : existingMax + 1);
  const to = args.to ?? Infinity;   // open-ended: runs until a whole batch comes back empty

  console.log(`\n${args.kind}s: ${cfg.dir} (currently up to ${existingMax})`);
  console.log(`fetching from ${from}${to === Infinity ? ' until the wiki runs out' : ` to ${to}`}` +
              `${args.refetch ? ' (refetch/overwrite)' : ''}\n`);

  const blocks = new Map();                          // block -> obj (lazy-loaded, dirty-tracked)
  const getBlock = async b => { if (!blocks.has(b)) blocks.set(b, await loadBlock(cfg.dir, b)); return blocks.get(b); };

  let added = 0, done = false;
  for (let base = from; base <= to && !done; base += BATCH){
    const hi = Math.min(base + BATCH - 1, to === Infinity ? base + BATCH - 1 : to);
    const nums = range(base, hi);
    process.stdout.write(`  ${base}..${hi} … `);
    const got = await fetchBatch(nums, cfg);

    let n = 0, valid = 0;
    for (const num of nums){
      const rec = got[num];
      if (rec === undefined) continue;               // missing here — repairGaps() will retry it
      if (rec === null){                             // exists but no title/summary → skip (stub)
        console.warn(`\n    ! ${cfg.prefix}${num} has no title/summary — skipped`);
        continue;
      }
      valid++;
      const b = blockOf(num);
      const obj = await getBlock(b);
      if (obj[String(num)] && !args.refetch){ n++; continue; }   // keep existing unless --refetch
      obj[String(num)] = rec;
      n++; added++;
    }
    // Open-ended run ends only when a whole batch yields nothing — a single
    // dropped page never ends it early (that was the old bug).
    if (to === Infinity && valid === 0) done = true;
    console.log(`${n} ok${done ? ' (reached the end)' : ''}`);

    // flush touched blocks each batch so a crash mid-run loses nothing
    for (const [b, obj] of blocks) await writeBlock(cfg.dir, b, obj);
    if (!done && base + BATCH <= to) await sleep(PAUSE_MS);
  }

  added += await repairGaps(cfg);

  // Guardrail: keys should tile 1..max with no gaps.
  const { keys, max } = await storedKeys(cfg.dir);
  const gaps = [];
  for (let i = 1; i <= max; i++) if (!keys.has(i)) gaps.push(i);
  console.log(`\nAdded/updated ${added}. Stored ${keys.size} ${args.kind}s, up to ${max}.`);
  if (gaps.length) console.warn(`⚠ gaps remain: ${gaps.slice(0, 40).join(', ')}${gaps.length > 40 ? ' …' : ''}`);
  else console.log('✓ contiguous 1.. no gaps.');
}

main().catch(e => { console.error(e); process.exit(1); });
