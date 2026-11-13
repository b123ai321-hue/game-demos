"use strict";
/* ASH HOLLOW — interconnected systems ("ripples"). A few multipliers and
   event hooks tie trade, economy, war, myth and discovery together:
     trade → economy    each trade/allied route adds wealth; the home people
                        also get food and lore flowing in along the routes
     economy → ideas    richer peoples invent faster (wealth multiplier)
     routes → ideas     every live route speeds ideas; a route broken by war
                        is announced and the bonus drops at once
     economy → war      wealth (surplus) makes armies stronger
     war → economy      battles burn wealth; war breaks trade
     war → myth         a victory or defeat for Ash Hollow births a war myth
                        (a new saying, faith); others gain myth too
     myth → war         war myths are morale: strength +5% each (to +30%)
     myth → trade       peoples who both have myths warm to each other faster
     trade → myth       traders carry stories: foreign sayings reach Ash
                        Hollow, and home myths spread to trading partners
   Every visible ripple gets a toast from the director.                    */
function routesOf(f){ let n=0; for(const r of relsOf(f.id)) if(r.state==='trade'||r.state==='allied') n++; return n; }
const wealthMult=f=>1+0.12*Math.min(3,f&&f.wealth||0);
const routeMult=f=>1+0.1*Math.min(5,f&&f.routes||0);
const mythsOf=f=>f.home?(tribe.warMyths||0)+Object.keys(tribe.beliefs).length*0.5:(f.myths||0);
const moraleMult=f=>1+0.05*Math.min(6,f.home?(tribe.warMyths||0):(f.warMyths||0));
function econStep(){
  cultureStep();
  const GC=new Map(), GO=f=>{ let g=GC.get(f.id); if(!g){ g=typeof goodOf==='function'?goodOf(f):{kind:'-'}; GC.set(f.id,g); } return g; };   // v3.7 trade goods, once per people per tick
  for(const f of world.factions){ if(!f.setts) continue;
    f.routes=routesOf(f); const atWar=relsOf(f.id).some(r=>r.state==='war');
    const gb=f.routes&&typeof goodsBonus==='function'?goodsBonus(f,GO):{v:0,ins:[]}; if(f.home) f.goodsIn=gb.ins.slice(0,4).map(([g,o])=>[g.name,o.root]);   // v3.7: different goods are worth more than the same good
    const scarce=typeof resRatio==='function'&&resRatio(f)<0.3?0.4:0;   // v3.7: spent ore and fuel
    const target=Math.min(3,0.4*f.routes+gb.v+(f.home&&world.peace.on?0.3:0)+(f.gov>=3?0.3:0)-(atWar?0.4:0)-scarce);
    f.wealth=Math.max(0,(f.wealth||0)+(target-(f.wealth||0))*0.15);
    if(f.home&&f.routes){ tribe.food=Math.min(tribe.food+f.routes,60); addLore(0.5*f.routes); }     // goods along the routes
    // trade spreads myths both ways
    if(f.routes&&!f.home&&rng()<0.04*f.routes){ f.myths=(f.myths||0)+0.5; }
  }
  const h=world.factions[0];
  if(h.routes&&tribe.words&&knows('myths')&&rng()<0.02*h.routes){ const partners=Object.values(world.rel).filter(r=>(r.a===0||r.b===0)&&(r.state==='trade'||r.state==='allied')); const r=pick(partners), o=world.factions[r.a===0?r.b:r.a];
    if(o){ const word=(typeof factionWords==='function'?factionWords(o):(o.words||(o.words=coinWords(rng))))[pick(['sky','fire','good','sun','stone'])]; tribe.extraMyths.push([`${cap(word)}, ${tribe.words.us} ${tribe.words.good}.`,`a story the ${o.root} traders brought`]);
      for(const v of alive()) v.faith=Math.min(100,v.faith+3);
      ripple(`Traders from the ${o.root}-folk bring a story: “${cap(word)}…”`,'trade carried a myth to Ash Hollow'); } }
  if(typeof thoughtStep==='function') thoughtStep();          // v3.7 intellect + philosophies + their spread (thought.js)
  if(typeof disasterStep==='function') disasterStep(DIPLO_TICK);   // v3.7 rare emergent catastrophes (disasters.js)
}
function ripple(caption,sub){ log(`<i>Ripple:</i> ${caption} — ${sub}.`); if(typeof director==='function') director(null,{kind:'ripple',caption,sub}); }
// war → myth (+ morale), war → economy
function onBattle(win,lose,ls){
  win.wealth=(win.wealth||0)+0.1; lose.wealth=Math.max(0,(lose.wealth||0)-0.3);
  if(!win.home) win.warMyths=Math.min(6,(win.warMyths||0)+0.34); if(!lose.home) lose.warMyths=Math.min(6,(lose.warMyths||0)+0.2);
}
function onWarEnd(win,lose,ls){
  lose.lesson=lose.lesson||'defeat'; lose.doubt=(lose.doubt||0)+0.8;   // v3.7: a lost war makes a people question its teaching
  for(const [f,won] of [[win,true],[lose,false]]){
    if(!f.home){ f.warMyths=Math.min(6,(f.warMyths||0)+1); continue; }
    tribe.warMyths=Math.min(6,(tribe.warMyths||0)+1);
    const w=tribe.words, place=ls.name;
    if(w) tribe.extraMyths.push(won?[`${cap(w.fire)} ${w.keep} ${w.us}! ${place}!`,`the song of the victory at ${place}`]:[`${cap(w.dark)} ${w.go}… ${w.us} ${w.keep}.`,`the lament for ${place}`]);
    for(const v of alive()) v.faith=Math.min(100,v.faith+(won?6:10));
    if(!tribe.beliefs.warmyth) belief('warmyth',won?'the Spear that Remembers — victory is sung':'the Long Grief — the lost are sung');
    ripple(won?`Victory at ${place} becomes a song`:`Defeat at ${place} birthed a myth`,`war myths now steel Ash Hollow in battle (+${Math.round((moraleMult(f)-1)*100)}% morale)`);
  }
}
function onRouteBroken(A,B){ if(A.home||B.home){ const o=A.home?B:A; ripple(`War broke the trade route with the ${o.root}-folk`,'goods and new ideas slow down'); } }

/* ------------------------- CULTURE (emergent) ---------------------------
   Each people has three culture leanings, 0..1, that drift from its OWN
   history every diplomacy tick — nothing is assigned as a fixed faction:
     war   – warlike:   war myths, battles won, a beast-belief (home), rivals near
     open  – open-handed: live trade routes, alliances, wealth
     piety – devout:    myths and beliefs, rites held, faith of the people
   A newly met people starts from a small hash of its own coined name, then
   history takes over. Culture feeds back into behaviour and looks:
     · diplomacy: warlike pairs build tension faster (war appetite);
       open-handed pairs warm faster and trade sooner (trade openness)
     · rites: a devout home people hold the dusk rite every day; a worldly
       one skips some days (ritual frequency)
     · architecture: roof colour, painted band, sacred mark on each hut
       (from their strongest belief), plus a palisade + watch-tower if
       warlike, totems if devout, market awnings if open-handed — at home,
       in watched settlements, and as marker shapes on the world map.     */
function nameHash(s){ let h=7; for(const ch of String(s)) h=(h*31+ch.charCodeAt(0))>>>0; return h; }
function cultureOf(f){
  if(!f.culture){ const h=nameHash(f.root||'x'); f.culture={war:0.3+((h%97)/97)*0.3, open:0.3+(((h>>7)%89)/89)*0.3, piety:0.3+(((h>>13)%83)/83)*0.3}; }
  return f.culture;
}
let AGTICK=0; const AGC=new Map(), LAYC=new Map();   // v3.7: per-people farming system + town layout, cached for one culture tick (they only change on a tick)
function cultureStep(){
  AGTICK++;
  for(const f of world.factions){ if(!f.setts) continue; const c=cultureOf(f);
    let wins=0; for(const r of relsOf(f.id)) if(r.history>0) wins++;
    let war=0.25+0.08*(f.home?(tribe.warMyths||0):(f.warMyths||0))+0.05*Math.min(4,wins)+0.08*Math.min(2,f.press||0);
    let open=0.25+0.12*Math.min(4,f.routes||0)+0.08*Math.min(3,f.wealth||0);
    let piety=0.25+0.08*Math.min(6,mythsOf(f));
    if(typeof ideaAx==='function'&&f.idea!=null){ const ax=ideaAx(f); war+=0.1*ax.struggle; open+=0.1*ax.open; piety+=0.12*ax.sacred; }   // v3.7: what they think moves how they live
    if(typeof layoutOf==='function'&&(f.home?tribe.age:(f.age||0))>=4&&layoutOf(f)==='spiral') piety+=0.05;   // v3.7: towns built round sacred ground
    if(f.home){ const B=tribe.beliefs; if(B.tooth) war+=0.1; if(B.fire) piety+=0.05; if(B.stone) piety+=0.1; if(B.seed) open+=0.05; piety+=0.002*Math.min(60,tribe.rites||0);
      const A=adults(); if(A.length){ war+=0.1*(A.reduce((n,v)=>n+v.tr.bold,0)/A.length-1); open+=0.1*(A.reduce((n,v)=>n+v.tr.social,0)/A.length-1); } }
    const ease=(k,t)=>{ c[k]+=(clamp(t,0.05,0.95)-c[k])*0.05; }; ease('war',war); ease('open',open); ease('piety',piety);
    moodStep(f,c,wins);
    const lean=cultureLean(f); if(f.home&&lean!==world.homeLean&&knows('hut')){ if(world.homeLean) ripple(`Ash Hollow grows ${CULT_ADJ[lean]}`,CULT_SAY[lean]); world.homeLean=lean; }
  }
}
const CULT_ADJ={war:'warlike',open:'open-handed',piety:'devout',mixed:'even-tempered'};
const CULT_SAY={war:'palisades rise, borders harden, war comes easier',open:'awnings and markets: trade comes easier',piety:'totems and painted marks: the rites never miss a dusk',mixed:'no one leaning rules them'};
function cultureLean(f){ const c=cultureOf(f), k=c.open>c.war?(c.piety>c.open?'piety':'open'):(c.piety>c.war?'piety':'war');   /* v3.6.3: was a sort (same order, ties → war, open, piety) */ return c[k]>=0.5&&c[k]-Math.min(c.war,c.open,c.piety)>0.08?k:'mixed'; }
// look: derived from culture + that people's own strongest belief + its colour
function styleOf(f){
  const c=cultureOf(f), lean=cultureLean(f);
  let mark; if(f.home){ const B=tribe.beliefs; mark=B.tooth&&c.war>=c.piety?'tooth':B.stone?'eye':B.fire?'sun':B.seed?'leaf':null; }
  else mark=c.piety>0.45?['sun','eye','tooth','leaf'][nameHash(f.root)%4]:null;
  const roof=lean==='war'?'#7a6a3a':lean==='open'?mixHex('#d8a840',f.color,0.35):lean==='piety'?'#c9b070':'#b8933e';
  const lay=typeof layoutOf==='function'?layoutOf(f):'scatter';
  return {lean,roof,band:lean==='piety'?'#e8e0c8':lean==='war'?'#5a2a20':f.color,mark,palisade:c.war>0.5||lay==='ring',totems:c.piety>0.5,market:c.open>0.5,flag:f.color,layout:lay};
}
function mixHex(a,b,t){ const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)); const A=p(a),B=p(b); return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join(''); }
// behaviour hooks used by diplomacy.js / sim.js
const cultTension=(A,B)=>(cultureOf(A).war+cultureOf(B).war-0.9)*0.8+(typeof ideaTension==='function'?ideaTension(A,B):0);   // v3.7: + what their ideas say about struggle
const cultWarmth=(A,B)=>(cultureOf(A).open+cultureOf(B).open-0.9)*0.6+(typeof ideaWarmth==='function'?ideaWarmth(A,B):0);
function riteToday(){ const p=cultureOf(world.factions[0]).piety, e=visEra(tribe.age);   // v3.6: industrial+ peoples gather less often (weekly-ish services / assemblies)
  if(e>=3) return tribe.day%(p>=0.55?3:5)===0; return p>=0.55 || (tribe.day%(p>=0.4?2:3))===0; }

/* ---------------- ARCHITECTURE + AGRICULTURE (per people) ----------------
   Not locked to any Earth timeline: every people's buildings and fields come
   from ITS culture leaning, its strongest belief (religion) and the land of
   its continent. Recomputed as those drift, so a people's look can change.
   Silhouettes (original, not historical styles):
     spire    – devout: tall stepped roof with a sacred finial
     longhall – warlike: low long hall with a ridge of stakes, palisade
     dome     – open-handed: round dome with an awning over the door
     cone     – even-tempered: the starter thatched cone
   Land shifts materials: hills → stone walls, forest → dark timber.
   Agriculture: own system per people with a REAL yield hook on carrying
   capacity (world.js sK) and its own field sprite:
     terrace (hills, 1.10) · grove (forest, 1.05) · herd (warlike grassland,
     0.95, roams) · shrine-garden (devout, 1.0, ringed with marks) ·
     rows (default, 1.0)                                                   */
function landOf(f){ const s=f.capital||home; return typeof terrain==='function'?terrain(s.cx,s.cy):'grass'; }
const AGRI={rows:{n:'row fields',y:1.0},terrace:{n:'hill terraces',y:1.10},grove:{n:'tended groves',y:1.05},herd:{n:'herding ranges',y:0.95},shrine:{n:'shrine gardens',y:1.0},
  paddy:{n:'flooded paddies',y:1.08},fungus:{n:'fungal beds',y:1.0}};   // v3.7: + paddies on coasts, fungal beds in devout / earth-kin forests (they shrug off blight)
function agriOf(f){ if(f.home&&!knows('planting')) return null; const C=AGC.get(f.id); if(C&&C[0]===AGTICK&&C[2]===f) return C[1]; const lean=cultureLean(f), land=landOf(f), earth=typeof ideaAx==='function'&&f.idea!=null?ideaAx(f).earth:0;
  const cs=f.capital||home, coast=typeof coastal==='function'&&!f.home&&coastal(cs);
  const k=land==='hills'?'terrace':land==='forest'?(lean==='piety'||earth>0.3?'fungus':'grove'):coast&&lean!=='war'?'paddy':lean==='war'?'herd':lean==='piety'?'shrine':'rows';
  if(f.home&&tribe.agri!==k){ if(tribe.agri) ripple(`Ash Hollow's farming becomes ${AGRI[k].n}`,`their own way of growing food (yield ×${AGRI[k].y})`); tribe.agri=k; }
  AGC.set(f.id,[AGTICK,k,f]); return k; }
const agriYield=f=>{ const k=agriOf(f); return k?AGRI[k].y:1; };
function archOf(f){
  const st=styleOf(f), land=landOf(f), lean=st.lean;
  st.shape=typeof ideaShape==='function'?ideaShape(f,lean):lean==='piety'?'spire':lean==='war'?'longhall':lean==='open'?'dome':'cone';   // v3.7: + mound / tower from ideas
  if(typeof archGene==='function'){ st.gene=archGene(f); st.idea=ideaOf(f); st.staple=f.home&&!knows('planting')?null:stapleOf(f); st.ruin=!!(f.fallen&&tribe.time-f.fallen.t<2400); }
  st.wall=land==='hills'?'#8d877c':land==='forest'?'#5e4630':'#8a6a48';
  st.agri=agriOf(f); st.era=visEra(f.home?tribe.age:(f.age||1)); return st;
}

/* industrial path (see PATHS in sim.js): chosen once, when a people first
   reaches Steel, from its culture leaning and land — then kept.          */
function pathOf(f){ if(f.path) return f.path; const lean=cultureLean(f), land=landOf(f);
  const p=lean==='war'||land==='hills'?'forge':lean==='open'?'market':'spark';
  const kn=f.home?knows:(id=>!!(f.known||{})[id]); if(kn('steel')){ f.path=p; if(f.home) ripple(`Ash Hollow takes the ${PATH_NAME[p]}`,PATH_SAY[p]); } return p; }
const PATH_NAME={forge:'forge path',spark:'spark path',market:'market path'};
const PATH_SAY={forge:'powder and steam first: forts, engines, roads',spark:'print and wire first: books, lamps, voices in the air',market:'print and powder for trade first: presses, ships, mills'};

/* FAITH DEVELOPS WITH THE PEOPLE (v3.6). Early beliefs (fire, stone, tooth,
   seed) are the ROOTS; as the people's era rises they grow into a faith or
   philosophy fitting that stage, named in the people's own words, flavoured
   by its culture (free ideology) — nothing is preloaded:
     era 0–1 spirits & myths · 2 a written faith ("the Book of …") ·
     3 a fellowship + reasoned ethic · 4 a civic creed · 5 a philosophy of
     the cosmos ("the Starward …"). The roots are still shown.             */
const IDEO={war:'the Oath of the Spear',open:'the Open Road',piety:'the Deep Rite',mixed:'the Middle Path'};
function faithOf(f){
  const w=(f.home?tribe.words:(typeof factionWords==='function'?factionWords(f):null))||{fire:'fire',stone:'stone',sky:'sky',good:'good',us:'us',sun:'sun'};
  const era=visEra(f.home?tribe.age:(f.age||1)), lean=cultureLean(f), C=s=>s?s[0].toUpperCase()+s.slice(1):s;
  const root=f.home?(tribe.beliefs.fire?w.fire:tribe.beliefs.stone?w.stone:w.sun):w.sun;
  const name=era<=1?null:era===2?`the Book of ${C(root)}`:era===3?`the ${C(w.good)} Fellowship`:era===4?`the Creed of ${C(w.us)}`:`the Starward ${C(w.sky)}`;
  const kind=era<=1?'':era===2?'written faith':era===3?'fellowship & reasoned ethic':era===4?'civic creed':'philosophy of the cosmos';
  const I=typeof ideaOf==='function'?ideaOf(f):null;   // v3.7: their own coined idea replaces the fixed ideology names
  return {era,name,kind,ideology:era>=2?(I?I.name:IDEO[lean]):null};
}

/* -------- EMERGENT ATTITUDES (v3.6.6): fear of outsiders, national pride --------
   Two slow-drifting 0..1 traits per people, from that people's OWN history. Nothing is
   assigned; both also fall again when the conditions fade. They are simulation of how
   attitudes form, reported in plain words — never as something good.
   f.xeno (fear / distrust of outsiders) rises with:
     · wars lost, settlements taken, battles fought (r.history with neighbours)
     · isolation: no trade routes, few contacts
     · rival pressure (f.press) and cultural clash with touching neighbours
   and falls with trade routes, alliances, shared stories (myths) and peace.
   f.nation (national pride / "our people" expansion) rises with:
     · a Kingdom-or-higher government (gov ≥ 4), a ruler
     · recent victories (war myths, wins) and a cohesive culture (one strong leaning)
   and falls with defeats, splits and loose (mixed) culture.                       */
function moodStep(f,c,wins){
  const R_=relsOf(f.id); let lost=0, clash=0, contacts=0;
  for(const r of R_){ contacts++; const o=world.factions[r.a===f.id?r.b:r.a]; if(!o||!o.setts) continue;
    if(f.grudge&&f.grudge[o.id]) lost++;
    if((r.d||99)<=12&&cultureLean(o)!==cultureLean(f)&&(cultureLean(o)==='war'||cultureLean(f)==='war')) clash++; }
  const myths=mythsOf(f), routes=f.routes||0, allied=R_.some(r=>r.state==='allied');
  const xT=0.15+0.12*Math.min(3,lost)+0.04*Math.min(5,wins)+(routes===0&&contacts<=2?0.12:0)+0.06*Math.min(2,f.press||0)+0.05*Math.min(3,clash)
          -0.07*Math.min(4,routes)-(allied?0.08:0)-(myths>=2?0.04:0)-(f.home&&world.peace.on?0.1:0)-(typeof ideaAx==='function'?0.1*ideaAx(f).open:0);
  const lead=Math.max(c.war,c.open,c.piety)-Math.min(c.war,c.open,c.piety);
  const nT=(f.gov>=4?0.25:f.gov>=3?0.12:0)+0.05*Math.min(6,f.home?(tribe.warMyths||0):(f.warMyths||0))+0.5*Math.min(0.4,lead)+(f.ruler&&f.gov>=3?0.05:0)-0.12*Math.min(2,lost);
  const wasX=f.xeno||0, wasN=f.nation||0;
  f.xeno=wasX+(clamp(xT,0,1)-wasX)*0.04; f.nation=wasN+(clamp(nT,0,1)-wasN)*0.04;
  const nm=f.home?'Ash Hollow':`the ${f.root}-folk`;
  if(wasX<0.5&&f.xeno>=0.5) wlog(`${cap(nm)} grow distrustful of outsiders${lost?' after their losses in war':routes===0?' — they have few dealings with other peoples':''}.`,'diplo',f.capital);
  else if(wasX>=0.45&&f.xeno<0.45&&f.xenoSaid) wlog(`${cap(nm)} are less wary of outsiders than they were.`,'diplo',f.capital);
  if(f.xeno>=0.5) f.xenoSaid=true;
  if(wasN<0.5&&f.nation>=0.5) wlog(`National pride runs high in ${f.home?'Ash Hollow':'the '+govName(f.gov)+' of '+f.root}; its rulers speak of "our people" beyond the border.`,'gov',f.capital);
}
