"use strict";
/* ---------------------- THE STRANGER (v3.6.6) ----------------------
   An optional, observer-spawned visitor: a lone person from far away who
   brings a breakthrough. NOT a beast and not a fighter. It walks in from
   the edge, stays by the fire for a while, and leaves.
   - Cooldown on the CALENDAR clock: at most once every STRANGER_YEARS (3,000)
     calendar years (calYear in sim.js), counted from the start of the world
     (12,000 BCE → the first can come in 9,000 BCE). Because the calendar
     slows as history speeds up, strangers come in prehistory and antiquity;
     after about 1000 CE there is not another 3,000 years left before the
     present day, so the next one only becomes possible far in the future.
   - Who gets it: the people being watched (a visited people, else Ash Hollow).
   - The breakthrough is that people's OWN frontier, nothing pre-written:
     the next key invention on its age ladder (or its industrial path after
     Steel). It is invented at once, and the invention after it gets a strong
     head start (+60% for Ash Hollow; half its cost for a remote people).
   - The stranger's origin is a far continent of this world (invented name).
   Key X or the 🧭 button; the button shows how many years are left.      */
const STRANGER_YEARS=3000;
let STRANGER=null;
const strangerBase=()=>tribe.strangerYear!=null?tribe.strangerYear:calYear(1);
function strangerYearsLeft(){ return Math.max(0,STRANGER_YEARS-(calYear(nowDay())-strangerBase())); }
function strangerTarget(){ return (typeof visit!=='undefined'&&visit.on&&visit.f)?visit.f:world.factions[0]; }
function frontierOf(f){
  if(f.home){ const nxt=AGES[tribe.age+1];
    if(nxt&&nxt.key&&!knows(nxt.key)&&nxt.key!=='fire'&&prereqOK(nxt.key)) return nxt.key;
    if(knows('steel')){ const id=nextInvention(knows,pathOf(f)); if(id) return id; }
    const c=Object.keys(INV).filter(id=>!knows(id)&&!INV[id].event&&id!=='fire'&&prereqOK(id)).sort((a,b)=>((tribe.ideas[b]||0)/INV[b].need)-((tribe.ideas[a]||0)/INV[a].need));
    return c[0]||null; }
  if(!f.known) f.known=ladderKnown(f.age||1); const kn=id=>!!f.known[id];
  return kn('steel')?nextInvention(kn,pathOf(f)):LADDER.find(k=>!kn(k))||null;
}
function canSpawnStranger(){ return !STRANGER&&strangerYearsLeft()<=0&&!!frontierOf(strangerTarget()); }
function spawnStranger(){
  if(!canSpawnStranger()) return false;
  const f=strangerTarget(), atVisit=!f.home, here=continentOf(f.capital?f.capital.cx:0,f.capital?f.capital.cy:0);
  const far=[]; for(let i=-WORLD_CI;i<=WORLD_CI;i++) for(let j=-WORLD_CJ;j<=WORLD_CJ;j++){ const c=contAt(i,j); if(c&&c!==here) far.push(c); }
  far.sort((a,b)=>Math.hypot(b.x-(here?here.x:0),b.y-(here?here.y:0))-Math.hypot(a.x-(here?here.x:0),a.y-(here?here.y:0)));
  const from=far.length?far[Math.floor(rng()*Math.min(4,far.length))]:null;
  const cx=atVisit?VC.x:FIRE.x, cy=atVisit?VC.y:FIRE.y, sx=atVisit?40:Math.max(40,FIRE.x-700), sy=cy+R(80,160);
  STRANGER={f,where:atVisit?'visit':'home',x:sx,y:sy,tx:cx+R(30,60),ty:cy+R(20,40),phase:'walk',t:0,from:from?from.name:'beyond the sea',face:1,taught:null};
  tribe.strangerYear=calYear(nowDay());
  const who=f.home?'Ash Hollow':`the ${f.root}-folk`;
  log(`A <b>stranger</b> walks in from the far side of the world — from ${from?'the continent of <b>'+from.name+'</b>':'beyond the sea'} — and comes to ${who}.`);
  if(typeof director==='function') director(null,{kind:'stranger',caption:`A stranger arrives from ${from?from.name:'beyond the sea'}`,sub:`walking toward the fire of ${who}`,big:true});
  return true;
}
function strangerTeach(S){
  const f=S.f, id=frontierOf(f); if(!id) return;
  const nm=INV[id].name;
  if(f.home){ discover(id,null); const id2=frontierOf(f); if(id2) tribe.ideas[id2]=Math.max(tribe.ideas[id2]||0,INV[id2].need*0.6); ageCheck(); }
  else { f.known[id]=1; const kn=x=>!!f.known[x]; const was=f.age; f.age=ageFrom(kn); f.latest=nm; const id2=frontierOf(f); if(id2) f.tp=Math.max(f.tp||0,Math.max(60,INV[id2].need)*0.5);
    if(f.age>was) log(`The ${f.root}-folk enter the <b>${AGES[f.age].n}</b>.`); }
  S.taught=nm; tribe.lastStranger=nm;
  const who=f.home?'Ash Hollow':`the ${f.root}-folk`;
  log(`The stranger from ${S.from} shows ${who} what their own people already know: <b>${nm}</b>. A breakthrough.`);
  if(typeof director==='function') director(null,{kind:'stranger',caption:`Breakthrough: ${nm}`,sub:`taught by a stranger from ${S.from}`,big:true});
}
function strangerStep(dt){ const S=STRANGER; if(!S) return; S.t+=dt;
  if(S.where==='visit'&&!(typeof visit!=='undefined'&&visit.on&&visit.f===S.f)){ if(!S.taught) strangerTeach(S); STRANGER=null; return; }   // view left: the teaching still happens
  const sp=60*dt;
  const go=(x,y)=>{ const dx=x-S.x, dy=y-S.y, d=Math.hypot(dx,dy); if(d<4) return true; S.x+=dx/d*Math.min(d,sp); S.y+=dy/d*Math.min(d,sp); S.face=dx<0?-1:1; return false; };
  if(S.phase==='walk'){ if(go(S.tx,S.ty)){ S.phase='stay'; S.t=0; strangerTeach(S); } }
  else if(S.phase==='stay'){ if(S.t>40){ S.phase='leave'; S.tx=S.where==='home'?Math.max(20,FIRE.x-800):20; S.ty=S.y+R(-40,40); } }
  else if(go(S.tx,S.ty)||S.t>200){ log(`The stranger leaves as quietly as they came.`); STRANGER=null; }
}
// a person in a long travel-worn cloak with a staff and a small lantern — not a beast
function drawStranger(S,t){
  const x=S.x, y=S.y, bob=S.phase==='stay'?0:Math.sin(t*6)*1.2;
  ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x,y+2,10,3.5,0,0,7); ctx.fill();
  ctx.strokeStyle='#6b5034'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x+9*S.face,y); ctx.lineTo(x+7*S.face,y-36); ctx.stroke();      // staff
  ctx.fillStyle='#3d5560'; ctx.beginPath(); ctx.moveTo(x-8,y); ctx.lineTo(x+8,y); ctx.lineTo(x+5,y-24+bob); ctx.lineTo(x-5,y-24+bob); ctx.closePath(); ctx.fill();   // cloak
  ctx.fillStyle='#2c4048'; ctx.beginPath(); ctx.arc(x,y-28+bob,6.5,0,7); ctx.fill();          // hood
  ctx.fillStyle='#d8b48c'; ctx.beginPath(); ctx.arc(x+1.5*S.face,y-27+bob,3.4,0,7); ctx.fill();  // face
  const g=0.6+0.4*Math.sin(t*3); ctx.fillStyle=`rgba(255,214,120,${0.55*g})`; ctx.beginPath(); ctx.arc(x+7*S.face,y-37,6,0,7); ctx.fill(); ctx.fillStyle='#ffe2a0'; ctx.fillRect(x+7*S.face-1.5,y-39,3,4);   // lantern
  if(S.phase==='stay'&&S.taught){ ctx.font='11px system-ui'; ctx.textAlign='center'; ctx.fillStyle='#000a'; ctx.fillText('teaching: '+S.taught,x+1,y-49); ctx.fillStyle='#ffe6b0'; ctx.fillText('teaching: '+S.taught,x,y-50); }
}
