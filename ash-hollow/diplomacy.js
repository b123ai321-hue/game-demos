"use strict";
/* ASH HOLLOW — diplomacy between peoples (settlement units; no armies of agents).
   One relation per pair of peoples that have met. States (rule-based):
     wary → neutral → trade → allied        (warmth grows, tension stays low)
     any (not allied) → WAR                 (tension ≥ WAR_AT)
     war → hostile (truce timer) → wary     (after a win, a flight, or exhaustion)
   Tension: shared borders, two strong governments, crowding (scarce land),
   old wars. Warmth: time in contact, similar governments, trade itself.
   Peace eras: after a war ends and the world stays war-free for a while (or
   trade spreads with no war), calm settles; growth and goodwill rise.      */
const WAR_AT=14, DIPLO_TICK=5;
// Peace eras are tracked for the home people (the ones the player watches most): with dozens of peoples, some war is almost always burning somewhere.
world.rel={}; world.battles=[]; world.peace={on:false,calmT:0,count:0,name:''}; world.diploT=0; world.everWar=false;
const relKey=(a,b)=>Math.min(a,b)+'-'+Math.max(a,b);
function relOf(a,b){ return world.rel[relKey(a,b)]; }
/* v3.6.3: per-people relation index (relations are never deleted, so it only
   needs a rebuild when a relation is added or a save swaps world.rel).     */
let RELIX={obj:null,n:-1,by:[]};
function relsOf(fid){ if(RELIX.obj!==world.rel||RELIX.n<0){ const by=[]; let n=0; for(const k in world.rel){ const r=world.rel[k]; n++; (by[r.a]=by[r.a]||[]).push(r); (by[r.b]=by[r.b]||[]).push(r); } RELIX={obj:world.rel,n,by}; } return RELIX.by[fid]||[]; }
const relsDirty=()=>{ RELIX.n=-1; };   // called when a relation is added, and once per diplomacy tick as a safety net
let BYF={};
function closestPair(fa,fb){ let best=null,bd=1e9; for(const a of (BYF[fa]||[])) for(const b of (BYF[fb]||[])){ const d=Math.hypot(a.cx-b.cx,a.cy-b.cy); if(d<bd){bd=d;best=[a,b];} } return best?{a:best[0],b:best[1],d:bd}:null; }
const fname=f=>f.home?'Ash Hollow':f.root;
const STATE_ICON={wary:'?',neutral:'·',trade:'⇄',allied:'☍',war:'⚔',hostile:'✕'};
function dlog(msg,kind,sett,big){ wlog(msg,kind,sett,big); }

function diploStep(dt){
  // fade battle markers
  for(const b of world.battles) b.t-=dt; world.battles=world.battles.filter(b=>b.t>0);
  world.diploT-=dt;
  if(!DJOB){ if(world.diploT>0) return; world.diploT=DIPLO_TICK; relsDirty();
  const F=world.factions.filter(f=>f.setts>0);
    BYF={}; for(const s of world.setts) (BYF[s.f]=BYF[s.f]||[]).push(s);
    /* v3.6.3 spatial pre-check: each people's bounding circle (centroid, spread, largest claim). If even the
       closest possible pair of settlements is out of contact range and the two have never met, skip the
       O(settlements²) closestPair — same result, far fewer checks at huge populations.                     */
    const BC={}; for(const f of F){ const L=BYF[f.id]||[]; let x=0,y=0,m=0; for(const s of L){ x+=s.cx; y+=s.cy; } x/=L.length||1; y/=L.length||1; let rr=0; for(const s of L){ rr=Math.max(rr,Math.hypot(s.cx-x,s.cy-y)); m=Math.max(m,claimR(s)); } BC[f.id]={x,y,rr,m}; }
    pressureStep(); if(typeof econStep==='function') econStep(); if(typeof scarcityStep==='function') scarcityStep();
    const SC=typeof scarcityTension==='function'?scarcityTension():0;
    DJOB={F,BC,SC,i:0,j:1,wars:0,trades:0}; }
  diploWork();
}
/* v3.6.5: a diplomacy tick visits every pair of peoples. In big worlds (>300 settlements) that pass is
   time-sliced: at most DIPLO_SLICE_MS per call, resumed on the next world step (a tick finishes well within
   its 5 s), so 50× speed has no 20 ms spikes. Small worlds finish the whole tick at once, exactly as before. */
let DJOB=null; const DIPLO_SLICE_MS=3;
function diploWork(){ const J=DJOB, F=J.F, t0=performance.now(), sliced=world.setts.length>300; let n=0;
  for(;J.i<F.length;J.i++,J.j=J.i+1){ for(;J.j<F.length;J.j++){ diploPair(F[J.i],F[J.j],J); if(sliced&&(++n&63)===0&&performance.now()-t0>DIPLO_SLICE_MS){ J.j++; return; } } }
  DJOB=null; const wars=J.wars, trades=J.trades;
  const P=world.peace;
  if(wars>0){ if(P.on){ P.on=false; dlog(`The ${P.name} ends. Ash Hollow is at war again.`,'war',null,true); } P.calmT=0; }
  else { P.calmT+=DIPLO_TICK; if(!P.on && ((world.homeWar&&P.calmT>=120)||(trades>=2&&P.calmT>=240))){ P.on=true; P.count++; P.name=peaceName(); dlog(`<b>A peace era begins for Ash Hollow: ${P.name}.</b> Trade and rites flourish.`,'peace',home,true); } }
}
function diploPair(A,B,J){ const BC=J.BC, SC=J.SC;
    const ba=BC[A.id], bb=BC[B.id];
    if(Math.hypot(ba.x-bb.x,ba.y-bb.y)-ba.rr-bb.rr>ba.m+bb.m+6.5 && !world.rel[relKey(A.id,B.id)]) return;
    const cp=closestPair(A.id,B.id); if(!cp) return;
    const touch=cp.d<=claimR(cp.a)+claimR(cp.b), inRange=cp.d<=claimR(cp.a)+claimR(cp.b)+6;
    let r=relOf(A.id,B.id);
    if(!r){ if(!inRange) return; r=world.rel[relKey(A.id,B.id)]={a:A.id,b:B.id,state:'wary',tension:touch?3:0,warmth:0,history:0,truceT:0,war:null,since:tribe.time}; relsDirty();
      dlog(`The ${fname(A)} people and the ${fname(B)} people meet for the first time. They are wary.`,'contact',cp.a); }
    const mine=A.home||B.home; r.d=cp.d;
    if(r.state==='war'){ if(mine) J.wars++; fight(r,A,B,cp); return; }
    // drift
    const crowd=([cp.a,cp.b].some(s=>s.pop>0.8*sK(s))?0.6:0) + ([cp.a,cp.b].some(s=>s.cramped&&tribe.time-s.cramped<120)?0.8:0) /* v3.6.4: no land left to split into */ + (touch||inRange?SC:SC*0.3) /* world filling up */, strong=(A.gov>=3&&B.gov>=3)?0.5:0;
    const allied=r.state==='allied', peace=world.peace.on&&mine;
    r.tension=Math.max(0, r.tension + (touch?1.1:inRange?0.25:-0.5) + strong + crowd + r.history*0.25 + cultTension(A,B) /* war appetite */ - r.warmth*0.04 - (allied?1.6:0) - (r.state==='trade'?0.5:0) - (peace?0.7:0) + R(-0.4,0.4));
    r.warmth=Math.max(0, r.warmth + (inRange?0.6:0.1) + (Math.abs(A.gov-B.gov)<=1?0.3:0) + (r.state==='trade'?0.6:0) + (peace?0.5:0) + (A.home||B.home?boost.warm:0) + (mythsOf(A)>=1&&mythsOf(B)>=1?0.3:0) /* shared stories */ + cultWarmth(A,B) /* trade openness */ - (touch?0.25:0) - (r.state==='hostile'?0.5:0));
    if(r.truceT>0){ r.truceT-=DIPLO_TICK; if(r.truceT<=0){ r.state='wary'; dlog(`The truce between ${fname(A)} and ${fname(B)} holds; they are merely wary now.`,'diplo',cp.a); } return; }
    // allies come to each other's aid: being at war with someone's ally raises tension with them
    /* v3.6.6: tension alone no longer starts a war — there must be a concrete stake (warMotive). With none, the
       tension is held just under the war line: they stay hostile, but no pointless war is fought. */
    if(r.tension>=WAR_AT && !allied){ const M=warMotive(r,A,B,cp,touch,inRange);
      if(M){ declareWar(r,A,B,cp,M); if(mine) J.wars++; return; }
      r.tension=WAR_AT-1; world.noStake=(world.noStake||0)+1; }
    if(r.state==='wary' && r.warmth>=6){ r.state='neutral'; log(`${fname(A)} and ${fname(B)} come to trust each other a little.`); }
    else if(r.state==='neutral' && r.warmth>=12 && r.tension<8){ r.state='trade'; dlog(`A <b>trade route</b> opens between ${cp.a.name} and ${cp.b.name} (${fname(A)} ⇄ ${fname(B)}).`,'trade',cp.a,true); }
    else if(r.state==='trade' && r.warmth>=26 && r.tension<5 && A.gov>=2 && B.gov>=2){ r.state='allied'; dlog(`<b>Alliance:</b> the ${fname(A)} and ${fname(B)} peoples swear to stand together.`,'alliance',cp.a,true); }
    else if((r.state==='trade'||r.state==='allied') && r.tension>=10){ if(r.state==='allied') r.broken=tribe.time; /* v3.6.6: a broken alliance is remembered */ r.state=r.state==='allied'?'trade':'wary'; dlog(`Goodwill sours between ${fname(A)} and ${fname(B)}.`,'diplo',cp.a); }
    if(r.state==='trade'||r.state==='allied'){ if(mine) J.trades++; cp.a.pop*=1.004; cp.b.pop*=1.004; if(A.home||B.home) addLore(0.6); }
}
const PRESS_W={war:1.2,hostile:0.8,wary:0.35,trade:0.45,neutral:0.25,allied:0.2};
function pressureStep(){
  for(const f of world.factions) f.pressRaw=0;
  for(const r of Object.values(world.rel)){ const w=(PRESS_W[r.state]||0)/(1+Math.max(0,(r.d||10)-8)/10), A=world.factions[r.a], B=world.factions[r.b]; if(A) A.pressRaw+=w; if(B) B.pressRaw+=w; }
  for(const f of world.factions){ const was=f.press||0; f.press=was+(Math.min(2.4,f.pressRaw)-was)*0.25; }   // eases in and out
  const h=world.factions[0], m=pressMult(h);
  if(knows('planting')){ if(m<0.75&&!world.lonelySaid){ world.lonelySaid=true; dlog('With no rivals near, Ash Hollow grows comfortable. New ideas come slowly.','diplo'); }
    if(m>=1.15) world.lonelySaid=false; }
}
function peaceName(){ const w=tribe.words; const n=w?cap(w.good)+'-'+w.sun:'Calm'; return `the ${['Long','Quiet','Green','Warm','Wide'][world.peace.count%5]} ${n}`; }

function declareWar(r,A,B,cp,M){
  if(r.state==='trade'||r.state==='allied') onRouteBroken(A,B);
  const [agg,def]=M?[M.agg,M.def]:(A.pop>=B.pop?[A,B]:[B,A]);
  r.state='war'; r.war={score:0,battles:0,t:0,why:M?M.why:'?',text:M?M.text:'',agg:agg.id}; world.everWar=true; if(A.home||B.home) world.homeWar=true;
  if(M){ world.motives=world.motives||{}; world.motives[M.why]=(world.motives[M.why]||0)+1; }
  dlog(`<b>War!</b> The ${fname(agg)} people march on the ${fname(def)} people${M?' — '+M.text:''}.`,'war',cp.a.f===def.id?cp.a:cp.b,true);
  // allies of the defender grow hostile to the aggressor, and remember why (alliance obligation is a stake)
  for(const o of relsOf(def.id)){ if(o.state==='allied'){ const ally=o.a===def.id?o.b:o.a; if(ally===agg.id) continue; const ra=relOf(ally,agg.id); if(ra&&ra.state!=='war'){ ra.tension+=6; ra.aid={ally:ally,friend:def.id,t:tribe.time}; } } }
}
function strength(f,s){ const allyAid=relsOf(f.id).some(o=>o.state==='allied')?1.25:1;
  return Math.pow(Math.max(10,s.pop),0.8)*(1+0.12*f.gov)*allyAid*(1+0.15*Math.min(2,f.press||0))*wealthMult(f)*moraleMult(f)*R(0.7,1.3); }   // rivalry, wealth (economy→war), war myths (myth→war)   // hardened by rivalry
function fight(r,A,B,cp){
  const w=r.war; w.t+=DIPLO_TICK; if(w.t<5) return;
  const LD=typeof layoutDefence==='function'?layoutDefence:()=>1;   // v3.7: walled ring towns defend better
  const sa=strength(A,cp.a)*(w.agg!==A.id?LD(A):1), sb=strength(B,cp.b)*(w.agg!==B.id?LD(B):1), [win,lose,ws,ls]=sa>=sb?[A,B,cp.a,cp.b]:[B,A,cp.b,cp.a];
  ls.pop*=R(0.86,0.92); ws.pop*=R(0.94,0.97); if(ls.home) ls.extra=Math.max(0,ls.extra*0.9);
  w.battles++; w.score+=win===A?1:-1; onBattle(win,lose,ls);
  if(ls.home||ws.home) tribe.food=Math.max(0,tribe.food-(ls.home?4:1));   // war damages the stores
  world.battles.push({ax:cp.a.cx,ay:cp.a.cy,bx:cp.b.cx,by:cp.b.cy,t:10,at:ls,win:win.id,lose:lose.id});
  ls.lastBattle={t:tribe.time,enemy:win.id,won:false}; ws.lastBattle={t:tribe.time,enemy:lose.id,won:true};
  if(w.battles===1||w.battles%3===0||A.home||B.home) dlog(`Battle at <b>${ls.name}</b>${w.text?' ('+w.text+')':''}: the ${fname(win)} people win the field.`,'battle',ls,w.battles===1);
  if(typeof nukeCheck==='function'&&nukeCheck(r,win,lose,ws,ls)) return;   // v3.7: a people with Nuclear Power may turn it into a weapon (disasters.js)
  if(Math.abs(w.score)>=4) return endWar(r,win,lose,ws,ls);
  if(w.t>110){ r.state='hostile'; r.truceT=90; r.tension=2; r.history++; r.war=null; dlog(`Exhausted, the ${fname(A)} and ${fname(B)} peoples agree a <b>truce</b>.`,'truce',cp.a,true); }
}
function endWar(r,win,lose,ws,ls){
  onWarEnd(win,lose,ls);
  lose.grudge=lose.grudge||{}; lose.grudge[win.id]={t:tribe.time,place:ls.name};   // v3.6.6: remembered — a possible motive for revenge
  r.state='hostile'; r.truceT=120; r.tension=0; r.history++; r.war=null; world.dirty=true;
  const loseSetts=world.setts.filter(s=>s.f===lose.id);
  if(loseSetts.length>1 && !ls.home){ ls.f=win.id; dlog(`<b>${ls.name}</b> is taken: the ${fname(win)} people win the war against ${fname(lose)}.`,'conquest',ls,true); }
  else if(lose.home){ const take=world.setts.find(s=>s.f===lose.id&&!s.home&&s!==ls); if(take){ take.f=win.id; } home.extra*=0.75; dlog(`Ash Hollow loses the war to the ${fname(win)} people${take?' and gives up '+take.name:''}, and pays tribute.`,'conquest',home,true); }
  else if(rng()<0.5){ for(const s of loseSetts) s.f=win.id; dlog(`The ${fname(lose)} people are <b>absorbed</b> into the ${govName(win.gov)} of ${fname(win)}.`,'conquest',ls,true); }
  else { const a=Math.atan2(ls.cy-ws.cy,ls.cx-ws.cx); let moved=false; for(let k=0;k<20&&!moved;k++){ const d=R(10,14), cx=Math.round(ls.cx+Math.cos(a+R(-.6,.6))*d), cy=Math.round(ls.cy+Math.sin(a+R(-.6,.6))*d), t=terrain(cx,cy);
      if(t!=='water'&&t!=='ocean'&&t!=='peak'&&!world.setts.some(s=>s!==ls&&Math.hypot(s.cx-cx,s.cy-cy)<4)){ ls.cx=cx; ls.cy=cy; ls.pop*=0.6; moved=true; } }
    dlog(`Defeated, the ${fname(lose)} people <b>flee</b> ${moved?'far from':'within reach of'} the ${fname(win)} people.`,'flee',ls,true); }
}

/* ------------------------- WAR MOTIVES (v3.6.6) -------------------------
   A war needs a concrete stake. When tension crosses WAR_AT, both directions
   (A against B, B against A) are checked for motives that come from the
   situation; the strongest wins and names the war. No motive → no war.
   Every motive needs the two peoples to be in contact range (or bound by an
   alliance), so distant peoples with nothing at stake never fight.
     weight  motive
     3.0  land      borders touch and the aggressor has no room (cramped
                    splits, crowded town, or a world >55% claimed)
     3.0  ally      defending an ally the other attacked
     2.8  revenge   the other took a town / won a war against them (≤900 s)
     2.6  betrayal  the other broke an alliance with them (≤900 s)
     2.5  fields    the other's land feeds more (agri yield) and they are crowded
     2.4  secession the other is a recent breakaway of theirs (≤900 s)
     2.3  coast     borders touch; they have no sea coast, the other does
     2.2  trade     the other holds ≥2 trade routes, they hold none
     2.0  conquest  2+ ages ahead in tech, a kingdom or more (metal/steel edge)
     1.9  succession the other's capital fell recently (turmoil, ≤300 s)
     1.7  nation    national pride ≥0.6 in a kingdom: claims a touching
                    borderland as "theirs" (emergent, see moodStep)
     1.5  faith     both devout (piety ≥0.55), borders touch, rival faiths
     1.2  customs   borders touch, one warlike culture against another way
     1.0  outsiders fear of outsiders ≥0.6 (emergent xeno, see moodStep)
   Material/political motives outweigh attitudes, so prejudice or pride only
   tip a war when nothing more concrete is at stake.                        */
function coastal(s){ const k=s.cx+','+s.cy; if(s.coastK===k) return s.coast; let c=false;
  for(let i=0;i<16&&!c;i++){ const a=i*0.3927; if(terrain(Math.round(s.cx+Math.cos(a)*5),Math.round(s.cy+Math.sin(a)*5))==='ocean') c=true; }
  s.coastK=k; s.coast=c; return c; }
function motivesFor(X,Y,xs,ys,r,touch,inRange){
  const out=[], now=tribe.time, crowded=xs.pop>0.8*sK(xs)||(xs.cramped&&now-xs.cramped<120), claimed=world.claimed||0, Yn=fname(Y);
  if(!inRange&&!(r.aid&&r.aid.ally===X.id)) return out;
  if(touch&&(crowded||claimed>0.55)) out.push([3.0,'land',claimed>0.85?`war for land — the world is full and the ${Yn} border blocks them`:`war to open land toward ${ys.name}`]);
  if(r.aid&&r.aid.ally===X.id&&now-r.aid.t<600){ const fr=world.factions[r.aid.friend]; out.push([3.0,'ally',`war to defend their allies${fr?' the '+fname(fr):''}`]); }
  const g=X.grudge&&X.grudge[Y.id]; if(g&&now-g.t<900) out.push([2.8,'revenge',`a war of revenge for ${g.place}`]);
  if(r.broken&&now-r.broken<900) out.push([2.6,'betrayal',`war over the broken alliance`]);
  if(crowded&&typeof agriYield==='function'&&agriYield(Y)>agriYield(X)+0.04) out.push([2.5,'fields',`war for the rich fields of ${ys.name}`]);
  if(Y.parent===X.id&&now-(Y.born||0)<900) out.push([2.4,'secession',`war to bring the breakaway ${Yn} back`]);
  if(touch&&!coastal(xs)&&coastal(ys)&&(X.gov>=3||crowded)) out.push([2.3,'coast',`war for the coast at ${ys.name}`]);
  if((Y.routes||0)>=2&&(X.routes||0)===0) out.push([2.2,'trade',`war over the trade roads of ${Yn}`]);
  if((X.age||0)>=(Y.age||0)+2&&X.gov>=4) out.push([2.0,'conquest',`a war of conquest — ${AGES[X.age]?AGES[X.age].n:'stronger arms'} against ${AGES[Y.age||0]?AGES[Y.age||0].n:'weaker'}`]);
  if(Y.capT&&now-Y.capT<300&&Y.setts>=2) out.push([1.9,'succession',`war while ${Yn} fight over the succession`]);
  if(touch&&(X.nation||0)>=0.6&&X.gov>=4) out.push([1.7,'nation',`a claim of national pride — ${X.home?'Ash Hollow':'the '+X.root+' realm'} calls the ${ys.name} borderland its own`]);
  if(touch&&cultureOf(X).piety>=0.55&&cultureOf(Y).piety>=0.55){ const fx=faithOf(X).name, fy=faithOf(Y).name; out.push([1.5,'faith',fx&&fy?`a war of faiths — ${fx} against ${fy}`:`a war between rival spirits and rites`]); }
  if(touch&&cultureLean(X)==='war'&&cultureLean(Y)!=='war') out.push([1.2,'customs',`a clash of customs along the border`]);
  if(touch&&typeof creedClash==='function'){ const cc=creedClash(X,Y); if(cc) out.push([1.4,'creed',cc]); }   // v3.7: militant ideas against very different ones
  if(typeof resourceMotive==='function'){ const rm=resourceMotive(X,Y,xs,ys); if(rm) out.push([2.7,'resources',rm]); }   // v3.7: spent land covets richer land
  if((X.xeno||0)>=0.6) out.push([1.0,'outsiders',g?`fear of outsiders after the last war`:`distrust of outsiders`]);
  return out;
}
function warMotive(r,A,B,cp,touch,inRange){
  const as=cp.a.f===A.id?cp.a:cp.b, bs=as===cp.a?cp.b:cp.a; let best=null;
  for(const [X,Y,xs,ys] of [[A,B,as,bs],[B,A,bs,as]]) for(const m of motivesFor(X,Y,xs,ys,r,touch,inRange)){
    const w=m[0]+(X.pop>=Y.pop?0.05:0);   // tie → the larger people moves first
    if(!best||w>best.w) best={w,why:m[1],text:m[2],agg:X,def:Y}; }
  return best;
}
