"use strict";
/* ASH HOLLOW v3.7 — CATASTROPHES. Rare, emergent from the sim's own state, and
   survivable (no people is ever wiped out; settlement floors stay ≥20). Nothing is
   scheduled: each needs the conditions below to build up first.
   1. SPENT LAND (resources): every continent has a finite store of ore and fuel
      (∝ its area). Industrial-era settlements draw on it (more people, later era =
      more); it regrows slowly; Solar/Fusion/Vertical Farms cut the draw. Below 30%
      the continent is SCARCE (research slows, wealth falls, 'resources' war motive
      against peoples on richer land); below 8% it is SPENT (towns hold 10% fewer).
   2. THE LAND SICKENS (environmental collapse): industrial peoples (era ≥ 3, over
      1,500 people) build up harm ∝ era × log(pop) × (1 − earth-kin ideas) × (1 −
      clean tech); the land slowly heals. At harm ≥ 1 their biggest town's region is
      blighted (yield ×0.6, fungal beds ×0.8) for 6–9 days, people die in the famine,
      and the lesson pushes their next idea toward the land as kin.
   3. FIRE FROM THE SKY (nuclear war): only a people that has INVENTED Nuclear Power
      and is at war can use it — mostly the losing side in desperation, more often
      with struggle/pride/distrust, almost never with peace-loving ideas. The struck
      town is ash (pop ×0.2–0.35), the land around it is poisoned for 12–20 days,
      neighbours suffer fallout; the victim may strike back; two strikes close
      together bring a nuclear winter (all yields ×0.85 for 5 days). The war ends
      in a horrified truce, and a world-wide taboo makes the next use far less likely.
   4. REBUILD FROM SCRATCH (collapse): a modern people (Early Modern Age or later)
      that loses ≥65% of its people around a catastrophe forgets its knowledge: back
      to the Steel, Bronze or Farming Age by severity. Its towns show ruins, and it
      must re-earn every invention step by step (neighbours' knowledge helps, as
      diffusion always did).                                                      */
const NUKE_ID='tech8', CLEAN={tech15:0.35,tech22:0.35,tech25:0.15};
function disInit(){ const D=world.dis||(world.dis={}); D.blight=D.blight||[]; D.res=D.res||{}; D.resMax=D.resMax||{}; D.cs=D.cs||{}; D.n=D.n||{env:0,nuke:0,scarce:0,spent:0,fall:0,winter:0}; if(D.taboo==null) D.taboo=0; if(D.winterT==null) D.winterT=-1; if(D.lastNuke==null) D.lastNuke=-1e9; return D; }
const cleanOf=f=>{ const k=fKnows(f); let c=0; for(const id in CLEAN) if(k(id)) c+=CLEAN[id]; return Math.min(0.85,c); };
function contIdOf(s){ const k=s.cx*100003+s.cy; if(s.contK!==k){ const c=continentOf(s.cx,s.cy); s.cont=c?c.id:null; s.contK=k; } return s.cont; }
function resRatio(f){ const D=world.dis; if(!D||!f||!f.capital) return 1; const id=contIdOf(f.capital); if(id==null||D.res[id]==null) return 1; return D.res[id]/D.resMax[id]; }
const resMult=f=>{ const r=resRatio(f); return r>=0.3?1:0.55+1.5*r; };   // scarce ore and fuel slow invention
function blightAt(cx,cy){ const D=world.dis; if(!D) return null; for(const z of D.blight) if(Math.hypot(cx-z.cx,cy-z.cy)<z.r) return z; return null; }
const ERA_USE=[0,0,0.25,1,1.4,1.2], ERA_HARM=[0,0,0,1,1.4,1.2];
function disasterStep(dt){
  const D=disInit(), now=tribe.time;
  // 1. resources: draw down / regrow every continent's store
  const use={};
  for(const s of world.setts){ const f=world.factions[s.f]; if(!f) continue; const e=fEra(f); if(e<2) continue; const id=contIdOf(s); if(id==null) continue;
    if(D.res[id]==null){ const C=contCache.get(id); const m=Math.round(((C&&C.r)||25)**2*3); D.res[id]=m; D.resMax[id]=m; }
    use[id]=(use[id]||0)+ERA_USE[e]*(s.pop/1000)*0.002*dt*(1-cleanOf(f)); }
  for(const id in D.res){ const m=D.resMax[id]; const r0=D.res[id]/m; D.res[id]=clamp(D.res[id]-(use[id]||0)*Math.max(0.12,Math.min(1,r0*1.4))+m*0.00006*dt,0,m); const r=D.res[id]/m, was=D.cs[id]||0, st=r<0.08?2:r<0.3?1:0;
    if(st>was){ const C=contCache.get(id), nm=C?C.name:'a far land';
      if(st===2){ D.n.spent++; wlog(`<b>The mines and wells of ${nm} are spent.</b> Ore and fuel must now come from far away — its towns shrink and its peoples look abroad.`,'war',null,true); }
      else { D.n.scarce++; wlog(`Ore and fuel run short on ${nm}. Its workshops slow, and its peoples eye richer lands.`,'diplo'); } }
    D.cs[id]=st>was?st:(r>0.4?0:was); }
  // 2. environmental harm (industrial peoples)
  for(const f of world.factions){ if(!f.setts) continue; const e=fEra(f), ax=ideaAx(f);
    if(e>=3&&f.pop>1500) f.harm=(f.harm||0)+0.000036*dt*ERA_HARM[e]*Math.log10(f.pop)*clamp(1-0.6*ax.earth,0.3,1.6)*(1-cleanOf(f));
    if(f.harm) f.harm=Math.max(0,f.harm-0.0001*dt*(1+Math.max(0,ax.earth)));
    if((f.harm||0)>=1&&trng()<0.25) landSickens(f);
    // collapse watch: recent peak population
    f.peak=Math.max(f.pop||0,(f.peak||f.pop||0)*(1-0.0005*dt));
    if(f.catT&&now-f.catT<600&&fAge(f)>=8&&f.pop<0.35*f.peak&&!(f.fallen&&now-f.fallen.t<1500)) collapse(f);
  }
  // decay: taboo, nuclear winter, blighted zones
  D.taboo=Math.max(0,D.taboo-0.00005*dt);   // the horror fades over generations, not seasons
  D.blight=D.blight.filter(z=>z.until>now);
  const winter=D.winterT>now?0.85:1;
  for(const s of world.setts){ let b=winter; for(const z of D.blight){ if(Math.hypot(s.cx-z.cx,s.cy-z.cy)<z.r){ const fu=world.factions[s.f]&&agriOf(world.factions[s.f])==='fungus'; b=Math.min(b,z.y+(fu?0.2:0)); } }
    const id=contIdOf(s); if(id!=null&&D.res[id]!=null&&D.res[id]/D.resMax[id]<0.08) b*=0.9;
    if(b<1) s.bl=+b.toFixed(3); else if(s.bl!=null) delete s.bl; }
}
function largestOf(f){ let b=null; for(const s of world.setts) if(s.f===f.id&&(!b||s.pop>b.pop)) b=s; return b; }
function shock(f,lesson,doubt,cat){ f.shock=tribe.time; if(cat) f.catT=tribe.time; f.lesson=lesson; f.doubt=(f.doubt||0)+doubt; f.wealth=(f.wealth||0)*0.5; }
function landSickens(f){
  const D=world.dis, S=largestOf(f); if(!S) return; D.n.env++;
  const z={cx:S.cx,cy:S.cy,r:Math.round(claimR(S)+5),kind:'env',y:0.6,t0:tribe.time,until:tribe.time+R_(700,1100),f:f.id}; D.blight.push(z);
  for(const s of world.setts) if(Math.hypot(s.cx-z.cx,s.cy-z.cy)<z.r){ s.pop=Math.max(20,s.pop*0.88); s.hit=tribe.time; if(s.home) home.extra=Math.max(0,home.extra*0.88); }
  f.harm=0.35; shock(f,'earth',1.5,true);
  if(f.home){ tribe.food=Math.floor(tribe.food*0.5); for(const v of alive()) v.fear=Math.min(100,v.fear+20); }
  wlog(`<b>The land sickens.</b> Around ${S.name} the rivers run foul and the fields of ${f.home?'Ash Hollow':'the '+f.root+'-folk'} fail — industry has taken more than the land could give.`,'war',S,true);
  if(f.home&&typeof banner==='function') banner('The land sickens','the fields fail around '+S.name);
}
const R_=(a,b)=>a+trng()*(b-a);
function nukeCheck(r,win,lose,ws,ls){
  const D=disInit(); if(!r.war) return false;
  for(const [X,Y,xs,ys] of [[lose,win,ls,ws],[win,lose,ws,ls]]){
    if(!fKnows(X)(NUKE_ID)) continue;
    const ax=ideaAx(X), desperate=X===lose&&Math.abs(r.war.score)>=2, zeal=ax.struggle>0.3||(X.nation||0)>=0.55||(X.xeno||0)>=0.55;
    if(tribe.time-D.lastNuke<3600) continue;   // the world is still reeling from the last one
    const p=(desperate?0.03:0.003)*(zeal?1.5:0.6)*(1-0.92*D.taboo)*(ax.struggle<-0.4?0.2:1);
    if(trng()<p){ nuke(X,Y,ys,r); if(fKnows(Y)(NUKE_ID)&&trng()<0.6) nuke(Y,X,xs,r,true); endInHorror(r,X,Y); return true; } }
  return false;
}
function nuke(X,Y,T,r,back){
  const D=world.dis, now=tribe.time; D.n.nuke++; if(now-D.lastNuke<300&&D.winterT<=now){ D.winterT=now+600; D.n.winter++; wlog('<b>Ash darkens the sky.</b> A nuclear winter: harvests fail across the whole world.','war',null,true); } D.lastNuke=now;
  const before=T.pop; T.pop=Math.max(20,T.pop*R_(0.2,0.35)); if(T.home){ home.extra=Math.max(0,home.extra*0.3); tribe.food=0; for(const v of alive()) v.fear=100; }
  T.ruin={t:now,kind:'nuke'}; T.hit=now;
  D.blight.push({cx:T.cx,cy:T.cy,r:9,kind:'nuke',y:0.4,t0:now,until:now+R_(1500,2400),f:Y.id});
  for(const s of world.setts) if(s!==T&&Math.hypot(s.cx-T.cx,s.cy-T.cy)<14){ s.pop=Math.max(20,s.pop*0.85); s.hit=now; if(s.home) home.extra=Math.max(0,home.extra*0.85); }
  shock(X,'horror',1); shock(Y,'horror',1.5,true);
  D.taboo=1;
  wlog(`☢ <b>Fire from the sky.</b> ${back?'In answer, the':'The'} ${fname(X)} people turn Nuclear Power into a weapon and strike ${T.name} (${fname(Y)}) — ${Math.round(before-T.pop).toLocaleString()} die, and the land around it is poisoned for years.`,'war',T,true);
  if((X.home||Y.home)&&typeof banner==='function') banner('Fire from the sky',T.name+' is ash');
}
function endInHorror(r,X,Y){
  r.state='hostile'; r.truceT=300; r.tension=0; r.history=(r.history||0)+1; r.war=null; world.dirty=true;
  for(const f of [X,Y]) for(const o of relsOf(f.id)){ const g=world.factions[o.a===f.id?o.b:o.a]; if(g&&g.setts){ g.lesson='horror'; g.doubt=(g.doubt||0)+0.8; } }
  wlog(`Horrified, the ${fname(X)} and ${fname(Y)} peoples stop the war. Word of the burned city travels to every people they know.`,'truce',null,true);
}
function collapse(f){
  const D=world.dis, sev=1-f.pop/Math.max(1,f.peak), L=sev>=0.85?3:sev>=0.75?5:7, fromA=AGES[fAge(f)].n; D.n.fall++;
  const keep=ladderKnown(L);
  if(f.home){ const lost=Object.keys(tribe.known).filter(id=>!keep[id]);
    for(const id of lost){ delete tribe.known[id]; tribe.ideas[id]=INV[id]?Math.round(INV[id].need*0.3):0; }   // ruins and half-remembered lore, nothing more
    const names=new Set(lost.map(id=>INV[id]&&INV[id].name)), kinds=new Set(lost.map(id=>INV[id]&&INV[id].tech&&INV[id].tech.lmk).filter(Boolean)); for(const m of tribe.landmarks||[]) if(names.has(m.name)||kinds.has(m.kind)) m.ruin=true;
    const a=ageFrom(knows); tribe.age=Math.min(tribe.age,a); boost=BOOST(); tribe.latest=null; f.age=tribe.age;
    if(typeof banner==='function') banner('The old knowledge is lost','back to the '+AGES[tribe.age].n+' — Ash Hollow must rebuild'); }
  else { f.known=keep; f.tp=0; f.age=ageFrom(id=>!!f.known[id]); f.latest=null; }
  for(const s of world.setts) if(s.f===f.id) s.ruin=s.ruin||{t:tribe.time,kind:'fall'};
  f.fallen={t:tribe.time,from:fromA,to:AGES[fAge(f)].n}; f.peak=f.pop; f.ageSeen=fAge(f);
  wlog(`<b>The old knowledge is lost</b> among ${f.home?'Ash Hollow':'the '+f.root+'-folk'}: from the ${fromA} they fall back to the ${AGES[fAge(f)].n}, and must rebuild from scratch.`,'war',f.capital,true);
}
// war motive (diplomacy.js): a scarce continent's people covets a neighbour on richer land
function resourceMotive(X,Y,xs,ys){ const D=world.dis; if(!D) return null; const a=contIdOf(xs), b=contIdOf(ys); if(a==null||b==null||a===b) return null;
  if(D.res[a]==null||D.res[a]/D.resMax[a]>=0.3) return null; if(D.res[b]!=null&&D.res[b]/D.resMax[b]<0.5) return null;
  return `war for ore and fuel — the mines of ${ys.name}`; }
