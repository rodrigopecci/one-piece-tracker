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
import { ThreeWorldMap } from './three-world.js?v=5';
import { mergeProgressState, pruneChangeMap, setsEqual } from './sync-progress.js?v=1';

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
   b:'The only way in. Currents from all four Blues climb the mountain and pour down into the Grand Line.',
   lore:'To enter the Grand Line you sail a canal up the mountainside, crest the summit, and plunge down the far side into the corridor. Read the entry wrong and the Red Line ends your voyage before it begins.'},
  {id:'twin-cape', n:'Twin Cape', x:1082, y:1252, sea:'paradise', type:'island',
   b:'A lighthouse at the foot of the mountain, where a whale has been waiting fifty years.',
   lore:'The whale batters its head against the Red Line, still waiting for a crew that promised to return and sailed on without it. Its lone keeper tends both the light and the wound.'},
  {id:'whisky-peak', n:'Whisky Peak', x:1245, y:1138, sea:'paradise', type:'island',
   b:'Cactus-shaped rock and a welcome party that never ends. Every citizen is a bounty hunter.',
   lore:'Beneath the songs and the endless hospitality, the whole town works for a secret criminal organisation, quietly appraising each new arrival for the price on their head.'},
  {id:'little-garden', n:'Little Garden', x:1425, y:1262, sea:'paradise', type:'island', major:true,
   b:'A prehistoric island where two giants have duelled for a century over a question nobody remembers.',
   lore:'Time stopped a million years ago here — dinosaurs, giant beasts, primeval jungle. Two warriors from the giants’ homeland fight a daily duel that has outlasted the reason they began it.'},
  {id:'drum-island', n:'Drum Island', x:1600, y:1132, sea:'paradise', type:'island', major:true,
   b:'A winter kingdom of snow and rose-coloured peaks, with a castle that climbs the mountainside.',
   lore:'A snowbound country once famous for the finest doctors in the sea — until a cruel king drove them all away. Twenty peaks ring it, and a rope-way climbs to a castle above the clouds.'},
  {id:'alabasta', n:'Alabasta', x:1785, y:1258, sea:'paradise', type:'island', major:true,
   b:'A desert kingdom of rivers gone dry, a rebel army, and a king blamed for a drought he did not cause.',
   lore:'One of the twenty kingdoms that founded the World Government, ruled by the Nefertari line for millennia. A manufactured drought has turned its people against their king and lit the fuse of civil war.'},
  {id:'jaya', n:'Jaya', x:1975, y:1150, sea:'paradise', type:'island', major:true,
   b:'Half an island. The other half was carried into the sky four hundred years ago.',
   lore:'What remains is a rough port of pirates, brawlers and bounty hunters. Old sailors here still trade the tall tale of a city of gold that once stood on the missing half.'},
  {id:'skypiea', n:'Skypiea', x:2015, y:1108, sea:'paradise', type:'sky', major:true,
   b:'A country in the clouds above Jaya, ruled by a self-declared god, built on a missing city of gold.',
   lore:'Reached only by a freak column of rising sea, a serene white land on the clouds. Its one harsh law: everything on the sacred ground belongs to God, and trespassers are judged without appeal.'},
  {id:'long-ring', n:'Long Ring Long Land', x:2170, y:1268, sea:'paradise', type:'island',
   b:'A long thin island of tall thin things, and a game with your ship as the stake.',
   lore:'Home of the Davy Back Fight, a pirate contest where the losers forfeit their crewmates and their flag. Even the animals here are stretched improbably long.'},
  {id:'water-7', n:'Water 7', x:2360, y:1128, sea:'paradise', type:'island', major:true,
   b:'The city of water and the world’s finest shipwrights, slowly sinking into its own canals.',
   lore:'A bay-city that floods with the tide, crossed by canals and yagara-bull gondolas. Its shipwrights are the best afloat — and its shipyards keep a heavy secret about the government.'},
  {id:'enies-lobby', n:'Enies Lobby', x:2490, y:1265, sea:'paradise', type:'island', major:true,
   b:'The judicial island. Reached by sea train, it never sleeps, and nobody leaves acquitted.',
   lore:'A government island where the sun never sets, reached across the sea by rail. Here the World Government’s justice is absolute, and the great door of its courthouse opens only one way.'},
  {id:'thriller-bark', n:'Thriller Bark', x:2645, y:1140, sea:'paradise', type:'island', major:true,
   b:'The largest ship ever built, drifting through the fog of the Florian Triangle, stealing shadows.',
   lore:'A haunted ghost-ship as big as an island, adrift in a fog where vessels and their crews vanish. On board, shadows are cut from the living to give the dead a semblance of life.'},
  {id:'sabaody', n:'Sabaody Archipelago', x:2880, y:1120, sea:'paradise', type:'island', major:true,
   b:'A grove of mangroves that breathe bubbles. The last stop before the Red Line — and a slave market.',
   lore:'Not one island but a grove of giant mangroves leaking coating-bubbles, the lawless threshold of the Red Line. Beneath its amusement-park surface runs an infamous human auction.'},
  {id:'amazon-lily', n:'Amazon Lily', x:2650, y:1400, sea:'paradise', type:'island', major:true,
   b:'Hidden in the Calm Belt, in the Sea Kings’ nursery. An island of women; men are not permitted.',
   lore:'The secret home of the Kuja, a tribe of warrior women deep in the Calm Belt. No man may set foot there and live — which makes it the last place in the world anyone would think to look for one.'},
  {id:'impel-down', n:'Impel Down', x:2800, y:1450, sea:'paradise', type:'undersea', major:true,
   b:'The great prison beneath the sea, six levels deep. Officially, nobody has ever escaped.',
   lore:'The World Government’s underwater fortress, six descending levels each crueller than the last, from Crimson Hell to the frozen floor at the bottom. Its warden boasts of a flawless record.'},
  {id:'marineford', n:'Marineford', x:2900, y:1288, sea:'paradise', type:'island', major:true,
   b:'Marine Headquarters, in the shadow of the Red Line. A fortified bay built to hold a war.',
   lore:'The Marine stronghold facing the holy land across the water, a fortress-town inside a walled bay. When the balance of the world is threatened, every admiral and warship converges here.'},
  {id:'mary-geoise', n:'Mary Geoise', x:3000, y:1120, sea:'paradise', type:'landmark', major:true,
   b:'The holy land, on top of the Red Line. Home of the Celestial Dragons and an empty throne.',
   lore:'The seat of world power atop the Red Line, where nobles who style themselves gods live above the clouds. Once a year the kings of the world gather here beneath a throne that no one is said to sit upon.'},
  {id:'fishman-island', n:'Fish-Man Island', x:3000, y:1285, sea:'paradise', type:'undersea', major:true,
   b:'Ten thousand metres down, beneath the Red Line, inside a bubble. The gateway to the New World.',
   lore:'A city in a giant bubble on the deep-sea floor, lit by sunlight piped down from above and warmed by a sunken forest. Fish-men and merfolk live here, wary of a surface world that has wronged them before.'},
  {id:'punk-hazard', n:'Punk Hazard', x:3180, y:1250, sea:'newworld', type:'island', major:true,
   b:'Burning on one half, frozen on the other. A research island that was never cleaned up.',
   lore:'A government laboratory torn by an old disaster into an inferno and a frozen waste, sealed off and struck from the maps as uninhabitable — though the experiments there never quite stopped.'},
  {id:'dressrosa', n:'Dressrosa', x:3340, y:1155, sea:'newworld', type:'island', major:true,
   b:'A kingdom of passion, flowers and living toys — and a colosseum with a Devil Fruit as the prize.',
   lore:'A radiant kingdom where clockwork toys walk and work alongside people, its colosseum drawing fighters from across the sea. Its beloved king rules with a smile the country has learned never to question.'},
  {id:'green-bit', n:'Green Bit', x:3388, y:1128, sea:'newworld', type:'island',
   b:'A forest island joined to Dressrosa by an iron bridge, home to a race thought extinct.',
   lore:'A wild, uninhabited forest linked to Dressrosa only at low tide, across a strait patrolled by fighting fish. It shelters the Tontatta — a tiny long-nosed people the outside world takes for a fairy tale.'},
  {id:'zou', n:'Zou', x:3570, y:1275, sea:'newworld', type:'island', major:true,
   b:'A country on the back of a thousand-year-old elephant that has never stopped walking.',
   lore:'An entire land riding a colossal elephant that has walked the sea for a millennium under a sentence no one remembers passing. The Mink tribe guards it, along with a piece of the world’s buried history.'},
  {id:'whole-cake', n:'Whole Cake Island', x:3735, y:1150, sea:'newworld', type:'island', major:true,
   b:'The seat of an Emperor, in a territory where the land is edible and the trees can talk.',
   lore:'The stronghold of one of the four Emperors, in a domain where the earth, rivers and forests are made of sweets. An army of homies — objects given souls and faces — watches every guest who arrives.'},
  {id:'wano', n:'Wano Country', x:3900, y:1272, sea:'newworld', type:'island', major:true,
   b:'A closed country behind a waterfall, ruled by a shogun, cut off from the world for centuries.',
   lore:'An isolationist land of samurai walled off by towering waterfalls, sealed to outsiders for generations. Its borders are watched, its ports shut, and its true history deliberately buried.'},
  {id:'weatheria', n:'Weatheria', x:3330, y:740, sea:'newworld', type:'sky',
   b:'A sky island where weather is a science — studied, grown, bottled, and thrown.',
   lore:'A tiny island in the clouds where scholars study, cultivate and bottle the weather itself, turning rain, wind and lightning into instruments — and, at need, into weapons.'},
  {id:'egghead', n:'Egghead', x:190, y:1170, sea:'newworld', type:'island', major:true,
   b:'The future island: a laboratory five hundred years ahead of the world it belongs to.',
   lore:'The island of the future, home to the government’s greatest scientist and to technology centuries ahead of its age. Robots, impossible machines and half-mad ideas fill a laboratory that ought not to exist yet.'},
  {id:'elbaf', n:'Elbaf', x:440, y:1265, sea:'newworld', type:'island', major:true,
   b:'The village of the giants, where disputes are settled by combat and the god of war is watching.',
   lore:'The fabled warrior nation of the giants, where every quarrel is laid before Elbaf’s god of war and settled by strength alone. To smaller folk it is a name out of childhood stories.'},

  {id:'rusukaina', n:'Rusukaina', x:2540, y:1440, sea:'paradise', type:'island',
   b:'A brutal, uninhabited island near Amazon Lily — the empty kingdom where only the strong survive.',
   lore:'No people live here, only five hundred beasts fiercer than any human, across an island of forty-eight shifting seasons. It is where a warrior goes to be broken down and rebuilt, with nothing to lean on but themselves.'},
  {id:'boin', n:'Boin Archipelago', x:1300, y:1520, sea:'paradise', type:'island',
   b:'A lush paradise in the Calm Belt that welcomes you with endless food — and quietly never lets you leave.',
   lore:'The whole archipelago is one enormous carnivorous ecosystem. It feeds its visitors, fattens them, and lets its ravenous plants and beasts do the rest. Idyllic, abundant, and a slow trap.'},
  {id:'kuraigana', n:'Kuraigana Island', x:2620, y:1560, sea:'paradise', type:'island', major:true,
   b:'A gloomy, overgrown island in the ruins of a lost kingdom, wrapped in perpetual dusk.',
   lore:'The abandoned Shikkearu Kingdom, swallowed by forest and by humandrills that learned to fight from the swordsmen they once watched. The greatest swordsman in the world keeps a castle here, alone but for the graves.'},
  {id:'namakura', n:'Namakura Island', x:2120, y:1500, sea:'paradise', type:'island',
   b:'An island in the Grand Line’s grimmest reaches, where hunger is the daily occupation.',
   lore:'Part of the Harahettania waters, a region of near-perpetual want where the long-armed and long-legged tribes scrape by. A hard place to be shipwrecked — and a harder place to leave.'},
  {id:'kamabakka', n:'Kamabakka Kingdom', x:2450, y:1005, sea:'paradise', type:'island',
   b:'The kingdom of the okama on Momoiro Island — a riot of colour, cooking and attitude.',
   lore:'A nation devoted to living exactly as one pleases, where the New Kama Kenpo is a genuine martial art. Its flamboyant queen is also one of the Revolutionary Army’s most formidable commanders.'},

  {id:'dawn-island', n:'Dawn Island', x:1860, y:600, sea:'east', type:'island', major:true,
   b:'Foosha Village, the Goa Kingdom, and the Grey Terminal. Where the voyage began.',
   lore:'An East Blue island split between a gilded city and the vast rubbish-heap beneath it. In its forests three sworn brothers grew up dreaming of the day each would sail his own sea.'},
  {id:'shells-town', n:'Shells Town', x:1740, y:520, sea:'east', type:'island', major:true,
   b:'A Marine base run by a captain who let his son do the ruling. A swordsman was tied up in its yard.',
   lore:'An East Blue garrison where a Marine captain rules by fear and lets his spoiled son do as he likes. A soon-to-be-notorious swordsman is bound to a post in its yard, refusing to beg for his life.'},
  {id:'orange-town', n:'Orange Town', x:1600, y:600, sea:'east', type:'island',
   b:'A town emptied by a clown, its buildings taken apart piece by piece.',
   lore:'A seaside town methodically dismantled and driven out, house by house, by a clown-pirate’s crew that treats terror as entertainment.'},
  {id:'syrup-village', n:'Syrup Village', x:1470, y:575, sea:'east', type:'island',
   b:'A quiet village on the Gecko Islands, where a boy cries pirate every morning.',
   lore:'A sleepy village on the Gecko Islands where a boy famous for false alarms guards a lonely mansion — and, for once, the pirates he shouts about turn out to be real.'},
  {id:'baratie', n:'Baratie', x:1360, y:800, sea:'east', type:'island', major:true,
   b:'A restaurant that sails. The cooks fight as well as they cook, and nobody hungry is turned away.',
   lore:'A ship built as a floating restaurant on the open sea, crewed by cooks who brawl as fiercely as they plate. Its ironclad rule: no one who is starving is ever refused a meal.'},
  {id:'conomi', n:'Conomi Islands', x:1240, y:560, sea:'east', type:'island',
   b:'Tangerine groves, and a village paying tribute to fish-men. Home of a cartographer.',
   lore:'Tangerine groves in the East Blue crushed under a fish-man crew that taxes every villager. A young cartographer draws maps and hoards coins toward a desperate, secret bargain.'},
  {id:'loguetown', n:'Loguetown', x:1110, y:820, sea:'east', type:'island', major:true,
   b:'The town of the beginning and the end: where the Pirate King was born, and where he died.',
   lore:'The East Blue town where the King of the Pirates was born and, years later, publicly executed. His final words on the scaffold lit the fuse of the Great Age of Pirates.'},
  {id:'shimotsuki', n:'Shimotsuki Village', x:1935, y:745, sea:'east', type:'island',
   b:'A village with a dojo, a promise between two children, and a sword left behind.',
   lore:'An East Blue village built around a swordsman’s dojo, where a promise between two child rivals set one of them on a lifelong road toward becoming the world’s greatest blade.'},

  {id:'flevance', n:'Flevance', x:560, y:430, sea:'north', type:'island', major:true,
   b:'The White Town, rich on a white lead that was quietly killing everyone who touched it.',
   lore:'The North Blue’s White Town, made wealthy by a beautiful pale mineral its people never suspected was slowly poisoning them — a truth the wider world knew and chose to hide.'},
  {id:'lvneel', n:'Lvneel Kingdom', x:650, y:620, sea:'north', type:'island',
   b:'The kingdom that sent an explorer to find a city of gold, and hanged him when he came back.',
   lore:'A North Blue kingdom whose explorer returned from a voyage to the sky with a wild tale of a golden city — and was executed for a lie the crown could not bring itself to believe.'},
  {id:'spider-miles', n:'Spider Miles', x:470, y:700, sea:'north', type:'island',
   b:'A scrapyard country of rust and rain, downstream of everything the North throws away.',
   lore:'A ruined North Blue country of endless rain and rusting scrap, where everything the north discards eventually washes up and is picked over by those left behind.'},
  {id:'germa', n:'Germa Kingdom', x:740, y:470, sea:'north', type:'roaming', major:true,
   b:'A kingdom with no fixed shore. It sails, it fights other people’s wars, and it charges by the day.',
   lore:'A North Blue kingdom with no fixed coast — once a conqueror, now a science-army for hire. Its royal children were engineered as soldiers, and the Vinsmoke name is feared far beyond its origin.'},
  {id:'karakuri', n:'Karakuri Island', x:400, y:560, sea:'north', type:'island', major:true,
   b:'A frozen North Blue island of scrap, cola and clockwork, where tinkerers build the impossible.',
   lore:'The birthplace of the world’s foremost inventor — and of others who came up among its junkyards and steam. Cola drives everything here, and nothing is ever truly thrown away.'},

  {id:'ohara', n:'Ohara', x:540, y:1800, sea:'west', type:'island', major:true,
   b:'An island of scholars and one enormous tree of books. The World Government erased it in an afternoon.',
   lore:'A West Blue island of archaeologists gathered around a vast Tree of Knowledge, who dared to study the one stretch of history the World Government forbids — and paid for it with everything they had.'},
  {id:'baterilla', n:'Baterilla', x:1280, y:1760, sea:'south', type:'island',
   b:'A quiet island the Marines combed for a year, hunting a child who was never born on time.',
   lore:'A South Blue island the Marines searched for over a year, hunting a newborn they never found — because its mother did the impossible and refused to let it be born on schedule.'},
  {id:'sorbet', n:'Sorbet Kingdom', x:1540, y:1715, sea:'south', type:'island',
   b:'A small kingdom whose king gave everything away, and then gave himself away too.',
   lore:'A small South Blue kingdom whose gentle king surrendered his wealth, his crown and at last his own freedom, for reasons the world would not understand until long afterward.'},
  {id:'torino', n:'Torino Kingdom', x:1400, y:1930, sea:'south', type:'island',
   b:'A South Blue island of enormous birds and the tiny people who ride them, above a jungle of beasts.',
   lore:'Its people live high in a single giant tree, safe from the monstrous animals prowling the jungle floor, hunting and travelling on the backs of great birds. Outsiders seldom arrive, and seldom leave unchanged.'},

  {id:'baltigo', n:'Baltigo', x:110, y:1470, sea:'newworld', type:'island', major:true,
   b:'A windswept island of white earth, hidden in the New World — the base of those who defy the world itself.',
   lore:'The stronghold of the Revolutionary Army, who wage their war not on pirates but on the world’s rulers, toppling tyrant kingdoms from the shadows. Their leader is among the most wanted men alive.'},
  {id:'hachinosu', n:'Hachinosu', x:330, y:1480, sea:'newworld', type:'island', major:true,
   b:'The pirates’ island: a lawless free port in the New World where the hunted hide and the desperate deal.',
   lore:'A haven built on the sea by outlaws and ruled by one of the four Emperors. Bounties mean nothing here but a price — on this island everything, and everyone, is for sale.'},
  {id:'sphinx', n:'Sphinx', x:250, y:1055, sea:'newworld', type:'island',
   b:'A small, peaceful island in the New World, fiercely watched over by the crew that calls it home.',
   lore:'The birthplace of the strongest man the seas have known. Long after his story ended, the quiet island he came from is still guarded by those who once sailed under his flag.'},
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
  {saga:"Water 7", id:"oceans-dream", n:"Ocean's Dream", ep:[220,224], detour:true, spot:"Ocean's Dream"},
  {saga:"Water 7", id:"foxy-return", n:"Foxy's Return", ep:[225,226], detour:true, offRoute:true, noIsland:true},
  {saga:"Water 7", id:"water-7", n:"Water 7", ep:[227,263], ch:[322,374], stops:["water-7"]},
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
  if (sea === 'west' || sea === 'south')        return [SOUTH_EDGE + 70, H - 90];
  return [90, NORTH_EDGE - 70];                                  // north / east (both top)
}
function makeFillerIslands(){
  const out = [];
  let side = 1;
  ARCS.forEach((arc, idx) => {
    if (!arc.detour || arc.noIsland) return;
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
  removed:{anime:{}, manga:{}},        // unit -> ms timestamp, recently unticked
  added:{anime:{}, manga:{}},          // unit -> ms timestamp, recently ticked/re-ticked
};
const seen = {anime:new Set(), manga:new Set()};
let selected = null, hovered = null, activeSea = 'all';
const openArcs = new Set();
const peeked = new Set();

/* Record the user's operation at the same moment the visible set changes.
   Waiting until the cloud write used to let its stale checked range merge the
   unit back in before an uncheck had a timestamp. */
function markSeen(med, unit, at = Date.now()){
  const changed = !seen[med].has(unit);
  seen[med].add(unit);
  if (changed || state.removed[med][unit]) state.added[med][unit] = at;
  delete state.removed[med][unit];
  return changed;
}
function unmarkSeen(med, unit, at = Date.now()){
  if (!seen[med].delete(unit)) return false;
  state.removed[med][unit] = at;
  delete state.added[med][unit];
  return true;
}
function clearSeen(med){
  const at = Date.now();
  for (const unit of [...seen[med]]) unmarkSeen(med, unit, at);
}

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
  // The route deliberately ends at Elbaf. Nobody knows what comes after it, so
  // the chart charts nothing beyond — no Laugh Tale, no Lodestar, no line into
  // the unknown — until the story actually gets there.
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
/* How far through a single island's episodes you are — the intra-arc progress
   the route line can't show, since a leg only turns red once you've cleared the
   whole island and moved on. Measured on significant units (filler excluded). */
function islandProgress(id){
  const use = sigOr(STOPS.filter(s => s.island === id).flatMap(s => s.units), medium());
  if (!use.length) return null;
  const done = use.filter(u => seen[medium()].has(u)).length;
  return {done, total: use.length, frac: done / use.length};
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

/* Spoiler shield + filler visibility — small helpers the whole app reads. */
const fillerShown = () => medium()==='anime' && state.settings.showFiller;
const isShielded = id =>
  state.settings.spoiler && !peeked.has(id) && !reachedIslands().has(id)
  && id !== positionIsland() && !(byId[id].type==='filler' && seenIn(ARCS.find(a=>a.id===byId[id].arcId), medium()) > 0);

/* ============================================================
   THE THREE.JS GLOBE
   The tracker, account, search, log book and persistence code below is the
   production application. Only its renderer is swapped for this adapter.
   ============================================================ */
const stage = document.getElementById('stage');
const cvs = document.getElementById('globe');
const labelLayer = document.getElementById('labelLayer');
let mapReady = false;
let mapZoom = 1;

const threeMap = new ThreeWorldMap({
  canvas:cvs,
  container:stage,
  labelLayer,
  islands:ISLANDS,
  onSelect:id => id ? select(id, true) : deselect()
});

function mapViewState(){
  const reached = reachedIslands();
  const hereId = positionIsland();
  const next = nextStop();
  const nextId = next?.island || null;
  const statusById = new Map();
  const shieldedIds = new Set();
  const progressById = new Map();
  const fillerDoneIds = new Set();

  for (const island of ISLANDS){
    const status = island.id === hereId ? 'here'
      : reached.has(island.id) ? 'sailed'
      : island.id === nextId ? 'next'
      : 'unreached';
    statusById.set(island.id, status);
    if (isShielded(island.id)) shieldedIds.add(island.id);
    const progress = islandProgress(island.id);
    if (progress) progressById.set(island.id, progress.frac);
    if (island.type === 'filler'){
      const arc = ARCS.find(item => item.id === island.arcId);
      if (arc && seenIn(arc, medium()) > 0) fillerDoneIds.add(island.id);
    }
  }

  const routeStops = [];
  for (const stop of STOPS){
    const item = {id:stop.island,reached:stopReached(stop)};
    if (routeStops.at(-1)?.id === item.id) routeStops[routeStops.length - 1].reached ||= item.reached;
    else routeStops.push(item);
  }

  return {
    medium:medium(),selectedId:selected,hereId,nextId,statusById,shieldedIds,progressById,
    routeStops,fillerVisible:fillerShown(),fillerDoneIds
  };
}

function draw(){
  threeMap.update(mapViewState());
  if (mapReady){ updatePose(); updateBehind(); }
}

function buildRoute(){ threeMap.routeSignature = ''; }
function buildMarkers(){}
function buildDetourLines(){ threeMap.routeSignature = ''; }
function setZoom(value){ mapZoom = Math.max(0.72, Math.min(5, value)); threeMap.setZoom(mapZoom); }
function flyTo(isle){ if (isle) threeMap.focusIsland(isle.id); }
function fit(){ mapZoom = 1; threeMap.reset(); draw(); }
function gresize(){ threeMap.resize(); }

document.getElementById('zin').onclick = () => setZoom(threeMap.camera.zoom * 1.35);
document.getElementById('zout').onclick = () => setZoom(threeMap.camera.zoom / 1.35);
document.getElementById('zhere').onclick = () => threeMap.focusIsland(positionIsland());
document.getElementById('zfit').onclick = fit;

new ResizeObserver(gresize).observe(stage);
window.addEventListener('resize', gresize);
gresize();

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
/* "Next up" is the next unit AFTER the furthest you've watched — not the
   lowest gap. So skipping the Warship Island fillers back in East Blue doesn't
   leave you pointed at ep 54 while you're actually at Water 7; it always moves
   forward with you. When you're not counting filler (Settings → "Count filler
   toward progress" off) it also steps over filler episodes, since you skip them. */
function nextUnitToMark(med){
  const last = med === 'anime' ? LAST_EP : LAST_CH;
  let maxSeen = 0;
  seen[med].forEach(u => { if (u > maxSeen) maxSeen = u; });
  const skipFiller = med === 'anime' && !state.settings.countFiller;
  for (let u = maxSeen + 1; u <= last; u++){
    if (skipFiller && isFillerEp(u)) continue;
    return u;
  }
  return null;                       // nothing further — caught up
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
  // Title, spoiler-gated like everywhere else — the next unit is unwatched, so it
  // only shows with the shield off. Lazy-load its block, then re-render.
  ensureContent(med, u, u, renderQuickLog);
  const info = unitInfo(med, u);
  document.getElementById('qlogT').textContent = (info && unitRevealed(med, u)) ? info.t : '';
  C.textContent = shielded || !arc ? 'Uncharted waters ahead' : arc.n;   // arc only — no duplicate island name
  mark.disabled = false;
  mark.textContent = med === 'anime' ? '✓ Mark watched' : '✓ Mark as read';
}
document.getElementById('qlogMark').onclick = () => {
  const med = medium();
  const u = nextUnitToMark(med);
  if (u === null) return;
  markSeen(med, u);
  recordProgress(1);
  commit();                          // re-renders map, book, crew, pose + quick-log
};

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
/* A day with more than this many marks is treated as data entry / a catch-up
   import, not viewing, and excluded from the pace average — otherwise importing
   400 episodes would claim you watch 400 a day. 40 is a heavy-but-real binge
   ceiling (a genuine One Piece binge still counts; a hundreds-strong import
   doesn't). */
const BULK = 40;
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
  if (days.length < 2) return null;
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
  const word = unitWord();
  const remaining = totalUnits(medium()) - countedSeen(medium());
  if (remaining <= 0){
    v.textContent = 'All caught up';
    s.textContent = p ? `You averaged ${p.toFixed(1)} ${word}s a day getting here.`
                      : `You've reached the frontier — nowhere left to sail.`;
  } else if (p){
    v.textContent = `${p.toFixed(1)} ${word}s a day`;
    s.textContent = `${remaining.toLocaleString()} to go · finish in ${humanEta(remaining/p)}`;
  } else {
    // No viewing pace yet (fresh, or only big catch-up days) — still show the
    // useful number instead of a dead end.
    v.textContent = `${remaining.toLocaleString()} ${word}s to go`;
    s.textContent = `Mark a couple of days of ${medium()==='anime' ? 'watching' : 'reading'} and I’ll estimate your finish date.`;
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
  const aboard = new Set(crewAboard().map(c => c.id));
  /* One cumulative portrait: crew-1 is just Luffy, crew-2 adds Zoro, and so
     on in join order \u2014 so the image is simply crew-<how many are aboard>. */
  const n = Math.max(1, Math.min(CREW.length, aboard.size));
  const img = document.getElementById('crewImg');
  img.src = `images/crew-${n}.png`;
  img.alt = `Your crew \u2014 ${n} aboard`;
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

/* ============================================================
   UNIT CONTENT — Viz/official titles + short summaries, lazy-loaded from
   data/<kind>/<block>.json in 100-unit blocks, only for arcs you actually
   open. This is reference data and lives in git like ARCS, not the database;
   a missing file or being offline just means no titles, same as before.
   ============================================================ */
const content = { anime:{}, manga:{} };
const loadedBlocks = { anime:new Set(), manga:new Set() };
const blockPromises = { anime:{}, manga:{} };
const contentDir = med => med === 'anime' ? 'episodes' : 'chapters';

function loadContentBlock(med, block){
  if (loadedBlocks[med].has(block)) return Promise.resolve();
  if (blockPromises[med][block]) return blockPromises[med][block];
  const p = (async () => {
    try {
      const res = await fetch(`data/${contentDir(med)}/${block}.json`);
      if (res.ok) Object.assign(content[med], await res.json());
    } catch { /* offline / not scraped yet — the app works fine without titles */ }
    loadedBlocks[med].add(block);
  })();
  blockPromises[med][block] = p;
  return p;
}
/* Ensure the block(s) covering units [from..to] are in memory; returns true if
   they already are, else kicks off the fetch and calls `after` once loaded. */
function ensureContent(med, from, to, after){
  const need = [];
  for (let b = Math.floor(from / 100); b <= Math.floor(to / 100); b++)
    if (!loadedBlocks[med].has(b)) need.push(b);
  if (!need.length) return true;
  Promise.all(need.map(b => loadContentBlock(med, b))).then(() => after && after());
  return false;
}
const unitInfo = (med, u) => content[med][u] || null;
/* Titles/summaries are spoilers — same rule as the island shield: shown only
   for units you've reached, or when the spoiler shield is off. */
const unitRevealed = (med, u) => !state.settings.spoiler || seen[med].has(u);
const unitTag = (med, u) => `${med === 'anime' ? 'Ep.' : 'Ch.'} ${u}`;

let bookReloadT;
const scheduleBook = () => { clearTimeout(bookReloadT); bookReloadT = setTimeout(renderBook, 30); };

/* ---- unit-detail modal (title + full short summary) ---- */
let umUnit = null, umReveal = false;
function openUnit(u){
  umUnit = u; umReveal = false;
  openModal('unitModal');
  ensureContent(medium(), u, u, () => { if (umUnit === u) fillUnitModal(); });
  fillUnitModal();
}
function fillUnitModal(){
  const med = medium(), u = umUnit;
  if (u == null) return;
  const c = unitInfo(med, u);
  const revealed = unitRevealed(med, u) || umReveal;
  document.getElementById('umKind').textContent = med === 'anime' ? 'Episode' : 'Chapter';
  document.getElementById('umTitle').textContent = (revealed && c) ? `${unitTag(med, u)} — ${c.t}` : unitTag(med, u);
  const veil = document.getElementById('umVeil'), sum = document.getElementById('umSum');
  veil.style.display = revealed ? 'none' : '';
  sum.style.display = revealed ? '' : 'none';
  if (revealed)
    sum.textContent = (c && c.s) ? c.s
      : c ? 'No summary written for this one yet.'
      : (loadedBlocks[med].has(Math.floor(u / 100)) ? 'No summary available.' : 'Loading…');
  const mark = document.getElementById('umMark'), has = seen[med].has(u);
  mark.textContent = has ? '✓ Marked — tap to unmark' : `Mark ${med === 'anime' ? 'watched' : 'read'}`;
  mark.onclick = () => {
    if (seen[med].has(u)) unmarkSeen(med, u);
    else { markSeen(med, u); recordProgress(1); }
    commit(); fillUnitModal();
  };
  const thr = document.getElementById('umThrough');
  thr.textContent = `Mark everything up to ${unitTag(med, u)}`;
  thr.onclick = () => { markThrough(u); fillUnitModal(); };
}
document.getElementById('umReveal').onclick = () => { umReveal = true; fillUnitModal(); };

/* ---- "Now reading/watching" — the current unit, inside the island panel ---- */
function renderNowReading(isle, useUnits, shielded){
  const box = document.getElementById('nowRead');
  const med = medium();
  const cur = shielded ? null : useUnits.find(u => !seen[med].has(u));
  if (cur == null){ box.style.display = 'none'; return; }
  box.style.display = '';
  ensureContent(med, cur, cur, () => { if (selected === isle.id) renderNowReading(isle, useUnits, isShielded(isle.id)); });
  const c = unitInfo(med, cur), revealed = unitRevealed(med, cur);
  document.getElementById('nrLabel').textContent = med === 'anime' ? 'Next to watch' : 'Next to read';
  document.getElementById('nrN').textContent = unitTag(med, cur);
  document.getElementById('nrT').textContent = (revealed && c) ? c.t
    : c ? 'Hidden — spoiler shield is on'
    : (loadedBlocks[med].has(Math.floor(cur / 100)) ? '(untitled)' : 'Loading…');
  document.getElementById('nrUnit').onclick = () => openUnit(cur);
  const mark = document.getElementById('nrMark');
  mark.textContent = `Mark ${med === 'anime' ? 'watched' : 'read'} & go to next`;
  mark.onclick = () => { markSeen(med, cur); recordProgress(1); commit(); };  // commit re-runs select → advances
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
        if (all) unmarkSeen(medium(), u);
        else if (markSeen(medium(), u)) added++;
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
      ensureContent(medium(), units[0], units[units.length-1], scheduleBook);  // titles for this arc
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
          if (seen[medium()].has(u)) unmarkSeen(medium(), u);
          else { markSeen(medium(), u); recordProgress(1); }
          commit();
        };
        const nm = document.createElement('button');
        nm.className='u-name';
        const info = unitInfo(medium(), u);
        if (info && (!state.settings.spoiler || seen[medium()].has(u))){
          nm.textContent = `${anime ? 'Ep.' : 'Ch.'} ${u} — `;
          const ut = document.createElement('span'); ut.className = 'ut'; ut.textContent = info.t;
          nm.appendChild(ut);
        } else {
          nm.textContent = `${anime ? 'Ep.' : 'Ch.'} ${u}`;
        }
        nm.title = 'Details & summary';
        nm.onclick = () => openUnit(u);
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
  // Additive: mark everything up to u, and never unmark what's already beyond it.
  // Progress is a union (same as the quick-log jump and the cross-device merge);
  // clearing here used to silently wipe progress past an earlier-clicked unit.
  const before = seen[medium()].size;
  for (const a of arcsFor(medium()))
    for (const x of unitsOf(a, medium())) if (x <= u) markSeen(medium(), x);
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
  if (searchInput.value.trim().length >= 2) runSearch();   // results are per-medium
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

function renderIslandArcs(arcs, shielded){
  const label = document.getElementById('pArcK');
  const host = document.getElementById('pArc');
  host.replaceChildren();
  if (shielded){
    label.textContent = 'Arc';
    host.textContent = 'Hidden';
    return;
  }
  const unique = [...new Map(arcs.filter(Boolean).map(arc => [arc.id, arc])).values()];
  label.textContent = unique.length === 1 ? 'Arc' : 'Arcs';
  if (!unique.length){
    host.textContent = 'Not on the route';
    return;
  }
  const rangeLabel = unitWordC();
  unique.forEach(arc => {
    const range = rangeOf(arc, medium());
    const row = document.createElement('div');
    row.className = 'meta-arc';
    const name = document.createElement('span');
    name.className = 'meta-arc-name';
    name.textContent = arc.n;
    const units = document.createElement('span');
    units.className = 'meta-arc-range';
    units.textContent = range ? `${rangeLabel} ${range[0]}–${range[1]}` : 'Not released';
    row.append(name, units);
    host.appendChild(row);
  });
}

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
  renderIslandArcs(isFiller ? [arc] : mine.map(stop => stop.arc), shielded);
  const units = isFiller ? unitsOf(arc,'anime') : mine.flatMap(s => s.units);

  veil.style.display = shielded ? '' : 'none';
  document.getElementById('pBlurb').style.display = shielded ? 'none' : '';
  document.getElementById('pBlurb').textContent = isle.b;
  const lore = document.getElementById('pLore');
  lore.textContent = isle.lore || '';
  lore.style.display = (shielded || !isle.lore) ? 'none' : '';
  renderAnchorage(id);

  const isPending = ARCS.some(a => a.unwritten && a.stops[0]===id);
  /* Progress here is measured on the SIGNIFICANT units — filler doesn't count,
     so watching an arc's canon fills the bar even with its fillers unticked.
     (A filler island is all filler, so sigOr falls back to counting those.) */
  const useUnits = sigOr(units, medium());
  const doneHere = useUnits.filter(u => seen[medium()].has(u)).length;

  /* How far through this island are you? Without this the button was a black
     hole — you clicked, something changed somewhere else, and the label never
     moved, so there was no way to know whether to click it again. */
  const prog = document.getElementById('isleProg');
  if (useUnits.length && !shielded){
    prog.style.display = '';
    prog.classList.toggle('fil', isFiller);
    document.getElementById('ipLabel').textContent = `${isFiller ? 'Filler ' : ''}${unitWord()}s here`;
    const pct = doneHere / useUnits.length * 100;
    document.getElementById('ipCount').textContent = `${doneHere} / ${useUnits.length} · ${Math.round(pct)}%`;
    // Set the width synchronously. Deferring it to requestAnimationFrame left the
    // fill stuck at 0 on iOS Safari when the panel first revealed (the count text,
    // set synchronously, updated fine — the rAF width never took). Floor a nonzero
    // fraction to a visible sliver so "1 of 48" still reads as started.
    document.getElementById('ipBar').style.width = doneHere ? `${Math.max(pct, 5)}%` : '0%';
  } else {
    prog.style.display = 'none';
    document.getElementById('ipBar').style.width = '0%';
  }

  sailbtn.className = 'sailbtn' + (isFiller ? ' fil' : '');
  sailbtn.style.display = shielded ? 'none' : '';   // an unreached island stays a secret — don't leak its range
  sailbtn.onclick = null;
  const last = useUnits.length ? useUnits[useUnits.length - 1] : null;
  const w = medium() === 'anime' ? 'ep.' : 'ch.';

  if (isPending){
    sailbtn.disabled = true;
    sailbtn.classList.add('na');
    sailbtn.textContent = 'Not written yet';
  } else if (!useUnits.length){
    sailbtn.disabled = true;
    sailbtn.classList.add('na');
    sailbtn.textContent = 'Not on the route';
  } else if (doneHere === useUnits.length){
    sailbtn.disabled = true;                       // nothing left here. Stop taking clicks.
    sailbtn.classList.add('done');
    sailbtn.textContent = isFiller
      ? `✓ Detour taken · all ${useUnits.length} eps`
      : `✓ Sailed · all ${useUnits.length} ${unitWord()}s`;
  } else {
    const left = useUnits.length - doneHere;
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

  /* "Next to watch/read" belongs to the island where the voyage is currently
     anchored. An island further along the route may be previewed, but its only
     progress action should be "Sail here"; exposing its next unit would let the
     user advance there before choosing to sail. */
  if (id === positionIsland()) renderNowReading(isle, useUnits, shielded);
  else document.getElementById('nowRead').style.display = 'none';

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
/* deselect on an empty-ocean click is handled in the globe pointer handler */

/* Region filters were removed — every island stays visible. activeSea is kept
   pinned to 'all' so the draw()/label logic that reads it is a no-op. */

/* ============================================================
   SEARCH — find an arc, episode or chapter by name, title, or summary.
   Searching is an explicit action, so on the first query we load all of the
   medium's title/summary blocks (~200KB gzipped, cached) and scan in memory.
   Titles show in results because you searched for them; the full summary still
   lives behind the unit modal's spoiler veil.
   ============================================================ */
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
let searchT;
const closeSearch = () => searchResults.classList.remove('open');
searchInput.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(runSearch, 160); });
searchInput.addEventListener('focus', () => { if (searchInput.value.trim().length >= 2) runSearch(); });
searchInput.addEventListener('keydown', e => { if (e.key === 'Escape'){ searchInput.value = ''; closeSearch(); searchInput.blur(); } });
document.addEventListener('click', e => { if (!document.getElementById('search').contains(e.target)) closeSearch(); });

function runSearch(){
  const q = searchInput.value.trim().toLowerCase();
  if (q.length < 2){ closeSearch(); searchResults.innerHTML = ''; return; }
  const med = medium();
  const last = med === 'anime' ? LAST_EP : LAST_CH;
  searchResults.classList.add('open');
  // pull every block into memory before scanning titles/summaries
  if (!ensureContent(med, 1, last, () => { if (searchInput.value.trim().toLowerCase() === q) runSearch(); })){
    searchResults.innerHTML = '<div class="sr-note">Loading the library…</div>';
    return;
  }

  const uw = med === 'anime' ? 'Ep.' : 'Ch.';
  const arcHits = [];
  for (const arc of arcsFor(med)){
    const isles = (arc.stops || []).map(id => byId[id]).filter(Boolean);
    if (fillerByArc[arc.id]) isles.push(fillerByArc[arc.id]);
    const hay = `${arc.saga} ${arc.n} ${isles.map(i => `${i.n} ${i.b || ''} ${i.lore || ''}`).join(' ')}`.toLowerCase();
    if (hay.includes(q)){ const r = rangeOf(arc, med); arcHits.push({ arc, sub: `${arc.saga} · ${uw} ${r[0]}–${r[1]}` }); }
  }
  const unitHits = [];
  for (let u = 1; u <= last; u++){
    const c = content[med][u];
    if (!c) continue;
    const inTitle = c.t && c.t.toLowerCase().includes(q);
    const inSum = c.s && c.s.toLowerCase().includes(q);
    if (inTitle || inSum) unitHits.push({ u, t: c.t, rank: inTitle ? 0 : 1 });
  }
  unitHits.sort((a, b) => a.rank - b.rank || a.u - b.u);
  renderResults(arcHits, unitHits, uw, med);
}

function renderResults(arcHits, unitHits, uw, med){
  searchResults.innerHTML = '';
  if (!arcHits.length && !unitHits.length){ searchResults.innerHTML = '<div class="sr-note">No matches.</div>'; return; }
  const sec = txt => { const d = document.createElement('div'); d.className = 'sr-sec'; d.textContent = txt; searchResults.appendChild(d); };
  const row = (t, sub, onclick) => {
    const b = document.createElement('button'); b.className = 'sr-item';
    const st = document.createElement('span'); st.className = 'sr-t'; st.textContent = t;
    const ss = document.createElement('span'); ss.className = 'sr-sub'; ss.textContent = sub;
    b.append(st, ss); b.onclick = onclick; searchResults.appendChild(b);
  };
  if (arcHits.length){
    sec(`Arcs (${arcHits.length})`);
    for (const h of arcHits) row(h.arc.n, h.sub, () => goToArc(h.arc));
  }
  if (unitHits.length){
    const word = med === 'anime' ? 'Episodes' : 'Chapters';
    const shown = unitHits.slice(0, 30);
    sec(unitHits.length > shown.length ? `${word} (showing ${shown.length} of ${unitHits.length})` : `${word} (${unitHits.length})`);
    for (const h of shown){
      const arc = arcOfUnit(h.u, med);
      row(`${uw} ${h.u} — ${h.t}`, arc ? arc.n : '', () => { closeSearch(); openUnit(h.u); });
    }
  }
}

function goToArc(arc){
  closeSearch();
  openArcs.add(arc.id);
  setBook(true);
  renderBook();
  requestAnimationFrame(() => bookScroll.querySelector(`[data-arc="${arc.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}

const acctBtn = document.getElementById('acctBtn'), acctMenu = document.getElementById('acctMenu');
const acctDisc = document.getElementById('acctDisc'), acctWho = document.getElementById('acctWho');
const syncStatusBtn = document.getElementById('syncStatusBtn');
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
  renderCloudStatus();
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
syncStatusBtn.onclick = () => { closeAcct(); openModal('settingsModal'); };

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
const syncNow=document.getElementById('syncNow');
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
syncNow.onclick = async () => {
  if (!state.user?.id){
    closeModal('settingsModal');
    authMode='signin'; renderAuthMode(); openModal('signinModal');
    return;
  }
  if (!navigator.onLine){ toast('You’re offline — progress is safe on this device'); return; }
  const saved = await pushRemote();
  if (saved) toast('Cloud save complete');
};
document.getElementById('resetVoyage').onclick = () => {
  clearSeen('anime'); clearSeen('manga'); peeked.clear();
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
const CLOUD_STATUS_KEY='voyage-cloud-status';
let warned=false, saveTimer, remoteTimer;
let lastSyncedSeen = {anime:new Set(), manga:new Set()};   // baseline for the next remote diff
let savedCloudTimestamp = 0;
try { savedCloudTimestamp = Number(localStorage.getItem(CLOUD_STATUS_KEY)) || 0; } catch {}
const cloudSync = {
  phase:navigator.onLine ? 'idle' : 'offline',
  active:0,
  failed:false,
  lastSuccess:savedCloudTimestamp,
};

function cloudTime(timestamp){
  if (!timestamp) return 'Not synchronized yet';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle:'medium',timeStyle:'short'
  }).format(new Date(timestamp));
}
function renderCloudStatus(){
  const title = document.getElementById('syncCardTitle');
  const detail = document.getElementById('syncCardDetail');
  const label = document.getElementById('syncStatusText');
  if (!title || !detail || !label) return;

  let stateName = 'local';
  let short = 'Local only';
  let heading = 'Saved on this device';
  let copy = supabase
    ? 'Sign in to keep your voyage synchronized across devices.'
    : 'Cloud synchronization is not configured. Your voyage remains available on this device.';

  if (state.user?.id && !navigator.onLine){
    stateName = 'offline'; short = 'Offline'; heading = 'Saved locally · offline';
    copy = cloudSync.lastSuccess ? `Last cloud save: ${cloudTime(cloudSync.lastSuccess)}` : 'No cloud save has completed on this device yet.';
  } else if (state.user?.id && cloudSync.active){
    stateName = 'syncing'; short = 'Syncing'; heading = 'Synchronizing voyage…';
    copy = cloudSync.lastSuccess ? `Last cloud save: ${cloudTime(cloudSync.lastSuccess)}` : 'Creating the first cloud save for this device.';
  } else if (state.user?.id && cloudSync.phase === 'error'){
    stateName = 'error'; short = 'Sync failed'; heading = 'Cloud save needs attention';
    copy = cloudSync.lastSuccess ? `Last successful cloud save: ${cloudTime(cloudSync.lastSuccess)}` : 'No cloud save has completed on this device yet.';
  } else if (state.user?.id && cloudSync.lastSuccess){
    stateName = 'saved'; short = 'Cloud saved'; heading = 'Cloud save is up to date';
    copy = `Last successful synchronization: ${cloudTime(cloudSync.lastSuccess)}`;
  } else if (state.user?.id){
    stateName = 'saved'; short = 'Cloud ready'; heading = 'Ready to synchronize';
    copy = 'No cloud save has completed on this device yet.';
  }

  syncStatusBtn.dataset.state = stateName;
  syncStatusBtn.setAttribute('aria-label', `Cloud save status: ${short}`);
  label.textContent = short;
  title.textContent = heading;
  detail.textContent = copy;
  syncNow.textContent = state.user?.id ? (cloudSync.active ? 'Syncing…' : 'Sync now') : 'Sign in to sync';
  syncNow.disabled = Boolean(state.user?.id && (cloudSync.active || !navigator.onLine));
}
function beginCloudSync(){
  if (cloudSync.active === 0) cloudSync.failed = false;
  cloudSync.active += 1;
  cloudSync.phase = 'syncing';
  renderCloudStatus();
}
function finishCloudSync(success){
  if (!success) cloudSync.failed = true;
  if (success){
    cloudSync.lastSuccess = Date.now();
    try { localStorage.setItem(CLOUD_STATUS_KEY, String(cloudSync.lastSuccess)); } catch {}
  }
  cloudSync.active = Math.max(0, cloudSync.active - 1);
  cloudSync.phase = cloudSync.active ? 'syncing' : cloudSync.failed ? 'error' : 'saved';
  renderCloudStatus();
}

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

const CHANGE_WINDOW = 45*864e5;                  // recent operations beat stale devices
function pruneProgressChanges(){
  const cutoff = Date.now() - CHANGE_WINDOW;
  for (const med of ['anime','manga']){
    pruneChangeMap(state.removed[med], cutoff);
    pruneChangeMap(state.added[med], cutoff);
  }
}

const snapshot = () => JSON.stringify({
  medium: state.medium,
  seen: {anime:[...seen.anime], manga:[...seen.manga]},
  user: state.user, settings: state.settings, history: state.history,
  removed: state.removed, added: state.added,
});

function persist(){
  diffProgressChanges();
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
    if (d.removed){
      state.removed.anime = d.removed.anime || {};
      state.removed.manga = d.removed.manga || {};
    }
    const restoredAdded = d.added || d.removed?.added;
    if (restoredAdded){
      state.added.anime = restoredAdded.anime || {};
      state.added.manga = restoredAdded.manga || {};
    }
    (d.seen?.anime||[]).forEach(u => seen.anime.add(u));
    (d.seen?.manga||[]).forEach(u => seen.manga.add(u));
  } catch {}
  lastSyncedSeen = {anime:new Set(seen.anime), manga:new Set(seen.manga)};
}

/* ---- Supabase: cross-device sync ----
   Ranges keep progress compact. Recent add/remove operation timestamps make
   an intentional edit win over a stale cache on another device. */
function scheduleRemoteSync(){
  if (!supabase || !state.user?.id) return;
  clearTimeout(remoteTimer);
  remoteTimer = setTimeout(pushRemote, 1500);
}

function diffProgressChanges(){
  const now = Date.now();
  ['anime','manga'].forEach(med => {
    lastSyncedSeen[med].forEach(u => {
      if (!seen[med].has(u) && !state.removed[med][u]){
        state.removed[med][u] = now;
        delete state.added[med][u];
      }
    });
    seen[med].forEach(u => {
      if (!lastSyncedSeen[med].has(u) && !state.added[med][u]){
        state.added[med][u] = now;
        delete state.removed[med][u];
      }
    });
  });
}

let syncWarned = false;

async function fetchRemote(){
  const { data, error } = await supabase.from('progress').select('*').eq('user_id', state.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

/* Union a fetched remote row into local state. Recent per-unit operations break
   conflicts in mergeProgressState. Settings apply only when explicitly adopted.
   Returns whether the reconciliation changed what's watched/read. */
function mergeRemoteRow(data, applySettings){
  if (!data) return false;
  const before = {anime:new Set(seen.anime), manga:new Set(seen.manga)};
  const remoteUpdatedAt = new Date(data.updated_at).getTime();
  for (const med of ['anime','manga']){
    const merged = mergeProgressState({
      localSeen:seen[med],
      remoteSeen:fromRanges(data[`${med}_ranges`]),
      localRemoved:state.removed[med],
      remoteRemoved:data.removed?.[med] || {},
      localAdded:state.added[med],
      remoteAdded:data.removed?.added?.[med] || {},
      remoteUpdatedAt,
    });
    seen[med] = merged.seen;
    state.removed[med] = merged.removed;
    state.added[med] = merged.added;
  }
  state.history = mergeHistory(state.history, data.history);
  pruneProgressChanges();
  if (applySettings && data.settings) Object.assign(state.settings, data.settings);
  return !setsEqual(before.anime, seen.anime) || !setsEqual(before.manga, seen.manga);
}

async function upsertLocal(){
  diffProgressChanges();
  pruneProgressChanges();
  const { error } = await supabase.from('progress').upsert({
    user_id: state.user.id,
    anime_ranges: toRanges(seen.anime),
    manga_ranges: toRanges(seen.manga),
    history: state.history,
    settings: state.settings,
    removed: {
      anime:state.removed.anime,
      manga:state.removed.manga,
      added:state.added,
    },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
  lastSyncedSeen = {anime:new Set(seen.anime), manga:new Set(seen.manga)};
}

/* Background sync is READ-MERGE-WRITE, never a blind overwrite: fetch what the
   DB currently has, union it into local, then save the union. This is what stops
   a stale tab left open on another device from clobbering newer progress — the
   bug that reverted a phone's worth of "watched" marks. If the union pulled in
   changes from elsewhere, refresh the views so they appear. */
async function pushRemote(){
  if (!supabase || !state.user?.id) return;
  beginCloudSync();
  let success = false;
  try {
    /* Capture local removals before fetching. The old order fetched and unioned
       first, which could restore a unit before its removal was timestamped. */
    diffProgressChanges();
    const changed = mergeRemoteRow(await fetchRemote(), false);
    await upsertLocal();
    syncWarned = false;
    if (changed){ persist(); refreshViews(); }
    success = true;
    return true;
  } catch (e){
    // Don't fail silently — a broken cloud save is exactly what destroys trust.
    console.error('Grand Line Chart — cloud save failed:', e?.message || e);
    if (!syncWarned){ syncWarned = true; toast('Couldn’t save to the cloud — will keep retrying'); }
    return false;
  } finally {
    finishCloudSync(success);
  }
}

function mergeHistory(a, b){
  const out = {anime:{...a.anime}, manga:{...a.manga}};
  for (const med of ['anime','manga']) for (const day in (b?.[med]||{}))
    out[med][day] = Math.max(out[med][day]||0, b[med][day]);
  return out;
}

/* applySettings: adopt the account's saved settings too (used on an explicit
   sign-in — that's when you want "my settings from my other device"). On a
   plain reload/focus we only merge progress, so we never clobber a setting you
   just changed on this device. */
async function pullAndMerge({ applySettings = false } = {}){
  if (!supabase || !state.user?.id) return;
  beginCloudSync();
  let success = false;
  try {
    mergeRemoteRow(await fetchRemote(), applySettings);
    lastSyncedSeen = {anime:new Set(seen.anime), manga:new Set(seen.manga)};
    persist();
    await upsertLocal();          // write the merged result back (safe: local now ⊇ remote)
    success = true;
    return true;
  } catch (e){
    console.error('Grand Line Chart — cloud load failed:', e?.message || e);
    return false;
  } finally {
    finishCloudSync(success);
  }
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
      /* Sync down on an explicit sign-in (adopt account settings too) and on a
         reload with an existing session (progress only). Then re-render
         everything a synced setting or new progress could affect. */
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION'){
        pullAndMerge({ applySettings: event === 'SIGNED_IN' }).then(() => {
          rebuildStops(); buildRoute();
          renderSettings(); applyVoyageCollapsed();
          renderBook(); renderCrew(); renderQuickLog();
          if (selected) select(selected, false);
          draw();
        });
      }
    } else if (event === 'SIGNED_OUT'){
      state.user = null;
      renderAcct(); renderSettings();
    }
  });
}

/* Both saves are debounced (400ms local, 1500ms cloud), so a mark made just
   before you close the tab or switch apps could be lost in flight. When the
   page is hidden, flush both immediately — this is the difference between
   "I ticked it and it's gone" and a tracker you can trust. */
function flushSync(){
  diffProgressChanges();
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, snapshot()); } catch {}
  if (supabase && state.user?.id){ clearTimeout(remoteTimer); pushRemote(); }   // merge-write: safe even from a stale tab
}

/* Re-render everything a progress change touches — shared by the focus/background
   syncs so freshly-merged data from another device actually shows up. */
function refreshViews(){
  rebuildStops(); buildRoute();
  renderBook(); renderCrew(); renderQuickLog();
  if (selected) select(selected, false);
  draw();
}

/* Coming back to a tab that's been open in the background: pull the latest from
   the DB and merge it in, so an idle tab doesn't sit on stale progress (and
   then risk pushing it). */
let syncingDown = false;
async function syncDownOnFocus(){
  if (!supabase || !state.user?.id || syncingDown) return;
  syncingDown = true;
  try { await pullAndMerge(); refreshViews(); }
  finally { syncingDown = false; }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSync();
  else syncDownOnFocus();
});
window.addEventListener('focus', syncDownOnFocus);
window.addEventListener('pagehide', flushSync);
window.addEventListener('offline', () => { cloudSync.phase = 'offline'; renderCloudStatus(); });
window.addEventListener('online', () => { cloudSync.phase = cloudSync.lastSuccess ? 'saved' : 'idle'; renderCloudStatus(); syncDownOnFocus(); });

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

/* the globe installs its own resize handler (ResizeObserver on #stage) */
(() => {
  restore();
  setupAuth();
  mAnime.setAttribute('aria-pressed', String(state.medium==='anime'));
  mManga.setAttribute('aria-pressed', String(state.medium==='manga'));
  rebuildStops(); buildRoute(); renderAcct(); renderSettings(); renderCrew(); renderQuickLog(); renderAuthMode(); applyVoyageCollapsed();
  requestAnimationFrame(() => { mapReady = true; renderBook(); fit(); });
})();
