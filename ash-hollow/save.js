"use strict";
/* ASH HOLLOW — autosave. One JSON blob in localStorage (works from file://;
   even big worlds of a few hundred settlements stay well under 1 MB).
   Saved: the rng state + original seed (the valley is regenerated from the
   seed, then its changes are re-applied), people, inventions, words,
   beliefs, structures, fire, settlements, peoples, diplomacy, peace,
   watcher prefs (director, speed). Not saved: in-progress tasks, bubbles,
   rites and visits (they restart naturally a moment after loading).       */
const SAVE_KEY='ash-hollow-save-v6';
const SEED0=seed;                       // seed the valley was generated from
let lastSave=0, saveSoon=false;
function serial(){
  const sIdx=s=>tribe.structures.indexOf(s);
  const T={}; for(const k in tribe){ if(['ritual','burning','toast'].includes(k)) continue; T[k]=tribe[k]; }
  T.burningIdx=tribe.burning?trees.indexOf(tribe.burning):-1;
  const V=villagers.map(v=>{ const o={...v}; o.task=null; o.bubble=null; o.home=v.home?sIdx(v.home):-1; if(o.carry&&o.carry.type==='brand') o.carry=null; return o; });
  const P=preds.filter(p=>!p.dead).map(p=>({x:p.x,y:p.y,hp:p.hp,life:p.life,face:p.face}));
  const S=world.setts.map(s=>({...s}));
  const F=world.factions.map(f=>({...f,capital:f.capital?world.setts.indexOf(f.capital):-1}));
  const Wd={unlocked:world.unlocked,rel:world.rel,peace:world.peace,everWar:world.everWar,homeWar:world.homeWar,natives:world.natives,lonelySaid:world.lonelySaid,battles:world.battles.map(b=>({...b,at:world.setts.indexOf(b.at)})),roleT:world.roleT,diploT:world.diploT,
    /* v3.7 */ ideas:world.ideas||[],ideaN:world.ideaN||0,ideaStats:world.ideaStats||null,dis:world.dis||null,tseed:typeof TSEED!=='undefined'?TSEED:0,claimed:world.claimed,halfSaid:world.halfSaid,fullSaid:world.fullSaid};
  return {v:3,savedAt:Date.now(),seed0:SEED0,rng:seed,nameI,tribe:T,villagers:V,preds:P,cairns,
    trees:trees.map(t=>t.burnt?2:t.burn>0?1:0),bushes:bushes.map(b=>b.berries),roots:roots.map(r=>r.amt),flints:flints.map(f=>f.amt),skitters:skitters.map(s=>[Math.round(s.x),Math.round(s.y),s.alive?1:0]),
    setts:S,factions:F,world:Wd,prefs:{director:typeof dir!=='undefined'?dir.on:true,speed:typeof speed!=='undefined'?speed:1}};
}
function saveNow(){ try{ localStorage.setItem(SAVE_KEY,JSON.stringify(serial())); lastSave=performance.now(); saveSoon=false; return true; }catch(e){ console.warn('save failed',e); return false; } }
function loadSave(){ try{ const t=localStorage.getItem(SAVE_KEY); return t?JSON.parse(t):null; }catch(e){ return null; } }
function wipeSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }
function restore(S){
  // tribe: assign into existing objects so references (e.g. Mind.ctx.beliefs) stay valid
  for(const k in S.tribe){ const val=S.tribe[k], cur=tribe[k];
    if(cur&&typeof cur==='object'&&!Array.isArray(cur)&&val&&typeof val==='object'){ for(const kk in cur) delete cur[kk]; Object.assign(cur,val); }
    else if(Array.isArray(cur)){ cur.length=0; cur.push(...val); } else tribe[k]=val; }
  tribe.ritual=null; tribe.toast=null;
  if(tribe.beliefs&&tribe.beliefs.bright){ delete tribe.beliefs.bright; }   // v3.6: metals are not beliefs
  // age index remaps via ageCheck from known inventions
  tribe.burning=S.tribe.burningIdx>=0?trees[S.tribe.burningIdx]:null; delete tribe.burningIdx;
  S.trees.forEach((s,i)=>{ if(trees[i]){ trees[i].burnt=s===2; trees[i].burn=s===1?20:0; } });
  S.bushes.forEach((n,i)=>{ if(bushes[i]) bushes[i].berries=n; }); S.roots.forEach((n,i)=>{ if(roots[i]) roots[i].amt=n; }); S.flints.forEach((n,i)=>{ if(flints[i]) flints[i].amt=n; });
  S.skitters.forEach((a,i)=>{ const s=skitters[i]; if(s){ s.x=a[0]; s.y=a[1]; s.alive=!!a[2]; if(!s.alive) s.rs=10; } });
  villagers.length=0; for(const o of S.villagers){ const v={...o}; v.home=o.home>=0?tribe.structures[o.home]:null; v.task=null; villagers.push(v); }
  preds.length=0; for(const p of S.preds){ const q=spawnPredQuiet(p.x,p.y); Object.assign(q,p); }
  cairns.length=0; cairns.push(...S.cairns);
  nameI=S.nameI;
  world.setts.length=0; S.setts.forEach((o,i)=>{ if(i===0){ for(const k in home) delete home[k]; Object.assign(home,o); world.setts.push(home); } else world.setts.push({...o}); });
  world.factions.length=0; for(const o of S.factions) world.factions.push({...o,capital:o.capital>=0?world.setts[o.capital]:null});
  const Wd=S.world; world.unlocked=Wd.unlocked; world.rel=Wd.rel||{}; Object.assign(world.peace,Wd.peace||{}); world.everWar=Wd.everWar; world.homeWar=Wd.homeWar; world.natives=Wd.natives; world.lonelySaid=Wd.lonelySaid;
  world.battles=(Wd.battles||[]).map(b=>({...b,at:world.setts[b.at]})); world.dirty=true;
  // v3.7 fields — an older v6 save simply has none of them: no ideas yet, an unspent world, no blight (they emerge from here on)
  world.ideas=Array.isArray(Wd.ideas)?Wd.ideas:[]; world.ideaN=Wd.ideaN||0; world.ideaStats=Wd.ideaStats||null; world.dis=Wd.dis||null;
  if(Wd.claimed!=null) world.claimed=Wd.claimed; if(Wd.halfSaid) world.halfSaid=true; if(Wd.fullSaid) world.fullSaid=true;
  if(typeof ideasInit==='function') ideasInit(); if(typeof disInit==='function') disInit(); if(Wd.tseed&&typeof TSEED!=='undefined') TSEED=Wd.tseed;
  seed=S.rng;
  tribe.era=0; delete tribe.beliefs.copper; delete tribe.beliefs.bronze; delete tribe.beliefs.iron; delete tribe.beliefs.steel; if(typeof ensureFrontier==='function'){ ensureFrontier(); }   // rebuild the post-Steel tech list from the known ids
  log(`The world resumes (saved ${new Date(S.savedAt).toLocaleString()}).`);
}
function spawnPredQuiet(x,y){ const p={x,y,hp:100,state:'prowl',target:null,t:0,life:0,face:1,anim:0,cd:0,tx:FIRE.x,ty:FIRE.y+200,dead:false,hurtBy:0,corpse:0}; preds.push(p); return p; }
addEventListener('pagehide',()=>{ if(!window.__noSave) saveNow(); });
addEventListener('beforeunload',()=>{ if(!window.__noSave) saveNow(); });
