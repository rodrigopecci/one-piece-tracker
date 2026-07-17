/* ============================================================
   SUPABASE
   Auth (Google/Facebook) + cross-device progress sync. Loaded from a CDN so
   the project keeps its "no build step" property — this is the only import
   in the file. Every call below is wrapped so a missing/misconfigured
   project, or the network being down, degrades to exactly today's
   local-only behaviour instead of breaking the page.
   ============================================================ */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from './config.js';

const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/* ============================================================
   THE WORLD
   ============================================================ */
const W = 4000, H = 2400;
const GL_Y = 1200, GL_HALF = 105, BELT = 210;
const RL_A = 1000, RL_B = 3000, RL_HALF = 72;

/* The chart is a stack of horizontal zones, and every island belongs to
   exactly one of them:
     North & West Blue   above the upper Calm Belt
     Calm Belt           dead water. Only Amazon Lily and Impel Down live here.
     the Grand Line      a corridor, 210 units wide. You cannot leave it.
     Calm Belt
     East & South Blue   below the lower Calm Belt                              */
const GL_TOP = GL_Y - GL_HALF, GL_BOT = GL_Y + GL_HALF;
const NORTH_EDGE = GL_TOP - BELT, SOUTH_EDGE = GL_BOT + BELT;

const CANON_ISLANDS = [
  {id:'reverse-mountain', n:'Reverse Mountain', x:1000, y:1200, sea:'paradise', type:'landmark', major:true,
   b:'The only way in. Currents from all four Blues climb the mountain and pour down into the Grand Line.'},
  {id:'twin-cape', n:'Twin Cape', x:1082, y:1252, sea:'paradise', type:'island',
   b:'A lighthouse at the foot of the mountain, where a whale has been waiting fifty years.'},
  {id:'whisky-peak', n:'Whisky Peak', x:1245, y:1138, sea:'paradise', type:'island',
   b:'Cactus-shaped rock and a welcome party that never ends. Every citizen is a bounty hunter.'},
  {id:'little-garden', n:'Little Garden', x:1425, y:1262, sea:'paradise', type:'island', major:true,
   b:'A prehistoric island where two giants have duelled for a century over a question nobody remembers.'},
  {id:'drum-island', n:'Drum Island', x:1600, y:1132, sea:'paradise', type:'island', major:true,
   b:'A winter kingdom of snow and rose-coloured peaks, with a castle that climbs the mountainside.'},
  {id:'alabasta', n:'Alabasta', x:1785, y:1258, sea:'paradise', type:'island', major:true,
   b:'A desert kingdom of rivers gone dry, a rebel army, and a king blamed for a drought he did not cause.'},
  {id:'jaya', n:'Jaya', x:1975, y:1150, sea:'paradise', type:'island', major:true,
   b:'Half an island. The other half was carried into the sky four hundred years ago.'},
  {id:'skypiea', n:'Skypiea', x:1975, y:700, sea:'paradise', type:'sky', major:true,
   b:'A country in the clouds above Jaya, ruled by a self-declared god, built on a missing city of gold.'},
  {id:'long-ring', n:'Long Ring Long Land', x:2170, y:1268, sea:'paradise', type:'island',
   b:'A long thin island of tall thin things, and a game with your ship as the stake.'},
  {id:'water-7', n:'Water 7', x:2360, y:1128, sea:'paradise', type:'island', major:true,
   b:'The city of water and the world’s finest shipwrights, slowly sinking into its own canals.'},
  {id:'enies-lobby', n:'Enies Lobby', x:2490, y:1265, sea:'paradise', type:'island', major:true,
   b:'The judicial island. Reached by sea train, it never sleeps, and nobody leaves acquitted.'},
  {id:'thriller-bark', n:'Thriller Bark', x:2645, y:1140, sea:'paradise', type:'island', major:true,
   b:'The largest ship ever built, drifting through the fog of the Florian Triangle, stealing shadows.'},
  {id:'sabaody', n:'Sabaody Archipelago', x:2880, y:1120, sea:'paradise', type:'island', major:true,
   b:'A grove of mangroves that breathe bubbles. The last stop before the Red Line — and a slave market.'},
  {id:'amazon-lily', n:'Amazon Lily', x:2650, y:1400, sea:'paradise', type:'island', major:true,
   b:'Hidden in the Calm Belt, in the Sea Kings’ nursery. An island of women; men are not permitted.'},
  {id:'impel-down', n:'Impel Down', x:2800, y:1450, sea:'paradise', type:'undersea', major:true,
   b:'The great prison beneath the sea, six levels deep. Officially, nobody has ever escaped.'},
  {id:'marineford', n:'Marineford', x:2900, y:1288, sea:'paradise', type:'island', major:true,
   b:'Marine Headquarters, in the shadow of the Red Line. A fortified bay built to hold a war.'},
  {id:'mary-geoise', n:'Mary Geoise', x:3000, y:1120, sea:'paradise', type:'landmark', major:true,
   b:'The holy land, on top of the Red Line. Home of the Celestial Dragons and an empty throne.'},
  {id:'fishman-island', n:'Fish-Man Island', x:3000, y:1285, sea:'paradise', type:'undersea', major:true,
   b:'Ten thousand metres down, beneath the Red Line, inside a bubble. The gateway to the New World.'},
  {id:'punk-hazard', n:'Punk Hazard', x:3180, y:1250, sea:'newworld', type:'island', major:true,
   b:'Burning on one half, frozen on the other. A research island that was never cleaned up.'},
  {id:'dressrosa', n:'Dressrosa', x:3340, y:1155, sea:'newworld', type:'island', major:true,
   b:'A kingdom of passion, flowers and living toys — and a colosseum with a Devil Fruit as the prize.'},
  {id:'green-bit', n:'Green Bit', x:3436, y:1112, sea:'newworld', type:'island',
   b:'A forest island joined to Dressrosa by an iron bridge, home to a race thought extinct.'},
  {id:'zou', n:'Zou', x:3570, y:1275, sea:'newworld', type:'island', major:true,
   b:'A country on the back of a thousand-year-old elephant that has never stopped walking.'},
  {id:'whole-cake', n:'Whole Cake Island', x:3735, y:1150, sea:'newworld', type:'island', major:true,
   b:'The seat of an Emperor, in a territory where the land is edible and the trees can talk.'},
  {id:'wano', n:'Wano Country', x:3900, y:1272, sea:'newworld', type:'island', major:true,
   b:'A closed country behind a waterfall, ruled by a shogun, cut off from the world for centuries.'},
  {id:'weatheria', n:'Weatheria', x:3330, y:740, sea:'newworld', type:'sky',
   b:'A sky island where weather is a science — studied, grown, bottled, and thrown.'},
  {id:'egghead', n:'Egghead', x:190, y:1170, sea:'newworld', type:'island', major:true,
   b:'The future island: a laboratory five hundred years ahead of the world it belongs to.'},
  {id:'elbaf', n:'Elbaf', x:440, y:1265, sea:'newworld', type:'island', major:true,
   b:'The village of the giants, where disputes are settled by combat and the god of war is watching.'},
  {id:'laugh-tale', n:'Laugh Tale', x:820, y:1185, sea:'newworld', type:'landmark', major:true,
   b:'The final island. One crew has reached it. What they found there started everything.'},

  {id:'dawn-island', n:'Dawn Island', x:2150, y:2010, sea:'east', type:'island', major:true,
   b:'Foosha Village, the Goa Kingdom, and the Grey Terminal. Where the voyage began.'},
  {id:'shells-town', n:'Shells Town', x:2565, y:1900, sea:'east', type:'island', major:true,
   b:'A Marine base run by a captain who let his son do the ruling. A swordsman was tied up in its yard.'},
  {id:'orange-town', n:'Orange Town', x:2350, y:1735, sea:'east', type:'island',
   b:'A town emptied by a clown, its buildings taken apart piece by piece.'},
  {id:'syrup-village', n:'Syrup Village', x:1905, y:1880, sea:'east', type:'island',
   b:'A quiet village on the Gecko Islands, where a boy cries pirate every morning.'},
  {id:'baratie', n:'Baratie', x:1680, y:1690, sea:'east', type:'island', major:true,
   b:'A restaurant that sails. The cooks fight as well as they cook, and nobody hungry is turned away.'},
  {id:'conomi', n:'Conomi Islands', x:1400, y:1790, sea:'east', type:'island',
   b:'Tangerine groves, and a village paying tribute to fish-men. Home of a cartographer.'},
  {id:'loguetown', n:'Loguetown', x:1160, y:1615, sea:'east', type:'island', major:true,
   b:'The town of the beginning and the end: where the Pirate King was born, and where he died.'},
  {id:'shimotsuki', n:'Shimotsuki Village', x:2790, y:2030, sea:'east', type:'island',
   b:'A village with a dojo, a promise between two children, and a sword left behind.'},

  {id:'flevance', n:'Flevance', x:1560, y:620, sea:'north', type:'island', major:true,
   b:'The White Town, rich on a white lead that was quietly killing everyone who touched it.'},
  {id:'lvneel', n:'Lvneel Kingdom', x:1870, y:415, sea:'north', type:'island',
   b:'The kingdom that sent an explorer to find a city of gold, and hanged him when he came back.'},
  {id:'spider-miles', n:'Spider Miles', x:2210, y:665, sea:'north', type:'island',
   b:'A scrapyard country of rust and rain, downstream of everything the North throws away.'},
  {id:'germa', n:'Germa Kingdom', x:2560, y:455, sea:'north', type:'roaming', major:true,
   b:'A kingdom with no fixed shore. It sails, it fights other people’s wars, and it charges by the day.'},

  {id:'ohara', n:'Ohara', x:480, y:600, sea:'west', type:'island', major:true,
   b:'An island of scholars and one enormous tree of books. The World Government erased it in an afternoon.'},
  {id:'baterilla', n:'Baterilla', x:560, y:1900, sea:'south', type:'island',
   b:'A quiet island the Marines combed for a year, hunting a child who was never born on time.'},
  {id:'sorbet', n:'Sorbet Kingdom', x:3620, y:1860, sea:'south', type:'island',
   b:'A small kingdom whose king gave everything away, and then gave himself away too.'},
];

/* ============================================================
   ARCS — the single source of truth for episodes, chapters, and how they
   group. Everything the app charts is derived from this array (plus
   CANON_ISLANDS above). Once an episode or chapter airs it never changes,
   so keeping it here — in git, reviewable, deployed with the code — beats a
   database. The database only holds users and their progress.

   HOW TO UPDATE (append-only, one small edit each):

   • New episode in the CURRENT arc → bump that arc's `ep` end by one.
       ep:[1123,1168]  →  ep:[1123,1169]
     Manga-canon is the default. If the episode is filler / mixed / anime-
     canon instead, also add its number to that arc's `filler` / `mixed` /
     `anime` list.

   • New chapter in the current arc → bump that arc's `ch` end by one.

   • A NEW arc begins → add an object after the current last one: an `id`,
     its `saga`, the next `ep`/`ch` start, and the island(s) it `stops` at
     (add that island to CANON_ISLANDS above if it's new). A 100%-filler
     arc sitting between two canon arcs is a `detour:true` island instead —
     see the ten existing ones; give it a `spot` name and no `stops`.

   Classification lists take a single number (54) or an inclusive range
   ([54,60]). The asserts below reject gaps, overlaps, and any exception
   outside its own arc, so a typo throws at load instead of quietly lying.
   ============================================================ */
const ARCS = [
  {saga:"East Blue", id:"romance-dawn", n:"Romance Dawn", ep:[1,3], ch:[1,7], stops:["dawn-island","shells-town"]},
  {saga:"East Blue", id:"orange-town", n:"Orange Town", ep:[4,8], ch:[8,21], stops:["orange-town"]},
  {saga:"East Blue", id:"syrup-village", n:"Syrup Village", ep:[9,18], ch:[22,41], stops:["syrup-village"]},
  {saga:"East Blue", id:"baratie", n:"Baratie", ep:[19,30], ch:[42,68], stops:["baratie"]},
  {saga:"East Blue", id:"arlong-park", n:"Arlong Park", ep:[31,44], ch:[69,95], stops:["conomi"]},
  {saga:"East Blue", id:"loguetown", n:"Loguetown", ep:[45,53], ch:[96,100], stops:["loguetown"], mixed:[[45,47]], anime:[[50,51]]},
  {saga:"East Blue", id:"warship", n:"Warship Island", ep:[54,60], detour:true, spot:"Warship Island"},

  {saga:"Arabasta", id:"reverse-mtn", n:"Reverse Mountain", ep:[61,63], ch:[101,105], stops:["reverse-mountain","twin-cape"], mixed:[61]},
  {saga:"Arabasta", id:"whisky-peak", n:"Whisky Peak", ep:[64,67], ch:[106,114], stops:["whisky-peak"]},
  {saga:"Arabasta", id:"little-garden", n:"Little Garden", ep:[68,77], ch:[115,129], stops:["little-garden"], mixed:[[68,69]]},
  {saga:"Arabasta", id:"drum", n:"Drum Island", ep:[78,91], ch:[130,153], stops:["drum-island"]},
  {saga:"Arabasta", id:"alabasta", n:"Alabasta", ep:[92,130], ch:[154,217], stops:["alabasta"], filler:[[98,99],102], mixed:[101], anime:[93]},
  {saga:"Arabasta", id:"post-alabasta", n:"Post-Alabasta", ep:[131,143], detour:true, spot:"Goat Island"},

  {saga:"Sky Island", id:"jaya", n:"Jaya", ep:[144,152], ch:[218,236], stops:["jaya"]},
  {saga:"Sky Island", id:"skypiea", n:"Skypiea", ep:[153,195], ch:[237,302], stops:["skypiea"]},
  {saga:"Sky Island", id:"g8", n:"G-8", ep:[196,206], detour:true, spot:"Navarone"},

  {saga:"Water 7", id:"long-ring", n:"Long Ring Long Land", ep:[207,219], ch:[303,321], stops:["long-ring"], anime:[[213,216]]},
  {saga:"Water 7", id:"oceans-dream", n:"Ocean's Dream", ep:[220,225], detour:true, spot:"Ocean's Dream"},
  {saga:"Water 7", id:"water-7", n:"Water 7", ep:[226,263], ch:[322,374], stops:["water-7"], mixed:[226]},
  {saga:"Water 7", id:"enies-lobby", n:"Enies Lobby", ep:[264,312], ch:[375,430], stops:["enies-lobby"], filler:[[279,283],[291,292],303]},
  {saga:"Water 7", id:"post-enies", n:"Post-Enies Lobby", ep:[313,325], ch:[431,441], stops:["water-7"], filler:[[317,319]]},

  {saga:"Thriller Bark", id:"ice-hunter", n:"Ice Hunter", ep:[326,336], detour:true, spot:"Lovely Land"},
  {saga:"Thriller Bark", id:"thriller-bark", n:"Thriller Bark", ep:[337,381], ch:[442,489], stops:["thriller-bark"], mixed:[354]},
  {saga:"Thriller Bark", id:"spa-island", n:"Spa Island", ep:[382,384], detour:true, spot:"Spa Island"},

  {saga:"Summit War", id:"sabaody", n:"Sabaody Archipelago", ep:[385,407], ch:[490,513], stops:["sabaody"], filler:[[406,407]]},
  {saga:"Summit War", id:"amazon-lily", n:"Amazon Lily", ep:[408,421], ch:[514,524], stops:["amazon-lily"], mixed:[421], anime:[[418,420]]},
  {saga:"Summit War", id:"impel-down", n:"Impel Down", ep:[422,456], ch:[525,549], stops:["impel-down"], filler:[[426,429]], anime:[[453,456]]},
  {saga:"Summit War", id:"marineford", n:"Marineford", ep:[457,489], ch:[550,580], stops:["marineford"], filler:[[457,458]], mixed:[489]},
  {saga:"Summit War", id:"post-war", n:"Post-War", ep:[490,516], ch:[581,597], stops:["marineford"], filler:[492], anime:[[497,499],506]},

  {saga:"Fish-Man Island", id:"return-sabaody", n:"Return to Sabaody", ep:[517,522], ch:[598,602], stops:["sabaody"], mixed:[520]},
  {saga:"Fish-Man Island", id:"fishman", n:"Fish-Man Island", ep:[523,574], ch:[603,653], stops:["fishman-island"], filler:[542], mixed:[574]},
  {saga:"Fish-Man Island", id:"z-ambition", n:"Z's Ambition", ep:[575,578], detour:true, spot:"Secon Island"},

  {saga:"Dressrosa", id:"punk-hazard", n:"Punk Hazard", ep:[579,625], ch:[654,699], stops:["punk-hazard"], filler:[590], mixed:[625]},
  {saga:"Dressrosa", id:"caesar", n:"Caesar Retrieval", ep:[626,627], detour:true, spot:"Caesar Retrieval"},
  {saga:"Dressrosa", id:"dressrosa", n:"Dressrosa", ep:[628,746], ch:[700,801], stops:["dressrosa","green-bit"], mixed:[628,633,653,657,679,690,731,738], anime:[737]},
  {saga:"Dressrosa", id:"silver-mine", n:"Silver Mine", ep:[747,750], detour:true, spot:"Silver Mine"},

  {saga:"Whole Cake", id:"zou", n:"Zou", ep:[751,779], ch:[802,824], stops:["zou"], mixed:[751,[777,778]], anime:[775]},
  {saga:"Whole Cake", id:"marine-rookie", n:"Marine Rookie", ep:[780,782], detour:true, spot:"Marine Rookie"},
  {saga:"Whole Cake", id:"whole-cake", n:"Whole Cake Island", ep:[783,877], ch:[825,902], stops:["whole-cake"], mixed:[789,803,807]},
  {saga:"Whole Cake", id:"reverie", n:"Reverie", ep:[878,890], ch:[903,908], offRoute:true, mixed:[[878,879],[881,885],[887,890]]},

  {saga:"Wano", id:"wano", n:"Wano Country", ep:[891,1085], ch:[909,1057], stops:["wano"], filler:[[895,896],907,[1029,1030]], mixed:[924,[988,989],991], anime:[1084]},

  {saga:"Final", id:"egghead", n:"Egghead", ep:[1086,1122], ch:[1058,1125], stops:["egghead"]},
  {saga:"Final", id:"elbaf", n:"Elbaf", ep:[1123,1168], ch:[1126,1188], stops:["elbaf"]},
];

/* expand a classification entry: 54 -> [54], [54,60] -> [54,55,…,60] */
const expandEntry = e => Array.isArray(e)
  ? Array.from({length: e[1] - e[0] + 1}, (_, i) => e[0] + i)
  : [e];

/* episode number -> 'manga' | 'anime' | 'mixed' | 'filler', derived from the
   arcs. Manga-canon is the silent default; detour arcs are 100% filler; each
   arc's filler/mixed/anime lists override individual episodes. */
const EP_TYPE = [];
ARCS.forEach(a => {
  if (!a.ep) return;
  for (let n = a.ep[0]; n <= a.ep[1]; n++) EP_TYPE[n] = a.detour ? 'filler' : 'manga';
  ['filler','mixed','anime'].forEach(kind =>
    (a[kind] || []).forEach(entry => expandEntry(entry).forEach(n => { EP_TYPE[n] = kind; })));
});
const LAST_EP = ARCS.reduce((m, a) => a.ep ? Math.max(m, a.ep[1]) : m, 0);
const LAST_CH = ARCS.reduce((m, a) => a.ch ? Math.max(m, a.ch[1]) : m, 0);
const isFillerEp = n => EP_TYPE[n] === 'filler';

/* Guardrails, asserted at load. Episode and chapter ranges must each tile
   1..LAST with no gaps or overlaps, and every classification exception must
   fall inside its own arc. A slip throws here rather than mislabelling the
   episode a user is on. */
(() => {
  const tile = (pick, last, label) => {
    const owner = new Array(last + 1).fill(null);
    ARCS.forEach(a => {
      const r = pick(a);
      if (!r) return;
      for (let n = r[0]; n <= r[1]; n++){
        if (owner[n]) throw new Error(`${label} ${n} is in two arcs (${owner[n]} and ${a.id})`);
        owner[n] = a.id;
      }
    });
    const gaps = [];
    for (let n = 1; n <= last; n++) if (!owner[n]) gaps.push(n);
    if (gaps.length) throw new Error(`${label} ranges have gaps: ${gaps.join(', ')}`);
  };
  tile(a => a.ep, LAST_EP, 'episode');
  tile(a => a.ch, LAST_CH, 'chapter');
  ARCS.forEach(a => ['filler','mixed','anime'].forEach(kind =>
    (a[kind] || []).forEach(entry => expandEntry(entry).forEach(n => {
      if (!a.ep || n < a.ep[0] || n > a.ep[1])
        throw new Error(`arc ${a.id}: ${kind} episode ${n} is outside its ep range ${a.ep ? a.ep.join('–') : '(none)'}`);
    }))));
})();

const EP_TYPE_LABEL = {
  manga:  'Manga canon',
  anime:  'Anime canon',
  mixed:  'Mixed canon / filler',
  filler: 'Filler',
};

/* the ten who sign on, and the arc that has to be finished before they do */
const CREW = [
  {id:'luffy',   n:'Monkey D. Luffy',   role:'Captain',       arc:null},
  {id:'zoro',    n:'Roronoa Zoro',      role:'Swordsman',     arc:'romance-dawn'},
  {id:'usopp',   n:'Usopp',             role:'Sniper',        arc:'syrup-village'},
  {id:'sanji',   n:'Sanji',             role:'Cook',          arc:'baratie'},
  {id:'nami',    n:'Nami',              role:'Navigator',     arc:'arlong-park'},
  {id:'chopper', n:'Tony Tony Chopper', role:'Doctor',        arc:'drum'},
  {id:'robin',   n:'Nico Robin',        role:'Archaeologist', arc:'alabasta'},
  {id:'franky',  n:'Franky',            role:'Shipwright',    arc:'post-enies'},
  {id:'brook',   n:'Brook',             role:'Musician',      arc:'thriller-bark'},
  {id:'jinbe',   n:'Jinbe',             role:'Helmsman',      arc:'whole-cake'},
];
const crewByArc = Object.fromEntries(CREW.filter(c => c.arc).map(c => [c.arc, c]));

const SEAS = {east:{label:'East Blue',short:'East'}, west:{label:'West Blue',short:'West'},
  north:{label:'North Blue',short:'North'}, south:{label:'South Blue',short:'South'},
  paradise:{label:'Grand Line — Paradise',short:'Paradise'},
  newworld:{label:'Grand Line — New World',short:'New World'}};
const TETHERS = [['skypiea','jaya']];

/* ---- filler islands are placed, not authored: each sits off the leg
        between the canon island before it and the canon island after,
        alternating sides. They only exist in the anime. ---- */
const canonById = Object.fromEntries(CANON_ISLANDS.map(i => [i.id, i]));

/* A filler island sits between the canon island before it and the one after.
   But it has to land somewhere it could plausibly *be*: never in a Calm Belt,
   never inside the Red Line, and in the same zone as the leg it interrupts.
   A detour off the Grand Line stays on the Grand Line — the corridor is only
   210 wide, so the branch bulges to the edge of it, not out of it.
   Warship Island happens before the crew ever reaches Reverse Mountain, so it
   belongs in the East Blue, not in the dead water they cross on the way. */
function zoneFor(sea){
  if (sea === 'paradise' || sea === 'newworld') return [GL_TOP + 22, GL_BOT - 22];
  if (sea === 'east' || sea === 'south')        return [SOUTH_EDGE + 70, H - 90];
  return [90, NORTH_EDGE - 70];                                  // north / west
}
function makeFillerIslands(){
  const out = [];
  let side = 1;
  ARCS.forEach((arc, idx) => {
    if (!arc.detour) return;
    let prev = null, next = null;
    for (let i = idx-1; i >= 0; i--) if (ARCS[i].stops){ prev = ARCS[i].stops[ARCS[i].stops.length-1]; break; }
    for (let i = idx+1; i < ARCS.length; i++) if (ARCS[i].stops){ next = ARCS[i].stops[0]; break; }
    if (!prev || !next) return;
    const A = canonById[prev], B = canonById[next];

    // the detour belongs to the sea you're leaving — unless you're leaving the
    // sky, in which case you're already on your way back down to the water
    const sea = A.type === 'sky' ? B.sea : A.sea;
    const [lo, hi] = zoneFor(sea);
    const onGrandLine = sea === 'paradise' || sea === 'newworld';

    let x = (A.x + B.x) / 2;
    [RL_A, RL_B].forEach(rl => {                                  // never inside the continent
      if (Math.abs(x - rl) < RL_HALF + 80) x = rl + (x >= rl ? 1 : -1) * (RL_HALF + 80);
    });

    let y;
    if (onGrandLine){
      y = GL_Y + side * 68;                                       // bulge to the edge of the corridor
    } else {
      const base = Math.min(Math.max((A.y + B.y) / 2, lo + 40), hi - 40);
      y = Math.min(Math.max(base + side * 130, lo), hi);
    }
    side *= -1;

    // and don't come to rest on top of somewhere that already exists
    for (let guard = 0; guard < 8; guard++){
      const clash = CANON_ISLANDS.find(i => Math.hypot(i.x - x, i.y - y) < 105);
      if (!clash) break;
      x += (x >= clash.x ? 1 : -1) * 75;
    }

    out.push({
      id:'filler-' + arc.id, n: arc.spot || arc.n, x, y, sea,
      type:'filler', arcId: arc.id, from: prev, to: next,
      b:'An anime-original stop. The manga never came here — the crew took the long way round.'
    });
  });
  return out;
}
const FILLER_ISLANDS = makeFillerIslands();
const ISLANDS = [...CANON_ISLANDS, ...FILLER_ISLANDS];
const byId = Object.fromEntries(ISLANDS.map(i => [i.id, i]));
const fillerByArc = Object.fromEntries(FILLER_ISLANDS.map(i => [i.arcId, i]));

/* ============================================================
   STATE
   ============================================================ */
const state = {
  medium:'anime',
  user:null,
  history:{anime:{}, manga:{}},        // yyyy-mm-dd -> how many you marked that day
  settings:{public:false, crew:false, spoiler:true, showFiller:true, countFiller:true, voyageCollapsed:false},
  removed:{anime:{}, manga:{}},        // unit -> ms timestamp, recently unticked (merge tiebreak)
};
const seen = {anime:new Set(), manga:new Set()};
let selected = null, hovered = null, activeSea = 'all';
const openArcs = new Set();
const peeked = new Set();

const medium = () => state.medium;
const unitWord  = () => medium()==='anime' ? 'episode' : 'chapter';
const unitWordC = () => medium()==='anime' ? 'Episodes' : 'Chapters';
const rangeOf = (arc, med) => med==='anime' ? arc.ep : arc.ch;
function unitsOf(arc, med){
  const r = rangeOf(arc, med);
  if (!r) return [];
  const out = [];
  for (let i=r[0]; i<=r[1]; i++) out.push(i);
  return out;
}
const arcsFor = med => ARCS.filter(a => rangeOf(a, med));
const seenIn = (arc, med) => unitsOf(arc, med).filter(u => seen[med].has(u)).length;

/* Filler is optional bonus content — you can tick it, and it shows in the
   per-arc counts, but it never decides whether you've *watched the story*.
   Position, the route, arc completion, crew, and the skipped/missing tags all
   key off the SIGNIFICANT (non-filler) units. Manga has no filler, so there
   every unit counts. `sigOr` falls back to all units for the rare stop chunk
   that is entirely filler, so it can still be completed. */
const sigUnits = (units, med) => med === 'anime' ? units.filter(u => !isFillerEp(u)) : units;
const sigOr = (units, med) => { const s = sigUnits(units, med); return s.length ? s : units; };
const relevantUnits = (arc, med) => sigUnits(unitsOf(arc, med), med);

const arcDone = (arc, med) => { const u = sigOr(unitsOf(arc, med), med); return u.length > 0 && u.every(x => seen[med].has(x)); };
const crewAboard = () => CREW.filter(c => !c.arc || arcDone(ARCS.find(a => a.id === c.arc), medium()));

/* ---- the route: one stop per island landed on, in story order ---- */
function buildStops(med){
  const out = [];
  arcsFor(med).forEach(arc => {
    if (!arc.stops) return;
    const units = unitsOf(arc, med);
    const per = Math.ceil(units.length / arc.stops.length);
    arc.stops.forEach((isl, i) => {
      const chunk = units.slice(i*per, (i+1)*per);
      if (chunk.length) out.push({island: isl, arc, units: chunk});
    });
  });
  // Laugh Tale is deliberately NOT a stop. Nobody knows what comes after Elbaf,
  // so the chart doesn't draw a line there and pretend that it does.
  return out;
}
let STOPS = buildStops('anime');
const rebuildStops = () => { STOPS = buildStops(medium()); };

const stopReached  = s => !s.pending && sigOr(s.units, medium()).some(u => seen[medium()].has(u));
const stopComplete = s => !s.pending && sigOr(s.units, medium()).every(u => seen[medium()].has(u));

/* Where you are = the furthest stop you've set foot on. Not the furthest
   *unbroken* stop — if you skipped Little Garden, you're still at Drum. */
function currentStopIndex(){
  let last = -1;
  STOPS.forEach((s,i) => { if (stopReached(s)) last = i; });
  return last;
}
const positionIsland = () => { const i = currentStopIndex(); return i < 0 ? STOPS[0].island : STOPS[i].island; };

/* The needle points forward, never back. Unfinished business behind you
   is surfaced separately, so it nags without hijacking the compass. */
function nextStop(){
  const cur = currentStopIndex();
  for (let i = cur + 1; i < STOPS.length; i++) if (!stopComplete(STOPS[i])) return STOPS[i];
  if (cur >= 0 && !stopComplete(STOPS[cur])) return STOPS[cur];
  return null;                     // caught up — and the story hasn't gone further either
}
function stopsBehind(){
  const cur = currentStopIndex();
  return STOPS.filter((s,i) => i < cur && !stopComplete(s));
}
function reachedIslands(){
  const set = new Set();
  STOPS.forEach(s => { if (stopReached(s)) set.add(s.island); });
  return set;
}

/* Filler belongs to an episode, not to an arc. Alabasta contains three filler
   episodes; Wano contains six. The manga has none at all. */
const countsTowardProgress = (u, med) =>
  med !== 'anime' || state.settings.countFiller || !isFillerEp(u);

function totalUnits(med){
  return arcsFor(med).reduce((n, a) =>
    n + unitsOf(a, med).filter(u => countsTowardProgress(u, med)).length, 0);
}
function countedSeen(med){
  let n = 0;
  seen[med].forEach(u => { if (countsTowardProgress(u, med)) n++; });
  return n;
}

/* ============================================================
   STATIC CHART
   ============================================================ */
const SVG = document.getElementById('chart');
const NS = 'http://www.w3.org/2000/svg';
const el = (t,a={}) => { const n = document.createElementNS(NS,t); for (const k in a) n.setAttribute(k,a[k]); return n; };

/* The world is a horizontal cylinder of width W: the Grand Line leaves the
   right edge and returns on the left. To let the map pan around it forever,
   everything positional is rendered at three tiles — one world-width left,
   centre, one right — and the viewport wraps modulo W (see clampView). The
   ghost tiles are identical, so crossing the seam is seamless. */
const TILES = [-W, 0, W];

/* full-width background bands only need to span the visible range across all
   three tiles, not be tiled themselves */
const BG_X0 = -W - 400, BG_X1 = 2*W + 400, BG_W = BG_X1 - BG_X0;
/* vertical extent for the grid + Red Line: generous enough that at full
   zoom-out they still reach top and bottom of any viewport, including tall
   portrait phones (where the view can be much taller than the world). */
const BG_Y0 = -1200, BG_Y1 = H + 6000;

/* faint swell across the open sea — gentle horizontal waves, behind the grid
   and the Grand Line band, so they only read in the open Blues */
const swell = document.getElementById('swell');
const wavePath = (y0, amp, period, phase) => {
  let d = '';
  for (let x=BG_X0; x<=BG_X1; x+=40){
    const y = y0 + amp*Math.sin(x/period + phase);
    d += (x===BG_X0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  return d;
};
for (let i=0;i<18;i++){
  const y0 = -200 + i*(H+400)/17;
  swell.appendChild(el('path',{d:wavePath(y0, 9, 250, i*1.7), fill:'none', stroke:'#3C7E92', 'stroke-width':1.1, opacity:.07}));
}

const grat = document.getElementById('graticule');
for (let x=BG_X0;x<=BG_X1;x+=125) grat.appendChild(el('line',{x1:x,y1:BG_Y0,x2:x,y2:BG_Y1,stroke:'var(--grid)','stroke-width':.7,opacity:(((x%W)+W)%W%500===0?.3:.1)}));
for (let y=BG_Y0;y<=BG_Y1;y+=125) grat.appendChild(el('line',{x1:BG_X0,y1:y,x2:BG_X1,y2:y,stroke:'var(--grid)','stroke-width':.7,opacity:(y%500===0?.3:.1)}));

const belts = document.getElementById('belts');
[GL_Y-GL_HALF-BELT, GL_Y+GL_HALF].forEach(y => {
  belts.appendChild(el('rect',{x:BG_X0,y,width:BG_W,height:BELT,fill:'var(--calm)',opacity:.7}));
  belts.appendChild(el('rect',{x:BG_X0,y,width:BG_W,height:BELT,fill:'url(#stipple)',opacity:.55}));
  belts.appendChild(el('line',{x1:BG_X0,y1:y,x2:BG_X1,y2:y,stroke:'#2C6E82','stroke-width':1,opacity:.35}));
});
[GL_Y-GL_HALF-BELT/2, GL_Y+GL_HALF+BELT/2].forEach(y => {
  TILES.forEach(dx => {
    const n = el('text',{x:400+dx,y:y+5,class:'zonelbl',fill:'#5FA6BC','font-size':22,opacity:.4});
    n.textContent='Calm Belt'; belts.appendChild(n);
  });
});

const glband = document.getElementById('glband');
/* luminous corridor: a soft glow bleeding past the banks, then the shallow
   band. The directional chevrons below carry the sense of current on their
   own — extra streamlines just clashed with them. */
glband.appendChild(el('rect',{x:BG_X0,y:GL_Y-GL_HALF-46,width:BG_W,height:GL_HALF*2+92,fill:'url(#glGlow)'}));
glband.appendChild(el('rect',{x:BG_X0,y:GL_Y-GL_HALF,width:BG_W,height:GL_HALF*2,fill:'var(--sea-shallow)',opacity:.42}));
[-1,1].forEach(s => glband.appendChild(el('line',{x1:BG_X0,y1:GL_Y+s*GL_HALF,x2:BG_X1,y2:GL_Y+s*GL_HALF,stroke:'#EFE6D2','stroke-width':2,opacity:.4})));
glband.appendChild(el('line',{x1:BG_X0,y1:GL_Y,x2:BG_X1,y2:GL_Y,stroke:'#EFE6D2','stroke-width':1,opacity:.5,'stroke-dasharray':'26 18'}));
const nearRedLine = x => [RL_A,RL_B].some(rl => TILES.some(dx => Math.abs(x-(rl+dx))<90));
for (let x=BG_X0+100;x<BG_X1;x+=260){
  if (nearRedLine(x)) continue;
  glband.appendChild(el('path',{d:`M${x-14} ${GL_Y-14} L${x+8} ${GL_Y} L${x-14} ${GL_Y+14}`,fill:'none',stroke:'#9FD4E4','stroke-width':2.4,opacity:.28,'stroke-linecap':'round'}));
}

/* The Red Line is a continent-tall mountain wall, not a bar: an irregular
   coastline down both sides, a horizontal cliff→crest→cliff gradient so it
   reads as lit rock, texture, and a jagged ridge line down the spine.
   The coastline is a deterministic function of y, so all three tiles match. */
const lines = document.getElementById('lines');
const RL_TOP = BG_Y0, RL_BOT = BG_Y1, RL_STEP = 40;
const coast = (y, seed) => 11*Math.sin(y/71 + seed) + 6*Math.sin(y/29 + seed*2.3) + 3*Math.sin(y/13 + seed);
function redBandPath(x){
  let d = '';
  for (let y=RL_TOP; y<=RL_BOT; y+=RL_STEP) d += (y===RL_TOP?'M':'L') + (x+RL_HALF+coast(y,1.0)).toFixed(1) + ' ' + y + ' ';
  for (let y=RL_BOT; y>=RL_TOP; y-=RL_STEP) d += 'L' + (x-RL_HALF-coast(y,4.2)).toFixed(1) + ' ' + y + ' ';
  return d + 'Z';
}
function ridgePath(x){
  let d = '';
  for (let y=RL_TOP; y<=RL_BOT; y+=RL_STEP) d += (y===RL_TOP?'M':'L') + (x + 5*Math.sin(y/38) + 3*Math.sin(y/16)).toFixed(1) + ' ' + y + ' ';
  return d;
}
TILES.forEach(dx => [RL_A,RL_B].forEach(rl => {
  const x = rl + dx, band = redBandPath(x);
  lines.appendChild(el('path',{d:band,fill:'url(#redWall)'}));
  lines.appendChild(el('path',{d:band,fill:'url(#rock)',opacity:.5}));
  lines.appendChild(el('path',{d:band,fill:'none',stroke:'#5A160F','stroke-width':2.6,'stroke-linejoin':'round'}));
  lines.appendChild(el('path',{d:ridgePath(x),fill:'none',stroke:'#E88B7E','stroke-width':1.4,opacity:.32,'stroke-linecap':'round'}));
  [420,2000].forEach(y => {
    const t = el('text',{x:x+6,y,class:'zonelbl',fill:'#F6D2CB','font-size':20,opacity:.8,transform:`rotate(-90 ${x+6} ${y})`,'text-anchor':'middle'});
    t.textContent='Red Line'; lines.appendChild(t);
  });
}));
/* Paradise sits between the two Red Line crossings; the New World is the
   wrap-around half, so its label rides the seam (x = 0 ≡ W). */
TILES.forEach(dx => [[2000,'Paradise'],[W,'New World']].forEach(([x,txt]) => {
  const t = el('text',{x:x+dx,y:GL_Y-GL_HALF-30,class:'zonelbl',fill:'#EFE6D2','font-size':26,'text-anchor':'middle',opacity:.5});
  t.textContent=txt; lines.appendChild(t);
}));

const seaLayer = document.getElementById('sealabels');
const seaLabelEls = [];
TILES.forEach(dx => [['North Blue',2000,430],['East Blue',2000,2070],['West Blue',W,290],['South Blue',W,2100]].forEach(([txt,x,y]) => {
  const t = el('text',{x:x+dx,y,class:'sealbl','font-size':104});
  t.textContent=txt; seaLayer.appendChild(t); seaLabelEls.push(t);
}));

const tetherLayer = document.getElementById('tethers');
TILES.forEach(dx => TETHERS.forEach(([a,b]) => {
  const A = byId[a], B = byId[b];
  tetherLayer.appendChild(el('line',{x1:A.x+dx,y1:A.y,x2:B.x+dx,y2:B.y,stroke:'#9FD4E4','stroke-width':1.4,'stroke-dasharray':'4 10',opacity:.45}));
}));

/* ---- yellow detours: canon island → filler island → canon island ---- */
const detourLayer = document.getElementById('detours');
let detourEls = {};
function buildDetourLines(){
  detourLayer.innerHTML = '';
  detourEls = {};
  FILLER_ISLANDS.forEach(f => {
    const A = byId[f.from], B = byId[f.to];
    const els = [];
    TILES.forEach(dx => {
      const l1 = el('line',{x1:A.x+dx,y1:A.y,x2:f.x+dx,y2:f.y,'stroke-linecap':'round'});
      const l2 = el('line',{x1:f.x+dx,y1:f.y,x2:B.x+dx,y2:B.y,'stroke-linecap':'round'});
      detourLayer.append(l1,l2);
      els.push(l1,l2);
    });
    detourEls[f.id] = els;
  });
}
buildDetourLines();

/* ---- the main line ----
   Each leg is drawn the short way round the cylinder (a leg spanning more
   than half the world wraps across the seam), then replicated at all three
   tiles so it stays continuous wherever you pan. */
const routeLayer = document.getElementById('route');
let legEls = [];
function buildRoute(){
  routeLayer.innerHTML = '';
  legEls = [];
  for (let i=0; i<STOPS.length-1; i++){
    const a = byId[STOPS[i].island], b = byId[STOPS[i+1].island];
    if (!a || !b || a.id === b.id){ legEls.push([]); continue; }
    let bx = b.x;
    if (Math.abs(bx - a.x) > W/2) bx += (bx > a.x ? -1 : 1) * W;   // shortest way round
    legEls.push(TILES.map(dx => {
      const l = el('line',{x1:a.x+dx,y1:a.y,x2:bx+dx,y2:b.y,'stroke-linecap':'round'});
      routeLayer.appendChild(l);
      return l;
    }));
  }
}

/* ---- markers ---- */
const markerLayer = document.getElementById('markers');
const labelLayer  = document.getElementById('labels');
let nodes = {};
function buildMarkers(){
  markerLayer.innerHTML = ''; labelLayer.innerHTML = '';
  nodes = {};
  ISLANDS.forEach(isle => TILES.forEach((dx, ti) => {
    const wx = isle.x + dx;                       // this instance's world x
    const g = el('g',{class:'island',tabindex: ti===1 ? 0 : -1,role:'button','data-id':isle.id,
      'aria-label':`${isle.n}, ${SEAS[isle.sea].label}`});
    const halo = el('circle',{class:'halo',cx:wx,cy:isle.y,fill:'none',stroke:'#5FA6BC','stroke-width':.8,opacity:.14});
    const shadow = el('circle',{class:'shadow',cx:wx,cy:isle.y,fill:'url(#isleShadow)','pointer-events':'none'});
    const ring = el('circle',{class:'ring',cx:wx,cy:isle.y,fill:'none',stroke:'var(--brass)','stroke-width':1.3,opacity:.75});
    if (isle.type==='sky') ring.setAttribute('stroke-dasharray','2 3');
    if (isle.type==='undersea') ring.setAttribute('stroke-dasharray','5 4');
    if (isle.type==='roaming') ring.setAttribute('stroke-dasharray','1 5');
    if (isle.type==='filler') ring.setAttribute('stroke-dasharray','3 3');
    const mk = (cls, extra) => isle.type==='landmark'
      ? el('rect',{class:cls,...extra})
      : el('circle',{class:cls,cx:wx,cy:isle.y,...extra});
    const body = mk('body',{stroke:'var(--ink)','stroke-width':1});
    const sheen = mk('sheen',{fill:'url(#isleSheen)','pointer-events':'none'});
    const hit = el('circle',{class:'hit',cx:wx,cy:isle.y,fill:'transparent'});
    g.append(halo,shadow,body,sheen,ring,hit);
    markerLayer.appendChild(g);
    const lbl = el('text',{class:'lbl'});
    lbl.textContent = isle.n;
    labelLayer.appendChild(lbl);
    nodes[`${isle.id}#${ti}`] = {g,halo,shadow,ring,body,sheen,hit,lbl,isle,wx,w100:0};
    g.addEventListener('click', e => { e.stopPropagation(); select(isle.id, true); });
    g.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' '){ e.preventDefault(); select(isle.id,true); } });
    g.addEventListener('pointerenter', () => { hovered = isle.id; draw(); });
    g.addEventListener('pointerleave', () => { if (hovered===isle.id){ hovered=null; draw(); } });
  }));
}
buildMarkers();

/* ============================================================
   VIEW + DRAW
   ============================================================ */
const view = {x:0,y:0,w:W,h:H};
let scale = 1;
/* Cap the zoom-out at one world width — the world is a cylinder, so seeing
   more than its full circumference is redundant, and it keeps the three
   tiles enough to always cover the viewport. */
const MIN_W = 520, MAX_W = W;

function fit(){
  const r = SVG.getBoundingClientRect();
  const s = Math.min(r.width/(W+320), r.height/(H+320));
  view.w = r.width/s; view.h = r.height/s;
  view.x = W/2 - view.w/2; view.y = H/2 - view.h/2;
  draw();
}
function clampView(){
  const r = SVG.getBoundingClientRect();
  view.w = Math.max(MIN_W, Math.min(MAX_W, view.w));
  view.h = view.w * (r.height/r.width);
  view.x = ((view.x % W) + W) % W;                 // wrap the pan — no left/right edge
  const m = 900;
  view.y = Math.max(-m, Math.min(H+m-view.h, view.y));
}
const BERTHS = [[1,0,'start'],[-1,0,'end'],[0,-1,'middle'],[0,1,'middle'],[1,-1,'start'],[1,1,'start']];
const overlaps = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

const fillerShown = () => medium()==='anime' && state.settings.showFiller;
const isShielded = id =>
  state.settings.spoiler && !peeked.has(id) && !reachedIslands().has(id)
  && id !== positionIsland() && !(byId[id].type==='filler' && seenIn(ARCS.find(a=>a.id===byId[id].arcId), medium()) > 0);

function draw(){
  clampView();
  SVG.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  const r = SVG.getBoundingClientRect();
  scale = r.width / view.w;
  const k = 1/scale;

  const here = positionIsland();
  const next = nextStop();
  const nextI = next ? next.island : null;
  const reached = reachedIslands();

  /* main line: a leg is red once you've reached the island it leads to.
     Skip an arc and its leg stays grey — a visible hole in your wake. */
  legEls.forEach((seg,i) => {
    const to = STOPS[i+1];
    const sailed = to && stopReached(to);
    seg.forEach(l => {
      l.setAttribute('stroke', sailed ? 'var(--voyage)' : 'rgba(239,230,210,.9)');
      l.setAttribute('stroke-width', (sailed ? 3 : 1.4) * k);
      l.setAttribute('opacity', sailed ? .9 : .16);
      l.setAttribute('stroke-dasharray', sailed ? 'none' : `${6*k} ${9*k}`);
    });
  });

  /* detours */
  FILLER_ISLANDS.forEach(f => {
    const els = detourEls[f.id];                    // 2 lines per tile, all styled alike
    if (!fillerShown()){ els.forEach(l => l.style.display='none'); return; }
    const arc = ARCS.find(a => a.id === f.arcId);
    const done = seenIn(arc, 'anime'), total = unitsOf(arc,'anime').length;
    const any = done > 0, all = done === total;
    els.forEach(l => {
      l.style.display='';
      l.setAttribute('stroke', any ? 'var(--filler)' : 'rgba(227,179,65,.9)');
      l.setAttribute('stroke-width', (any ? 2.4 : 1.2) * k);
      l.setAttribute('opacity', all ? .85 : any ? .55 : .16);
      l.setAttribute('stroke-dasharray', all ? 'none' : `${5*k} ${6*k}`);
    });
  });

  const visible = [], obstacles = [];
  for (const id in nodes){
    const nd = nodes[id];
    const {isle,g,halo,shadow,ring,body,sheen,hit,lbl} = nd;

    if (isle.type === 'filler' && !fillerShown()){ g.classList.add('gone'); lbl.style.display='none'; continue; }
    g.classList.remove('gone');

    const on = activeSea==='all' || isle.sea===activeSea;
    g.classList.toggle('dim', !on);

    const rr = (isle.major ? 11 : isle.type==='filler' ? 7 : 8) * k;
    ring.setAttribute('r', rr);
    halo.setAttribute('r', rr*2.3);
    halo.style.opacity = (scale > .35 && isle.type!=='filler') ? .14 : 0;
    hit.setAttribute('r', Math.max(rr*1.6, 18*k));

    const br = (isle.major ? 6.5 : isle.type==='filler' ? 3.8 : 4.5) * k;
    /* soft shadow pool, always a circle, nudged down to lift the island off the sea */
    shadow.setAttribute('r', br*1.55);
    shadow.setAttribute('cy', isle.y + br*0.42);
    shadow.style.opacity = isle.type==='filler' ? .5 : 1;
    if (isle.type==='landmark'){
      const set = n => { n.setAttribute('x', nd.wx-br); n.setAttribute('y', isle.y-br);
        n.setAttribute('width', br*2); n.setAttribute('height', br*2);
        n.setAttribute('transform', `rotate(45 ${nd.wx} ${isle.y})`); };
      set(body); set(sheen);
    } else { body.setAttribute('r', br); sheen.setAttribute('r', br); }

    const isHere = isle.id===here;
    const isNext = isle.id===nextI && !isHere;
    const isSailed = reached.has(isle.id) && !isHere;

    let ringCol='var(--brass)', ringOp=.7, ringW=1.3;
    let fill = isle.type==='landmark' ? 'var(--lacquer)'
             : isle.type==='undersea' ? 'var(--sea-shallow)'
             : isle.type==='sky' ? '#DCEEF4'
             : isle.type==='filler' ? 'rgba(8,32,45,.9)' : 'var(--land)';
    if (isle.type==='sky') ringCol = '#9FD4E4';

    if (isle.type === 'filler'){
      const arc = ARCS.find(a => a.id === isle.arcId);
      const done = seenIn(arc,'anime'), total = unitsOf(arc,'anime').length;
      ringCol = 'var(--filler)';
      ringOp = done ? 1 : .45;
      ringW = done ? 2 : 1.2;
      if (done === total) fill = 'var(--filler)';
      else if (done) fill = 'rgba(227,179,65,.4)';
    } else {
      if (isSailed){ ringCol='var(--voyage)'; ringOp=.95; ringW=2.2; fill='var(--voyage)'; }
      if (isNext){ ringCol='var(--brass-lite)'; ringOp=1; ringW=2.2; }
      if (isHere){ ringCol='var(--brass-lite)'; ringOp=1; ringW=3; fill='var(--brass)'; }
    }
    if (isle.id===selected){ ringCol='var(--brass-lite)'; ringW=2.6; ringOp=1; }

    ring.setAttribute('stroke', ringCol);
    ring.setAttribute('stroke-width', ringW*k);
    ring.style.opacity = ringOp;
    body.setAttribute('fill', fill);

    const sx = (nd.wx-view.x)*scale, sy = (isle.y-view.y)*scale;
    lbl.style.display='none';
    if (!on || sx<-140 || sx>r.width+140 || sy<-80 || sy>r.height+80) continue;
    obstacles.push({x:sx-rr*scale-2, y:sy-rr*scale-2, w:rr*scale*2+4, h:rr*scale*2+4});

    let prio = 5;
    if (isHere) prio=0;
    else if (isNext || isle.id===selected) prio=1;
    else if (isle.id===hovered) prio=2;
    else if (isle.major) prio=3;
    else if (isle.type==='filler') prio=5;
    else prio=4;

    visible.push({nd,sx,sy,rr:rr*scale,prio,isHere,isNext,isSailed});
  }

  const z = W/view.w;
  visible.sort((a,b) => a.prio - b.prio);
  const placed = [];

  for (const v of visible){
    const {nd,sx,sy,rr} = v;
    const {isle,lbl} = nd;
    const forced = v.prio <= 2;
    const tier = isle.major ? 0 : isle.type==='filler' ? 2 : 1;
    if (!forced){
      if (tier===1 && z <= 1.9) continue;
      if (tier===2 && z <= 2.6) continue;         // filler names surface last
    }

    const shielded = isShielded(isle.id);
    lbl.textContent = shielded ? '???' : isle.n;
    const fs = isle.major ? 12 : isle.type==='filler' ? 10 : 11;
    const wpx = shielded ? fs*2.2 : nd.w100 * fs/100;
    const hpx = fs*1.1, gap = 6;

    let put = null;
    for (const [bx,by,anchor] of BERTHS){
      const cx = sx + bx*(rr+gap), cy = sy + by*(rr+gap+hpx*.5);
      const left = anchor==='start' ? cx : anchor==='end' ? cx-wpx : cx-wpx/2;
      const box = {x:left-2, y:cy-hpx*.72-1, w:wpx+4, h:hpx+2};
      const clash = placed.some(p => overlaps(box,p)) || obstacles.some(o => overlaps(box,o));
      if (!clash || forced){ put={cx,cy,anchor,box}; if (!clash) break; }
    }
    if (!put) continue;

    placed.push(put.box);
    lbl.style.display='';
    lbl.setAttribute('font-size', fs*k);
    lbl.setAttribute('text-anchor', put.anchor);
    lbl.setAttribute('stroke-width', 3.2*k);
    lbl.setAttribute('x', view.x + put.cx/scale);
    lbl.setAttribute('y', view.y + put.cy/scale);
    lbl.classList.toggle('fill', isle.type==='filler' && !shielded);
    lbl.classList.toggle('sailed', v.isSailed && isle.type!=='filler' && !shielded);
    lbl.classList.toggle('here', (v.isHere||v.isNext) && !shielded);
    lbl.classList.toggle('hidden-name', shielded);
  }

  seaLabelEls.forEach(t => t.style.opacity = z>2.4 ? Math.max(0,.3-(z-2.4)*.12) : .3);
  updatePose();
  updateBehind();
}

/* ============================================================
   PAN / ZOOM
   ============================================================ */
SVG.addEventListener('wheel', e => {
  e.preventDefault();
  const r = SVG.getBoundingClientRect();
  const px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
  const wx=view.x+px*view.w, wy=view.y+py*view.h;
  view.w *= Math.exp(e.deltaY*0.0016);
  clampView();
  view.x=wx-px*view.w; view.y=wy-py*view.h;
  draw();
}, {passive:false});

/* double-click, or double-tap, zooms in on the spot you hit */
function zoomAt(clientX, clientY, f){
  const r = SVG.getBoundingClientRect();
  const px = (clientX - r.left)/r.width, py = (clientY - r.top)/r.height;
  const wx = view.x + px*view.w, wy = view.y + py*view.h;
  const from = view.w;
  const target = Math.max(MIN_W, Math.min(MAX_W, view.w * f));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches){
    view.w = target; clampView();
    view.x = wx - px*view.w; view.y = wy - py*view.h;
    draw(); return;
  }
  const t0 = performance.now(), dur = 320;
  (function step(t){
    const p = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-p,3);
    view.w = from + (target - from)*e;
    clampView();
    view.x = wx - px*view.w;
    view.y = wy - py*view.h;
    draw();
    if (p<1) requestAnimationFrame(step);
  })(performance.now());
}
const onWater = t => !(t.closest && t.closest('.island'));
SVG.addEventListener('dblclick', e => {
  if (!onWater(e.target)) return;
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, e.shiftKey ? 2 : 0.5);
});

const ptrs = new Map(); let pinch = null;
let lastTap = 0, lastTapXY = [0,0];
/* Capture the pointer only ONCE a real drag begins (past a few px). Capturing
   on pointerdown would swallow the click event on an island, so a single tap
   would never open its details — which is exactly what was happening. */
let downXY = null, dragging = false;
const capture = id => { try { SVG.setPointerCapture(id); } catch { /* pointer already gone */ } };
SVG.addEventListener('pointerup', e => {
  if (e.pointerType === 'mouse') return;          // the mouse goes through dblclick
  if (!onWater(e.target)) return;
  const now = performance.now();
  const moved = Math.hypot(e.clientX - lastTapXY[0], e.clientY - lastTapXY[1]);
  if (now - lastTap < 320 && moved < 30){ zoomAt(e.clientX, e.clientY, 0.5); lastTap = 0; }
  else { lastTap = now; lastTapXY = [e.clientX, e.clientY]; }
});
SVG.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if (ptrs.size===1){ downXY = {x:e.clientX, y:e.clientY}; dragging = false; }
  if (ptrs.size===2){                              // two fingers: a pinch, capture right away
    capture(e.pointerId);
    SVG.classList.add('dragging');
    const [a,b]=[...ptrs.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y),w:view.w};
  }
});
SVG.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const prev = ptrs.get(e.pointerId), r = SVG.getBoundingClientRect();
  if (ptrs.size===2 && pinch){
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const [a,b]=[...ptrs.values()], d=Math.hypot(a.x-b.x,a.y-b.y);
    if (d>0){
      const px=((a.x+b.x)/2-r.left)/r.width, py=((a.y+b.y)/2-r.top)/r.height;
      const wx=view.x+px*view.w, wy=view.y+py*view.h;
      view.w = pinch.w*(pinch.d/d); clampView();
      view.x=wx-px*view.w; view.y=wy-py*view.h;
      draw();
    }
    return;
  }
  if (!dragging){                                  // start panning only after moving a little
    if (!downXY || Math.hypot(e.clientX-downXY.x, e.clientY-downXY.y) < 5) return;
    dragging = true;
    capture(e.pointerId);
    SVG.classList.add('dragging');
  }
  view.x -= (e.clientX-prev.x)/r.width*view.w;
  view.y -= (e.clientY-prev.y)/r.height*view.h;
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  draw();
});
['pointerup','pointercancel','pointerleave'].forEach(ev => SVG.addEventListener(ev, e => {
  ptrs.delete(e.pointerId);
  if (ptrs.size<2) pinch=null;
  if (ptrs.size===0){ SVG.classList.remove('dragging'); dragging = false; downXY = null; }
}));
SVG.addEventListener('keydown', e => {
  const s = view.w*.08;
  const m = {ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,-s],ArrowDown:[0,s]};
  if (m[e.key]){ e.preventDefault(); view.x+=m[e.key][0]; view.y+=m[e.key][1]; draw(); }
  if (e.key==='+'||e.key==='='){ e.preventDefault(); zoomBy(.72); }
  if (e.key==='-'||e.key==='_'){ e.preventDefault(); zoomBy(1/.72); }
  if (e.key==='Escape') deselect();
});
function zoomBy(f){
  const cx=view.x+view.w/2, cy=view.y+view.h/2;
  view.w*=f; clampView();
  view.x=cx-view.w/2; view.y=cy-view.h/2; draw();
}
document.getElementById('zin').onclick  = () => zoomBy(.7);
document.getElementById('zout').onclick = () => zoomBy(1/.7);
document.getElementById('zfit').onclick = fit;
document.getElementById('zhere').onclick = () => select(positionIsland(), true);

function flyTo(isle, targetW = 900){
  const from = {...view}, r = SVG.getBoundingClientRect();
  const tw = Math.max(MIN_W, Math.min(view.w, targetW));
  /* fly to whichever wrapped copy of the island is nearest the current view,
     so crossing the seam takes the short way; clampView wraps the result. */
  let ix = isle.x, cx = view.x + view.w/2;
  while (ix - cx > W/2) ix -= W;
  while (cx - ix > W/2) ix += W;
  const to = {x: ix - tw/2, y: isle.y - (tw*r.height/r.width)/2, w: tw};
  if (matchMedia('(prefers-reduced-motion: reduce)').matches){ view.x=to.x; view.y=to.y; view.w=to.w; draw(); return; }
  const t0 = performance.now(), dur = 700;
  (function step(t){
    const p = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-p,3);
    view.x = from.x+(to.x-from.x)*e;
    view.y = from.y+(to.y-from.y)*e;
    view.w = from.w+(to.w-from.w)*e;
    draw();
    if (p<1) requestAnimationFrame(step);
  })(performance.now());
}

/* ============================================================
   LOG POSE
   ============================================================ */
const poseBtn = document.getElementById('pose');
const needle = document.getElementById('needle');
const poseK = document.getElementById('poseK'), poseName = document.getElementById('poseName'), poseSub = document.getElementById('poseSub');

function updatePose(){
  const here = byId[positionIsland()];
  const next = nextStop();
  if (!next){
    poseK.textContent = 'Nowhere left to sail';
    poseName.textContent = here.n;
    poseSub.textContent = 'You are as far as the story goes';
    return;
  }
  const target = byId[next.island];
  if (target.id !== here.id){
    let ddx = target.x - here.x;                    // point the short way round the cylinder
    if (ddx > W/2) ddx -= W; else if (ddx < -W/2) ddx += W;
    const ang = Math.atan2(ddx, here.y-target.y)*180/Math.PI;
    needle.style.transform = `rotate(${ang}deg)`;
  }
  const shield = isShielded(target.id);
  const name = shield ? 'Somewhere ahead' : target.n;
  const left = next.units.filter(u => !seen[medium()].has(u)).length;
  poseK.textContent = currentStopIndex() < 0 ? 'Log Pose · your first island' : `At ${here.n} · next heading`;
  poseName.textContent = name;
  poseSub.textContent = `${left} ${unitWord()}${left===1?'':'s'} · ${shield ? 'ahead' : next.arc.n}`;
  poseBtn.setAttribute('aria-label', `Go to ${name}`);
}
poseBtn.onclick = () => {
  const next = nextStop();
  select(next ? next.island : positionIsland(), true);
};

/* ============================================================
   QUICK LOG — mark the next episode/chapter without opening anything.
   "Next up" = the lowest-numbered unit you haven't marked yet, so a first-
   time user starts at 1 and just keeps hitting the button.
   ============================================================ */
const qlog = document.getElementById('qlog');
const arcOfUnit = (u, med) => ARCS.find(a => { const r = rangeOf(a, med); return r && u >= r[0] && u <= r[1]; });
function nextUnitToMark(med){
  const last = med === 'anime' ? LAST_EP : LAST_CH;
  for (let u = 1; u <= last; u++) if (!seen[med].has(u)) return u;
  return null;                       // everything marked — caught up
}
function renderQuickLog(){
  const med = medium();
  const u = nextUnitToMark(med);
  const V = document.getElementById('qlogV'), C = document.getElementById('qlogC');
  const K = document.getElementById('qlogK'), mark = document.getElementById('qlogMark');
  if (u === null){
    qlog.classList.add('done');
    K.textContent = 'All caught up';
    V.textContent = medium()==='anime' ? 'Every episode' : 'Every chapter';
    C.textContent = 'Nothing left to mark';
    mark.disabled = true;
    mark.textContent = '✓ Caught up';
    return;
  }
  qlog.classList.remove('done');
  const arc = arcOfUnit(u, med);
  const stop = STOPS.find(s => s.units.includes(u));
  const islandId = stop ? stop.island : (arc && arc.detour && fillerByArc[arc.id] ? fillerByArc[arc.id].id : null);
  const shielded = islandId ? isShielded(islandId) : true;
  K.textContent = 'Next up';
  V.textContent = `${med==='anime' ? 'Ep.' : 'Ch.'} ${u}`;
  C.textContent = shielded || !arc ? 'Uncharted waters ahead'
    : islandId ? `${arc.n} · ${byId[islandId].n}` : arc.n;
  mark.disabled = false;
  mark.textContent = `✓ Mark watched`;
}
document.getElementById('qlogMark').onclick = () => {
  const med = medium();
  const u = nextUnitToMark(med);
  if (u === null) return;
  seen[med].add(u);
  recordProgress(1);
  commit();                          // re-renders map, book, crew, pose + quick-log
};
function quickJumpTo(n){
  const med = medium();
  const last = med === 'anime' ? LAST_EP : LAST_CH;
  n = Math.max(1, Math.min(last, Math.floor(n)));
  if (!Number.isFinite(n)) return;
  let added = 0;
  for (let u = 1; u <= n; u++) if (!seen[med].has(u)){ seen[med].add(u); added++; }   // additive — never unmarks
  recordProgress(added);
  document.getElementById('qlogInput').value = '';
  commit();
};
document.getElementById('qlogGo').onclick = () => {
  const v = parseInt(document.getElementById('qlogInput').value, 10);
  if (!isNaN(v)) quickJumpTo(v);
};
document.getElementById('qlogInput').addEventListener('keydown', e => {
  if (e.key === 'Enter'){ e.preventDefault(); document.getElementById('qlogGo').click(); }
});

/* collapse / expand the bottom-left voyage HUD (Next up + Log Pose), remembered */
const applyVoyageCollapsed = () => document.body.classList.toggle('voyage-collapsed', !!state.settings.voyageCollapsed);
const setVoyageCollapsed = v => { state.settings.voyageCollapsed = v; applyVoyageCollapsed(); persist(); };
document.getElementById('voyageCollapse').onclick = () => setVoyageCollapsed(true);
document.getElementById('voyageExpand').onclick = () => setVoyageCollapsed(false);

/* ============================================================
   PACE — how fast are you actually going?
   A day where you ticked a huge block is data entry, not viewing, so it's
   left out of the average. Otherwise importing 400 episodes on your first
   day would have the app claim you watch 400 a day.
   ============================================================ */
const BULK = 25;
const dayKey = d => new Date(d).toISOString().slice(0,10);
function recordProgress(n){
  if (n <= 0) return;
  const h = state.history[medium()];
  const k = dayKey(Date.now());
  h[k] = (h[k] || 0) + n;
}
function pace(){
  const h = state.history[medium()] || {};
  const cutoff = Date.now() - 30*864e5;
  const days = Object.entries(h).filter(([k,v]) => new Date(k).getTime() >= cutoff && v > 0 && v <= BULK);
  if (days.length < 3) return null;
  const total = days.reduce((n,[,v]) => n + v, 0);
  const t = days.map(([k]) => new Date(k).getTime());
  const span = Math.max(1, Math.round((Math.max(...t) - Math.min(...t)) / 864e5) + 1);
  return total / span;
}
function humanEta(days){
  if (days < 14)  return `about ${Math.max(1, Math.round(days))} day${Math.round(days)===1?'':'s'}`;
  if (days < 70)  return `about ${Math.round(days/7)} weeks`;
  if (days < 730) return `about ${Math.round(days/30)} months`;
  return `about ${(days/365).toFixed(1)} years`;
}
function renderPace(){
  const p = pace();
  const v = document.getElementById('paceV'), s = document.getElementById('paceS');
  const remaining = totalUnits(medium()) - countedSeen(medium());
  if (!p){
    v.textContent = 'Not enough to go on yet';
    s.textContent = `Mark a few ${unitWord()}s across a few days and your pace will show up here.`;
  } else if (remaining <= 0){
    v.textContent = 'You are current.';
    s.textContent = `${p.toFixed(1)} ${unitWord()}s a day while you were catching up.`;
  } else {
    v.textContent = `${p.toFixed(1)} ${unitWord()}s a day — current in ${humanEta(remaining/p)}`;
    s.textContent = `${remaining} ${unitWord()}s to go · from your last 30 days`;
  }
}

/* ============================================================
   WHO ELSE IS HERE — mocked, but stable per island
   ============================================================ */
const NAMES = ['saltbeard','kuina_fan','gomu_gomu_jo','navigator_ren','thousand_sunny','redhaired',
  'marimo','blackleg_v','ohara_reader','bellamy_was_right','chopper_stan','sea_king_9',
  'loguetown_local','wano_wanderer','poneglyph','vivi_deserved_better','laboon_waits','yonko_watch'];
function hash(s){ let h=2166136261; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619); } return Math.abs(h); }
const sailorsAt = id => 40 + (hash(id + medium()) % 860);
function sailorSample(id, n){
  const h = hash(id), stop = STOPS.find(s => s.island===id && !s.pending);
  const units = stop ? stop.units : [1];
  const out = [];
  for (let i=0;i<n;i++) out.push({name: NAMES[(h + i*7) % NAMES.length], unit: units[(h + i*13) % units.length]});
  return out;
}
function renderAnchorage(id){
  const box = document.getElementById('anch');
  const stop = STOPS.find(s => s.island===id && !s.pending);
  if (!stop || isShielded(id)){ box.style.display='none'; return; }
  box.style.display='';
  const isHere = id === positionIsland();

  /* The sailor count is only meaningful (and only shown) when you've opted
     into a public profile — with it off, hide the number rather than flash a
     figure you can't act on. */
  if (!state.settings.public){
    box.innerHTML = `<div class="hd"><b>Who else is here?</b></div>
      <p class="locked">Turn on a public profile to see how many sailors are at this island — and meet the ones on your exact ${unitWord()}.</p>
      <button class="cta" id="goPublic">Make my profile public</button>`;
    document.getElementById('goPublic').onclick = () => openModal('settingsModal');
    return;
  }

  let html = `<div class="hd"><b>${sailorsAt(id).toLocaleString()} sailors</b>
    <span>${isHere ? 'anchored with you' : 'are here'}</span></div>`;
  if (state.settings.crew){
    sailorSample(id, 3).forEach(s => {
      html += `<div class="who"><span class="d">${s.name[0].toUpperCase()}</span>
        <span class="t">${s.name}</span>
        <span class="e">${medium()==='anime'?'Ep.':'Ch.'} ${s.unit}</span></div>`;
    });
    html += `<button class="cta" id="tavern">Open the tavern</button>`;
  } else {
    html += `<p class="locked">Turn on “Find sailors at my island” to see who they are and talk to the ones on your exact ${unitWord()}.</p>`;
  }
  box.innerHTML = html;
  const t = document.getElementById('tavern');
  if (t) t.onclick = () => toast('The tavern isn\u2019t built yet');
  const g = document.getElementById('goPublic');
  if (g) g.onclick = () => openModal('settingsModal');
}

/* ============================================================
   CREW
   ============================================================ */
document.getElementById('openCrew').onclick = () => { renderCrew(); openModal('crewModal'); };
function renderCrew(){
  const grid = document.getElementById('crewGrid');
  const aboard = new Set(crewAboard().map(c => c.id));
  grid.innerHTML = '';
  CREW.forEach(c => {
    const inCrew = aboard.has(c.id);
    const arc = c.arc ? ARCS.find(a => a.id === c.arc) : null;
    const hide = !inCrew && state.settings.spoiler;   // who joins, and when, is itself a spoiler
    const d = document.createElement('div');
    d.className = 'cm ' + (inCrew ? 'in' : 'out');
    const sub = inCrew ? (arc ? `${c.role} \u00b7 joined at ${arc.n}` : 'Captain')
              : hide   ? 'Not yet aboard'
              : `${c.role} \u00b7 joins after ${arc.n}`;
    d.innerHTML = `<span class="disc">${hide ? '?' : c.n[0]}</span>
      <span class="t"><b>${hide ? '???' : c.n}</b><span>${sub}</span></span>`;
    grid.appendChild(d);
  });
  document.getElementById('crSub').textContent = aboard.size === CREW.length
    ? 'The full crew. Every seat on the ship is taken.'
    : 'They sign on as you sail. Finish the arc, gain the shipmate.';
  document.getElementById('crewCount').textContent = `${aboard.size}/${CREW.length}`;
}

/* ============================================================
   LOG BOOK
   ============================================================ */
const book = document.getElementById('book');
const scrim = document.getElementById('scrim');
const bookScroll = document.getElementById('bookScroll');
const openBookBtn = document.getElementById('openBook');
const setBook = open => {
  book.classList.toggle('open', open);
  scrim.classList.toggle('open', open);
  book.setAttribute('aria-hidden', String(!open));
  openBookBtn.setAttribute('aria-expanded', String(open));
};
openBookBtn.onclick = () => setBook(true);
document.getElementById('closeBook').onclick = () => setBook(false);
scrim.onclick = () => setBook(false);

/* Classify canon arcs you've moved PAST but not finished. Filler never counts
   (see sigUnits), so leaving Alabasta's fillers unwatched is not a skip.
     - skipped: you leapfrogged the arc entirely — no significant unit watched.
     - missing: you watched part of it but left canon/mixed units unwatched.
   Arcs you're currently in or haven't reached yet get neither. */
function arcStatuses(){
  const med = medium();
  const cur = currentStopIndex();
  const arcMaxStop = {};
  STOPS.forEach((s,i) => { arcMaxStop[s.arc.id] = Math.max(arcMaxStop[s.arc.id] ?? -1, i); });
  const out = {};
  arcsFor(med).forEach(arc => {
    const maxIdx = arcMaxStop[arc.id];
    if (maxIdx === undefined || maxIdx >= cur) return;   // off-route, current, or ahead
    const rel = relevantUnits(arc, med);
    if (!rel.length) return;
    const seenN = rel.filter(u => seen[med].has(u)).length;
    if (seenN === 0) out[arc.id] = 'skipped';
    else if (seenN < rel.length) out[arc.id] = 'missing';
  });
  return out;
}
function updateBehind(){
  const ids = Object.keys(arcStatuses());
  const dot = document.getElementById('behindDot');
  dot.classList.toggle('on', ids.length > 0);
  dot.textContent = ids.length || '';
  const btn = document.getElementById('behindBtn');
  if (!ids.length){ btn.style.display='none'; return; }
  btn.style.display='';
  document.getElementById('behindTxt').textContent =
    `${ids.length} arc${ids.length===1?'':'s'} left behind you`;
  btn.onclick = () => {
    const first = ids[0];
    openArcs.add(first);
    renderBook();
    setBook(true);
    requestAnimationFrame(() => {
      bookScroll.querySelector(`[data-arc="${first}"]`)?.scrollIntoView({block:'center', behavior:'smooth'});
    });
  };
}

function renderBook(){
  document.getElementById('unitWord').textContent = unitWord();
  document.getElementById('legFil').style.display = medium()==='anime' ? '' : 'none';
  document.getElementById('legSrc').textContent = medium()==='anime'
    ? `${LAST_EP} eps \u00b7 ${EP_TYPE.filter(t => t === 'filler').length} filler`
    : 'chapters estimated';
  bookScroll.innerHTML = '';
  const statuses = arcStatuses();
  let saga = null;

  arcsFor(medium()).forEach(arc => {
    if (arc.saga !== saga){
      saga = arc.saga;
      const h = document.createElement('div');
      h.className='saga'; h.textContent = saga;
      bookScroll.appendChild(h);
    }
    const units = unitsOf(arc, medium());
    const done = seenIn(arc, medium());
    const status = statuses[arc.id];
    const wrap = document.createElement('div');
    wrap.className = 'arc' + (arc.detour?' filler':'') + (done===units.length?' done':'')
      + (openArcs.has(arc.id)?' open':'')
      + (status==='skipped'?' gap':'') + (status==='missing'?' miss':'');
    wrap.dataset.arc = arc.id;

    const row = document.createElement('div');
    row.className='arc-row';

    const tick = document.createElement('button');
    tick.className='tick';
    tick.setAttribute('role','checkbox');
    tick.setAttribute('aria-checked', done===units.length?'true':done>0?'mixed':'false');
    tick.setAttribute('aria-label', `Mark all of ${arc.n}`);
    tick.textContent = done===units.length ? '✓' : '';
    tick.onclick = () => {
      const all = done===units.length;
      let added = 0;
      units.forEach(u => {
        if (all) seen[medium()].delete(u);
        else if (!seen[medium()].has(u)){ seen[medium()].add(u); added++; }
      });
      recordProgress(added);
      commit();
    };

    const mate = crewByArc[arc.id];
    const fillerHere = medium()==='anime' ? units.filter(isFillerEp).length : 0;
    const tags = (arc.detour ? '<span class="tag fil">Filler</span>' : '')
      + (!arc.detour && fillerHere ? `<span class="tag fil">${fillerHere} filler</span>` : '')
      + (arc.offRoute ? '<span class="tag nolan">No landfall</span>' : '')
      + (status==='skipped' ? '<span class="tag skip">Skipped</span>' : '')
      + (status==='missing' ? `<span class="tag miss">Missing ${unitWord()}s</span>` : '')
      + (mate && !state.settings.spoiler ? `<span class="tag crew">${mate.n.split(' ').pop()}</span>` : '');

    const name = document.createElement('button');
    name.className='arc-name';
    name.innerHTML = `<span class="t"><span class="caret">▶</span>${arc.n}${tags}</span>
      <small>${unitWordC()} ${units[0]}–${units[units.length-1]}</small>`;
    name.onclick = () => { openArcs.has(arc.id) ? openArcs.delete(arc.id) : openArcs.add(arc.id); renderBook(); };

    const count = document.createElement('span');
    count.className='arc-count';
    count.textContent = `${done}/${units.length}`;

    row.append(tick,name,count);
    wrap.appendChild(row);

    if (openArcs.has(arc.id)){
      const ul = document.createElement('div');
      ul.className='units';
      units.forEach(u => {
        const anime = medium()==='anime';
        const ty = anime ? EP_TYPE[u] : 'manga';
        const li = document.createElement('div');
        li.className = 'unit t-' + ty + (seen[medium()].has(u) ? ' seen' : '');
        const t = document.createElement('button');
        t.className='tick'; t.setAttribute('role','checkbox');
        t.setAttribute('aria-checked', String(seen[medium()].has(u)));
        t.setAttribute('aria-label', `${unitWordC()} ${u}${anime ? ', ' + EP_TYPE_LABEL[ty] : ''}`);
        t.textContent = seen[medium()].has(u) ? '\u2713' : '';
        t.onclick = () => {
          if (seen[medium()].has(u)) seen[medium()].delete(u);
          else { seen[medium()].add(u); recordProgress(1); }
          commit();
        };
        const nm = document.createElement('button');
        nm.className='u-name';
        nm.textContent = `${anime ? 'Ep.' : 'Ch.'} ${u}`;
        nm.title = 'Mark everything up to here';
        nm.onclick = () => markThrough(u);
        li.append(t, nm);
        // canon is the silent default; only the exceptions get a badge
        if (anime && ty !== 'manga'){
          const b = document.createElement('span');
          b.className = 'ubadge ' + ty;
          b.textContent = ty === 'filler' ? 'filler' : ty === 'mixed' ? 'mixed' : 'anime only';
          li.appendChild(b);
        }
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
    }
    bookScroll.appendChild(wrap);
  });

  const lt = ARCS.find(a => a.unwritten);
  if (lt){
    const h = document.createElement('div');
    h.className='saga'; h.textContent='Not yet charted';
    const wrap = document.createElement('div');
    wrap.className='arc';
    wrap.innerHTML = `<div class="arc-row" style="opacity:.55">
      <span class="tick" style="border-style:dashed"></span>
      <span class="arc-name"><span class="t">${lt.n}<span class="tag soon">To come</span></span>
      <small>Nobody has been there yet</small></span></div>`;
    bookScroll.append(h,wrap);
  }
  renderTally();
}

function markThrough(u){
  const all = arcsFor(medium()).flatMap(a => unitsOf(a, medium())).sort((a,b)=>a-b);
  const before = seen[medium()].size;
  seen[medium()].clear();
  for (const x of all) if (x <= u) seen[medium()].add(x);
  recordProgress(Math.max(0, seen[medium()].size - before));
  commit();
}

function renderTally(){
  const med = medium();
  const total = totalUnits(med), done = countedSeen(med);
  let doneFil = 0;
  if (med === 'anime') seen[med].forEach(u => { if (isFillerEp(u)) doneFil++; });
  const shownFil = (med === 'anime' && state.settings.countFiller) ? doneFil : 0;
  document.getElementById('tallyBig').textContent = `${done} / ${total} ${unitWord()}s`;
  document.getElementById('tallyPct').textContent = total ? `${Math.round(done/total*100)}%` : '0%';
  document.getElementById('barCanon').style.width = total ? `${(done-shownFil)/total*100}%` : '0';
  document.getElementById('barFil').style.width   = total ? `${shownFil/total*100}%` : '0';
  renderPace();
}

/* ============================================================
   MEDIUM
   ============================================================ */
const mAnime = document.getElementById('mAnime'), mManga = document.getElementById('mManga');
function setMedium(m){
  state.medium = m;
  mAnime.setAttribute('aria-pressed', String(m==='anime'));
  mManga.setAttribute('aria-pressed', String(m==='manga'));
  rebuildStops(); buildRoute();
  persist(); renderBook(); renderCrew(); renderQuickLog();
  if (selected && byId[selected].type==='filler' && m==='manga') deselect();
  else if (selected) select(selected, false);
  draw();
}
mAnime.onclick = () => setMedium('anime');
mManga.onclick = () => setMedium('manga');

/* ============================================================
   PANEL
   ============================================================ */
const panel = document.getElementById('panel');
const sailbtn = document.getElementById('sailbtn');
const veil = document.getElementById('veil');
const stopsAt = id => STOPS.filter(s => s.island===id && !s.pending);

function select(id, fly){
  const isle = byId[id];
  if (!isle) return;
  selected = id;
  const shielded = isShielded(id);
  const isFiller = isle.type === 'filler';
  const arc = isFiller ? ARCS.find(a => a.id === isle.arcId) : null;
  const mine = isFiller ? [] : stopsAt(id);

  const eyebrow = document.getElementById('pEyebrow');
  eyebrow.textContent = isFiller ? 'Anime only — not in the manga' : SEAS[isle.sea].label;
  eyebrow.classList.toggle('fil', isFiller);
  document.getElementById('pName').textContent = shielded ? '???' : isle.n;
  document.getElementById('pSea').textContent = SEAS[isle.sea].label;
  document.getElementById('pArc').textContent = shielded ? 'Hidden'
    : isFiller ? arc.n
    : mine.length ? [...new Set(mine.map(s=>s.arc.n))].join(', ') : 'Not on the route';
  document.getElementById('pRangeK').textContent = unitWordC();
  const units = isFiller ? unitsOf(arc,'anime') : mine.flatMap(s => s.units);
  document.getElementById('pRange').textContent = shielded ? 'Hidden'
    : units.length ? `${units[0]}–${units[units.length-1]}` : '—';

  veil.style.display = shielded ? '' : 'none';
  document.getElementById('pBlurb').style.display = shielded ? 'none' : '';
  document.getElementById('pBlurb').textContent = isle.b;
  renderAnchorage(id);

  const isPending = ARCS.some(a => a.unwritten && a.stops[0]===id);
  const doneHere = units.filter(u => seen[medium()].has(u)).length;

  /* How far through this island are you? Without this the button was a black
     hole — you clicked, something changed somewhere else, and the label never
     moved, so there was no way to know whether to click it again. */
  const prog = document.getElementById('isleProg');
  if (units.length && !shielded){
    prog.style.display = '';
    prog.classList.toggle('fil', isFiller);
    document.getElementById('ipLabel').textContent = `${isFiller ? 'Filler ' : ''}${unitWord()}s here`;
    document.getElementById('ipCount').textContent = `${doneHere} / ${units.length}`;
    requestAnimationFrame(() => {
      document.getElementById('ipBar').style.width = `${doneHere / units.length * 100}%`;
    });
  } else {
    prog.style.display = 'none';
    document.getElementById('ipBar').style.width = '0%';
  }

  sailbtn.className = 'sailbtn' + (isFiller ? ' fil' : '');
  sailbtn.onclick = null;
  const last = units.length ? units[units.length - 1] : null;
  const w = medium() === 'anime' ? 'ep.' : 'ch.';

  if (isPending){
    sailbtn.disabled = true;
    sailbtn.classList.add('na');
    sailbtn.textContent = 'Not written yet';
  } else if (!units.length){
    sailbtn.disabled = true;
    sailbtn.classList.add('na');
    sailbtn.textContent = 'Not on the route';
  } else if (doneHere === units.length){
    sailbtn.disabled = true;                       // nothing left here. Stop taking clicks.
    sailbtn.classList.add('done');
    sailbtn.textContent = isFiller
      ? `✓ Detour taken · all ${units.length} eps`
      : `✓ Sailed · all ${units.length} ${unitWord()}s`;
  } else {
    const left = units.length - doneHere;
    sailbtn.disabled = false;
    sailbtn.textContent = doneHere === 0
      ? (isFiller ? `Take the detour — through ep. ${last}`
                  : `Sail here — through ${w} ${last}`)
      : `Finish this island — ${left} ${unitWord()}${left === 1 ? '' : 's'} left`;
    sailbtn.onclick = () => {
      markThrough(last);
      toast(isFiller ? `Detour taken — ${isle.n} complete`
                     : `Arrived at ${isle.n} · marked through ${w} ${last}`);
    };
  }

  panel.classList.add('open');
  panel.setAttribute('aria-hidden','false');
  if (fly) flyTo(isle);
  draw();
}
document.getElementById('peek').onclick = () => { peeked.add(selected); select(selected,false); };
function deselect(){
  selected = null;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden','true');
  draw();
}
document.getElementById('pclose').onclick = deselect;
SVG.addEventListener('click', e => { if (e.target===SVG || e.target.id==='ocean') deselect(); });

const filters = document.getElementById('filters');
const chips = [['all','All'], ...Object.entries(SEAS).map(([k,v]) => [k, v.short])];
chips.forEach(([key,label]) => {
  const b = document.createElement('button');
  b.className='chip'; b.textContent=label;
  b.setAttribute('aria-pressed', key==='all');
  b.onclick = () => {
    activeSea = key;
    filters.querySelectorAll('.chip').forEach((c,i) => c.setAttribute('aria-pressed', chips[i][0]===key));
    draw();
  };
  filters.appendChild(b);
});

const acctBtn = document.getElementById('acctBtn'), acctMenu = document.getElementById('acctMenu');
const acctDisc = document.getElementById('acctDisc'), acctWho = document.getElementById('acctWho');
function renderAcct(){
  const u = state.user;
  acctDisc.textContent = u ? u.name[0].toUpperCase() : '?';
  acctWho.textContent = u ? u.name : 'Sign in';
  acctMenu.innerHTML = '';
  if (u){
    const head = document.createElement('div');
    head.className='head';
    head.innerHTML = `<span class="n">${u.name}</span><span class="p">via ${u.provider} · ${state.settings.public?'Public':'Private'}</span>`;
    acctMenu.appendChild(head);
    const s = document.createElement('button'); s.textContent='Settings';
    s.onclick = () => { closeAcct(); openModal('settingsModal'); };
    const o = document.createElement('button'); o.textContent='Sign out'; o.className='danger';
    o.onclick = () => {
      if (supabase) supabase.auth.signOut();
      state.user=null; persist(); renderAcct(); closeAcct(); toast('Signed out');
    };
    acctMenu.append(s,o);
  } else {
    const i = document.createElement('button'); i.textContent='Sign in';
    i.onclick = () => { closeAcct(); authMode='signin'; renderAuthMode(); openModal('signinModal'); };
    const s = document.createElement('button'); s.textContent='Settings';
    s.onclick = () => { closeAcct(); openModal('settingsModal'); };
    acctMenu.append(i,s);
  }
}
const closeAcct = () => { acctMenu.classList.remove('open'); acctBtn.setAttribute('aria-expanded','false'); };
acctBtn.onclick = e => {
  e.stopPropagation();
  const open = !acctMenu.classList.contains('open');
  acctMenu.classList.toggle('open', open);
  acctBtn.setAttribute('aria-expanded', String(open));
};
document.addEventListener('click', () => closeAcct());
acctMenu.addEventListener('click', e => e.stopPropagation());

const openModal = id => document.getElementById(id).classList.add('open');
const closeModal = id => document.getElementById(id).classList.remove('open');
document.querySelectorAll('[data-close]').forEach(b => b.onclick = e => e.target.closest('.modal').classList.remove('open'));
document.addEventListener('keydown', e => {
  if (e.key==='Escape'){
    document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    if (book.classList.contains('open')) setBook(false);
  }
});
/* ---- email + password sign-in / sign-up ----
   Our own form; Supabase handles the actual credentials (hashing, sessions,
   resets) — we never store or hash passwords ourselves. onAuthStateChange
   (see PERSISTENCE) picks the session up and merges progress on SIGNED_IN. */
const authForm = document.getElementById('authForm');
const siEmail = document.getElementById('siEmail'), siPass = document.getElementById('siPass');
const siSubmit = document.getElementById('siSubmit'), siErr = document.getElementById('siErr');
const siTitle = document.getElementById('siTitle'), siSub = document.getElementById('siSub');
const siSwapText = document.getElementById('siSwapText'), siToggle = document.getElementById('siToggle');
const siNote = document.getElementById('siNote');
let authMode = 'signin';                            // 'signin' | 'signup'

function showAuthError(msg){ siErr.textContent = msg; siErr.classList.toggle('show', !!msg); }

function renderAuthMode(){
  const up = authMode === 'signup';
  siTitle.textContent = up ? 'Create your account' : 'Sign on to the crew';
  siSubmit.textContent = up ? 'Create account' : 'Sign in';
  siSwapText.textContent = up ? 'Already have an account?' : 'New to the crew?';
  siToggle.textContent = up ? 'Sign in' : 'Create an account';
  siPass.setAttribute('autocomplete', up ? 'new-password' : 'current-password');
  showAuthError('');
  siNote.textContent = supabase ? '' : 'Sign-in isn’t available yet — the app’s backend isn’t configured. Your progress is still saved on this device.';
  siSubmit.disabled = !supabase;
}
siToggle.onclick = () => { authMode = authMode === 'signin' ? 'signup' : 'signin'; renderAuthMode(); };

authForm.addEventListener('submit', async e => {
  e.preventDefault();
  showAuthError('');
  if (!supabase){ showAuthError('Sign-in isn’t configured yet.'); return; }
  const email = siEmail.value.trim(), password = siPass.value;
  if (!email || password.length < 6){ showAuthError('Enter an email and a password of at least 6 characters.'); return; }

  siSubmit.disabled = true;
  const prev = siSubmit.textContent;
  siSubmit.textContent = authMode === 'signup' ? 'Creating…' : 'Signing in…';
  try {
    if (authMode === 'signup'){
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session){
        // email-confirmation is on: no session yet, user must confirm first
        authMode = 'signin'; renderAuthMode();
        siNote.textContent = 'Check your email to confirm your account, then sign in.';
        return;
      }
      // confirmation off → signed straight in; onAuthStateChange takes it from here
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    authForm.reset();
    closeModal('signinModal');
    toast(authMode === 'signup' ? 'Welcome aboard' : 'Signed in');
  } catch (err){
    showAuthError(err?.message || 'Something went wrong — try again.');
  } finally {
    siSubmit.disabled = !supabase;
    siSubmit.textContent = prev;
  }
});

const sPublic=document.getElementById('sPublic'), sCrew=document.getElementById('sCrew');
const sSpoiler=document.getElementById('sSpoiler'), sShowFiller=document.getElementById('sShowFiller');
const sFiller=document.getElementById('sFiller');
function renderSettings(){
  sPublic.setAttribute('aria-checked', String(state.settings.public));
  sCrew.setAttribute('aria-checked', String(state.settings.crew && state.settings.public));
  sCrew.disabled = !state.settings.public;
  sSpoiler.setAttribute('aria-checked', String(state.settings.spoiler));
  sShowFiller.setAttribute('aria-checked', String(state.settings.showFiller));
  sFiller.setAttribute('aria-checked', String(state.settings.countFiller));
  renderAcct();
}
sPublic.onclick = () => {
  state.settings.public = !state.settings.public;
  if (!state.settings.public) state.settings.crew = false;
  persist(); renderSettings();
  if (selected) renderAnchorage(selected);
};
sCrew.onclick = () => {
  if (!state.settings.public) return;
  state.settings.crew = !state.settings.crew;
  persist(); renderSettings();
  if (selected) renderAnchorage(selected);
};
sSpoiler.onclick = () => {
  state.settings.spoiler = !state.settings.spoiler;
  peeked.clear();
  persist(); renderSettings(); renderBook(); renderCrew(); renderQuickLog();
  if (selected) select(selected,false);
  draw();
};
sShowFiller.onclick = () => {
  state.settings.showFiller = !state.settings.showFiller;
  persist(); renderSettings(); draw();
};
sFiller.onclick = () => {
  state.settings.countFiller = !state.settings.countFiller;
  persist(); renderSettings(); renderTally(); draw();
};
document.getElementById('resetVoyage').onclick = () => {
  seen.anime.clear(); seen.manga.clear(); peeked.clear();
  state.history = {anime:{}, manga:{}};
  persist(); renderBook(); renderCrew(); renderQuickLog(); deselect(); draw();
  closeModal('settingsModal');
  toast('Voyage reset — back to Dawn Island');
};

let toastTimer;
function toast(msg, kind){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ============================================================
   PERSISTENCE
   localStorage is the fast, offline working copy — always written first,
   always read first. Supabase is the backup + cross-device sync layered on
   top: writes go out debounced and in the background, and a slow or dead
   connection never blocks using the app. If Supabase isn't configured
   (config.js still has placeholders) or the network is down, everything
   below degrades to exactly the local-only behaviour this app always had.
   ============================================================ */
const KEY='voyage';
let warned=false, saveTimer, remoteTimer;
let lastSyncedSeen = {anime:new Set(), manga:new Set()};   // baseline for the next remote diff

/* seen units as [[a,b],[c],...] — compact for storage, cheap to diff */
function toRanges(nums){
  const sorted = [...nums].sort((a,b)=>a-b);
  const out = [];
  for (const n of sorted){
    const last = out[out.length-1];
    if (last && n === last[1]+1) last[1] = n;
    else out.push([n,n]);
  }
  return out.map(([a,b]) => a===b ? [a] : [a,b]);
}
function fromRanges(ranges){
  const out = new Set();
  (ranges||[]).forEach(r => {
    const [a,b] = r.length===2 ? r : [r[0],r[0]];
    for (let i=a;i<=b;i++) out.add(i);
  });
  return out;
}

const REMOVED_WINDOW = 45*864e5;                  // forget unticks older than this
function pruneRemoved(map){
  const cutoff = Date.now() - REMOVED_WINDOW;
  for (const u in map) if (map[u] < cutoff) delete map[u];
  return map;
}

const snapshot = () => JSON.stringify({
  medium: state.medium,
  seen: {anime:[...seen.anime], manga:[...seen.manga]},
  user: state.user, settings: state.settings, history: state.history,
  removed: state.removed,
});

function persist(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, snapshot()); }
    catch { if (!warned){ warned=true; toast('Progress is kept for this session only'); } }
  }, 400);
  scheduleRemoteSync();
}

function restore(){
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.medium) state.medium = d.medium;
    if (d.user) state.user = d.user;
    if (d.history) state.history = d.history;
    if (d.settings) Object.assign(state.settings, d.settings);
    if (d.removed) state.removed = d.removed;
    (d.seen?.anime||[]).forEach(u => seen.anime.add(u));
    (d.seen?.manga||[]).forEach(u => seen.manga.add(u));
  } catch {}
  lastSyncedSeen = {anime:new Set(seen.anime), manga:new Set(seen.manga)};
}

/* ---- Supabase: cross-device sync ----
   Union by default — progress is additive, so merging never loses a tick.
   Unticking is the rare exception, so it's tracked with a timestamp and
   only wins the tiebreak when it's newer than whatever it's competing with. */
function scheduleRemoteSync(){
  if (!supabase || !state.user?.id) return;
  clearTimeout(remoteTimer);
  remoteTimer = setTimeout(pushRemote, 1500);
}

function diffRemoved(){
  const now = Date.now();
  ['anime','manga'].forEach(med => {
    lastSyncedSeen[med].forEach(u => { if (!seen[med].has(u)) state.removed[med][u] = now; });
  });
}

async function pushRemote(){
  if (!supabase || !state.user?.id) return;
  diffRemoved();
  pruneRemoved(state.removed.anime); pruneRemoved(state.removed.manga);
  try {
    await supabase.from('progress').upsert({
      user_id: state.user.id,
      anime_ranges: toRanges(seen.anime),
      manga_ranges: toRanges(seen.manga),
      history: state.history,
      settings: state.settings,
      removed: state.removed,
      updated_at: new Date().toISOString(),
    });
    lastSyncedSeen = {anime:new Set(seen.anime), manga:new Set(seen.manga)};
  } catch { /* background sync — next edit will just try again */ }
}

function mergeSeen(localSet, remoteSet, localRemoved, remoteRemoved, remoteUpdatedAt){
  const merged = new Set([...localSet, ...remoteSet]);
  for (const u in remoteRemoved)
    if (merged.has(+u) && remoteRemoved[u] > (localRemoved[u]||0)) merged.delete(+u);
  for (const u in localRemoved)
    if (merged.has(+u) && localRemoved[u] >= (remoteUpdatedAt||0)) merged.delete(+u);
  return merged;
}
function mergeHistory(a, b){
  const out = {anime:{...a.anime}, manga:{...a.manga}};
  for (const med of ['anime','manga']) for (const day in (b?.[med]||{}))
    out[med][day] = Math.max(out[med][day]||0, b[med][day]);
  return out;
}

async function pullAndMerge(){
  if (!supabase || !state.user?.id) return;
  try {
    const { data } = await supabase.from('progress').select('*').eq('user_id', state.user.id).maybeSingle();
    if (data){
      const remoteUpdatedAt = new Date(data.updated_at).getTime();
      seen.anime = mergeSeen(seen.anime, fromRanges(data.anime_ranges), state.removed.anime, data.removed?.anime||{}, remoteUpdatedAt);
      seen.manga = mergeSeen(seen.manga, fromRanges(data.manga_ranges), state.removed.manga, data.removed?.manga||{}, remoteUpdatedAt);
      state.history = mergeHistory(state.history, data.history);
      for (const med of ['anime','manga'])
        state.removed[med] = pruneRemoved({ ...(data.removed?.[med]||{}), ...state.removed[med] });
    }
  } catch { /* offline, or first sign-in with no row yet — local state stands as-is */ }
  lastSyncedSeen = {anime:new Set(seen.anime), manga:new Set(seen.manga)};
  persist();
  await pushRemote();
}

function setupAuth(){
  if (!supabase) return;
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user){
      const meta = session.user.user_metadata || {};
      const email = session.user.email || '';
      state.user = {
        id: session.user.id,
        name: meta.full_name || meta.name || email.split('@')[0] || 'Navigator',
        provider: session.user.app_metadata?.provider || 'email',
      };
      renderAcct(); renderSettings();
      if (event === 'SIGNED_IN') pullAndMerge().then(() => { renderBook(); renderCrew(); draw(); });
    } else if (event === 'SIGNED_OUT'){
      state.user = null;
      renderAcct(); renderSettings();
    }
  });
}

function commit(){
  const before = new Set(crewAboard().map(c => c.id));
  persist();
  rebuildStops();
  renderBook();
  const joined = crewAboard().filter(c => !before.has(c.id));
  renderCrew();
  renderQuickLog();
  if (selected) select(selected, false);
  draw();
  if (joined.length) toast(`${joined.map(c => c.n).join(' and ')} joined your crew`, 'crew');
}

window.addEventListener('resize', () => { clampView(); draw(); });
(() => {
  restore();
  setupAuth();
  mAnime.setAttribute('aria-pressed', String(state.medium==='anime'));
  mManga.setAttribute('aria-pressed', String(state.medium==='manga'));
  rebuildStops(); buildRoute(); renderAcct(); renderSettings(); renderCrew(); renderQuickLog(); renderAuthMode(); applyVoyageCollapsed();
  requestAnimationFrame(() => {
    for (const id in nodes){
      const {lbl} = nodes[id];
      lbl.setAttribute('font-size', 100);
      nodes[id].w100 = lbl.getComputedTextLength();
    }
    renderBook(); fit();
  });
})();
