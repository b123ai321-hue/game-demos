"use strict";
/* ASH HOLLOW — watching other peoples.
   Other settlements are counted, not simulated. To watch one, we build a small
   LOCAL CAST there on the fly (≈6–18 people drawn with the same sprites, the
   same Mind speech in that people's own coined words, the same camera and
   director). Their huts, fields, stones and banner reflect the settlement's
   size, the shared level of invention, their government and the state of
   their wars and trade. Leaving the visit discards the cast; the counted
   world keeps running the whole time.                                       */
const VW_W=1800, VW_H=1300, VC={x:900,y:640};
const visit={on:false,s:null,f:null,cast:[],huts:[],plots:[],trees:[],enemies:[],bg:null,words:null,auto:0,lastGlance:-999,lang:0};
function seeded(n){ let a=(n*2654435761)>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; }; }
function factionWords(f){ if(f.home) return tribe.words; if(!tribe.words) return null; if(!f.words) f.words=coinWords(seeded(1000+f.id*7)); return f.words; }

function startVisit(s,opt){
  opt=opt||{};
  if(!s||s.home){ endVisit(); return; }
  const f=world.factions[s.f], rr=seeded(s.id*97+13), RR=(a,b)=>a+rr()*(b-a);
  visit.on=true; visit.s=s; visit.f=f; visit.auto=opt.auto?opt.dur||16:0; visit.words=factionWords(f);
  // ground
  const t=terrain(s.cx,s.cy), base={grass:'#6f7a3a',forest:'#56682e',hills:'#86804e'}[t]||'#6f7a3a';   // settlements are always on land
  const g=(visit.bg=document.createElement('canvas')); g.width=VW_W; g.height=VW_H; const c=g.getContext('2d');
  c.fillStyle=base; c.fillRect(0,0,VW_W,VW_H);
  for(let i=0;i<4500;i++){ c.fillStyle=['#86803f','#5f6b2e','#a39446','#71753a','#8c6e33'][Math.floor(rr()*5)]; c.globalAlpha=.5; c.fillRect(rr()*VW_W,rr()*VW_H,1.5,2+rr()*3); } c.globalAlpha=1;
  const cg=c.createRadialGradient(VC.x,VC.y,10,VC.x,VC.y,330); cg.addColorStop(0,'#8a7050aa'); cg.addColorStop(1,'#8a705000'); c.fillStyle=cg; c.beginPath(); c.ellipse(VC.x,VC.y,360,260,0,0,7); c.fill();
  for(let i=0;i<300;i++){ c.fillStyle=['#c8642a','#d98a2b','#b9452a','#e0b23a'][Math.floor(rr()*4)]; c.globalAlpha=.7; c.beginPath(); c.ellipse(rr()*VW_W,rr()*VW_H,2.6,1.4,rr()*3,0,7); c.fill(); } c.globalAlpha=1;
  // buildings from size + shared inventions
  visit.huts=[]; const nh=Math.min(22,Math.max(2,Math.ceil(s.pop/60))), type=(f.age||1)>=2?'hut':'leanto';   // that people's OWN age (v3.6), not home's
  const LAY=typeof layoutOf==='function'?layoutOf(f):'scatter';   // v3.7: their town plan sets where the houses stand
  for(let i=0;i<nh;i++){ let x,y; const ring=Math.floor(i/7), j=i%7;
    if(LAY==='grid'){ const c=i%6-2.5, r=Math.floor(i/6); x=VC.x+c*130; y=VC.y-250+r*115+(r>=2?150:0); }
    else if(LAY==='ring'){ const a=0.15+i*(6.283/Math.min(nh,12))+(i>=12?0.26:0), R0=i>=12?380:260; x=VC.x+Math.cos(a)*R0; y=VC.y+Math.sin(a)*R0*0.7; }
    else if(LAY==='spiral'){ const a=0.6+i*0.62, R0=170+i*17; x=VC.x+Math.cos(a)*R0; y=VC.y+Math.sin(a)*R0*0.7; }
    else if(LAY==='terraces'){ const row=Math.floor(i/6), c=i%6-2.5; x=VC.x+c*(120+row*20); y=VC.y-170-row*95; if(row>=3){ x=VC.x+c*150; y=VC.y+260; } }
    else { const a=0.2+j*0.9+ring*0.45+(rr()-0.5)*0.3, r=210+ring*120+(rr()-0.5)*50; x=VC.x+Math.cos(a)*r; y=VC.y+Math.sin(a)*r*0.7; }
    if(Math.abs(x-VC.x)<90&&Math.abs(y-VC.y)<70) y+=110;   // keep the fire clear
    visit.huts.push({type,built:true,x,y,painted:knows('copper')}); }
  visit.plots=[]; if((f.age||1)>=3) for(let i=0;i<Math.min(4,1+Math.floor(s.pop/400));i++) visit.plots.push({type:'plot',built:true,x:VC.x-380+i*250,y:VC.y+390,stage:i%2?'ripe':'growing',grow:0.6,need:0,have:0,work:1,workNeed:1});
  visit.trees=[]; for(let i=0;i<70;i++){ const a=rr()*6.283, r=560+rr()*400; visit.trees.push({x:VC.x+Math.cos(a)*r*1.2,y:VC.y+Math.sin(a)*r*0.75,r:15+rr()*10,kind:rr()<.3?'pine':'leaf',hue:HUES[Math.floor(rr()*HUES.length)],burn:0,burnt:false}); }
  // the cast
  visit.cast=[]; const n=Math.round(clamp(Math.sqrt(s.pop)/2,6,18));
  for(let i=0;i<n;i++){ const v=mkPuppet(VC.x+RR(-200,200),VC.y+RR(-120,160),rr);
    if(i===0&&f.gov>=3&&f.capital===s){ v.role=f.gov>=4?'Ruler':'Chief'; v.name=(f.ruler||'').split(' ')[0]||v.name; }
    if(i===1&&f.gov>=1) v.role='Elder';
    if(i===2) v.isLead=true;
    visit.cast.push(v); }
  visit.enemies=[];
  visit.lang=(f.age||1)>=2?3:2;
  cam.x=VC.x; cam.y=VC.y; cam.z=1.25; cam.follow=null; if(typeof dir!=='undefined'){ dir.q.length=0; dir.cur=null; dir.idleT=0; }
  const rel=Object.values(world.rel).filter(r=>r.a===f.id||r.b===f.id), wars=rel.filter(r=>r.state==='war').map(r=>fname(world.factions[r.a===f.id?r.b:r.a]));
  if(typeof director==='function') director(null,{kind:'visit',caption:`Watching ${s.name} — ${govName(f.gov)} of ${f.root}`,sub:`${typeof archOf==='function'?(()=>{const A=archOf(f);const I=typeof ideaOf==='function'?ideaOf(f):null; return CULT_ADJ[A.lean]+' · '+A.shape+' houses'+(A.layout&&A.layout!=='scatter'?' in '+LAYOUT_N[A.layout]:'')+(A.staple?' · '+A.staple.name:A.agri?' · '+AGRI[A.agri].n:'')+(I?' · '+I.name:'')+(A.ruin?' · a fallen people, rebuilding':'')+' · ';})():''}${Math.round(s.pop).toLocaleString()} people here · shown as a small cast${wars.length?' · at war with '+wars.join(', '):''}`});
}
function endVisit(){ if(!visit.on) return; visit.on=false; visit.cast=[]; visit.s=null; cam.x=STOCK.x; cam.y=STOCK.y-60; cam.z=1.4; cam.follow=null; if(typeof dir!=='undefined'){ dir.q.length=0; dir.cur=null; dir.idleT=0; } }
function mkPuppet(x,y,rr){
  const T=rollTraits(), fa=(visit.f&&visit.f.age)||1, tier=fa>=8?8:fa>=4?fa:fa>=2?3:2;
  return {id:900+Math.floor(rr()*9999),name:coinName(),x,y,face:1,spd:30+rr()*10,hunger:30,fear:0,faith:40,hp:100,tool:tier,carry:null,
    task:{kind:'idle'},bubble:null,isLead:false,dead:false,anim:rr()*9,moving:false,mood:'content',thought:'',gloss:'',
    skin:['#c58c5a','#a8703f','#8a5a33','#d5a070','#7a4c2a'][Math.floor(rr()*5)],hide:['#8a6a44','#7b5a3a','#9a7a50','#6d5236','#a0805a'][Math.floor(rr()*5)],hair:['#2a1c12','#3b2a1a','#1a120c','#5a3a20'][Math.floor(rr()*4)],
    child:rr()<.15,grow:0.5,talkT:2+rr()*10,role:'',deeds:0,tr:T.tr,type:T.type,puppet:true,tx:x,ty:y,wait:0};
}
function visitCtx(){ return {pick, rand:rng, beliefs:tribe.beliefs, words:visit.words, extraMyths:[], lang:()=>visit.lang, say:(a,t)=>{a.bubble={text:t,t:3}}}; }
function puppetSay(v,ev){ let r={}; try{ r=Mind.provider.think(v,ev,visitCtx())||{}; }catch(e){ r=RuleMind.think(v,ev,visitCtx()); } if(r.emotion) v.mood=r.emotion; if(r.bubbleText){ v.bubble={text:r.bubbleText,t:3.2}; v.thought=r.bubbleText; v.gloss=r.gloss||''; } }
function visitStep(dt){
  if(!visit.on) return;
  if(visit.auto>0){ visit.auto-=dt; if(visit.auto<=0){ endVisit(); return; } }
  const s=visit.s; if(!s||!world.setts.includes(s)){ endVisit(); return; }
  const ph=phaseName(), battle=s.lastBattle&&tribe.time-s.lastBattle.t<25;
  // a battle at this settlement: raiders from the enemy people arrive at the edge
  if(battle&&!visit.enemies.length){ const ef=world.factions[s.lastBattle.enemy]; for(let i=0;i<Math.min(8,visit.cast.length);i++){ const e=mkPuppet(VC.x+R(-500,500),VC.y-420+R(-40,40),rng); e.enemy=true; e.sash=ef?ef.color:'#c05050'; e.tool=(()=>{ const a=(ef&&ef.age)||1; return a>=8?8:a>=4?a:3; })(); visit.enemies.push(e); } }
  if(!battle&&visit.enemies.length) visit.enemies=[];
  const rite=ph==='Dusk', market=relsOf(s.f).some(r=>r.state==='trade'||r.state==='allied');
  const all=visit.cast.concat(visit.enemies);
  all.forEach((v,i)=>{
    v.anim+=dt*8; v.moving=false; v.working=false; v.pondering=false; if(v.bubble){ v.bubble.t-=dt; if(v.bubble.t<=0) v.bubble=null; }
    if(battle){ // defenders and raiders clash in the middle ground
      const tx=v.enemy?VC.x+((i%8)-4)*26:VC.x+((i%8)-4)*26, ty=v.enemy?VC.y-150:VC.y-110;
      if(moveTo(v,tx,ty,dt,1.3)){ v.working=true; v.face=v.enemy?1:-1; v.face=(i%2?1:-1); }
      v.task={kind:'fight'}; v.mood='fierce'; v.talkT-=dt; if(v.talkT<=0){ v.talkT=R(3,7); puppetSay(v,{type:'fight'}); } return; }
    if(ph==='Night'){ const h=visit.huts[i%visit.huts.length]; if(moveTo(v,h.x+(i%2?6:-6),h.y+10,dt)) v.task={kind:'sleep',arrived:true}; else v.task={kind:'idle'}; return; }
    if(rite){ const a=(i/visit.cast.length)*6.283, tx=VC.x+Math.cos(a)*60, ty=VC.y+10+Math.sin(a)*38; if(moveTo(v,tx,ty,dt)){ v.task={kind:'ritual',arrived:true}; v.face=VC.x<v.x?-1:1; v.talkT-=dt; if(v.talkT<=0){ v.talkT=R(3,6); puppetSay(v,{type:'chant'}); } } else v.task={kind:'ritual'}; return; }
    // FIX (idle-looking peoples): puppets used to keep task 'idle' even while working, walk at 0.8×,
    // and idle 30% of the time. Now each job has a real task kind (pose + follow-card text), food is
    // carried home to the fire, and they only rest briefly between jobs.
    v.task={kind:v.job==='farm'?'farm':v.job==='build'?'build':v.job==='forage'?'forage':v.job==='haul'?'haul':v.job==='market'?'eat':'idle'};
    if(moveTo(v,v.tx,v.ty,dt,1.1)){ v.wait-=dt; v.working=v.job!=='idle'&&v.job!=='haul';
      if(v.job==='haul'){ v.carry=null; v.wait=0; }
      if(v.wait<=0){ const r=rng(); let p;
        if((v.job==='farm'||v.job==='forage')&&!v.child){ v.carry={type:'food',n:3}; p={x:VC.x+R(-30,30),y:VC.y+R(20,40)}; v.job='haul'; v.wait=0.5; }
        else if(market&&r<0.2){ p={x:VC.x-150+R(-40,40),y:VC.y+90+R(-10,20)}; v.job='market'; }
        else if(visit.plots.length&&r<0.5){ const pl=pick(visit.plots); p={x:pl.x+R(-30,30),y:pl.y+R(-6,6)}; v.job='farm'; }
        else if(r<0.72){ const h=pick(visit.huts); p={x:h.x+R(-20,20),y:h.y+16}; v.job='build'; }
        else if(r<0.9){ const tr=pick(visit.trees); p={x:tr.x+R(-12,12),y:tr.y+14}; v.job='forage'; }
        else { p={x:VC.x+R(-90,90),y:VC.y+R(-20,80)}; v.job='idle'; }
        v.tx=p.x; v.ty=p.y; if(v.job!=='haul') v.wait=v.job==='idle'?R(1.5,3):R(3,6); } }
    v.talkT-=dt; if(v.talkT<=0){ v.talkT=R(8,18); puppetSay(v,v.job&&v.job!=='idle'?{type:'work',job:v.job==='haul'?'forage':v.job==='market'?'eat':v.job}:{type:rng()<.2&&v.tr.wit>1.15?'ponder':'idle'}); }
  });
}
function drawMarket(x,y){ let goods=['#c4283a','#e8c24a','#2b2933','#9a6a3a','#d0702a'];
  if(typeof goodOf==='function'&&visit.f){ const own=goodOf(visit.f).color, ins=goodsBonus(visit.f).ins.map(([g])=>g.color); goods=[own,...ins,own,...ins].slice(0,5); while(goods.length<5) goods.push(own); }   /* v3.7: their own good + what partners bring */
  for(let i=0;i<3;i++){ const mx=x+i*46, my=y+(i%2)*10; ctx.fillStyle='#a8875a'; ctx.beginPath(); ctx.ellipse(mx,my,18,8,0,0,7); ctx.fill(); ctx.strokeStyle='#7a6040'; ctx.lineWidth=1; ctx.stroke(); for(let k=0;k<6;k++){ ctx.fillStyle=goods[(i+k)%5]; ctx.beginPath(); ctx.arc(mx-9+k*3.6,my-1+(k%2)*2,2,0,7); ctx.fill(); } } }
function drawBanner(x,y,col){ ctx.strokeStyle='#5a3c22'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-70); ctx.stroke(); ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(x,y-70); ctx.lineTo(x+30,y-62); ctx.lineTo(x,y-50); ctx.fill(); }
function renderVisit(t){
  ctx.setTransform(DPR,0,0,DPR,0,0); ctx.fillStyle='#1b1712'; ctx.fillRect(0,0,VW,VH);
  worldXform(); ctx.drawImage(visit.bg,0,0);
  const s=visit.s, f=visit.f;
  HSTYLE=typeof archOf==='function'?archOf(f):null;
  for(const p of visit.plots) drawStructure(p);
  if(HSTYLE) drawCivic(HSTYLE,VC.x,VC.y,560,t);
  // their fire
  ctx.fillStyle='#3a2a1c'; ctx.beginPath(); ctx.ellipse(VC.x,VC.y,22,11,0,0,7); ctx.fill(); for(let i=0;i<12;i++){ const a=i/12*6.28; ctx.fillStyle=i%2?'#8b8478':'#77706a'; ctx.beginPath(); ctx.ellipse(VC.x+Math.cos(a)*24,VC.y+Math.sin(a)*12,5,3.5,0,0,7); ctx.fill(); } flame(VC.x,VC.y,1,t);
  const market=relsOf(s.f).some(r=>r.state==='trade'||r.state==='allied');
  if(market) drawMarket(VC.x-200,VC.y+90);
  if(s.bl!=null&&s.bl<1){ ctx.fillStyle=`rgba(${s.bl<0.5?'70,50,40':'90,90,40'},${(1-s.bl)*0.45})`; ctx.fillRect(0,0,VW_W,VW_H); }   // v3.7: poisoned / sickened ground
  const ents=[];
  for(const tr of visit.trees) ents.push([tr.y,()=>drawTree(tr,t)]);
  for(const h of visit.huts) ents.push([h.y,()=>drawStructure(h)]);
  ents.push([VC.y-40,()=>drawBanner(VC.x+60,VC.y-40,f.color)]);
  if(typeof ideaOf==='function'){ const I=ideaOf(f); if(I) ents.push([VC.y-30,()=>drawTeachingStone(I,VC.x-80,VC.y-30)]); }
  if(f.gov>=4) for(let i=0;i<3;i++){ const x=VC.x-120+i*60, y=VC.y-90; ents.push([y,()=>{ shadow(x+4,y+2,8,3); ctx.fillStyle='#7d776e'; ctx.fillRect(x-5,y-22,10,22); ctx.fillStyle=f.color; ctx.fillRect(x-5,y-16,10,2); }]); }
  for(const v of visit.cast.concat(visit.enemies)) ents.push([v.y,()=>{ drawVillager(v,t); ctx.fillStyle=v.enemy?v.sash:f.color; ctx.fillRect(v.x-4,v.y-(v.child?8:12),8,2); }]);
  if(STRANGER&&STRANGER.where==='visit'&&STRANGER.f===f) ents.push([STRANGER.y,()=>drawStranger(STRANGER,t)]);
  ents.sort((a,b)=>a[0]-b[0]); for(const e of ents) e[1]();
  const fph=phase(); let a=0; if(fph>0.64&&fph<0.76) a=(fph-0.64)/0.12*0.55; else if(fph>=0.76) a=0.6; else if(fph<0.08) a=0.6*(1-fph/0.08);
  if(a>0.01){ ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle=`rgba(14,16,42,${a})`; ctx.fillRect(0,0,cv.width,cv.height); worldXform(); ctx.globalCompositeOperation='lighter'; const fg=ctx.createRadialGradient(VC.x,VC.y-10,0,VC.x,VC.y-10,220); fg.addColorStop(0,`rgba(255,140,40,${0.45*a})`); fg.addColorStop(1,'rgba(255,140,40,0)'); ctx.fillStyle=fg; ctx.fillRect(VC.x-230,VC.y-240,460,460); ctx.globalCompositeOperation='source-over'; }
  if(world.dis&&world.dis.winterT>tribe.time){ ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='rgba(120,120,130,.32)'; ctx.fillRect(0,0,cv.width,cv.height); worldXform(); }   // v3.7: nuclear winter
  const bs=visit.cast.concat(visit.enemies).filter(v=>v.bubble).map(v=>[Math.hypot(v.x-cam.x,v.y-cam.y),v]).sort((a,b)=>a[0]-b[0]).slice(0,7);
  if(cam.z>0.7) for(const [,v] of bs) drawBubble(v);
}
// cycle through peoples to watch: home, then each people's largest settlement
function peoplesToWatch(){ const out=[home]; for(const f of world.factions){ if(f.home||!f.setts) continue; const ss=world.setts.filter(s=>s.f===f.id).sort((a,b)=>b.pop-a.pop); if(ss[0]) out.push(ss[0]); } return out; }
function cycleWatch(){ const L=peoplesToWatch(); if(L.length<2) return; const cur=visit.on?L.findIndex(s=>s.f===visit.s.f):0; const n=L[(cur+1)%L.length]; if(n.home) endVisit(); else startVisit(n); }
