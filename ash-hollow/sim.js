"use strict";
/* ASH HOLLOW — simulation. Four wanderers start with nothing: no fire, no
   tools, no shelter, no words, no gods. Everything is invented in play. */
const Q = new URLSearchParams(location.search);
// autosave: resume the saved world unless this is a new/test/demo URL (see save.js)
const TEST_URL=['new','seed','ff','demo','nosave','n'].some(k=>Q.has(k));
if(TEST_URL) globalThis.__noSave=true;
const SAVED=TEST_URL?null:(()=>{ try{ const t=localStorage.getItem('ash-hollow-save-v6'); return t?JSON.parse(t):null; }catch(e){ return null; } })();
let seed = SAVED ? SAVED.seed0 : ((+Q.get('seed')) || 20261010);
function rng(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}
const R=(a,b)=>a+rng()*(b-a), RI=(a,b)=>Math.floor(R(a,b+1)), pick=a=>a[Math.floor(rng()*a.length)];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

const W=3600, H=2400, DAY=120;            // world px (was 2400x1600 before the land expansion), sim-seconds per day
const SPREAD=1.5;                         // how much the valley layout was stretched vs v2
const FIRE={x:1800,y:900};                // the gathering place (where fire will be kept)
const STOCK={x:FIRE.x-46,y:FIRE.y+20};    // shared food pile
const STONE={x:FIRE.x+125,y:FIRE.y-55};   // an odd rock with a hole — later "the Stone that Listens"
const POND={x:2800,y:1750,r:150};

/* ------------------------------ AGES -------------------------------
   Every age is reached by an INVENTION, never by a timer. After Steel the
   real-world tech chain continues (TECH below), and after that the next
   invention + age is generated from templates forever (nextTech()).   */
const AGES=[
 {n:'Bare Hands',   sub:'stone age · no fire, no tools, no words', key:null},
 {n:'Stone Age',    sub:'kept fire, sticks & lean-tos',            key:'fire'},
 {n:'Neolithic',    sub:'wattle huts',                             key:'hut'},
 {n:'Farming Age',  sub:'planted patches',                         key:'planting'},
 {n:'Copper Age',   sub:'copper tools',                            key:'copper'},
 {n:'Bronze Age',   sub:'bronze tools',                            key:'bronze'},
 {n:'Iron Age',     sub:'iron tools',                              key:'iron'},
 {n:'Steel Age',    sub:'harder steel tools',                      key:'steel'},
];

/* --------------------------- INVENTIONS ----------------------------
   Each invention needs its prerequisites and enough "idea" points.
   Ideas come from experience (see inspire() calls). 'fire' is an event:
   lightning must strike and someone must carry a burning stick home.  */
const INV={
  sticks:  {name:'Stick-in-hand', desc:'a branch becomes a tool',               need:6,  pre:[]},
  syll:    {name:'First Sounds',  desc:'shared syllables, no meanings yet',     need:12, pre:[]},
  fire:    {name:'Kept Fire',     desc:'sky-fire carried home and fed',         need:1,  pre:['sticks'], event:true},
  leanto:  {name:'Lean-to',       desc:'sticks and boughs against the wind',    need:8,  pre:['sticks']},
  spear:   {name:'Pointed Stick', desc:'a sharpened stick to hunt and to hold off the beast', need:10, pre:['sticks']},
  words:   {name:'Shared Words',  desc:'one sound, one thing, for everyone',    need:26, pre:['syll','fire']},
  flint:   {name:'Knapping',      desc:'stone struck on stone for an edge',     need:10, pre:['spear']},
  myths:   {name:'Myths',         desc:'stories told in the new words',         need:22, pre:['words'], needsBelief:true},
  strike:  {name:'Fire-Striking', desc:'sparks from stone — no need to wait for the sky', need:8, pre:['flint','fire']},
  hut:     {name:'Wattle Hut',    desc:'woven walls, mud and thatch',           need:16, pre:['leanto','fire']},
  planting:{name:'Planting',      desc:'bury a root and it comes back',         need:22, pre:['hut']},
  copper:  {name:'Copper',        desc:'soft red metal that softens in the fire', need:90, pre:['strike','planting']}   /* v3.6 pacing: was 30 */,
  bronze:  {name:'Bronze',        desc:'copper mixed with tin for a harder edge', need:130, pre:['copper']},   /* was 34 */
  iron:    {name:'Iron',          desc:'hard grey metal from the red earth',       need:180, pre:['bronze']},   /* was 40 */
  steel:   {name:'Steel',         desc:'iron hardened with charcoal in a hotter fire', need:240, pre:['iron']},   /* was 46 */
};
/* ---------------------- ENDLESS TECHNOLOGY ------------------------
   After Steel: a named chain of real technologies, then procedural ones.
   Every tech is BOTH an invention and a new age, and each has a visible
   effect: a landmark in the valley (lmk) plus one lasting bonus (fx):
     tool   – better weapons (tool tier)      growth – faster population growth
     think  – inventions come faster          cap    – settlements hold more people
     food   – another planted field           warm   – peoples warm to each other faster
     aware  – (Space Age) the people sense the watcher                       */
const TECH=[
 {id:'gunpowder',  name:'Gunpowder',        age:'Early Modern Age', sub:'gunpowder, printing, sail and powder forts',  desc:'saltpetre, charcoal and sulphur that burn in a flash', fx:'tool',  lmk:'fort'},
 {id:'printing',   name:'Printing Press',   age:null, sub:'',               desc:'movable type: one book becomes a thousand',          fx:'think', lmk:'press'},
 {id:'steam',      name:'Steam Engine',     age:'Industrial Age',   sub:'steam engines, brick mills and factories',       desc:'boiling water turns wheels',                          fx:'growth',lmk:'mill'},
 {id:'electricity',name:'Electricity',      age:'Electric Age',     sub:'wires, lamps and motors',                  desc:'lightning tamed and sent down a wire',                fx:'cap',   lmk:'lamps'},
 {id:'combustion', name:'Combustion Engine',age:'Oil Age',          sub:'oil, engines, paved roads and radio',             desc:'oil burned inside an engine',                         fx:'food',  lmk:'roads'},
 {id:'radio',      name:'Radio',            age:null, sub:'',              desc:'talk across the land without wires',                  fx:'warm',  lmk:'mast'},
 {id:'computing',  name:'Computing',        age:'Computer Age',     sub:'machines that calculate',                  desc:'machines that count and remember',                    fx:'think', lmk:'computer'},
 {id:'spaceflight',name:'Spaceflight',      age:'Space Age',        sub:'rockets leave the sky',                    desc:'a rocket climbs past the sky',                        fx:'aware', lmk:'rocket'},
];
// procedural templates: field → milestone names (real-ish), then numbered levels forever
const FIELDS=[
 {f:'Energy',      fx:'growth',lmk:'plant',     names:['Nuclear Power','Solar Power','Fusion Power','Orbital Solar Arrays']},
 {f:'Medicine',    fx:'growth',lmk:'clinic',    names:['Antibiotics','Vaccines','Gene Therapy','Regenerative Medicine']},
 {f:'Materials',   fx:'cap',   lmk:'tower',     names:['Plastics','Composites','Superconductors','Nanomaterials']},
 {f:'Agriculture', fx:'food',  lmk:'greenhouse',names:['Fertiliser','High-Yield Crops','Vertical Farms','Engineered Crops']},
 {f:'Computing',   fx:'think', lmk:'computer',  names:['Networks','Artificial Intelligence','Quantum Computing','Neural Interfaces']},
 {f:'Transport',   fx:'warm',  lmk:'roads',     names:['Railways','Jet Flight','Maglev Trains','Hypersonic Flight']},
 {f:'Space',       fx:'cap',   lmk:'rocket',    names:['Satellites','Moon Base','Mars Settlement','Space Elevator']},
];
const ROMAN_N=n=>{ const v=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]; let o=''; for(const [k,r] of v) while(n>=k){o+=r;n-=k;} return o; };
const TNEED=n=>400+n*150+n*n*n*28;   // v3.6 steep late curve
function techDef(n){        // n = 0,1,2… after Steel; deterministic, so saves need only the known ids
  if(n<TECH.length) return {...TECH[n],need:TNEED(n)};   /* v3.6: was 56+n*8 (Gunpowder 56 → 400, Electricity 80 → 1606, Spaceflight 112 → 11054) */
  const m=n-TECH.length, F=FIELDS[m%FIELDS.length], lvl=Math.floor(m/FIELDS.length);
  const name=lvl<F.names.length?F.names[lvl]:`${F.f} Science ${ROMAN_N(lvl-F.names.length+2)}`;
  const BIG=['Information Age','Fusion Age','Orbital Age','Interplanetary Age','Stellar Age'], bi=Math.floor(m/FIELDS.length);
  return {id:'tech'+n,name,age:m%FIELDS.length===0?(bi<BIG.length?BIG[bi]:'Stellar Age '+ROMAN_N(bi-BIG.length+2)):null,sub:`${F.f.toLowerCase()} milestone ${lvl+1} · invention #${n+1} after Steel`,desc:`a new step in ${F.f.toLowerCase()}`,fx:F.fx,lmk:F.lmk,need:Math.round(12000+(n-8)*900+Math.pow(Math.max(0,n-8),1.5)*40),proc:true};   /* was 120+n*10+n^1.3; always above Spaceflight */
}
/* visual era from a people's age index (AGES): the LOOK of houses, clothes and fields follows tech.
   0 camp (lean-tos) · 1 huts (Neolithic–Steel) · 2 early modern · 3 industrial
   4 electric + oil · 5 modern (Computer Age and later)                                   */
const visEra=age=>age<2?0:age<8?1:age<9?2:age<10?3:age<12?4:5;   // AGES: 8 Early Modern · 9 Industrial · 10 Electric · 11 Oil · 12 Computer · 13 Space · 14+ …
/* v3.6 — INVENTION ≠ AGE. Post-Steel inventions are added to INV only.
   AGES holds a small list of BROAD ages; each opens by a TEST on what a
   people knows (any path can reach it). Captions say "Invented: Railways";
   the age bar shows the broad age (subtitle: latest invention).
   DIVERGENT INDUSTRIALISATION: the six early-modern/industrial inventions
   come in different orders. Each people has a PATH (pathOf in ripples.js,
   from its culture + land) that sets the order it pursues them:
     forge  (warlike / hills):  Gunpowder → Steam → Combustion → Printing → Electricity → Radio
     spark  (devout / mixed):   Printing → Electricity → Radio → Gunpowder → Steam → Combustion
     market (open-handed):      Printing → Gunpowder → Steam → Electricity → Radio → Combustion
   Real prerequisites stay (GATE): Radio needs Electricity, Combustion needs
   Steam, Computing needs Electricity + 4 of the 6, Spaceflight needs
   Computing + Combustion. Then procedural inventions run in order.       */
const EARLY=['gunpowder','printing','steam','electricity','combustion','radio'];
const PATHS={forge:['gunpowder','steam','combustion','printing','electricity','radio'],spark:['printing','electricity','radio','gunpowder','steam','combustion'],market:['printing','gunpowder','steam','electricity','radio','combustion']};
const GATE={radio:kn=>kn('electricity'),combustion:kn=>kn('steam'),computing:kn=>kn('electricity')&&EARLY.filter(kn).length>=4,spaceflight:kn=>kn('computing')&&kn('combustion')};
const postCount=kn=>EARLY.filter(kn).length+(kn('computing')?1:0)+(kn('spaceflight')?1:0);
const BROAD=[
 {n:'Early Modern Age',sub:'powder, print and sail',          test:kn=>postCount(kn)>=1},
 {n:'Industrial Age',  sub:'engines, brick mills, factories',  test:kn=>postCount(kn)>=3},
 {n:'Electric Age',    sub:'wires, lamps and motors',          test:kn=>kn('electricity')&&postCount(kn)>=4},
 {n:'Oil Age',         sub:'engines, paved roads, radio',      test:kn=>kn('combustion')&&postCount(kn)>=6},
 {n:'Computer Age',    sub:'machines that calculate',          test:kn=>kn('computing')},
 {n:'Space Age',       sub:'rockets leave the sky',            test:kn=>kn('spaceflight'), future:true},
];
for(const B of BROAD) AGES.push({n:B.n,sub:B.sub,key:null,test:B.test,future:!!B.future});
TECH.forEach((T,n)=>{ INV[T.id]={name:T.name,desc:T.desc,need:TNEED(n),pre:n<6?['steel']:[],gate:GATE[T.id],tech:{...T,need:TNEED(n)},research:true}; });
let techN=TECH.length;      // techDef(0..techN-1) exist in INV
function addNextTech(){      // procedural inventions; every FIELDS.length-th one opens a new broad age
  const T=techDef(techN), prev=techN===TECH.length?'spaceflight':techDef(techN-1).id;
  INV[T.id]={name:T.name,desc:T.desc,need:T.need,pre:[prev],tech:T,research:true};
  if(T.age) AGES.push({n:T.age,sub:T.sub,key:T.id,future:false});
  techN++;
}
const prereqK=(id,kn)=>{ const I=INV[id]; return I.pre.every(kn)&&(!I.gate||I.gate(kn)); };
// the next invention a people pursues on its own path (kn = that people's "knows")
function nextInvention(kn,path){
  if(!kn('steel')) return null;
  for(const id of (PATHS[path]||PATHS.spark).concat(['computing','spaceflight'])) if(!kn(id)&&prereqK(id,kn)) return id;
  if(!kn('spaceflight')) return null;
  for(let n=TECH.length;;n++){ while(techN<=n) addNextTech(); const id=techDef(n).id; if(!kn(id)) return prereqK(id,kn)?id:null; }
}
function ageFrom(kn){ let a=0; for(let i=1;i<AGES.length;i++){ const A=AGES[i]; if(A.test?A.test(kn):kn(A.key)) a=i; else break; } return a; }
function ensureFrontier(){ while(knows('spaceflight')&&AGES.length<ageFrom(knows)+3) addNextTech(); boost=BOOST(); }
function BOOST(){ return BOOST_(); }
const BOOST_=()=>{ const b={tool:0,think:1,growth:1,cap:1,food:0,warm:0}; for(let n=0;n<techN;n++){ const T=techDef(n); if(!knows(T.id)) continue;
  if(T.fx==='tool') b.tool++; else if(T.fx==='think') b.think+=0.12; else if(T.fx==='growth') b.growth=Math.min(1.5,b.growth+0.06); else if(T.fx==='cap') b.cap+=0.1; else if(T.fx==='food') b.food=Math.min(8,b.food+1); else if(T.fx==='warm') b.warm=Math.min(2,b.warm+0.3); } return b; };
// (additive and gently capped on purpose: endless inventions must not mean endless population explosions)
let boost={tool:0,think:1,growth:1,cap:1,food:0,warm:0};

/* ------------------------------ WORLD ------------------------------ */
function ridgeEdge(x){ const b=Math.exp(-Math.pow((x-FIRE.x)/1050,4)); return 120+430*b+38*Math.sin(x/150)+18*Math.sin(x/53+1.3); }
const CAVE={x:FIRE.x-150,y:0}; CAVE.y=ridgeEdge(CAVE.x)-6;
const CAVE_IN={x:CAVE.x,y:CAVE.y+14};
const CAVE_CAP=8;
const trees=[],bushes=[],roots=[],flints=[],skitters=[],cairns=[],leaves=[];
function okSpot(x,y){ if(x<30||y<30||x>W-30||y>H-30) return false; if(y<ridgeEdge(x)+40) return false;
  if(Math.hypot(x-FIRE.x,y-FIRE.y)<420) return false; if(Math.hypot(x-POND.x,y-POND.y)<POND.r+40) return false; return true; }
const HUES=['#c8642a','#d98a2b','#b9452a','#e0b23a','#7d8f3a','#a8682a'];
function genWorld(){
  const clumps=[[300,900],[500,1350],[1500,1450],[2150,800],[1950,450],[350,550],[2200,1350],[800,1200],[1600,700]].map(([x,y])=>[FIRE.x+(x-1150)*SPREAD,FIRE.y+(y-860)*SPREAD]);
  for(let i=0;i<8;i++) clumps.push([R(200,W-200),R(1300,H-150)]);   // extra woods in the new southern land
  for(const [cx,cy] of clumps){ const n=RI(14,24); for(let i=0;i<n;i++){ const a=R(0,6.28), r=R(0,210)*Math.sqrt(rng()); const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
    if(okSpot(x,y)) trees.push({x,y,r:R(16,26),kind:rng()<.28?'pine':'leaf',hue:pick(HUES),burn:0,burnt:false}); } }
  for(let i=0;i<90;i++){ const x=R(40,W-40),y=R(200,H-40); if(okSpot(x,y)) trees.push({x,y,r:R(15,24),kind:rng()<.3?'pine':'leaf',hue:pick(HUES),burn:0,burnt:false}); }
  let tries=0; while(bushes.length<40&&tries++<4000){ const a=R(0,6.28),r=R(450,1150); const x=FIRE.x+Math.cos(a)*r,y=FIRE.y+Math.sin(a)*r*0.8; if(okSpot(x,y)) bushes.push({x,y,berries:RI(3,6),max:6,rg:0}); }
  tries=0; while(roots.length<20&&tries++<4000){ const x=R(200,W-200),y=R(800,H-80); if(okSpot(x,y)&&Math.hypot(x-FIRE.x,y-FIRE.y)>460&&Math.hypot(x-FIRE.x,y-FIRE.y)<1400) roots.push({x,y,amt:3,rg:0}); }
  tries=0; while(flints.length<12&&tries++<3000){ const x=R(FIRE.x-1000,FIRE.x+1000); const y=ridgeEdge(x)+R(30,60); if(Math.abs(x-CAVE.x)>90 && Math.hypot(x-FIRE.x,y-FIRE.y)>200) flints.push({x,y,amt:4,rg:0}); }
  for(let i=0;i<14;i++){ let x,y,g=0; do{x=R(200,W-200);y=R(800,H-100);}while(!okSpot(x,y)&&g++<500); skitters.push({x,y,hx:x,hy:y,vx:0,vy:0,alive:true,rs:0,t:0}); }
  for(let i=0;i<1100;i++) leaves.push({x:R(0,W),y:R(0,H),c:pick(['#c8642a','#d98a2b','#b9452a','#e0b23a']),a:R(0,6.28)});
}

/* --------------------------- TRIBE STATE --------------------------- */
const tribe={ food:2, sticks:0, flint:0, lore:0, age:0, era:0 /* legacy, unused */, time:DAY*0.14, day:1,
  beliefs:{}, known:{}, ideas:{}, words:null, extraMyths:[], structures:[], ritual:null, ritualDay:0, rites:0,
  fire:{lit:false,fuel:0,ever:false,nights:0}, storm:-1, flash:0, burning:null,
  survived:0, log:[], births:0, deaths:0, birthT:-100, strangerT:0, handprints:false, toast:null };
const villagers=[], preds=[];
const NAMES=['Ula','Brak','Teshi','Moro','Kiva','Dunn','Ahra','Sef','Lio','Orra','Pim','Gaal','Neb','Yesh','Tamu','Rhi','Oska','Venn','Iru','Talla','Bo','Mesk','Anu','Ferr'];
let nameI=0;
/* Person types: everyone has six abilities (≈0.6–1.5, 1 = ordinary). The
   strongest one, if clearly above the rest, is their type. Types are latent
   in children (inherited from two adults + noise) and show in behaviour.   */
const TRAITS=['wit','bold','hands','care','forage','social'];
const TYPES={wit:'Deep-Looker',bold:'Spear-Heart',hands:'Hand-Maker',care:'Kin-Keeper',forage:'Root-Finder',social:'Fire-Talker'};
const TYPE_NOTE={wit:'asks, watches, invents faster',bold:'hunts and faces the beast',hands:'builds and shapes tools faster',care:'tends the young; more births',forage:'finds food faster',social:'talks; spreads sounds and words'};
function rollTraits(parents){
  const t={}; for(const k of TRAITS){ const base=parents&&parents.length>=2?(parents[0].tr[k]+parents[1].tr[k])/2:1; t[k]=clamp(base+R(-0.28,0.28)+(rng()<0.18?R(0.15,0.4):0),0.55,1.6); }
  let best='wit'; for(const k of TRAITS) if(t[k]>t[best]) best=k; return {tr:t,type:best};
}
function mkVillager(x,y,child,parents){
  const v={id:villagers.length,name:NAMES[nameI++%NAMES.length]+(nameI>NAMES.length?' '+Math.ceil(nameI/NAMES.length):''),x,y,face:1,spd:R(36,42),hunger:R(5,35),fear:R(0,15),faith:R(0,6),hp:100,
    tool:0,carry:null,task:null,bubble:null,home:null,isLead:false,dead:false,anim:R(0,9),moving:false,mood:'wary',thought:'',gloss:'',
    skin:pick(['#c58c5a','#a8703f','#8a5a33','#d5a070','#7a4c2a']),hide:pick(['#8a6a44','#7b5a3a','#9a7a50','#6d5236','#a0805a']),hair:pick(['#2a1c12','#3b2a1a','#1a120c','#5a3a20']),
    child:!!child,grow:child?0:1,talkT:R(4,14),fearCD:0,born:tribe.time-(child?0:R(5000,9000)),deeds:0,role:'',...rollTraits(parents)};
  villagers.push(v); return v;
}
const alive=()=>villagers.filter(v=>!v.dead);
const adults=()=>alive().filter(v=>!v.child);
const knows=id=>!!tribe.known[id];
const langLevel=()=>knows('myths')?3:knows('words')?2:knows('syll')?1:0;
function log(msg){ tribe.log.unshift({d:tribe.day,msg}); if(tribe.log.length>10) tribe.log.pop(); }
function say(v,text,gloss,t){ if(!text) return; v.bubble={text,t:t||3.2}; v.thought=text; v.gloss=gloss||''; }
Mind.ctx={ pick, rand:rng, beliefs:tribe.beliefs, get words(){return tribe.words;}, get extraMyths(){return tribe.extraMyths;}, lang:()=>langLevel(), say:(a,t)=>say(a,t) };
function think(v,ev,force){ const r=Mind.think(v,ev); if(r.emotion) v.mood=r.emotion; if(r.bubbleText&&(force||!v.bubble)) say(v,r.bubbleText,r.gloss); return r; }
function addLore(n){ tribe.lore+=n; }
function banner(a,b){ if(typeof document==='undefined') return; const el=document.getElementById('banner'); if(!el) return; document.getElementById('ba').textContent=a; document.getElementById('bb').textContent=b; el.style.opacity=1; clearTimeout(banner.t); banner.t=setTimeout(()=>el.style.opacity=0,3800); }
function W_(c){ return tribe.words?tribe.words[c]:null; }      // tribe word for a concept, if coined
function belief(id,text){ if(tribe.beliefs[id]) return; tribe.beliefs[id]=true; addLore(8); log(`A new belief stirs: <b>${text}</b>.`); if(typeof director==='function') director(id==='stone'?STONE:FIRE,{kind:'belief',caption:'A new belief: '+text,big:true}); }

/* ---------------------------- INVENTION ---------------------------- */
function prereqOK(id){ const I=INV[id]; return I.pre.every(knows) && (!I.gate||I.gate(knows)) && (!I.needsBelief || Object.keys(tribe.beliefs).length>0); }
function inspire(id,n,who){
  if(knows(id)||INV[id].event||!prereqOK(id)) return;
  n*=boost.think;
  const pm=knows('planting')&&typeof pressMult==='function'?pressMult(world.factions[0]):1; n*=pm;   // rival pressure (world.js)
  const em=typeof wealthMult==='function'?wealthMult(world.factions[0])*routeMult(world.factions[0]):1; n*=em;
  if(typeof partnerAgeGap==='function'&&world.factions[0].age!=null) n*=1+0.6*partnerAgeGap(world.factions[0]);
  if(typeof iqMult==='function'&&knows('planting')){ const h=world.factions[0]; n*=iqMult(h)*inquiryMult(h)*resMult(h); }   // v3.7: intellect, inquiry ideas, scarce ore/fuel   // ideas spread from more advanced partners   // economy + trade routes (ripples.js)
  if(who&&who.tr){ n*=who.tr.wit; if(id==='syll'||id==='words'||id==='myths') n*=who.tr.social; }
  tribe.ideas[id]=(tribe.ideas[id]||0)+n;
  if(tribe.ideas[id]>=INV[id].need) discover(id,who);
}
function discover(id,who){
  if(knows(id)) return; tribe.known[id]=true; tribe.ideas[id]=INV[id].need; addLore(12);
  const I=INV[id]; log(`${who?'<b>'+who.name+'</b> — ':''}invention: <b>${I.name}</b> (${I.desc}).`);
  if(typeof director==='function') director(who,{kind:'invent',caption:'Invented: '+I.name,sub:I.desc+(who?' — '+who.name+', '+TYPES[who.type]:''),big:true});
  if(id==='words'){ tribe.words=coinWords(rng); if(typeof director==='function') director(who,{kind:'invent',caption:`First words: fire is “${tribe.words.fire}”`,sub:'sounds now mean things',big:true}); log(`The people now call fire “<b>${tribe.words.fire}</b>”, the beast “<b>${tribe.words.beast}</b>”, the stone “<b>${tribe.words.stone}</b>”.`); }
  if(id==='planting') belief('seed','the Mother Under — bury one, eat many');
  if(I.tech) onTech(I.tech,who);
  if(knows('planting')&&id!=='planting'&&typeof pressMult==='function'){ const f=world.factions[0], m=pressMult(f);
    const em=wealthMult(f)*routeMult(f);
    if(em>=1.15&&em>=m){ ripple(`Trade routes sped ${I.name}`,`${f.routes} route${f.routes>1?'s':''} and wealth bring ideas ${em.toFixed(1)}× faster`); }
    else if(m>=1.2){ const rv=Object.values(world.rel).filter(r=>r.a===0||r.b===0).sort((a,b)=>(PRESS_W[b.state]||0)-(PRESS_W[a.state]||0))[0], o=rv&&world.factions[rv.a===0?rv.b:rv.a];
      const why=o?`${rv.state==='war'?'war with':rv.state==='trade'?'trade rivalry with':'pressure from'} the ${o.root}-folk`:'their rivals';
      log(`Rivalry drove <b>${I.name}</b>: ${why} (ideas ×${m.toFixed(1)}).`);
      if(typeof director==='function') director(null,{kind:'invent',caption:`Rivalry drove ${I.name}`,sub:`${why} — ideas come ${m.toFixed(1)}× faster`}); } }
  if(who){ think(who,{type:'discover'},true); who.deeds+=3; }
  if(id==='sticks' && tribe.storm<0) tribe.storm=tribe.time+R(20,35);
}
function ageCheck(){
  ensureFrontier();
  const a=ageFrom(knows);
  while(tribe.age<a){ tribe.age++; onAgeUp(tribe.age); }
}
const ageName=()=>AGES[tribe.age].n;     // no more looping "Age of X" eras: every age is an invention
/* Research: once Steel is known, the whole people (counted + watched) keep
   working on the frontier tech. More people and wiser heads = faster. The
   wisest watched adult gets the credit (and the director's camera).        */
function researchStep(dt){
  if(!knows('steel')) return;
  const id=nextInvention(knows,typeof pathOf==='function'?pathOf(world.factions[0]):'spark'); if(!id) return;   // home's own industrial path
  const A=adults(); if(!A.length) return;
  const sage=A.reduce((b,v)=>v.tr.wit>b.tr.wit?v:b,A[0]);
  const pop=typeof totalPop==='function'?totalPop():A.length;
  inspire(id,dt*0.012*(1+Math.log10(Math.max(10,pop))),sage);   /* was 0.03 */
}
const LMK_NAME={fort:'a powder fort',press:'a print house',mill:'a smoking mill',lamps:'electric lamps along the paths',roads:'paved roads',mast:'a radio mast',computer:'a computer hall',rocket:'a rocket on its pad',plant:'a power plant',clinic:'a clinic',tower:'a tall tower',greenhouse:'a glass greenhouse'};
const FX_NOTE={tool:'better weapons',think:'ideas come faster',growth:'faster growth',cap:'settlements hold more people',food:'a new field',warm:'neighbours warm faster',aware:'they sense the watcher'};
function onTech(T,who){
  boost=BOOST();
  // the landmark: a new building in the valley, on a widening ring around the hearth (never ends)
  const k=(tribe.landmarks=tribe.landmarks||[]).length, ring=Math.floor(k/10), a=-2.6+(k%10)*0.52+ring*0.26, r=640+ring*150;
  tribe.landmarks.push({kind:T.lmk,x:FIRE.x+Math.cos(a)*r,y:FIRE.y+Math.sin(a)*r*0.7,name:T.name,n:k});
  log(`A new building rises: <b>${LMK_NAME[T.lmk]||T.lmk}</b> (${T.name}). Effect: ${FX_NOTE[T.fx]}.`);
  if(T.fx==='aware'&&!tribe.beliefs.watcher) belief('watcher','the Watcher beyond the sky — someone sees us');
}

/* --------------------------- STRUCTURES ---------------------------- */
function slotPos(i){ const ring=Math.floor(i/6), j=i%6; const a=0.35+j*0.6+(ring%2)*0.3; const r=200+ring*95; return {x:FIRE.x+Math.cos(a)*r, y:FIRE.y+Math.sin(a)*r*0.8}; }
function plotPos(i){ const a=-0.25+i*0.42, r=400+Math.floor(i/5)*120; return {x:FIRE.x+Math.cos(a)*r*1.05, y:FIRE.y+110+Math.sin(a)*r*0.55}; }
const CAP={leanto:2,hut:4};
function capacity(){ return tribe.structures.filter(s=>s.built&&CAP[s.type]).reduce((n,s)=>n+CAP[s.type],0); }
function activeSite(){ return tribe.structures.find(s=>!s.built); }
function freeSlot(){ for(let i=0;i<60;i++){ if(!tribe.structures.some(s=>s.slot===i)) return i; } return -1; }
function planBuilding(){
  if(activeSite()||!knows('leanto')) return;
  const pop=alive().length;
  const plots=tribe.structures.filter(s=>s.type==='plot').length;
  if(knows('planting') && plots < 1+(knows('copper')?1:0)+(knows('bronze')?1:0)+(knows('iron')?1:0)+(knows('steel')?1:0)+boost.food){
    const p=plotPos(plots); tribe.structures.push({type:'plot',x:p.x,y:p.y,need:0,have:0,work:0,workNeed:9,built:false,stage:'tilled',grow:0});
    log(plots?'Another planted patch is scratched out.':'The tribe scratches out a <b>first planted patch</b>.'); return; }
  if(capacity()<pop || (capacity()<pop+2 && pop<LOCAL_CAP && knows('hut'))){ const i=freeSlot(); if(i<0) return; const s=slotPos(i); const type=knows('hut')?'hut':'leanto';
    tribe.structures.push({type,slot:i,x:s.x,y:s.y,need:type==='hut'?8:4,have:0,work:0,workNeed:type==='hut'?14:7,built:false}); return; }
  if(knows('hut')){ const lt=tribe.structures.find(s=>s.built&&s.type==='leanto'); if(lt){ Object.assign(lt,{built:false,upgrading:true,type:'hut',need:6,have:0,work:0,workNeed:12}); return; } }
}
function finishSite(s,who){
  s.built=true; if(who) who.deeds+=1;
  if(s.type==='leanto'){ addLore(6); inspire('hut',3,who); if(!tribe.firstShelter){tribe.firstShelter=true; log('The first <b>lean-to</b> stands at the gathering place.'); if(typeof director==='function') director(s,{kind:'build',caption:'The first shelter stands'});} }
  else if(s.type==='hut'){ addLore(9); log(s.upgrading?'A lean-to is rebuilt as a <b>wattle hut</b>.':'A new <b>wattle hut</b> rises.'); s.upgrading=false; if(knows('copper')||knows('bronze')||knows('iron')||knows('steel')) s.painted=true; }
  else if(s.type==='plot'){ addLore(6); }
}

/* ------------------------------- FIRE ------------------------------ */
const fireLit=()=>tribe.fire.lit;
function lightFire(who){
  const f=tribe.fire; f.lit=true; f.fuel=70; addLore(4);
  if(!knows('fire')){ tribe.known.fire=true; addLore(12); f.ever=true;
    log(`<b>${who?who.name:'Someone'}</b> carries sky-fire home on a stick. Invention: <b>Kept Fire</b>.`); if(typeof director==='function') director(who,{kind:'invent',caption:'Invented: Kept Fire',sub:'carried home from a lightning-struck tree — now it must be fed',big:true});
    for(const v of alive()){ v.fear=Math.max(0,v.fear-30); } }
  else log(`<b>${who?who.name:'Someone'}</b> ${knows('strike')?'strikes sparks and':''} brings the fire back.`);
  if(who){ think(who,{type:'discover'},true); who.deeds+=3; }
}
function updateFire(dt){
  const f=tribe.fire;
  if(f.lit){ f.fuel-=dt*0.45; if(f.fuel<=0){ f.lit=false; f.fuel=0; log('The fire has <b>died</b>. The dark comes closer.'); for(const v of alive()) v.fear=Math.min(100,v.fear+25);
      if(!knows('strike')) tribe.storm=tribe.time+R(40,90); } }
  if(tribe.flash>0) tribe.flash-=dt;
  if(tribe.storm>0 && tribe.time>=tribe.storm && !f.lit){ tribe.storm=-1; lightning(); }
  const b=tribe.burning; if(b){ b.burn-=dt; if(b.burn<=0){ b.burnt=true; tribe.burning=null; if(!f.lit && !knows('strike')) tribe.storm=tribe.time+R(50,100); } }
}
function lightning(){
  const cand=trees.filter(t=>!t.burnt&&dist(t,FIRE)<620&&dist(t,FIRE)>340); const t=cand.length?pick(cand):pick(trees);
  t.burn=40; tribe.burning=t; tribe.flash=0.5; addLore(2);
  log('<b>Sky-fire</b> strikes a tree! It burns.'); if(typeof director==='function') director(t,{kind:'lightning',caption:'Lightning strikes a tree',sub:'the people have never held fire',big:true});
  for(const v of alive()){ v.fear=Math.min(100,v.fear+15); if(dist(v,t)<500) think(v,{type:'awe'},true); }
}

/* ---------------------------- PREDATORS ---------------------------- */
function spawnPred(x,y){
  if(x==null){ const e=RI(0,2); if(e===0){x=R(100,W-100);y=H-20;} else if(e===1){x=20;y=R(900,H-100);} else {x=W-20;y=R(900,H-100);} }
  const p={x,y,hp:100,state:'prowl',target:null,t:0,life:0,face:1,anim:0,cd:0,tx:FIRE.x+R(-300,300),ty:FIRE.y+R(150,400),dead:false,hurtBy:0,corpse:0};
  preds.push(p); log('A <b>Gloamjaw</b> slinks out of the trees.'); if(typeof director==='function') director(p,{kind:'predator',caption:'A Gloamjaw comes out of the trees'});
  return p;
}
const livePreds=()=>preds.filter(p=>!p.dead&&p.state!=='gone');
const huntingPreds=()=>preds.filter(p=>!p.dead&&p.state!=='gone'&&p.state!=='leave');
const safeAt=v=>dist(v,CAVE_IN)<40 || (fireLit()&&dist(v,FIRE)<90);
function fireRepels(p){ return fireLit() && dist(p,FIRE)<(phaseName()!=='Day'?150:85); }
function updatePred(p,dt){
  p.anim+=dt*(p.state==='lunge'?14:7); p.life+=dt; p.cd-=dt; if(p.hurtBy>0) p.hurtBy-=dt;
  if(p.dead){ p.corpse+=dt; return; }
  const mv=(x,y,s)=>{ const dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy)||1; const st=Math.min(d,s*dt); p.x+=dx/d*st; p.y+=dy/d*st; if(Math.abs(dx)>1)p.face=dx<0?-1:1; return d; };
  if(p.state==='leave'){ const ex=p.x<W/2?-80:W+80; mv(ex,p.y+40,95); if(p.x<-40||p.x>W+40){ p.state='gone'; survivedPred(false); } return; }
  if(p.hp<35 || p.life>55){ p.state='leave'; log(p.hp<35?'The Gloamjaw flees, bleeding.':'The Gloamjaw gives up and slinks off.'); return; }
  if(dist(p,CAVE_IN)<70){ const a=Math.atan2(p.y-CAVE_IN.y,p.x-CAVE_IN.x); mv(p.x+Math.cos(a)*60,p.y+Math.sin(a)*60,60); }
  if(fireRepels(p)){ const a=Math.atan2(p.y-FIRE.y,p.x-FIRE.x); mv(p.x+Math.cos(a)*80,p.y+Math.sin(a)*80,70); p.state='prowl';
    if(!tribe.fireRepelled){ tribe.fireRepelled=true; addLore(3); log('The fire <b>watched</b> — the Gloamjaw would not come close.'); belief('fire','the Fire that Watches'); } return; }
  if(p.state==='retreat'){ p.t-=dt; mv(p.x+(p.x-FIRE.x)*0.2,p.y+(p.y-FIRE.y)*0.2,80); if(p.t<=0)p.state='prowl'; return; }
  if(p.state==='lunge'){ p.t-=dt; const tg=p.target; if(!tg||tg.dead||tg.inCave||safeAt(tg)){p.state='prowl';return;} const d=mv(tg.x,tg.y,120);
    if(d<14){ bite(p,tg); p.state='retreat'; p.t=3; } else if(p.t<=0) p.state='stalk'; return; }
  let best=null,bd=1e9; for(const v of alive()){ if(v.inCave||safeAt(v)) continue; const d=dist(v,p); if(d<bd){bd=d;best=v;} }
  if(best && bd<300){ p.target=best; p.state='stalk'; const d=mv(best.x,best.y,bd<120?52:34); if(d<75&&p.cd<=0){ p.state='lunge'; p.t=1.1; p.cd=2.5; } return; }
  p.state='prowl'; if(mv(p.tx,p.ty,30)<10){ p.tx=FIRE.x+R(-420,420); p.ty=FIRE.y+R(-80,450); }
}
function bite(p,v){
  v.hp-=32; v.fear=100; think(v,{type:'bitten'},true); if(typeof director==='function') director(v,{kind:'predator',caption:`The Gloamjaw bites ${v.name}`});
  for(const o of alive()) if(o!==v&&dist(o,v)<220){ o.fear=Math.min(100,o.fear+30); inspire('spear',1.5,o); }
  if(v.hp<=0) kill(v,'taken by the Gloamjaw');
}
function kill(v,why){
  v.dead=true; v.task=null; cairns.push({x:v.x,y:v.y,name:v.name}); tribe.deaths++;
  log(`<b>${v.name}</b> was ${why}. Stones are piled over them.`);
  for(const o of alive()){ o.fear=Math.min(100,o.fear+20); o.faith=Math.min(100,o.faith+5); }
  const near=alive().sort((a,b)=>dist(a,v)-dist(b,v))[0]; if(near) think(near,{type:'grief'},true);
}
function survivedPred(killed){
  tribe.survived++; addLore(killed?25:14);
  belief('tooth','the Tooth in the Dark');
  if(fireLit()&&knows('syll')) startRitual('tooth');
}

/* ------------------------------ RITUALS ---------------------------- */
// Rites only emerge once there is a kept fire, at least one belief and some shared sounds.
const ritesPossible=()=>fireLit() && Object.keys(tribe.beliefs).length>0 && knows('syll');
const ritePlace=()=>tribe.beliefs.stone?STONE:FIRE;
function pickLead(){ const a=adults(); if(!a.length) return null; const sc=v=>v.faith+v.tr.social*15+v.tr.wit*8; let L=a[0]; for(const v of a) if(sc(v)>sc(L)) L=v;
  const was=villagers.find(v=>v.isLead); for(const v of villagers) v.isLead=false; L.isLead=true;
  if(was!==L) log(`<b>${L.name}</b>, the most faithful, now leads the rites — the <b>Fire-Singer</b>.`); return L; }
function startRitual(kind){
  if(tribe.ritual) return;
  const L=pickLead(); tribe.ritual={kind,t:0,dur:kind==='tooth'?13:15,lead:L,at:ritePlace()};
  log(kind==='tooth'?`<b>${L?L.name:'The tribe'}</b> calls a Tooth-Rite.`:`Dusk. <b>${L?L.name:'The tribe'}</b> gathers everyone at the ${tribe.beliefs.stone?'Listening Stone':'fire'}.`);
  for(const v of alive()) if(v.task&&!['flee','fight','brand'].includes(v.task.kind)){ v.task=null; v.carry=null; }
  if(typeof director==='function') director(tribe.ritual.at,{kind:'ritual',caption:kind==='tooth'?'A Tooth-Rite after the beast':'The dusk rite'+(L?' — led by '+L.name:''),zoom:2});
}
function endRitual(){
  const r=tribe.ritual; const part=alive().filter(v=>v.task&&v.task.kind==='ritual'&&v.task.arrived);
  for(const v of part){ v.fear=Math.max(0,v.fear-40); v.faith=Math.min(100,v.faith+8); v.task=null; }
  addLore(4+part.length*0.6); tribe.rites++;
  inspire('words',4,r.lead); inspire('myths',5,r.lead);
  if(!tribe.beliefs.stone && tribe.rites>=2 && r.lead){ tribe.handprints=true; belief('stone','the Stone that Listens'); log(`<b>${r.lead.name}</b> presses ochre hands on the odd stone with the hole. The rites move there.`); }
  const sp=part[Math.floor(rng()*part.length)]; if(sp) think(sp,{type:'ritual_end'},true);
  if(r.lead) r.lead.faith=Math.min(100,r.lead.faith+4);
  tribe.ritual=null;
}

/* ------------------------------- TIME ------------------------------ */
const phase=()=>(tribe.time%DAY)/DAY;
function phaseName(){ const f=phase(); return f<0.08?'Dawn':f<0.64?'Day':f<0.76?'Dusk':'Night'; }
const SEASONS=['Early Autumn','Late Autumn','First Frost','Deep Cold','Thaw','Green Time'];
const season=()=>SEASONS[Math.floor((tribe.day-1)/5)%SEASONS.length];   // seasons stay cosmetic (cycle every 5 sim-days)
/* v3.6.1 calendar: tribe.day stays the internal sim-day counter (DAY=120 sim-s). The UI shows a historical
   calendar year = piecewise-linear interpolation of CAL anchors [sim-day, year] (negative = BCE), then
   +CAL_TAIL years per sim-day after the last anchor. Anchors match the measured v3.6 pace (Copper d22, Steel d92,
   Gunpowder d105, Steam d116, Electricity d133, Spaceflight projected ~d330–400). */
const CAL=[[1,-12000],[22,-5000],[50,-3000],[92,1000],[105,1450],[116,1712],[133,1880],[360,1957],[400,1971]], CAL_TAIL=0.35;
function calYear(d){ if(d<=CAL[0][0]) return CAL[0][1]; for(let i=1;i<CAL.length;i++){ const [d1,y1]=CAL[i]; if(d<=d1){ const [d0,y0]=CAL[i-1]; return Math.round(y0+(y1-y0)*(d-d0)/(d1-d0)); } } const L=CAL[CAL.length-1]; return Math.round(L[1]+(d-L[0])*CAL_TAIL); }
function fmtYear(d){ const y=calYear(d); return y<=0?`${(-y||1).toLocaleString('en-US')} BCE`:`${y} CE`; }
const nowDay=()=>1+tribe.time/DAY;   // fractional sim-day, so the clock moves smoothly

/* ----------------------------- AGENT AI ---------------------------- */
function moveTo(v,x,y,dt,m){ const dx=x-v.x,dy=y-v.y,d=Math.hypot(dx,dy); if(d<3) return true; const s=Math.min(d,v.spd*(m||1)*(v.child?0.8:1)*dt); v.x+=dx/d*s; v.y+=dy/d*s; if(Math.abs(dx)>0.5)v.face=dx<0?-1:1; v.moving=true; return d-s<3; }
// tool tiers: 0 bare · 1 stick · 2 pointed · 3 flint · 4 copper · 5 bronze · 6 iron
const maxTier=()=>boost.tool>0?8:knows('steel')?7:knows('iron')?6:knows('bronze')?5:knows('copper')?4:knows('flint')?3:knows('spear')?2:knows('sticks')?1:0;
function nearest(list,v,ok,k){ const c=list.filter(ok).sort((a,b)=>dist(a,v)-dist(b,v)); return c.length?c[Math.floor(rng()*Math.min(k||3,c.length))]:null; }
const near=(v,r)=>alive().filter(o=>o!==v&&dist(o,v)<r);

function chooseWork(v){
  const pop=alive().length;
  if(v.hunger>62){ if(tribe.food>0) return {kind:'eat'}; think(v,{type:'hungry'}); const b=nearest(bushes,v,b=>b.berries>0); if(b) return {kind:'forage',tgt:b,eatNow:true}; }
  if(v.child) return {kind:'wander',x:STOCK.x+R(-90,90),y:STOCK.y+R(-40,90),dur:R(3,7)};
  const T=maxTier();
  if(v.tool<T){ if(T===1) return {kind:'pickstick',tgt:nearest(trees,v,t=>!t.burnt,3)};
    if(T===2&&tribe.sticks>=1) return {kind:'craft'}; if(T===3&&tribe.sticks>=1&&tribe.flint>=1) return {kind:'craft'}; if(T>=4&&tribe.flint>=1&&fireLit()) return {kind:'craft'}; }
  if(fireLit() && tribe.fire.fuel<55 && tribe.sticks>0 && !alive().some(o=>o.task&&o.task.kind==='feed')) return {kind:'feed'};
  if(!fireLit() && knows('strike') && tribe.sticks>=2 && !alive().some(o=>o.task&&o.task.kind==='relight')) return {kind:'relight'};
  const opts=[], site=activeSite();
  if(site&&site.type!=='plot'){ if(site.have<site.need) opts.push([tribe.sticks>0?'haul':'sticks',5]); else opts.push(['build',6]); }
  if(site&&site.type==='plot') opts.push(['build',5]);
  opts.push(['forage', tribe.food<pop*2?7:tribe.food<pop*4?3:1]);
  if(knows('sticks')) opts.push(['sticks', tribe.sticks<6?3:1]);
  if(v.tool>=2) opts.push(['hunt',2.5]); else opts.push(['chase',0.6]);
  if(knows('flint')&&tribe.flint<3) opts.push(['flint',2]);
  if(knows('planting')){ const pl=tribe.structures.filter(s=>s.type==='plot'&&s.built); if(pl.some(s=>s.stage==='tilled'||s.stage==='ripe')) opts.push(['farm',8]); else if(pl.length) opts.push(['farm',1.5]); }
  if(v.tr.hands>1.15 && site) opts.push(['build_bias',3]);
  if(v.type==='bold' && v.tool>=1) opts.push(['hunt',2.5]);
  if(v.type==='forage') opts.push(['forage',3]);
  if(v.type==='wit') opts.push(['ponder',2.2]);
  if(alive().some(c=>c.child) && v.tr.care>1.1) opts.push(['tend',2+v.tr.care*2]);
  opts.push(['idle', 1.4*v.tr.social]);
  let r=rng()*opts.reduce((n,o)=>n+o[1],0), job='idle'; for(const o of opts){ r-=o[1]; if(r<=0){job=o[0];break;} }
  switch(job){
    case 'forage': { const useRoot=rng()<.35; const t=useRoot?nearest(roots,v,x=>x.amt>0):nearest(bushes,v,b=>b.berries>0); return t?{kind:'forage',tgt:t,root:useRoot}:{kind:'wander',x:v.x+R(-80,80),y:v.y+R(-80,80),dur:2}; }
    case 'sticks': return {kind:'sticks',tgt:nearest(trees,v,t=>!t.burnt,5)};
    case 'haul': return {kind:'haul',site};
    case 'build': return {kind:'build',site};
    case 'hunt': case 'chase': { const s=nearest(skitters,v,s=>s.alive,2); return s?{kind:'hunt',tgt:s}:{kind:'idle'}; }
    case 'flint': { const f=nearest(flints,v,f=>f.amt>0,2); return f?{kind:'flint',tgt:f}:{kind:'idle'}; }
    case 'farm': return {kind:'farm'};
    case 'build_bias': return site.type!=='plot'&&site.have<site.need?(tribe.sticks>0?{kind:'haul',site}:{kind:'sticks',tgt:nearest(trees,v,t=>!t.burnt,5)}):{kind:'build',site};
    case 'ponder': { const spot=pick([STONE,{x:v.x+R(-120,120),y:v.y+R(-120,120)},CAVE_IN]); return {kind:'ponder',x:spot.x+R(-30,30),y:spot.y+R(10,40)}; }
    case 'tend': { const c=pick(alive().filter(c=>c.child)); return c?{kind:'tend',c}:{kind:'idle'}; }
    default: { const others=near(v,400); const o=others.length?pick(others):null; const base=fireLit()?FIRE:o||STOCK; return {kind:'idle',x:base.x+R(-50,50),y:base.y+R(-20,50),dur:R(4,8)}; }
  }
}

function updateVillager(v,dt){
  v.anim+=dt*8; v.moving=false; v.working=false; v.pondering=false; v.fearCD-=dt;
  if(v.bubble){ v.bubble.t-=dt; if(v.bubble.t<=0) v.bubble=null; }
  if(v.child){ v.grow+=dt/90; if(v.grow>=1){ v.child=false; log(`<b>${v.name}</b> is grown and joins the work.`);} }
  const ph=phaseName(), sleeping=v.task&&v.task.kind==='sleep'&&v.task.arrived;
  v.hunger=Math.min(100,v.hunger+dt*(sleeping?0.18:0.42));
  if(v.hunger>=100){ v.hp-=dt*0.8; if(v.hp<=0){ kill(v,'lost to hunger'); return; } }
  v.hp=Math.min(100,v.hp+dt*(sleeping?1.5:0.25));
  const warm=fireLit()&&dist(v,FIRE)<110;
  v.fear=Math.max(0,v.fear-dt*(warm?3.5:1.2)*(1+v.faith/120));
  if(ph==='Night'&&!sleeping&&!warm) v.fear=Math.min(100,v.fear+dt*1.5);
  v.inCave = sleeping && v.sleepSpot==='cave';

  // 1) threat — highest priority
  let th=null,td=1e9; for(const p of huntingPreds()){ const d=dist(p,v); if(d<td){td=d;th=p;} }
  if(th && td<230 && !v.inCave){
    const alliesArmed=alive().filter(o=>o!==v&&o.tool>=2&&!o.child&&dist(o,th)<260).length;
    const canFight=!v.child && v.tool>=2 && v.hp>35 && (alliesArmed>=2 || ((knows('flint')||v.tr.bold>1.25)&&alliesArmed>=1) || v.tool>=4);
    if(!v.task || !['flee','fight'].includes(v.task.kind)){
      v.fear=Math.min(100,v.fear+25); if(v.carry&&v.carry.type!=='brand') v.carry=null;
      inspire('spear',2,v); inspire('syll',0.5,v);
      const r=think(v,{type:'see_predator',allies:alliesArmed},true);
      if(canFight && r.actionHint!=='flee'){ v.task={kind:'fight',p:th,t:0}; think(v,{type:'fight'},true); }   // Mind hint is advisory; rules decide
      else v.task={kind:'flee',t:0};
    }
  }
  // 2) fear: before any belief they cower; after, they pray
  if((!v.task || ['idle','wander'].includes(v.task.kind)) && v.fear>70-v.faith*0.2 && !th && v.fearCD<=0){
    const r=think(v,{type:'fear_high'},true); v.task={kind:'pray',t:0,dur:4,cower:r.actionHint!=='pray'}; v.fearCD=8; }
  // 3) rite / night overrides
  if(tribe.ritual && !v.child && (!v.task || !['flee','fight','ritual','pray','brand'].includes(v.task.kind))){ v.carry=null; v.task={kind:'ritual',t:0}; }
  if(ph==='Night' && !tribe.ritual && (!v.task || !['flee','fight','sleep','pray','brand'].includes(v.task.kind))){ if(v.carry&&v.carry.type!=='brand') v.carry=null; v.task={kind:'sleep',t:0}; }
  if(v.task && v.task.kind==='sleep' && ph!=='Night') v.task=null;
  if(!v.task){ v.task=chooseWork(v); v.task.t=0; }
  runTask(v,dt);
  // social moments grow language
  v.talkT-=dt; if(v.talkT<=0){ v.talkT=R(8,18); const company=near(v,70).length;
    if(v.task&&['idle','wander','eat'].includes(v.task.kind)){ think(v,{type:'idle'}); if(company){ inspire('syll',1,v); inspire('words',1,v); inspire('myths',0.6,v); } } }
}
function deposit(v){ const c=v.carry; if(!c) return; if(c.type==='food'){tribe.food+=c.n; addLore(c.n*0.5); if(c.root) inspire('planting',1,v);} else if(c.type==='sticks'){tribe.sticks+=c.n; addLore(0.4);} else if(c.type==='flint'){tribe.flint+=c.n; addLore(1); inspire('strike',1,v); inspire('copper',1,v); if(knows('copper')) inspire('bronze',0.8,v); if(knows('bronze')) inspire('iron',0.6,v); if(knows('iron')) inspire('steel',0.5,v);} v.carry=null; }
function runTask(v,dt){
  const k=v.task; k.t+=dt; const done=()=>{v.task=null;};
  if(k.t>60 && !['sleep','ritual'].includes(k.kind)) return done();
  switch(k.kind){
    case 'idle': case 'wander': { if(k.x==null){k.x=v.x+R(-60,60);k.y=v.y+R(-60,60);k.dur=k.dur||3;} if(moveTo(v,k.x,k.y,dt,0.6)){ k.w=(k.w||0)+dt; if(k.w>k.dur) done(); } break; }
    case 'eat': if(moveTo(v,STOCK.x,STOCK.y+12,dt)){ k.w=(k.w||0)+dt; if(k.w>1.5){ if(tribe.food>0){tribe.food--; v.hunger=Math.max(0,v.hunger-48); if(rng()<.3)think(v,{type:'work',job:'eat'}); if(near(v,60).length) inspire('syll',0.5,v); inspire('planting',0.3,v);} done(); } } break;
    case 'forage': { const t=k.tgt; if(!k.back){ if(moveTo(v,t.x,t.y+10,dt)){ v.working=true; k.w=(k.w||0)+dt; if(k.w>(k.root&&v.tool<1?4:2.6)/v.tr.forage){ const have=k.root?t.amt:t.berries; if(have<=0) return done();
            const n=Math.min(have,2); if(k.root)t.amt-=n; else t.berries-=n;
            inspire('sticks',k.root?1.5:0.8,v);   // pulling at roots/branches gives the idea of a stick
            if(k.eatNow){ v.hunger=Math.max(0,v.hunger-15*n); return done(); }
            v.carry={type:'food',n:k.root?n+1:n,root:k.root}; k.back=true; think(v,{type:'work',job:k.root?'root':'forage'}); } } }
        else if(moveTo(v,STOCK.x,STOCK.y,dt)){ deposit(v); done(); } break; }
    case 'ponder': if(moveTo(v,k.x,k.y,dt,0.7)){ k.w=(k.w||0)+dt; v.pondering=true; if(!k.said){ k.said=1; think(v,{type:'ponder'},true); }
        if(k.w>6){ const open=Object.keys(INV).filter(id=>!knows(id)&&!INV[id].event&&prereqOK(id)); if(open.length) inspire(pick(open),1.2,v); done(); } } break;
    case 'tend': { const c=k.c; if(!c||c.dead||!c.child) return done(); if(moveTo(v,c.x+10,c.y,dt)){ k.w=(k.w||0)+dt; v.working=true; if(k.w>2.5){ if(tribe.food>0&&c.hunger>20){ tribe.food--; c.hunger=Math.max(0,c.hunger-45);} c.fear=Math.max(0,c.fear-30); c.grow+=0.02*v.tr.care; think(v,{type:'work',job:'tend'}); done(); } } break; }
    case 'pickstick': { const t=k.tgt; if(!t) return done(); if(moveTo(v,t.x+12,t.y+12,dt)){ v.working=true; k.w=(k.w||0)+dt; if(k.w>2){ v.tool=Math.max(v.tool,1); think(v,{type:'work',job:'sticks'}); done(); } } break; }
    case 'sticks': { const t=k.tgt; if(!t) return done(); if(!k.back){ if(moveTo(v,t.x+12,t.y+12,dt)){ v.working=true; k.w=(k.w||0)+dt; if(k.w>2.4){ v.carry={type:'sticks',n:2}; k.back=true; if(rng()<.3)think(v,{type:'work',job:'sticks'}); } } }
        else if(moveTo(v,STOCK.x,STOCK.y,dt)){ deposit(v); done(); } break; }
    case 'flint': { const t=k.tgt; if(!k.back){ if(moveTo(v,t.x,t.y+12,dt)){ v.working=true; k.w=(k.w||0)+dt; if(k.w>3){ if(t.amt<=0) return done(); t.amt--; v.carry={type:'flint',n:1}; k.back=true; think(v,{type:'work',job:'flint'}); } } }
        else if(moveTo(v,STOCK.x,STOCK.y,dt)){ deposit(v); done(); } break; }
    case 'feed': if(moveTo(v,FIRE.x-14,FIRE.y+18,dt)){ k.w=(k.w||0)+dt; v.working=true; if(k.w>1.5){ if(tribe.sticks>0&&fireLit()){ const n=Math.min(2,tribe.sticks); tribe.sticks-=n; tribe.fire.fuel=Math.min(100,tribe.fire.fuel+22*n); think(v,{type:'work',job:'feed'}); inspire('copper',0.6,v); if(knows('copper')) inspire('bronze',0.4,v); if(knows('bronze')) inspire('iron',0.3,v); if(knows('iron')) inspire('steel',0.25,v); } done(); } } break;
    case 'relight': if(moveTo(v,FIRE.x-14,FIRE.y+18,dt)){ k.w=(k.w||0)+dt; v.working=true; if(k.w>5){ if(tribe.sticks>=2&&!fireLit()){ tribe.sticks-=2; lightFire(v); } done(); } } break;
    case 'brand': { const t=k.tree; if(!k.got){ if(!t||t.burn<=0) return done(); if(moveTo(v,t.x+16,t.y+8,dt)){ k.w=(k.w||0)+dt; if(k.w>1.5){ k.got=true; v.carry={type:'brand'}; } } }
        else if(moveTo(v,FIRE.x,FIRE.y+8,dt)){ v.carry=null; if(!fireLit()) lightFire(v); done(); } break; }
    case 'haul': { const s=k.site; if(!s||s.built) return done(); if(!k.got){ if(moveTo(v,STOCK.x,STOCK.y,dt)){ const n=Math.min(2,tribe.sticks,s.need-s.have); if(n<=0) return done(); tribe.sticks-=n; v.carry={type:'sticks',n}; k.got=true; } }
        else if(moveTo(v,s.x,s.y+14,dt)){ s.have+=v.carry?v.carry.n:0; v.carry=null; done(); } break; }
    case 'build': { const s=k.site; if(!s||s.built||s.have<s.need) return done(); if(k.ox==null) k.ox=R(-20,20); if(moveTo(v,s.x+k.ox,s.y+16,dt)){ v.working=true; s.work+=dt*v.tr.hands; if(!k.said){k.said=1; think(v,{type:'work',job:s.type==='plot'?'farm':'build'});} if(s.work>=s.workNeed){ finishSite(s,v); done(); } else if(k.t>14) done(); } break; }
    case 'craft': if(moveTo(v,STOCK.x+6,STOCK.y+14,dt)){ k.w=(k.w||0)+dt*v.tr.hands; v.working=true; if(k.w>3){ const T=maxTier();
          if(T===2&&tribe.sticks>=1){tribe.sticks--; v.tool=2; inspire('flint',3,v);} else if(T===3&&tribe.sticks>=1&&tribe.flint>=1){tribe.sticks--;tribe.flint--; v.tool=3;} else if(T>=4&&tribe.flint>=1&&fireLit()){tribe.flint--; v.tool=T;} else return done();
          addLore(3); think(v,{type:'work',job:'craft'}); done(); } } break;
    case 'hunt': { const s=k.tgt; if(!k.back){ if(!s.alive) return done(); const d=dist(v,s); moveTo(v,s.x,s.y,dt,1.15); k.throwT=(k.throwT||0)-dt;
          if(d<(v.tool>=2?55:30)&&k.throwT<=0){ k.throwT=1.2; if(rng()<(v.tool>=2?0.22+v.tool*0.08:0.06)*v.tr.bold){ s.alive=false; s.rs=45; v.carry={type:'food',n:4}; k.back=true; addLore(2); think(v,{type:'work',job:'hunt'}); } else if(v.tool<2) inspire('spear',1,v); else inspire('flint',0.5,v); }
          if(k.t>(v.tool>=2?20:10)){ if(v.tool<2) inspire('spear',1.5,v); done(); } }
        else if(moveTo(v,STOCK.x,STOCK.y,dt)){ deposit(v); done(); } break; }
    case 'farm': { if(!k.p){ const pl=tribe.structures.filter(s=>s.type==='plot'&&s.built); k.p=pl.find(s=>s.stage==='ripe')||pl.find(s=>s.stage==='tilled')||pl[Math.floor(rng()*pl.length)]; k.ox=R(-25,25); } const p=k.p; if(!p) return done();
        if(!k.back){ if(moveTo(v,p.x+k.ox,p.y+4,dt)){ k.w=(k.w||0)+dt; v.working=true; if(k.w>3){ if(p.stage==='ripe'){ p.stage='tilled'; p.grow=0; v.carry={type:'food',n:7}; k.back=true; addLore(3); } else if(p.stage==='tilled'){ p.stage='growing'; p.grow=0; think(v,{type:'work',job:'farm'}); done(); } else { p.grow=Math.min(1,p.grow+0.12); done(); } } } }
        else if(moveTo(v,STOCK.x,STOCK.y,dt)){ deposit(v); done(); } break; }
    case 'flee': { const toFire=fireLit()&&dist(v,FIRE)<dist(v,CAVE_IN)*1.6; const tgt=toFire?{x:FIRE.x+(v.id%3-1)*18,y:FIRE.y+18+(v.id%2)*10}:{x:CAVE_IN.x+(v.id%3-1)*10,y:CAVE_IN.y}; moveTo(v,tgt.x,tgt.y,dt,1.45);
        if(near(v,60).length) inspire('syll',0.05,v);
        if(!huntingPreds().some(p=>dist(p,v)<300)&&k.t>3) done(); break; }
    case 'fight': { const p=k.p; if(!p||p.dead||p.state==='leave'||p.state==='gone') return done(); const d=dist(v,p); moveTo(v,p.x-(v.x<p.x?18:-18),p.y,dt,1.3);
        k.hit=(k.hit||0)-dt; if(d<30&&k.hit<=0){ k.hit=1; v.working=true; p.hp-=[0,3,7,13,20,24,28,32,60][v.tool]; p.hurtBy=0.3; inspire('flint',0.5,v);
          if(p.hp<=0){ p.dead=true; p.state='dead'; log(`The Gloamjaw falls to <b>${v.name}</b>'s spear!`); v.deeds+=5; tribe.food+=6; survivedPred(true);} }
        if(v.hp<30) v.task={kind:'flee',t:0}; break; }
    case 'pray': { k.w=(k.w||0)+dt; if(k.w>k.dur){ v.fear=Math.max(0,v.fear-(k.cower?25:45)); if(!k.cower){ v.faith=Math.min(100,v.faith+6); addLore(0.6);} else v.faith=Math.min(100,v.faith+1.5); done(); } break; }
    case 'ritual': { const r=tribe.ritual; if(!r) return done(); const C=r.at; let tx,ty;
        if(v===r.lead){ tx=C.x-16; ty=C.y+14; } else { const ring=alive().filter(o=>!o.child&&o!==r.lead); const i=ring.indexOf(v), n=Math.max(1,ring.length); const a=Math.PI*0.1+(i/n)*Math.PI*1.8; tx=C.x+Math.cos(a)*(C===FIRE?48:66); ty=C.y+(C===FIRE?6:24)+Math.sin(a)*(C===FIRE?34:42); }
        if(moveTo(v,tx,ty,dt)){ k.arrived=true; v.face=C.x<v.x?-1:1; k.c=(k.c==null?R(0,3):k.c)-dt; if(k.c<=0){ k.c=R(3,6); think(v,{type:'chant'},true); } } break; }
    case 'sleep': { const h=v.home; let tgt; if(h) tgt={x:h.x+(v.id%2?6:-6),y:h.y+10}; else if(v.sleepSpot==='cave') tgt={x:CAVE_IN.x+(v.id%5-2)*12,y:CAVE_IN.y-4}; else if(fireLit()) tgt={x:FIRE.x+Math.cos(v.id)*40,y:FIRE.y+Math.sin(v.id)*22+8}; else tgt={x:CAVE_IN.x+(v.id%7-3)*16,y:CAVE_IN.y+30};
        if(moveTo(v,tgt.x,tgt.y,dt)) k.arrived=true; break; }
    default: done();
  }
}
function assignHomes(){
  const shel=tribe.structures.filter(s=>s.built&&CAP[s.type]); const vs=alive(); let i=0;
  for(const s of shel){ for(let c=0;c<CAP[s.type]&&i<vs.length;c++){ vs[i].home=s; vs[i].sleepSpot='shelter'; i++; } }
  let cave=0; for(;i<vs.length;i++){ vs[i].home=null; vs[i].sleepSpot=cave++<CAVE_CAP?'cave':'open'; }
  // nights teach: cramped cave / open ground -> lean-to idea; lean-to nights -> hut idea
  for(const v of vs){ if(v.sleepSpot!=='shelter') inspire('leanto',v.sleepSpot==='open'?2:1.2,v); else if(v.home.type==='leanto') inspire('hut',0.6,v); }
}
function updateSkitter(s,dt){
  if(!s.alive){ s.rs-=dt; if(s.rs<=0){ s.alive=true; s.x=s.hx; s.y=s.hy; } return; }
  s.t-=dt; let thr=null; for(const v of villagers){ if(!v.dead&&dist(v,s)<70){thr=v;break;} }
  if(thr){ const a=Math.atan2(s.y-thr.y,s.x-thr.x)+R(-.4,.4); s.vx=Math.cos(a)*48; s.vy=Math.sin(a)*48; }
  else if(s.t<=0){ s.t=R(1,3); if(rng()<.5){ s.vx=0;s.vy=0; } else { const a=R(0,6.28); s.vx=Math.cos(a)*14; s.vy=Math.sin(a)*14; } }
  s.x=clamp(s.x+s.vx*dt,40,W-40); s.y=clamp(s.y+s.vy*dt,ridgeEdge(s.x)+40,H-40);
  if(Math.hypot(s.x-s.hx,s.y-s.hy)>300){ s.vx=(s.hx-s.x)*0.1; s.vy=(s.hy-s.y)*0.1; }
}

/* ---------------------------- WORLD TICK --------------------------- */
let lastPhase=null, planT=0;
let SIM_BATCH=0, worldAcc=0;   // v3.6.5 high-speed batching (set by the frame loop from the speed)
function step(dt){
  tribe.time+=dt; const d=Math.floor(tribe.time/DAY)+1; if(d!==tribe.day){ tribe.day=d; log(`${season()}.`); }
  const ph=phaseName();
  if(ph!==lastPhase){
    if(ph==='Dusk' && tribe.ritualDay!==tribe.day && !huntingPreds().length && ritesPossible() && (typeof riteToday!=='function'||riteToday())){ tribe.ritualDay=tribe.day; startRitual('dusk'); }
    if(ph==='Dusk' && fireLit()) for(const v of alive()) if(dist(v,FIRE)<200){ inspire('syll',0.6,v); inspire('words',0.6,v); }
    if(ph==='Night') assignHomes();
    if(ph==='Dawn' && fireLit()){ tribe.fire.nights++; if(tribe.fire.nights>=2) belief('fire','the Fire that Watches'); }
    lastPhase=ph; }
  if(tribe.toast){ tribe.toast.t-=dt; if(tribe.toast.t<=0) tribe.toast=null; }
  updateFire(dt);
  if(tribe.burning && !alive().some(v=>v.task&&v.task.kind==='brand')){
    const c=adults().filter(v=>!v.task||!['flee','fight'].includes(v.task.kind)).sort((a,b)=>(a.fear-b.fear)||(dist(a,tribe.burning)-dist(b,tribe.burning)))[0];
    if(c && knows('sticks') && !fireLit()){ c.task={kind:'brand',tree:tribe.burning,t:0}; c.carry=null; }
  }
  if(tribe.ritual){ tribe.ritual.t+=dt; if(tribe.ritual.t>tribe.ritual.dur) endRitual(); }
  for(const b of bushes){ if(b.berries<b.max){ b.rg+=dt; if(b.rg>22){b.rg=0;b.berries++;} } }
  for(const r of roots){ if(r.amt<3){ r.rg+=dt; if(r.rg>40){r.rg=0;r.amt++;} } }
  for(const f of flints){ if(f.amt<4){ f.rg+=dt; if(f.rg>60){f.rg=0;f.amt++;} } }
  for(const s of skitters) updateSkitter(s,dt);
  for(const p of tribe.structures) if(p.type==='plot'&&p.built&&p.stage==='growing'){ p.grow+=dt/55; if(p.grow>=1){p.grow=1;p.stage='ripe';} }
  planT-=dt; if(planT<=0){ planT=2; planBuilding(); }
  researchStep(dt);
  ageCheck();
  // births: two or more adults, food to spare, somewhere to sleep
  tribe.birthT+=dt; { const pop=alive().length, room=CAVE_CAP+capacity();
    const kk=adults().some(a=>a.type==='care')?0.8:1;
    if(tribe.birthT>80*kk/Math.max(1,adults().length/4) && adults().length>=2 && pop<Math.min(LOCAL_CAP,room) && tribe.food>=pop*1.2+2){ tribe.birthT=0; tribe.food-=2;
      const A=adults(); const c=mkVillager(STOCK.x+R(-20,20),STOCK.y+30,true,[pick(A),pick(A)]); tribe.births++; log(`A child is born: <b>${c.name}</b>${c.tr[c.type]>1.2?` (a born ${TYPES[c.type]}?)`:''}.`); if(typeof director==='function') director(c,{kind:'birth',caption:`A child is born: ${c.name}`}); inspire('words',2); } }
  // if the people dwindle, wanderers may find the hollow (keeps the world going)
  if(alive().length<2){ tribe.strangerT+=dt; if(tribe.strangerT>60){ tribe.strangerT=0; for(let i=0;i<2;i++) mkVillager(20,R(800,1200)); log('Two <b>wanderers</b> find the hollow.'); } }
  /* v3.6.5: at high speed the world layer (growth, splits, research, diplomacy, factions) runs on accumulated
     time every SIM_BATCH sim-seconds instead of every sub-step. Everything in it is dt-based, so totals, the
     clock and inventions stay the same; only how often it is evaluated changes. SIM_BATCH=0 → every step. */
  worldAcc+=dt; if(typeof worldStep==='function'&&worldAcc>=SIM_BATCH){ const wd=worldAcc; worldAcc=0; worldStep(wd); }
  for(const v of villagers) if(!v.dead) updateVillager(v,dt);
  for(const p of preds) updatePred(p,dt);
  if(typeof strangerStep==='function') strangerStep(dt);   // v3.6.6 the Stranger (stranger.js)
  for(let i=preds.length-1;i>=0;i--) if(preds[i].state==='gone'||(preds[i].dead&&preds[i].corpse>40)) preds.splice(i,1);
}
/* OBSERVER AWARENESS (stub). If a far-future age is ever added (AGES entry with
   future:true), call this once: the people come to sense they are being watched.
   The Space Age tech has fx:'aware', so its AGES entry has future:true and this fires once. */
function onObserverAwareness(){ log('The people look up, all at once, as if someone were watching them.'); for(const v of alive()) say(v,'?','they sense the watcher',5); }
function onAgeUp(a){
  const A=AGES[a]; log(`The people enter the <b>${A.n}</b>.`); banner(A.n, A.sub); if(typeof director==='function') director(FIRE,{kind:'age',caption:'A new age: '+A.n,zoom:1.1}); if(A.future) onObserverAwareness();
  if(a===4) for(const s of tribe.structures) if(s.type==='hut') s.painted=true;
  const sp=alive()[0]; if(sp) think(sp,{type:'age_up',age:a},true);
}
