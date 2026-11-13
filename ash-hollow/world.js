"use strict";
/* ASH HOLLOW — the wider world.
   - Home valley: up to LOCAL_CAP fully simulated people. Past that, people are
     COUNTED, not simulated (level of detail): the home settlement gets an
     `extra` population that grows logistically.
   - FINITE WORLD (v3.6.4): the world beyond the valley is a closed map of
     WORLD_CI×2+1 by WORLD_CJ×2+1 continent cells (7×5) inside an ocean
     boundary (the World's Edge). Crowded settlements split and found new
     ones nearby or overseas; once the land is claimed there is nowhere left
     to go — cramped towns and a filling world raise tension and war.
   - Factions & governments emerge from population/settlement counts. Splits
     far from the capital (or before strong rule) become rival peoples.
   - The mini world map unlocks at WORLD_UNLOCK total people.              */
const LOCAL_CAP=30;
const WORLD_UNLOCK=10000;
const GOV=[
  {n:'Band',         min:0},
  {n:'Hearth-Camp',  min:10},
  {n:'Village',      min:25, need:'hut'},
  {n:'Chiefdom',     min:120},
  {n:'Kingdom',      min:600,  sett:3},
  {n:'High Kingdom', min:5000, sett:8},
];
const ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X'];
function govIndex(pop,sett){
  let g=0; for(let i=1;i<GOV.length;i++){ const G=GOV[i]; if(pop>=G.min&&(!G.need||knows(G.need))&&(!G.sett||sett>=G.sett)) g=i; else break; }
  if(g===GOV.length-1){ const extra=Math.floor(Math.log10(pop/5000)/0.5); if(extra>=1) g+=extra; }   // endless: Great Realm I, II, …
  return g;
}
const govName=g=>g<GOV.length?GOV[g].n:'Great Realm '+(ROMAN[g-GOV.length]||(g-GOV.length+1));
const COLORS=['#e0a040','#5aa0d0','#c05050','#70b060','#a070c0','#d07fb0','#50b0a0','#c0c060','#8080e0','#e07040'];

/* -------- endless terrain: value noise on integer region coords -------- */
const WSEED=(seed*2654435761)>>>0;
function hsh(x,y){ let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+WSEED)|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; }
function vnoise(x,y){ const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,s=t=>t*t*(3-2*t); const a=hsh(xi,yi),b=hsh(xi+1,yi),c=hsh(xi,yi+1),d=hsh(xi+1,yi+1),u=s(xf),v=s(yf); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }
/* -------- continents: endless, sparse, each with an invented name --------
   The plane is cut into CONT_CELL×CONT_CELL-region cells. Each cell may hold
   one continent (the home cell always does, centred near Ash Hollow) with a
   jittered centre, its own radius and a noisy coast. Between them: open
   ocean. Cells go on forever, so there is still no edge to the world.     */
const CONT_CELL=110;
/* v3.6.4 finite world: continent cells i∈[-WORLD_CI,WORLD_CI], j∈[-WORLD_CJ,WORLD_CJ]; outside them only
   ocean, and beyond WORLD_X/WORLD_Y regions (cell edge + 50 for coastlines) the map ends. */
const WORLD_CI=3, WORLD_CJ=2, WORLD_X=WORLD_CI*CONT_CELL+CONT_CELL/2+50, WORLD_Y=WORLD_CJ*CONT_CELL+CONT_CELL/2+50;
const inWorld=(cx,cy)=>cx>=-WORLD_X&&cx<WORLD_X&&cy>=-WORLD_Y&&cy<WORLD_Y;
const CSYL1=['Ver','Osh','Tal','Mir','Dun','Ael','Zor','Bel','Quen','Ith','Ral','Sev','Kor','Ulm','Thas','Vey','Nal','Ord','Yr','Esk'];
const CSYL2=['an','ar','el','um','ish','or','ae','en','ith','ol'];
const CSYL3=['ia','oth','enn','ura','esh','ond','ys','amar','ell','ireth'];
const contCache=new Map();
function contAt(i,j){
  if(i<-WORLD_CI||i>WORLD_CI||j<-WORLD_CJ||j>WORLD_CJ) return null;   // v3.6.4: no continents past the edge
  const k=i+','+j; if(contCache.has(k)) return contCache.get(k);
  const h=(a)=>hsh(i*7+a*131,j*13-a*71); let c=null;
  if(i===0&&j===0) c={i,j,x:4,y:2,r:34,home:true};
  else if(h(1)<0.62) c={i,j,x:i*CONT_CELL+(h(2)-0.5)*CONT_CELL*0.45,y:j*CONT_CELL+(h(3)-0.5)*CONT_CELL*0.45,r:20+h(4)*24};
  if(c){ c.name=CSYL1[Math.floor(h(5)*CSYL1.length)]+CSYL2[Math.floor(h(6)*CSYL2.length)]+CSYL3[Math.floor(h(7)*CSYL3.length)]; c.id=k; }
  contCache.set(k,c); return c;
}
// land strength at a region (>0 = land) and which continent it belongs to
function landAt(cx,cy){
  const i=Math.round(cx/CONT_CELL), j=Math.round(cy/CONT_CELL); let best=-9, bc=null;
  for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++){ const c=contAt(i+a,j+b); if(!c) continue;
    const ang=Math.atan2(cy-c.y,cx-c.x), wob=1+0.28*Math.sin(ang*3+hsh(c.i,c.j)*6)+0.18*Math.sin(ang*5+1+hsh(c.j,c.i)*6);
    const v=1-Math.hypot(cx-c.x,cy-c.y)/(c.r*wob); if(v>best){best=v;bc=c;} }
  return {v:best+(vnoise(cx/5,cy/5)-0.5)*0.35,c:bc};
}
function continentOf(cx,cy){ const L=landAt(cx,cy); return L.v>0?L.c:null; }
const TCACHE=new Map();
function terrain(cx,cy){ const k=cx*100003+cy; let t=TCACHE.get(k); if(t===undefined){ if(TCACHE.size>600000) TCACHE.clear(); t=terrain_(cx,cy); TCACHE.set(k,t); } return t; }
function terrain_(cx,cy){
  if(Math.abs(cx)<=1&&Math.abs(cy)<=1) return 'grass';
  if(!inWorld(cx,cy)) return 'ocean';
  const L=landAt(cx,cy); if(L.v<-0.12) return 'ocean'; if(L.v<0) return 'water';
  const e=vnoise(cx/8,cy/8)*0.65+vnoise(cx/2.7+50,cy/2.7)*0.35, m=vnoise(cx/9+100,cy/9-40);
  if(e<0.26) return 'water'; if(e>0.78) return 'peak'; if(e>0.64||L.v>0.75&&e>0.55) return 'hills'; return m>0.55?'forest':'grass';
}
const landOK=(cx,cy)=>{ const t=terrain(cx,cy); return t!=='water'&&t!=='ocean'&&t!=='peak'; };

/* ------------------------------ state ------------------------------ */
const world={ factions:[], setts:[], unlocked:false, conflictT:0, roleT:0, dirty:true, contacts:{} };
const home={ id:0, name:'Ash Hollow', cx:0, cy:0, pop:4, extra:0, f:0, home:true, splitT:60 };
world.setts.push(home);
world.factions.push({ id:0, root:'Ash Hollow', color:COLORS[0], gov:0, pop:4, setts:1, ruler:'', capital:home, home:true });
const totalPop=()=>world.setts.reduce((n,s)=>n+s.pop,0);
const claimR=s=>0.8+Math.sqrt(s.pop)/14;                 // in regions
// carrying capacity of one settlement: raised (fewer, fuller towns) and it no longer explodes with endless ages
const sK=s=>900*(1+0.4*Math.min(tribe.age,8)+0.08*Math.max(0,tribe.age-8))*boost.cap*(s.home?1.2:1)*(typeof agriYield==='function'&&world.factions[s.f]?agriYield(world.factions[s.f])*(typeof layoutCap==='function'?layoutCap(world.factions[s.f]):1):1)*(s.bl==null?1:s.bl);   // v3.7: town layout, blight / nuclear winter / spent land
function coinName(){ const w=tribe.words; const a=w?pick(Object.values(w)):pick(SYL)+pick(SYL); const b=pick(SYL); const n=(a+b); return n[0].toUpperCase()+n.slice(1); }
const DIRS=['north','north-east','east','south-east','south','south-west','west','north-west'];

function foundFrom(par){
  const pf0=world.factions[par.f], wantRival=(pf0.gov<4&&rng()<0.3) || rng()<0.18;
  // seafaring: once they work metal, a few splits sail to another continent (sparse global spread)
  const sail=tribe.age>=4 && rng()<(knows('gunpowder')?0.22:0.1);
  let target=null; if(sail){ const C=nearContinents(continentOf(par.cx,par.cy),6); if(C.length){ const cnt=c=>world.setts.reduce((n,s)=>n+(Math.hypot(s.cx-c.x,s.cy-c.y)<c.r*1.2?1:0),0); C.sort((a,b)=>cnt(a)/a.r/a.r-cnt(b)/b.r/b.r); target=pick(C.slice(0,3)); } }   // v3.6.4: settlers seek the emptiest shores
  for(let k=0;k<40;k++){
    let cx,cy;
    if(target){ const a=R(0,6.283), d=R(0,target.r*0.7); cx=Math.round(target.x+Math.cos(a)*d); cy=Math.round(target.y+Math.sin(a)*d); }
    else { const a=R(0,6.283), d=wantRival?R(9,16):R(4,8) /* local cluster: neighbours can be close */; cx=Math.round(par.cx+Math.cos(a)*d); cy=Math.round(par.cy+Math.sin(a)*d); }
    if(!landOK(cx,cy)) continue;
    if(typeof blightAt==='function'&&blightAt(cx,cy)) continue;   // v3.7: poisoned / sickened land is not settled
    if(world.setts.some(s=>Math.hypot(s.cx-cx,s.cy-cy)<(target?8:3.5))) continue;
    const take=Math.floor(par.pop*0.25); if(par.home){ if(par.extra<take) return; par.extra-=take; } par.pop-=take;
    const pf=world.factions[par.f], far=Math.hypot(cx-pf.capital.cx,cy-pf.capital.cy);
    const rival=wantRival || (far>16&&rng()<0.4) || (target&&rng()<0.7);
    const s={ id:world.setts.length, name:coinName(), cx, cy, pop:take, extra:0, f:par.f, splitT:60 };
    const dir=DIRS[Math.round(((Math.atan2(cy-par.cy,cx-par.cx)+Math.PI*2.5)%(Math.PI*2))/(Math.PI/4))%8];
    if(rival){ const f={ parent:pf.id, born:tribe.time, age:pf.age!=null?pf.age:tribe.age, known:pf.home?{...tribe.known}:{...(pf.known||{})}, id:world.factions.length, root:s.name, color:COLORS[world.factions.length%COLORS.length], gov:0, pop:take, setts:1, ruler:coinName()+' of '+s.name, capital:s }; world.factions.push(f); s.f=f.id;
      wlog(`${take} people leave ${par.name} for the ${dir} and will not bow: a rival people, <b>the ${s.name}-folk</b>.`,'rival',s,true); }
    else wlog(`${take} people from ${par.name} settle new land to the ${dir}: <b>${s.name}</b>.`,'settle',s);
    if(target) wlog(`Ships from ${par.name} cross the ocean to the continent of <b>${target.name}</b>.`,'settle',s,true);
    world.setts.push(s); world.dirty=true; return s;
  }
  // v3.6.4: no free land in reach — the town stays cramped (raises tension with neighbours, diplomacy.js)
  par.cramped=tribe.time; world.crampedN=(world.crampedN||0)+1;
}
/* LAND SCARCITY (v3.6.4): share of the finite world's land that is claimed. Land area is sampled once
   on a 3-region grid over the whole world; claims are rasterised as an exact union on that grid. Refreshed with
   the diplomacy tick. Past ~55% claimed, every border is a little tenser; past 85% tension rises fast. */
let LAND_TOTAL=0, LAND_MASK=null; const LG=3, LGW=Math.ceil(2*WORLD_X/LG), LGH=Math.ceil(2*WORLD_Y/LG);
function landTotal(){ if(!LAND_MASK){ LAND_MASK=new Uint8Array(LGW*LGH); let n=0; for(let j=0;j<LGH;j++) for(let i=0;i<LGW;i++){ const t=terrain_(-WORLD_X+i*LG,-WORLD_Y+j*LG); if(t!=='ocean'&&t!=='water'&&t!=='peak'){ LAND_MASK[j*LGW+i]=1; n++; } } LAND_TOTAL=n; } return LAND_TOTAL; }
function landClaimed(){ const tot=landTotal(); if(!tot) return 0; const seen=new Uint8Array(LGW*LGH); let n=0;   // exact union of claims on the coarse land grid
  for(const s of world.setts){ const r=claimR(s), X=(s.cx+WORLD_X)/LG, Y=(s.cy+WORLD_Y)/LG, rr=r/LG;
    for(let j=Math.max(0,Math.floor(Y-rr));j<=Math.min(LGH-1,Math.ceil(Y+rr));j++) for(let i=Math.max(0,Math.floor(X-rr));i<=Math.min(LGW-1,Math.ceil(X+rr));i++){ const k=j*LGW+i; if(!seen[k]&&LAND_MASK[k]&&(i-X)*(i-X)+(j-Y)*(j-Y)<=rr*rr){ seen[k]=1; n++; } } }
  return n/tot; }
function scarcityStep(){ if(world.setts.length<8) return; const was=world.claimed||0; world.claimed=landClaimed();
  if(world.claimed>=0.85&&was<0.85&&!world.fullSaid){ world.fullSaid=true; wlog('<b>The world is filling up.</b> There is little empty land left anywhere — peoples begin to press on each other\'s borders.','war',null,true); }
  else if(world.claimed>=0.55&&was<0.55&&!world.halfSaid){ world.halfSaid=true; wlog('More than half the land of the world is claimed. The empty places are running out.','diplo'); } }
const scarcityTension=()=>{ const c=world.claimed||0; return c<0.55?0:c<0.85?(c-0.55)*2:0.6+(c-0.85)*8; };   // per diplomacy tick
function wlog(msg,kind,sett,big){ log(msg); if(typeof director==='function') director(null,{kind:kind||'world',caption:msg.replace(/<\/?b>/g,''),sett,big}); }

function worldStep(dt){
  const local=alive().length;
  // saner growth: ~doubling every few in-game days at most (was ~2× per day by the Iron Age)
  const r=0.0011*(1+0.12*Math.min(tribe.age,8))*boost.growth*(world.peace&&world.peace.on?1.15:1);
  // home: abstract growth only once the valley's detailed population is full
  if(local>=LOCAL_CAP-1 && home.pop>0) home.extra=Math.max(0,home.extra+r*home.pop*dt*(1-home.pop/sK(home)));
  home.pop=local+home.extra;
  /* v3.6.3 LOD: remote growth + splits are batched. With few settlements this runs every step (blank-slate
     start unchanged); with many it runs every 0.25 sim-s on the accumulated dt (same logistic math). sK is
     evaluated once per settlement per batch with the per-people agri yield computed once per people.      */
  world.growAcc=(world.growAcc||0)+dt; const many=world.setts.length>40, batch=!many||world.growAcc>=0.25;
  if(batch){ const gdt=world.growAcc; world.growAcc=0;
    const base=900*(1+0.4*Math.min(tribe.age,8)+0.08*Math.max(0,tribe.age-8))*boost.cap, Y=[];
    const kOf=s=>{ let y=Y[s.f]; if(y===undefined) y=Y[s.f]=(typeof agriYield==='function'&&world.factions[s.f]?agriYield(world.factions[s.f])*(typeof layoutCap==='function'?layoutCap(world.factions[s.f]):1):1); return base*(s.home?1.2:1)*y*(s.bl==null?1:s.bl); };
    for(const s of world.setts){ const K=kOf(s);
      if(!s.home) s.pop=Math.max(1,s.pop+r*0.9*s.pop*gdt*(1-s.pop/K));
      // crowded places split and settle further out (no edge to the land)
      s.splitT-=gdt; if(s.splitT<=0 && s.pop>Math.max(90,0.85*K) && (!s.home||s.extra>20)){ s.splitT=R(150,300); /* was 25–45 s: one split per 1–2.5 days */ if(rng()<0.6) foundFrom(s); } } }
  // far-off peoples: once the home people can sail (metal age), they learn of peoples who rose on their own on other continents
  if(tribe.age>=4 && !world.natives){ world.natives=1; for(const c of nearContinents(continentOf(0,0),4)){ spawnNative(c); } }
  techStepPeoples(dt);
  // diplomacy between peoples: contact, trade, alliances, war, truces, peace eras (diplomacy.js)
  if(typeof diploStep==='function') diploStep(dt);
  // factions: totals + government stage (v3.6.3: with the growth batch when the world is big)
  if(batch){
  for(const f of world.factions){ f.pop=0; f.setts=0; }
  for(const s of world.setts){ const f=world.factions[s.f]; f.pop+=s.pop; f.setts++; }
  for(const f of world.factions){ if(f.setts && !(f.capital&&f.capital.f===f.id)){ if(f.capital) f.capT=tribe.time; f.capital=world.setts.find(s=>s.f===f.id); }   /* v3.6.6: capT = capital lost → succession turmoil */   /* v3.6.3: settlements are never removed, so ownership is the check (was a full scan per people per step) */
    const g=govIndex(f.pop*(0.7+0.3*pressMult(f)),f.setts); if(g>f.gov){ /* rivals push governments to organise sooner */ f.gov=g; if(f.home){ const nm=tribe.words&&g>=4?` of ${coinRealm()}`:''; wlog(`The Ash Hollow people become a <b>${govName(g)}</b>${nm}.`,'gov'); if(typeof banner==='function') banner(govName(g),'government · '+Math.round(f.pop).toLocaleString()+' people'); }
      else if(g>=3) wlog(`The ${f.root} people now form a <b>${govName(g)}</b>.`,'gov',f.capital); } }
  }
  // roles in the home valley
  world.roleT-=dt; if(world.roleT<=0){ world.roleT=2; updateRoles(); }
  if(!world.unlocked && totalPop()>=WORLD_UNLOCK){ world.unlocked=true; wlog(`<b>${WORLD_UNLOCK.toLocaleString()} people</b> now live across the land — the world map opens.`,'worldmap'); if(typeof banner==='function') banner('The World Map opens','press M or the World button'); }
}
function nearContinents(from,n){ const out=[]; for(let a=-2;a<=2;a++) for(let b=-2;b<=2;b++){ const c=contAt((from?from.i:0)+a,(from?from.j:0)+b); if(c&&c!==from) out.push(c); }
  const fx=from?from.x:0, fy=from?from.y:0; return out.sort((p,q)=>Math.hypot(p.x-fx,p.y-fy)-Math.hypot(q.x-fx,q.y-fy)).slice(0,n); }
function spawnNative(c){
  for(let k=0;k<60;k++){ const a=R(0,6.283), d=R(0,c.r*0.6), cx=Math.round(c.x+Math.cos(a)*d), cy=Math.round(c.y+Math.sin(a)*d); if(!landOK(cx,cy)) continue;
    const pop=Math.round(R(200,900)), s={id:world.setts.length,name:coinName(),cx,cy,pop,extra:0,f:world.factions.length,splitT:R(60,200)};
    world.factions.push({id:world.factions.length,root:s.name,color:COLORS[world.factions.length%COLORS.length],gov:0,pop,setts:1,ruler:coinName()+' of '+s.name,capital:s,native:true,age:Math.max(1,tribe.age-2),known:ladderKnown(Math.max(1,tribe.age-2))});
    world.setts.push(s); world.dirty=true; wlog(`Far across the ocean, on the continent of <b>${c.name}</b>, live the <b>${s.name}-folk</b> — a people who rose on their own.`,'rival',s); return s; } }
/* RIVAL PRESSURE. Every people's pressure comes from its relations: wars
   and hostile borders press hardest, competing traders and wary neighbours
   less, all fading with distance (computed in diploStep → f.press). A people
   with no rivals near (a lonely continent) plateaus: ideas come at 0.6×;
   under heavy pressure they come up to 1.8× faster. It only applies once
   people farm (early bands are not punished for being alone).            */
const pressMult=f=>clamp(0.6+0.5*(f&&f.press||0),0.6,1.8);
/* PER-PEOPLE TECH (v3.6). Every people has its own age index f.age on the
   shared AGES ladder (home: f.age = tribe.age, from its own inventions).
   Remote peoples are counted, not simulated, so they research abstractly:
     points/s = 0.010 × (1+log10 pop) × rival pressure × wealth × routes
                × diffusion (1 + 0.6 × ages behind any partner it trades,
                  allies or wars with — ideas spread by contact)
   and move up an age when points reach that age's invention cost (the same
   `need` as home). Isolated peoples plateau; connected ones catch up.
   Splits inherit the parent people's age; peoples found overseas start
   2 ages behind. Home also gets diffusion if a partner is ahead.         */
/* PER-PEOPLE TECH (v3.6). Every people keeps its OWN known-inventions set
   (f.known; home = tribe.known) and its age = ageFrom(its set).
   Remote peoples are counted, not simulated, so they research abstractly,
   one invention at a time along their OWN path (nextInvention):
     points/s = 0.010 × (1+log10 pop) × rival pressure × wealth × routes
                × diffusion (1 + 0.6 × ages behind its most advanced
                  trade / ally / war / neutral partner)
   An invention lands when points reach its `need` (pre-Steel: the next
   key on the age ladder). Trade partners can also hand over an invention
   the partner already has (diffusion, without forcing order).
   Splits inherit the parent's set; peoples found overseas start 2 ages
   behind the home people. Home gets the same diffusion multiplier.       */
const LADDER=['fire','hut','planting','copper','bronze','iron','steel'];
function ladderKnown(age){ const k={sticks:1,leanto:1,spear:1,flint:1,strike:1,syll:1,words:1,myths:1}; for(let i=0;i<Math.min(age,7);i++) k[LADDER[i]]=1; return k; }
function partnerAgeGap(f){ let g=0; for(const r of (typeof relsOf==='function'?relsOf(f.id):Object.values(world.rel))){ if(r.a!==f.id&&r.b!==f.id) continue; if(!['trade','allied','war','neutral'].includes(r.state)) continue; const o=world.factions[r.a===f.id?r.b:r.a]; if(o&&o.setts) g=Math.max(g,(o.age||0)-(f.age||0)); } return g; }
let techAcc=0;
function techStepPeoples(dt0){
  techAcc+=dt0; if(techAcc<1) return; const dt=techAcc; techAcc=0;   // once per sim-second (cheap LOD)
  for(const f of world.factions){ if(!f.setts) continue;
    if(f.home){ f.age=tribe.age; f.known=tribe.known; continue; }
    if(!f.known) f.known=ladderKnown(f.age!=null?f.age:Math.max(1,tribe.age-1));
    const kn=id=>!!f.known[id];
    const id=kn('steel')?nextInvention(kn,typeof pathOf==='function'?pathOf(f):'spark'):LADDER.find(k=>!kn(k)); if(!id) { f.age=ageFrom(kn); continue; }
    const em=((typeof wealthMult==='function')?wealthMult(f)*routeMult(f):1)*(typeof iqMult==='function'&&canThink(f)?iqMult(f)*inquiryMult(f)*resMult(f):1);   // v3.7: intellect, inquiry, scarce ore/fuel
    f.tp=(f.tp||0)+dt*0.010*(1+Math.log10(Math.max(10,f.pop)))*pressMult(f)*em*(1+0.6*partnerAgeGap(f));
    const need=Math.max(60,INV[id].need)*(LADDER.indexOf(id)>=0&&LADDER.indexOf(id)<3?2:1);
    if(f.tp>=need){ f.tp-=need; f.known[id]=1; const was=f.age; f.age=ageFrom(kn); f.latest=INV[id].name;
      if(INV[id].tech||f.age>was) wlog(`The ${f.root}-folk invent <b>${INV[id].name}</b>${f.age>was?' and enter the '+AGES[f.age].n:''}.`,'gov',f.capital); }
    else f.age=ageFrom(kn);
  }
}
function coinRealm(){ const f=world.factions[0]; if(!f.realm) f.realm=(tribe.words?cap(tribe.words.us)+cap(tribe.words.fire).toLowerCase():'Ash Hollow'); return f.realm; }

/* Leadership emerges with the government:
   Band: none (a Fire-Singer appears once there are rites) · Hearth-Camp: Elder ·
   Chiefdom: Chief (most deeds) · Kingdom+: the Chief becomes Ruler. */
function updateRoles(){
  const f=world.factions[0], A=adults(); if(!A.length) return;
  const prev={}; for(const v of villagers) if(v.role) prev[v.role]=v; for(const v of villagers) v.role='';
  if(f.gov>=3){ const c=A.slice().sort((a,b)=>b.deeds-a.deeds)[0]; c.role=f.gov>=4?'Ruler':'Chief'; f.ruler=c.name; }
  if(f.gov>=1){ const e=A.filter(v=>!v.role).sort((a,b)=>a.born-b.born)[0]; if(e) e.role='Elder'; }
  for(const role of ['Elder','Chief','Ruler']){ const now=villagers.find(v=>v.role===role); if(now&&prev[role]!==now){ log(`<b>${now.name}</b> is now ${role==='Elder'?'the Elder':'the '+role} of Ash Hollow.`); if(typeof director==='function') director(now,{kind:'role',caption:`${now.name} becomes ${role==='Elder'?'the Elder':'the '+role}`}); } }
}
