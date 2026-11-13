"use strict";
/* ASH HOLLOW — rendering (procedural canvas art, all original), the auto-camera
   "director", watcher UI, world map, input, boot. */
const cv=document.getElementById('c'), ctx=cv.getContext('2d');
const dark=document.createElement('canvas'), dctx=dark.getContext('2d');
let VW=0,VH=0,DPR=1;
function resize(){ DPR=Math.min(2,window.devicePixelRatio||1); VW=innerWidth; VH=innerHeight; cv.width=VW*DPR; cv.height=VH*DPR; cv.style.width=VW+'px'; cv.style.height=VH+'px'; dark.width=cv.width; dark.height=cv.height; wmc.width=VW*DPR; wmc.height=VH*DPR; wmc.style.width=VW+'px'; wmc.style.height=VH+'px'; world.dirty=true; }
const cam={x:STOCK.x,y:STOCK.y-120,z:1.5,follow:null};
const bg=document.createElement('canvas'); bg.width=W; bg.height=H;

/* ------------------------------ background ------------------------------ */
function paintBG(){
  const g=bg.getContext('2d');
  const grd=g.createLinearGradient(0,0,0,H); grd.addColorStop(0,'#7b7a3c'); grd.addColorStop(1,'#6a7434'); g.fillStyle=grd; g.fillRect(0,0,W,H);
  const blob=(c,n,a0,a1,al)=>{ for(let i=0;i<n;i++){ g.globalAlpha=al; g.fillStyle=c; g.beginPath(); g.ellipse(R(0,W),R(0,H),R(a0,a1),R(a0,a1)*0.7,R(0,3),0,7); g.fill(); } g.globalAlpha=1; };
  blob('#9a8b3e',360,18,70,.22); blob('#55652c',310,18,60,.2); blob('#a8813a',180,10,40,.22); blob('#4e5a28',270,6,22,.35);
  for(let i=0;i<20000;i++){ g.fillStyle=pick(['#86803f','#5f6b2e','#a39446','#71753a','#8c6e33']); g.globalAlpha=.55; g.fillRect(R(0,W),R(0,H),1.5,R(2,5)); } g.globalAlpha=1;
  // a faint natural clearing (no camp yet) and game trails
  const cg=g.createRadialGradient(FIRE.x,FIRE.y,10,FIRE.x,FIRE.y,330); cg.addColorStop(0,'#8a7a4a88'); cg.addColorStop(1,'#8a7a4a00'); g.fillStyle=cg; g.beginPath(); g.ellipse(FIRE.x,FIRE.y,350,260,0,0,7); g.fill();
  g.strokeStyle='#8a735066'; g.lineCap='round'; g.lineWidth=10;
  for(const [x,y] of [[CAVE.x,CAVE.y+20],[FIRE.x+750,FIRE.y+570],[FIRE.x-900,FIRE.y+300],[FIRE.x-300,FIRE.y+1300],[POND.x-90,POND.y-60]]){ g.beginPath(); g.moveTo(FIRE.x,FIRE.y); g.quadraticCurveTo((FIRE.x+x)/2+R(-80,80),(FIRE.y+y)/2+R(-60,60),x,y); g.stroke(); }
  g.strokeStyle='#4f7f8a'; g.lineWidth=18; g.beginPath(); g.moveTo(POND.x+60,POND.y+80); g.bezierCurveTo(POND.x+160,POND.y+200,POND.x+250,POND.y+260,W,H-30); g.stroke();
  g.fillStyle='#6d6a44'; g.beginPath(); g.ellipse(POND.x,POND.y,POND.r+16,POND.r*0.75+14,0.2,0,7); g.fill();
  const pg=g.createRadialGradient(POND.x-20,POND.y-20,10,POND.x,POND.y,POND.r); pg.addColorStop(0,'#6fa3ad'); pg.addColorStop(1,'#3e6d7a'); g.fillStyle=pg; g.beginPath(); g.ellipse(POND.x,POND.y,POND.r,POND.r*0.75,0.2,0,7); g.fill();
  g.strokeStyle='#ffffff30'; g.lineWidth=2; for(let i=0;i<8;i++){ g.beginPath(); const x=POND.x+R(-70,70),y=POND.y+R(-50,50); g.moveTo(x,y); g.lineTo(x+R(10,26),y); g.stroke(); }
  for(let i=0;i<30;i++){ const a=R(0,6.28); const x=POND.x+Math.cos(a)*(POND.r+8),y=POND.y+Math.sin(a)*(POND.r*0.75+6); g.strokeStyle='#5c6b2a'; g.lineWidth=2; g.beginPath(); g.moveTo(x,y); g.lineTo(x+R(-3,3),y-R(8,16)); g.stroke(); }
  g.beginPath(); g.moveTo(0,0); for(let x=0;x<=W;x+=8) g.lineTo(x,ridgeEdge(x)); g.lineTo(W,0); g.closePath();
  const rg=g.createLinearGradient(0,0,0,600); rg.addColorStop(0,'#6e665c'); rg.addColorStop(1,'#8a7f70'); g.fillStyle=rg; g.fill();
  g.save(); g.clip();
  for(let i=0;i<500;i++){ const x=R(0,W),y=R(0,ridgeEdge(x)); g.fillStyle=pick(['#7a7064','#5f574e','#958a7a','#6b6157']); g.beginPath(); g.ellipse(x,y,R(10,40),R(6,18),R(-.3,.3),0,7); g.fill(); }
  g.strokeStyle='#4f4840'; g.lineWidth=2; for(let k=0;k<14;k++){ g.beginPath(); const off=R(20,400); for(let x=0;x<=W;x+=20){ const y=ridgeEdge(x)-off+Math.sin(x/90+k)*6; x?g.lineTo(x,y):g.moveTo(x,y);} g.stroke(); }
  for(let i=0;i<120;i++){ const x=R(0,W),y=R(0,ridgeEdge(x)-30); g.fillStyle=pick(['#6f7a35','#8a6a2a','#556126']); g.beginPath(); g.arc(x,y,R(4,10),0,7); g.fill(); }
  g.restore();
  g.beginPath(); for(let x=0;x<=W;x+=8) g.lineTo(x,ridgeEdge(x)); for(let x=W;x>=0;x-=8) g.lineTo(x,ridgeEdge(x)-26); g.closePath(); g.fillStyle='#4d463e'; g.fill();
  g.beginPath(); for(let x=0;x<=W;x+=8) g.lineTo(x,ridgeEdge(x)); for(let x=W;x>=0;x-=8) g.lineTo(x,ridgeEdge(x)+14); g.closePath(); g.fillStyle='#00000030'; g.fill();
  g.fillStyle='#3a332c'; g.beginPath(); g.ellipse(CAVE.x,CAVE.y-6,62,48,0,Math.PI,0); g.lineTo(CAVE.x+62,CAVE.y+8); g.lineTo(CAVE.x-62,CAVE.y+8); g.fill();
  const cvg=g.createRadialGradient(CAVE.x,CAVE.y,4,CAVE.x,CAVE.y-10,50); cvg.addColorStop(0,'#0b0806'); cvg.addColorStop(1,'#231d18'); g.fillStyle=cvg; g.beginPath(); g.ellipse(CAVE.x,CAVE.y,46,36,0,Math.PI,0); g.lineTo(CAVE.x+46,CAVE.y+8); g.lineTo(CAVE.x-46,CAVE.y+8); g.fill();
  for(const l of leaves){ if(l.y<ridgeEdge(l.x)+10) continue; g.fillStyle=l.c; g.globalAlpha=.8; g.beginPath(); g.ellipse(l.x,l.y,2.6,1.4,l.a,0,7); g.fill(); } g.globalAlpha=1;
}

/* -------------------------------- sprites -------------------------------- */
function shadow(x,y,rx,ry){ ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,7); ctx.fill(); }
function flame(x,y,s,t){ for(let i=0;i<3;i++){ const f=Math.sin(t*9+i*2+x)*3; ctx.fillStyle=['#ff7a1a','#ffb02e','#fff1a0'][i]; const k=[1,0.7,0.4][i]*s; ctx.beginPath(); ctx.moveTo(x-11*k,y); ctx.quadraticCurveTo(x-8*k,y-20*k,x+f*k,y-(30+f)*k); ctx.quadraticCurveTo(x+8*k,y-18*k,x+11*k,y); ctx.fill(); } }
function drawTree(t,time){
  if(t.burnt&&!t.burn){ shadow(t.x+4,t.y+2,8,3); ctx.fillStyle='#2a1f18'; ctx.fillRect(t.x-3,t.y-t.r*0.8,6,t.r*0.8); ctx.strokeStyle='#2a1f18'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(t.x,t.y-t.r*0.6); ctx.lineTo(t.x-8,t.y-t.r*1.1); ctx.moveTo(t.x,t.y-t.r*0.7); ctx.lineTo(t.x+7,t.y-t.r*1.2); ctx.stroke(); return; }
  shadow(t.x+6,t.y+2,t.r*0.9,t.r*0.35);
  ctx.fillStyle='#4a321e'; ctx.fillRect(t.x-3,t.y-t.r*0.9,6,t.r*0.9);
  if(t.kind==='pine'){ ctx.fillStyle=t.burn>0?'#2a2a20':'#2f4a2a'; for(let i=0;i<3;i++){ const w=t.r*(1-i*0.25), y=t.y-t.r*0.5-i*t.r*0.55; ctx.beginPath(); ctx.moveTo(t.x-w,y); ctx.lineTo(t.x+w,y); ctx.lineTo(t.x,y-t.r*0.95); ctx.fill(); } }
  else { ctx.fillStyle=t.burn>0?'#3a2a20':t.hue; const cy=t.y-t.r*1.35; ctx.beginPath(); ctx.arc(t.x,cy,t.r,0,7); ctx.arc(t.x-t.r*0.6,cy+t.r*0.3,t.r*0.7,0,7); ctx.arc(t.x+t.r*0.6,cy+t.r*0.25,t.r*0.72,0,7); ctx.fill();
    if(!t.burn){ ctx.fillStyle='rgba(255,230,160,.18)'; ctx.beginPath(); ctx.arc(t.x-t.r*0.3,cy-t.r*0.35,t.r*0.5,0,7); ctx.fill(); ctx.fillStyle='rgba(0,0,0,.14)'; ctx.beginPath(); ctx.arc(t.x+t.r*0.35,cy+t.r*0.35,t.r*0.55,0,7); ctx.fill(); } }
  if(t.burn>0){ flame(t.x-6,t.y-t.r*1.2,1.2,time); flame(t.x+8,t.y-t.r*1.5,0.9,time+1); ctx.fillStyle='rgba(60,60,60,.35)'; for(let i=0;i<4;i++){ ctx.beginPath(); ctx.arc(t.x+Math.sin(time+i)*8,t.y-t.r*2.2-i*14-((time*20)%14),8+i*3,0,7); ctx.fill(); } }
}
function drawBush(b){ shadow(b.x+3,b.y+2,14,5); ctx.fillStyle='#4f6a2c'; ctx.beginPath(); ctx.arc(b.x-6,b.y-6,8,0,7); ctx.arc(b.x+6,b.y-6,8,0,7); ctx.arc(b.x,b.y-11,9,0,7); ctx.fill();
  ctx.fillStyle='#c4283a'; for(let i=0;i<b.berries;i++){ const a=i*1.9; ctx.beginPath(); ctx.arc(b.x+Math.cos(a)*7,b.y-8+Math.sin(a)*4,1.9,0,7); ctx.fill(); } }
function drawRoot(r){ ctx.strokeStyle='#6d8a34'; ctx.lineWidth=2; for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(r.x,r.y); ctx.quadraticCurveTo(r.x+i*6,r.y-8,r.x+i*9,r.y-12); ctx.stroke(); } if(r.amt>0){ ctx.fillStyle='#9a6a3a'; ctx.beginPath(); ctx.ellipse(r.x,r.y+1,4+r.amt,2.5,0,0,7); ctx.fill(); } }
function drawFlint(f){ shadow(f.x+3,f.y+2,13,4); ctx.fillStyle='#5a5560'; ctx.beginPath(); ctx.moveTo(f.x-12,f.y); ctx.lineTo(f.x-6,f.y-12); ctx.lineTo(f.x+5,f.y-14); ctx.lineTo(f.x+12,f.y-2); ctx.closePath(); ctx.fill(); ctx.fillStyle='#8a8590'; ctx.beginPath(); ctx.moveTo(f.x-5,f.y-11); ctx.lineTo(f.x+4,f.y-13); ctx.lineTo(f.x+1,f.y-6); ctx.fill(); }
function drawSkitter(s){ if(!s.alive) return; const d=s.vx<0?-1:1; shadow(s.x,s.y+1,5,2); ctx.fillStyle='#b39a72'; ctx.beginPath(); ctx.ellipse(s.x,s.y-3,5,3.5,0,0,7); ctx.fill(); ctx.beginPath(); ctx.ellipse(s.x+d*4,s.y-6,2.5,2.2,0,0,7); ctx.fill();
  ctx.strokeStyle='#8a7350'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(s.x+d*4,s.y-7); ctx.lineTo(s.x+d*6,s.y-13); ctx.moveTo(s.x+d*3,s.y-7); ctx.lineTo(s.x+d*3,s.y-13); ctx.stroke(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(s.x-d*5,s.y-3,1.5,0,7); ctx.fill(); }
function drawFire(t){
  const F=tribe.fire;
  if(knows('fire')){ ctx.fillStyle='#3a2a1c'; ctx.beginPath(); ctx.ellipse(FIRE.x,FIRE.y,22,11,0,0,7); ctx.fill();
    const n=tribe.age>=2?14:8; for(let i=0;i<n;i++){ const a=i/n*6.28; ctx.fillStyle=i%2?'#8b8478':'#77706a'; ctx.beginPath(); ctx.ellipse(FIRE.x+Math.cos(a)*24,FIRE.y+Math.sin(a)*12,tribe.age>=2?5:4,3.5,0,0,7); ctx.fill(); }
    ctx.strokeStyle=F.lit?'#5a3a1e':'#2a2420'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(FIRE.x-14,FIRE.y+4); ctx.lineTo(FIRE.x+12,FIRE.y-4); ctx.moveTo(FIRE.x-12,FIRE.y-4); ctx.lineTo(FIRE.x+14,FIRE.y+4); ctx.stroke();
    if(F.lit) flame(FIRE.x,FIRE.y,0.6+0.5*Math.min(1,F.fuel/60),t); else { ctx.fillStyle='#8a8580'; ctx.beginPath(); ctx.ellipse(FIRE.x,FIRE.y,10,4,0,0,7); ctx.fill(); } }
  // shared pile (food from day one; sticks / flint once they matter)
  ctx.strokeStyle='#6b4a2a'; ctx.lineWidth=2.5; const ns=Math.min(12,tribe.sticks); for(let i=0;i<ns;i++){ const y=STOCK.y-2-Math.floor(i/3)*3; ctx.beginPath(); ctx.moveTo(STOCK.x-16+(i%3)*2,y); ctx.lineTo(STOCK.x+2+(i%3)*2,y-3); ctx.stroke(); }
  const nf=Math.min(15,tribe.food); if(nf>0||knows('leanto')){ ctx.fillStyle='#6a5a3a'; ctx.beginPath(); ctx.ellipse(STOCK.x+18,STOCK.y,11,5,0,0,7); ctx.fill(); }
  for(let i=0;i<nf;i++){ ctx.fillStyle=i%3?'#b8283a':'#9a6a3a'; ctx.beginPath(); ctx.arc(STOCK.x+11+(i%5)*3.2,STOCK.y-1-Math.floor(i/5)*2.6,1.9,0,7); ctx.fill(); }
  if(tribe.flint>0){ ctx.fillStyle='#3a3842'; for(let i=0;i<Math.min(5,tribe.flint);i++){ ctx.beginPath(); ctx.moveTo(STOCK.x-22+i*4,STOCK.y+9); ctx.lineTo(STOCK.x-20+i*4,STOCK.y+4); ctx.lineTo(STOCK.x-18+i*4,STOCK.y+9); ctx.fill(); } }
}
function drawStone(t){
  const r=tribe.ritual; if(r){ ctx.fillStyle=`rgba(255,200,120,${0.16+0.08*Math.sin(t*3)})`; ctx.beginPath(); ctx.ellipse(r.at.x,r.at.y+16,84,52,0,0,7); ctx.fill(); }
  const nStones=tribe.age>=4?Math.min(14,3+Math.max(0,tribe.age-4)):0;
  for(let i=0;i<nStones;i++){ const a=-Math.PI*0.9+i*(Math.PI*1.8/Math.max(1,nStones-1)), h=20+(i%3)*4, x=STONE.x+Math.cos(a)*70, y=STONE.y-6+Math.sin(a)*30;
    shadow(x+4,y+2,8,3); ctx.fillStyle='#7d776e'; ctx.fillRect(x-5,y-h,10,h); ctx.fillStyle='#c8642a'; ctx.fillRect(x-5,y-h+6,10,2); }
  shadow(STONE.x+6,STONE.y+2,16,6);
  ctx.fillStyle='#6f6a66'; ctx.beginPath(); ctx.moveTo(STONE.x-12,STONE.y); ctx.lineTo(STONE.x-14,STONE.y-22); ctx.quadraticCurveTo(STONE.x-6,STONE.y-46,STONE.x+4,STONE.y-40); ctx.lineTo(STONE.x+13,STONE.y-18); ctx.lineTo(STONE.x+11,STONE.y); ctx.fill();
  ctx.fillStyle='#8c8782'; ctx.beginPath(); ctx.moveTo(STONE.x-10,STONE.y-24); ctx.quadraticCurveTo(STONE.x-5,STONE.y-42,STONE.x+2,STONE.y-38); ctx.lineTo(STONE.x-2,STONE.y-20); ctx.fill();
  ctx.fillStyle='#2a2522'; ctx.beginPath(); ctx.ellipse(STONE.x+2,STONE.y-28,2.6,3.4,0,0,7); ctx.fill();
  if(typeof ideaOf==='function') drawTeachingStone(ideaOf(world.factions[0]),STONE.x+52,STONE.y+10);
  if(tribe.handprints){ ctx.fillStyle='#b4502a'; for(const [dx,dy] of [[-7,-12],[5,-11],[-2,-5]]){ ctx.beginPath(); ctx.arc(STONE.x+dx,STONE.y+dy,2.4,0,7); ctx.fill(); for(let f=0;f<4;f++) ctx.fillRect(STONE.x+dx-2.5+f*1.6,STONE.y+dy-5,1,3); } }
}
function drawStructure(s){
  const p=s.built?1:Math.min(1,(s.have/(s.need||1))*0.4+(s.work/s.workNeed)*0.6); ctx.globalAlpha=s.built?1:0.45+0.55*p;
  const x=s.x,y=s.y;
  if(s.small){ ctx.save(); ctx.translate(x,y); ctx.scale(0.7,0.7); ctx.translate(-x,-y); }
  if(s.type==='leanto'){ shadow(x+4,y+2,26,7);
    ctx.strokeStyle='#5a3c22'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x-22,y-30); ctx.lineTo(x+22,y-30); ctx.moveTo(x-22,y-30); ctx.lineTo(x-24,y+2); ctx.moveTo(x+22,y-30); ctx.lineTo(x+24,y+2); ctx.stroke();
    ctx.lineWidth=2.5; const n=Math.max(1,Math.round(9*p)); for(let i=0;i<n;i++){ const xx=x-20+i*5; ctx.beginPath(); ctx.moveTo(xx,y-32); ctx.lineTo(xx+5,y+2); ctx.stroke(); }
    if(p>0.6){ ctx.fillStyle='#6b7a34'; for(let i=0;i<8;i++){ ctx.beginPath(); ctx.ellipse(x-19+i*5.4,y-22+(i%2)*7,5,9,0.4,0,7); ctx.fill(); } ctx.fillStyle='#9a7650'; ctx.beginPath(); ctx.ellipse(x+3,y-8,9,6,0,0,7); ctx.fill(); } }
  else if((s.type==='hut'||s.type==='leanto')&&HSTYLE&&HSTYLE.era>=2&&p>0.5) geneHouse(x,y,HSTYLE,drawEraHouse);
  else if(s.type==='hut'&&HSTYLE&&HSTYLE.shape!=='cone'&&p>0.5) geneHouse(x,y,HSTYLE,drawStyledHut);
  else if(s.type==='hut'){ shadow(x+5,y+2,30,9);
    ctx.fillStyle='#8a6a48'; ctx.fillRect(x-24,y-24,48,16); ctx.beginPath(); ctx.ellipse(x,y-8,24,8,0,0,Math.PI); ctx.fill();
    ctx.strokeStyle='#6a4e32'; ctx.lineWidth=1; for(let i=0;i<5;i++){ ctx.beginPath(); ctx.moveTo(x-24,y-22+i*3.4); ctx.lineTo(x+24,y-22+i*3.4); ctx.stroke(); }
    if(s.painted||(s.small&&knows('copper'))){ ctx.fillStyle='#b4502a'; ctx.fillRect(x-24,y-15,48,3); for(let i=0;i<6;i++){ ctx.beginPath(); ctx.moveTo(x-21+i*8,y-15); ctx.lineTo(x-17+i*8,y-20); ctx.lineTo(x-13+i*8,y-15); ctx.fill(); } }
    if(p>0.5){ ctx.fillStyle=HSTYLE?HSTYLE.roof:'#b8933e'; ctx.beginPath(); ctx.moveTo(x-31,y-21); ctx.lineTo(x,y-58); ctx.lineTo(x+31,y-21); ctx.quadraticCurveTo(x,y-15,x-31,y-21); ctx.fill();
      ctx.strokeStyle='#8f6f2a'; ctx.lineWidth=1; for(let i=-3;i<=3;i++){ ctx.beginPath(); ctx.moveTo(x,y-56); ctx.lineTo(x+i*9.5,y-20); ctx.stroke(); }
      ctx.fillStyle='#5a3c22'; ctx.fillRect(x-2,y-62,4,6); }
    else { ctx.strokeStyle='#5a3c22'; ctx.lineWidth=2; for(let i=-3;i<=3;i++){ ctx.beginPath(); ctx.moveTo(x,y-58); ctx.lineTo(x+i*9.5,y-22); ctx.stroke(); } }
    ctx.fillStyle='#2a1d12'; ctx.beginPath(); ctx.ellipse(x,y-8,6,8,0,Math.PI,0); ctx.lineTo(x+6,y-1); ctx.lineTo(x-6,y-1); ctx.fill(); }
  else if(s.type==='plot'&&HSTYLE&&HSTYLE.era>=3&&s.built) drawFarmModern(s,x,y,HSTYLE);
  else if(s.type==='plot'&&HSTYLE&&HSTYLE.agri&&HSTYLE.agri!=='rows'&&s.built) drawAgri(s,x,y,HSTYLE);
  else if(s.type==='plot'){ ctx.globalAlpha=1; const q=Math.max(.35,p); ctx.fillStyle='#5e4630'; ctx.beginPath(); ctx.ellipse(x,y,50*q,23*q,0,0,7); ctx.fill();
    ctx.strokeStyle='#4a3622'; ctx.lineWidth=2; for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.moveTo(x-38*q,y+i*7); ctx.lineTo(x+38*q,y+i*7); ctx.stroke(); }
    ctx.strokeStyle='#6b4a2a'; ctx.lineWidth=1.5; for(let a=0;a<6.28;a+=0.33){ const fx=x+Math.cos(a)*56*q,fy=y+Math.sin(a)*28*q; ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+1,fy-8); ctx.stroke(); }
    if(s.built&&s.stage!=='tilled'){ const g=s.stage==='ripe'?1:s.grow; for(let i=-2;i<=2;i++) for(let j=-4;j<=4;j++){ const px=x+j*8,py=y+i*7, h=3+g*9; ctx.strokeStyle=s.stage==='ripe'?'#d9b13a':'#6f9a34'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px,py-h); ctx.stroke(); if(s.stage==='ripe'){ ctx.fillStyle='#e8c24a'; ctx.beginPath(); ctx.ellipse(px,py-h,1.6,3,0,0,7); ctx.fill(); } } } }
  if(s.small) ctx.restore();
  ctx.globalAlpha=1;
}
/* architecture packs (see archOf in ripples.js) */
function drawAgri(s,x,y,S){ const ripe=s.stage==='ripe'; ctx.globalAlpha=1;
  if(S.agri==='terrace'){ for(let i=0;i<4;i++){ ctx.fillStyle=i%2?'#6a5a3a':'#7a6a44'; ctx.fillRect(x-48+i*6,y-18+i*10,96-i*12,8); ctx.fillStyle=ripe?'#c8b040':'#6f8a3a'; for(let j=0;j<8-i;j++) ctx.fillRect(x-42+i*6+j*11,y-21+i*10,4,4); } }
  else if(S.agri==='grove'){ for(let i=0;i<6;i++){ const gx=x-36+(i%3)*36, gy=y-10+Math.floor(i/3)*20; ctx.fillStyle='#5a3c22'; ctx.fillRect(gx-1.5,gy-10,3,10); ctx.fillStyle='#4f7a34'; ctx.beginPath(); ctx.arc(gx,gy-14,9,0,7); ctx.fill(); if(ripe){ ctx.fillStyle='#d8503a'; ctx.beginPath(); ctx.arc(gx-3,gy-14,2,0,7); ctx.arc(gx+4,gy-11,2,0,7); ctx.fill(); } } }
  else if(S.agri==='herd'){ ctx.strokeStyle='#6b4a2a'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(x,y,52,24,0,0,7); ctx.stroke(); const T=(typeof performance!=='undefined'?performance.now()/1000:0);
    for(let i=0;i<5;i++){ const hx=x-30+i*15+Math.sin(T*0.5+i)*5, hy=y-6+(i%2)*10; ctx.fillStyle=i%2?'#e8e0d0':'#6a5040'; ctx.beginPath(); ctx.ellipse(hx,hy,7,4,0,0,7); ctx.fill(); ctx.fillRect(hx+5,hy-4,3,3); } }
  else if(S.agri==='paddy'){ ctx.fillStyle='#6a5a3a'; ctx.fillRect(x-52,y-22,104,44); for(let i=0;i<2;i++) for(let j=0;j<2;j++){ ctx.fillStyle='#4a7a8a'; ctx.fillRect(x-49+j*51,y-19+i*21,47,18); ctx.fillStyle='rgba(220,240,255,.25)'; ctx.fillRect(x-47+j*51,y-17+i*21,20,2);
      ctx.strokeStyle=ripe?'#d8c860':'#8ac050'; ctx.lineWidth=1.4; for(let k=0;k<5;k++) for(let q=0;q<2;q++){ const px=x-44+j*51+k*9, py=y-6+i*21-q*7; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px-2,py-6); ctx.moveTo(px,py); ctx.lineTo(px+2,py-6); ctx.stroke(); } } }   // v3.7: flooded paddies (wet coasts)
  else if(S.agri==='fungus'){ for(let i=0;i<3;i++){ const bx=x-40+i*40, by=y-4+(i%2)*10; ctx.fillStyle='#4a3424'; ctx.fillRect(bx-16,by-6,32,10); ctx.fillStyle='#3a2a1c'; ctx.fillRect(bx-16,by+2,32,2);
      for(let k=0;k<4;k++){ const mx=bx-11+k*7.5, h=3+(ripe?4:2)+(k%2); ctx.fillStyle='#e0d4bc'; ctx.fillRect(mx-1,by-6-h,2,h); ctx.fillStyle=ripe?'#b8703a':'#b89a70'; ctx.beginPath(); ctx.ellipse(mx,by-6-h,4,2.6,0,Math.PI,0); ctx.fill(); } } }   // v3.7: fungus beds on shaded logs (deep forest)
  else { ctx.fillStyle='#5e4630'; ctx.beginPath(); ctx.ellipse(x,y,46,22,0,0,7); ctx.fill(); for(let i=0;i<10;i++){ const a=i*0.628; ctx.fillStyle=ripe?'#e0b040':'#7aa04a'; ctx.beginPath(); ctx.arc(x+Math.cos(a)*30,y+Math.sin(a)*13,4,0,7); ctx.fill(); } drawMark(S.mark||'leaf',x,y-2,'#f0d070'); }
}
function drawMark(m,x,y,c){ if(!m) return; ctx.fillStyle=c; ctx.strokeStyle=c; ctx.lineWidth=1.5;
  if(m==='sun'){ ctx.beginPath(); ctx.arc(x,y,3.5,0,7); ctx.fill(); for(let i=0;i<8;i++){ const a=i*0.785; ctx.beginPath(); ctx.moveTo(x+Math.cos(a)*5,y+Math.sin(a)*5); ctx.lineTo(x+Math.cos(a)*7.5,y+Math.sin(a)*7.5); ctx.stroke(); } }
  else if(m==='eye'){ ctx.beginPath(); ctx.ellipse(x,y,6,3.5,0,0,7); ctx.stroke(); ctx.beginPath(); ctx.arc(x,y,1.8,0,7); ctx.fill(); }
  else if(m==='tooth'){ ctx.beginPath(); for(let i=0;i<3;i++){ ctx.moveTo(x-7+i*5,y-3); ctx.lineTo(x-4.5+i*5,y+4); ctx.lineTo(x-2+i*5,y-3); } ctx.fill(); }
  else if(m==='leaf'){ ctx.beginPath(); ctx.ellipse(x,y,3,6,0.6,0,7); ctx.fill(); } }
/* TECH-ERA base buildings (v3.6); culture/religion (S.shape, roof, band, mark) modify them */
function drawEraHouse(x,y,S){
  const e=S.era; shadow(x+6,y+2,34,9);
  const wall=e===2?'#c8b48a':e===3?'#9a4a3a':e===4?'#b0a090':'#c8ccd2', tw=S.shape==='tower', W=(e>=4?26:24)*(tw?0.62:1), H=(e>=3?(e>=5?44:34):26)*(tw?1.7:1);
  ctx.fillStyle=wall; ctx.fillRect(x-W,y-H,W*2,H);
  if(e===2){ ctx.strokeStyle='#5a3c22'; ctx.lineWidth=2; ctx.strokeRect(x-W,y-H,W*2,H); ctx.beginPath(); ctx.moveTo(x-W,y-H); ctx.lineTo(x,y-H/2); ctx.lineTo(x+W,y-H); ctx.stroke(); }   // timber frame
  if(e===3){ ctx.strokeStyle='#7a3a2a'; ctx.lineWidth=1; for(let i=1;i<6;i++){ ctx.beginPath(); ctx.moveTo(x-W,y-H+i*6); ctx.lineTo(x+W,y-H+i*6); ctx.stroke(); } }   // brick courses
  // windows: lit at night from the Electric era on
  const lit=e>=4&&phase()>0.62; ctx.fillStyle=lit?'#ffe28a':(e>=5?'#7ab0d8':'#3a3a40');
  const rows=(e>=5?3:e>=3?2:1)+(tw?2:0), wx=tw?7:12; for(let r=0;r<rows;r++) for(let c=-1;c<=1;c+=2) ctx.fillRect(x+c*wx-4,y-H+6+r*12,8,7);
  // roof: era shape, culture colour; spire/longhall/dome culture shapes stay as accents
  ctx.fillStyle=e>=5?'#5a6068':S.roof;
  if(e>=5){ ctx.fillRect(x-W-2,y-H-4,W*2+4,4); }
  else if(S.shape==='dome'){ ctx.beginPath(); ctx.ellipse(x,y-H,W,14,0,Math.PI,0); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(x-W-5,y-H); ctx.lineTo(x,y-H-(S.shape==='spire'?30:18)); ctx.lineTo(x+W+5,y-H); ctx.fill(); }
  if(e===3||e===4){ ctx.fillStyle='#5a4a44'; ctx.fillRect(x+W-10,y-H-22,6,16); }   // chimney
  if(e===3&&typeof performance!=='undefined'){ const u=(performance.now()/2500+x*0.01)%1; ctx.fillStyle=`rgba(190,190,190,${0.5*(1-u)})`; ctx.beginPath(); ctx.arc(x+W-7+u*10,y-H-26-u*30,4+u*7,0,7); ctx.fill(); }
  ctx.fillStyle=S.band; ctx.fillRect(x-W,y-8,W*2,3);
  if(S.shape==='mound'){ ctx.fillStyle='#5e7a3a'; ctx.beginPath(); ctx.ellipse(x,y-H+2,W+8,13,0,Math.PI,0); ctx.fill(); ctx.fillStyle='#6a8a40'; ctx.beginPath(); ctx.moveTo(x-W-8,y); ctx.lineTo(x-W,y-H+2); ctx.lineTo(x-W,y); ctx.moveTo(x+W+8,y); ctx.lineTo(x+W,y-H+2); ctx.lineTo(x+W,y); ctx.fill(); }   // v3.7: turf roof + earth banks, even on modern houses
  if(S.mark) drawMark(S.mark,x,y-H-(S.shape==='spire'&&e<5?20:8),e>=5?'#e8f0ff':'#f0d070');
  ctx.fillStyle='#2a1d12'; ctx.fillRect(x-4,y-12,8,12);
}
function drawFarmModern(s,x,y,S){ const ripe=s.stage==='ripe'; ctx.globalAlpha=1;
  ctx.fillStyle='#5e4a30'; ctx.fillRect(x-54,y-22,108,44);
  for(let i=0;i<9;i++){ ctx.fillStyle=i%2?(ripe?'#d8b840':'#7aa04a'):(ripe?'#c8a830':'#6a9040'); ctx.fillRect(x-52,y-20+i*4.6,104,3.4); }
  ctx.strokeStyle='#8a7a5a'; ctx.lineWidth=1.5; ctx.strokeRect(x-54,y-22,108,44);
  if(S.era>=4){ ctx.fillStyle='#4a6a8a'; ctx.fillRect(x+44,y-34,8,14); ctx.fillStyle='#a0a8b0'; ctx.beginPath(); ctx.arc(x+48,y-36,6,Math.PI,0); ctx.fill(); }   // silo
  else { ctx.fillStyle='#8a5030'; ctx.fillRect(x+40,y-34,14,12); ctx.fillStyle='#6a3a24'; ctx.beginPath(); ctx.moveTo(x+38,y-34); ctx.lineTo(x+47,y-42); ctx.lineTo(x+56,y-34); ctx.fill(); }   // barn
  if(S.agri==='herd'){ for(let i=0;i<3;i++){ ctx.fillStyle='#e8e0d0'; ctx.beginPath(); ctx.ellipse(x-30+i*22,y+28,7,4,0,0,7); ctx.fill(); } }
  else if(S.agri==='terrace'){ ctx.strokeStyle='#7a6a44'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x-54,y); ctx.lineTo(x+54,y); ctx.stroke(); }
  else if(S.agri==='paddy'){ ctx.fillStyle='#4a7a8a'; ctx.fillRect(x-54,y+2,108,8); ctx.fillStyle='rgba(220,240,255,.3)'; ctx.fillRect(x-50,y+4,40,2); }
  else if(S.agri==='fungus'){ ctx.fillStyle='#3a2a1c'; ctx.fillRect(x-54,y+24,30,10); ctx.fillStyle='#b89a70'; for(let k=0;k<4;k++){ ctx.beginPath(); ctx.ellipse(x-50+k*7,y+24,3,2,0,Math.PI,0); ctx.fill(); } }
}
function drawStyledHut(x,y,S){
  shadow(x+5,y+2,32,9);
  if(S.shape==='spire'){ ctx.fillStyle=S.wall; ctx.fillRect(x-20,y-22,40,22); ctx.fillStyle=S.band; ctx.fillRect(x-20,y-14,40,3);
    ctx.fillStyle=S.roof; for(let i=0;i<3;i++){ const w=26-i*7, b=y-22-i*13; ctx.beginPath(); ctx.moveTo(x-w,b); ctx.lineTo(x,b-16); ctx.lineTo(x+w,b); ctx.fill(); }
    ctx.strokeStyle='#5a3c22'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,y-62); ctx.lineTo(x,y-74); ctx.stroke(); drawMark(S.mark||'sun',x,y-77,'#f0d070'); }
  else if(S.shape==='longhall'){ ctx.fillStyle=S.wall; ctx.fillRect(x-32,y-18,64,18); ctx.fillStyle=S.band; ctx.fillRect(x-32,y-10,64,3);
    ctx.fillStyle=S.roof; ctx.beginPath(); ctx.moveTo(x-38,y-17); ctx.lineTo(x-26,y-36); ctx.lineTo(x+26,y-36); ctx.lineTo(x+38,y-17); ctx.fill();
    ctx.strokeStyle='#4a3020'; ctx.lineWidth=2; for(let i=-4;i<=4;i++){ ctx.beginPath(); ctx.moveTo(x+i*6,y-36); ctx.lineTo(x+i*6+(i%2?2:-2),y-44); ctx.stroke(); }
    if(S.mark) drawMark(S.mark,x,y-26,'#e8d8b0'); }
  else if(S.shape==='mound'){ // v3.7: earth-house — the land as kin: turf roof, stone-framed door
    ctx.fillStyle='#6a5236'; ctx.beginPath(); ctx.ellipse(x,y-2,32,24,0,Math.PI,0); ctx.fill();
    ctx.fillStyle='#5e7a3a'; ctx.beginPath(); ctx.ellipse(x,y-6,30,22,0,Math.PI,0); ctx.fill();
    ctx.strokeStyle='#7a9a48'; ctx.lineWidth=1.5; for(let i=-3;i<=3;i++){ ctx.beginPath(); ctx.moveTo(x+i*7,y-26+Math.abs(i)*3); ctx.lineTo(x+i*7+2,y-31+Math.abs(i)*3); ctx.stroke(); }
    ctx.fillStyle='#8a847c'; ctx.beginPath(); ctx.ellipse(x,y-5,9,11,0,Math.PI,0); ctx.lineTo(x+9,y); ctx.lineTo(x-9,y); ctx.fill();
    ctx.fillStyle='#4a4038'; ctx.fillRect(x+14,y-30,4,7); if(S.mark) drawMark(S.mark,x-14,y-14,'#e8d8b0'); }
  else if(S.shape==='tower'){ // v3.7: inquiry — a tall narrow house to look out from
    ctx.fillStyle=S.wall; ctx.fillRect(x-13,y-54,26,54); ctx.fillStyle=S.band; ctx.fillRect(x-13,y-30,26,3);
    ctx.fillStyle='#2a1d12'; for(let i=0;i<3;i++) ctx.fillRect(x-2,y-50+i*12,4,7);
    ctx.fillStyle=S.roof; ctx.beginPath(); ctx.moveTo(x-17,y-54); ctx.lineTo(x,y-74); ctx.lineTo(x+17,y-54); ctx.fill();
    ctx.strokeStyle='#5a3c22'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x-17,y-56); ctx.lineTo(x+17,y-56); ctx.stroke(); if(S.mark) drawMark(S.mark,x,y-62,'#f0d070'); }
  else { // dome
    ctx.fillStyle=S.wall; ctx.fillRect(x-24,y-10,48,10); ctx.fillStyle=S.roof; ctx.beginPath(); ctx.ellipse(x,y-10,26,26,0,Math.PI,0); ctx.fill();
    ctx.strokeStyle=S.band; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(x,y-10,26,26,0,Math.PI*1.15,Math.PI*1.85); ctx.stroke();
    ctx.fillStyle=S.flag; ctx.beginPath(); ctx.moveTo(x-14,y-14); ctx.lineTo(x+14,y-14); ctx.lineTo(x+18,y-6); ctx.lineTo(x-18,y-6); ctx.fill();
    if(S.mark) drawMark(S.mark,x,y-26,'#fff8e0'); }
  ctx.fillStyle='#2a1d12'; ctx.beginPath(); ctx.ellipse(x,y-6,5,7,0,Math.PI,0); ctx.lineTo(x+5,y); ctx.lineTo(x-5,y); ctx.fill();
}
// palisade (warlike), totems (devout), market awnings (open-handed) — around a settlement centre
function drawCivic(S,cx,cy,R,t){
  drawLayout(S,cx,cy,R);
  if(S.palisade){ ctx.strokeStyle='#5a3c22'; ctx.lineWidth=3; for(let a=0;a<6.283;a+=0.045){ if(Math.abs(a-1.57)<0.12) continue; const x=cx+Math.cos(a)*R, y=cy+Math.sin(a)*R*0.68; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-16); ctx.stroke(); } }
  if(S.totems) for(let i=0;i<4;i++){ const a=0.4+i*1.57, x=cx+Math.cos(a)*R*0.55, y=cy+Math.sin(a)*R*0.38; shadow(x+3,y+1,6,2); ctx.fillStyle='#6a4a2a'; ctx.fillRect(x-4,y-34,8,34); ctx.fillStyle=S.band; ctx.fillRect(x-5,y-30,10,4); ctx.fillRect(x-5,y-18,10,4); drawMark(S.mark||'eye',x,y-40,'#f0d070'); }
  if(S.market){ for(let i=0;i<3;i++){ const x=cx-120+i*40, y=cy+150; ctx.fillStyle='#7a5a3a'; ctx.fillRect(x-1,y-22,2,22); ctx.fillRect(x+27,y-22,2,22); ctx.fillStyle=i%2?S.flag:'#e8d8b0'; ctx.beginPath(); ctx.moveTo(x-4,y-22); ctx.lineTo(x+32,y-22); ctx.lineTo(x+28,y-30); ctx.lineTo(x,y-30); ctx.fill(); } }
}
/* v3.7 house genome: every people's coined words set tiers, eaves, finial, wall pattern, door and stilts (thought.js archGene) */
function houseTop(S){ const e=S.era; if(e>=2){ const tw=S.shape==='tower', H=(e>=3?(e>=5?44:34):26)*(tw?1.7:1); return H+(e>=5?4:S.shape==='spire'?30:S.shape==='dome'?14:S.shape==='mound'?13:18); } return ({spire:66,longhall:40,mound:28,tower:74})[S.shape]||36; }
function houseHalfW(S){ const e=S.era; if(e>=2) return (e>=4?26:24)*(S.shape==='tower'?0.62:1); return ({spire:20,longhall:32,mound:28,tower:13})[S.shape]||24; }
function drawRubble(x,y,seed){ shadow(x+4,y+2,28,7); const r=((seed*9301+49297)%233280)/233280; ctx.fillStyle='#6a6058'; ctx.fillRect(x-22,y-14-r*8,7,14+r*8); ctx.fillRect(x+10,y-9,6,9);
  for(let i=0;i<9;i++){ const a=i*0.7+r*3; ctx.fillStyle=i%2?'#8a8078':'#5a524a'; ctx.beginPath(); ctx.ellipse(x+Math.cos(a)*18*(0.4+(i%3)*0.3),y-2+Math.sin(a)*5,5-(i%3),3,a,0,7); ctx.fill(); }
  ctx.strokeStyle='#3a3028'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x-12,y-2); ctx.lineTo(x+4,y-16); ctx.stroke(); }
function geneHouse(x,y,S,draw){
  const G=S.gene; if(!G){ draw(x,y,S); return; }
  if(S.ruin&&((Math.round(x)*7+Math.round(y)*13)%3===0)){ drawRubble(x,y,Math.round(x+y)); return; }   // a fallen people: some houses are rubble
  const lift=G.stilts&&S.era<4?9:0, top=houseTop(S)+lift, hw=houseHalfW(S)*G.prop;
  if(lift){ ctx.strokeStyle='#4a3020'; ctx.lineWidth=3; for(const dx of [-0.8,-0.3,0.3,0.8]){ ctx.beginPath(); ctx.moveTo(x+dx*hw,y); ctx.lineTo(x+dx*hw,y-lift); ctx.stroke(); } }
  ctx.save(); ctx.translate(x,y-lift); ctx.scale(G.prop,1); ctx.translate(-x,-y); draw(x,y,S); ctx.restore();
  const yb=y-lift, ink=S.era>=5?'#e8f0ff':'#f0d070';
  // wall pattern band
  if(G.pattern!=='none'){ const py=yb-15, w=hw*0.85; ctx.fillStyle=ink; ctx.strokeStyle=ink; ctx.lineWidth=1.2; ctx.globalAlpha=0.75;
    if(G.pattern==='stripes') for(let i=-w;i<=w;i+=6) ctx.fillRect(x+i-0.8,py-3,1.6,6);
    else if(G.pattern==='dots'){ ctx.beginPath(); for(let i=-w;i<=w;i+=6){ ctx.moveTo(x+i+1.3,py); ctx.arc(x+i,py,1.3,0,7); } ctx.fill(); }
    else if(G.pattern==='zigzag'){ ctx.beginPath(); ctx.moveTo(x-w,py); for(let i=-w,k=0;i<=w;i+=4,k++) ctx.lineTo(x+i,py+(k%2?-2.5:2.5)); ctx.stroke(); }
    else for(let i=-w,k=0;i<=w;i+=5,k++) ctx.fillRect(x+i,py-(k%2?3:0),3,3);
    ctx.globalAlpha=1; }
  // door shape over the base door
  ctx.fillStyle='#2a1d12'; if(G.door==='square') ctx.fillRect(x-5,yb-13,10,13); else if(G.door==='pointed'){ ctx.beginPath(); ctx.moveTo(x-5,yb); ctx.lineTo(x-5,yb-9); ctx.lineTo(x,yb-15); ctx.lineTo(x+5,yb-9); ctx.lineTo(x+5,yb); ctx.fill(); }
  // eaves: upturned / drooping (pre-modern roofs)
  if(S.era<5&&G.curve&&S.shape!=='mound'&&S.shape!=='dome'){ const ey=yb-top+(S.era>=2?top-(S.era>=3?(S.era>=5?44:34):26)*(S.shape==='tower'?1.7:1):top*0.55); ctx.strokeStyle=S.roof; ctx.lineWidth=3; for(const sd of [-1,1]){ const ex=x+sd*(hw+4); ctx.beginPath(); ctx.moveTo(ex-sd*6,ey); ctx.quadraticCurveTo(ex,ey,ex+sd*4,ey-G.curve*6); ctx.stroke(); } }
  // extra roof tiers (steps)
  if(G.steps>1&&S.era<5){ ctx.strokeStyle='rgba(40,25,10,.55)'; ctx.lineWidth=1.5; for(let i=1;i<G.steps;i++){ const ty=yb-top+top*0.18*i+4, tw=hw*(0.35+0.2*i); ctx.beginPath(); ctx.moveTo(x-tw,ty); ctx.lineTo(x+tw,ty); ctx.stroke(); } }
  // finial
  const fy=yb-top-2*1; ctx.fillStyle=ink; ctx.strokeStyle=S.era>=5?'#c8ccd2':'#5a3c22'; ctx.lineWidth=2;
  if(G.finial==='orb'){ ctx.beginPath(); ctx.moveTo(x,fy); ctx.lineTo(x,fy-5); ctx.stroke(); ctx.beginPath(); ctx.arc(x,fy-8,3,0,7); ctx.fill(); }
  else if(G.finial==='horns'){ ctx.beginPath(); ctx.moveTo(x-7,fy-9); ctx.quadraticCurveTo(x-2,fy-1,x,fy); ctx.quadraticCurveTo(x+2,fy-1,x+7,fy-9); ctx.stroke(); }
  else if(G.finial==='fin'){ ctx.beginPath(); ctx.moveTo(x-3,fy); ctx.lineTo(x+1,fy-11); ctx.lineTo(x+5,fy); ctx.fill(); }
  else if(G.finial==='ring'){ ctx.beginPath(); ctx.moveTo(x,fy); ctx.lineTo(x,fy-4); ctx.stroke(); ctx.beginPath(); ctx.arc(x,fy-8,4,0,7); ctx.stroke(); }
  else if(G.finial==='spike'){ ctx.beginPath(); ctx.moveTo(x,fy); ctx.lineTo(x,fy-13); ctx.stroke(); }
}
/* v3.7 town plans (thought.js layoutOf): streets, terraces, a spiral path — drawn on the ground round the centre */
function drawLayout(S,cx,cy,R){
  const L=S.layout; if(!L||L==='scatter'||L==='ring') return;
  if(L==='grid'){ ctx.strokeStyle='rgba(200,180,140,.38)'; ctx.lineWidth=14; for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.moveTo(cx-R,cy+i*R*0.26); ctx.lineTo(cx+R,cy+i*R*0.26); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx+i*R*0.36,cy-R*0.62); ctx.lineTo(cx+i*R*0.36,cy+R*0.62); ctx.stroke(); } }
  else if(L==='terraces'){ ctx.strokeStyle='rgba(110,100,86,.75)'; ctx.lineWidth=5; for(let i=1;i<=3;i++){ ctx.beginPath(); ctx.ellipse(cx,cy+R*0.1,R*(0.3+i*0.22),R*(0.2+i*0.15),0,Math.PI*1.05,Math.PI*1.95); ctx.stroke(); } }
  else if(L==='spiral'){ ctx.fillStyle='rgba(170,160,150,.8)'; for(let a=0;a<4*Math.PI;a+=0.16){ const r=30+a*R*0.055; ctx.beginPath(); ctx.ellipse(cx+Math.cos(a)*r,cy+Math.sin(a)*r*0.62,3.5,2.2,0,0,7); ctx.fill(); } }
}
/* v3.7 teaching stone: the people's own philosophy, in its colour, with a glyph for what it holds most */
function drawGlyph(k,pos,x,y,c){ ctx.strokeStyle=c; ctx.fillStyle=c; ctx.lineWidth=1.8; ctx.beginPath();
  if(k==='struggle'){ if(pos){ ctx.moveTo(x-5,y-5); ctx.lineTo(x+5,y+5); ctx.moveTo(x+5,y-5); ctx.lineTo(x-5,y+5); } else { ctx.moveTo(x-6,y); ctx.lineTo(x+6,y); ctx.moveTo(x-6,y+3); ctx.lineTo(x+6,y+3); } ctx.stroke(); }
  else if(k==='open'){ ctx.arc(x,y,4,0,7); ctx.stroke(); if(pos) for(let i=0;i<6;i++){ const a=i*1.047; ctx.beginPath(); ctx.moveTo(x+Math.cos(a)*5,y+Math.sin(a)*5); ctx.lineTo(x+Math.cos(a)*8,y+Math.sin(a)*8); ctx.stroke(); } }
  else if(k==='inquiry'){ if(pos){ for(let a=0;a<9;a+=0.4){ const r=a*0.8; ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r); } ctx.stroke(); } else { ctx.rect(x-5,y-5,10,10); ctx.stroke(); } }
  else if(k==='sacred'){ if(pos){ for(let i=0;i<10;i++){ const a=i*0.628-1.57, r=i%2?3:7; ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r); } ctx.fill(); } else { ctx.moveTo(x-6,y+4); ctx.lineTo(x,y-5); ctx.lineTo(x+6,y+4); ctx.stroke(); } }
  else { ctx.ellipse(x,y,3.2,6.5,0.6,0,7); if(pos) ctx.fill(); else ctx.stroke(); } }
function drawTeachingStone(I,x,y){ if(!I) return; shadow(x+4,y+2,13,4); ctx.fillStyle='#7d776e'; ctx.beginPath(); ctx.moveTo(x-11,y); ctx.lineTo(x-9,y-30); ctx.lineTo(x+9,y-33); ctx.lineTo(x+11,y); ctx.fill();
  ctx.fillStyle=I.color; ctx.fillRect(x-9,y-30,18,4); const k=topAxes(I.ax)[0]; drawGlyph(k,I.ax[k]>=0,x,y-16,I.color);
  if(cam.z>0.8){ ctx.font='10px system-ui'; ctx.textAlign='center'; ctx.fillStyle='#000a'; ctx.fillText(I.name,x+1,y+13); ctx.fillStyle='#f1e6d2'; ctx.fillText(I.name,x,y+12); } }
function drawCairn(c){ shadow(c.x+2,c.y+2,9,3); for(const [y,w,col] of [[-2,8,'#8a847c'],[-6,6,'#9c968e'],[-9.5,4,'#aaa49c']]){ ctx.fillStyle=col; ctx.beginPath(); ctx.ellipse(c.x,c.y+y,w,w*0.55,0,0,7); ctx.fill(); } }
const TIPC=['','','#d9c49a','#2b2933','#d0702a','#c9a040','#8a8a90','#d4dae4','#1c1c1c'];
/* landmarks: one building per post-Steel invention (see onTech in sim.js) */
function drawLandmark(m,t){
  const x=m.x, y=m.y;
  if(m.ruin){ drawRubble(x,y,Math.round(x*3+y)); if(cam.z>0.6){ ctx.font='10px system-ui'; ctx.textAlign='center'; ctx.fillStyle='#000a'; ctx.fillText('ruin of the '+m.name,x+1,y+15); ctx.fillStyle='#c8b8a0'; ctx.fillText('ruin of the '+m.name,x,y+14); } return; }   // v3.7: lost in a collapse
  shadow(x+6,y+2,26,7);
  const box=(w,h,c,r)=>{ ctx.fillStyle=c; ctx.fillRect(x-w/2,y-h,w,h); if(r){ ctx.fillStyle=r; ctx.beginPath(); ctx.moveTo(x-w/2-3,y-h); ctx.lineTo(x,y-h-w*0.35); ctx.lineTo(x+w/2+3,y-h); ctx.fill(); } };
  const smoke=(sx,sy)=>{ for(let i=0;i<4;i++){ const u=((t*0.4+i/4)%1); ctx.fillStyle=`rgba(200,200,200,${0.45*(1-u)})`; ctx.beginPath(); ctx.arc(sx+u*14,sy-u*40,4+u*8,0,7); ctx.fill(); } };
  switch(m.kind){
    case 'fort': box(46,22,'#8c8478'); ctx.fillStyle='#8c8478'; for(let i=0;i<5;i++) ctx.fillRect(x-23+i*10,y-28,6,6); ctx.fillStyle='#222'; ctx.fillRect(x+16,y-14,14,4); break;
    case 'press': box(34,24,'#9a7a56','#6a4a30'); ctx.fillStyle='#f0e6d0'; for(let i=0;i<3;i++) ctx.fillRect(x-12+i*9,y-12,6,8); break;
    case 'mill': box(40,26,'#8a4a3a','#5a3a2a'); ctx.fillStyle='#5a4a40'; ctx.fillRect(x+10,y-50,7,26); smoke(x+13,y-52); break;
    case 'lamps': for(let i=-2;i<=2;i++){ const lx=x+i*22; ctx.strokeStyle='#333'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(lx,y); ctx.lineTo(lx,y-30); ctx.stroke(); ctx.fillStyle='#ffe9a0'; ctx.beginPath(); ctx.arc(lx,y-32,3.5,0,7); ctx.fill(); } break;
    case 'roads': ctx.strokeStyle='#4a4a4a'; ctx.lineWidth=7; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(FIRE.x+(x-FIRE.x)*0.35,FIRE.y+(y-FIRE.y)*0.35); ctx.stroke(); ctx.strokeStyle='#e0d070'; ctx.lineWidth=1; ctx.setLineDash([6,6]); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='#b03030'; ctx.fillRect(x-9,y-8,18,7); ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(x-5,y-1,2.5,0,7); ctx.arc(x+5,y-1,2.5,0,7); ctx.fill(); break;
    case 'mast': ctx.strokeStyle='#a33'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x-10,y); ctx.lineTo(x,y-70); ctx.lineTo(x+10,y); ctx.moveTo(x-6,y-25); ctx.lineTo(x+6,y-25); ctx.moveTo(x-3,y-48); ctx.lineTo(x+3,y-48); ctx.stroke(); if(Math.sin(t*4)>0){ ctx.fillStyle='#ff4040'; ctx.beginPath(); ctx.arc(x,y-72,3,0,7); ctx.fill(); } break;
    case 'computer': box(46,20,'#c8ccd0','#7a8088'); ctx.fillStyle='#3a6fb0'; for(let i=0;i<4;i++) ctx.fillRect(x-19+i*10,y-15,6,5); ctx.fillStyle=Math.sin(t*6)>0?'#7f7':'#272'; ctx.fillRect(x+16,y-6,3,3); break;
    case 'rocket': ctx.fillStyle='#777'; ctx.fillRect(x-22,y-4,44,5); ctx.fillStyle='#eee'; ctx.beginPath(); ctx.moveTo(x-6,y-6); ctx.lineTo(x-6,y-52); ctx.quadraticCurveTo(x,y-70,x+6,y-52); ctx.lineTo(x+6,y-6); ctx.fill(); ctx.fillStyle='#c33'; ctx.beginPath(); ctx.moveTo(x-6,y-6); ctx.lineTo(x-12,y); ctx.lineTo(x-6,y-18); ctx.moveTo(x+6,y-6); ctx.lineTo(x+12,y); ctx.lineTo(x+6,y-18); ctx.fill(); ctx.fillStyle='#3a6fb0'; ctx.beginPath(); ctx.arc(x,y-40,2.5,0,7); ctx.fill(); break;
    case 'plant': box(40,22,'#9aa0a6'); ctx.fillStyle='#b8bcc0'; ctx.beginPath(); ctx.moveTo(x-30,y); ctx.lineTo(x-26,y-44); ctx.lineTo(x-14,y-44); ctx.lineTo(x-10,y); ctx.fill(); smoke(x-20,y-46); break;
    case 'clinic': box(36,22,'#f0ece4','#9a9aa0'); ctx.fillStyle='#d33'; ctx.fillRect(x-2,y-18,4,12); ctx.fillRect(x-6,y-14,12,4); break;
    case 'tower': box(18,64,'#8a9aa8'); ctx.fillStyle='#bfe0ff'; for(let i=0;i<6;i++) ctx.fillRect(x-6,y-58+i*10,12,4); break;
    case 'greenhouse': ctx.fillStyle='rgba(190,230,210,.75)'; ctx.beginPath(); ctx.ellipse(x,y-2,30,22,0,Math.PI,0); ctx.fill(); ctx.strokeStyle='#5a7a6a'; ctx.lineWidth=1; ctx.stroke(); ctx.fillStyle='#4a8a3a'; for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.arc(x+i*9,y-6,3,0,7); ctx.fill(); } break;
    default: box(30,30,'#888','#555');
  }
  if(cam.z>0.6){ ctx.font='10px system-ui'; ctx.textAlign='center'; ctx.fillStyle='#000a'; ctx.fillText(m.name,x+1,y+15); ctx.fillStyle='#f1e6d2'; ctx.fillText(m.name,x,y+14); }
}
function drawVillager(v,t){
  if(v.inCave) return;
  const s=v.child?0.62+0.3*v.grow:1, x=v.x, y=v.y, k=v.task?v.task.kind:'';
  const sleeping=k==='sleep'&&v.task.arrived, praying=k==='pray'&&!v.task.cower, cowering=k==='pray'&&v.task.cower, chanting=k==='ritual'&&v.task.arrived, sitting=v.pondering;
  ctx.save(); ctx.translate(x,y); ctx.scale(s*v.face,s);
  shadow(0,0,7,2.5);
  if(sleeping){ ctx.fillStyle=v.hide; ctx.beginPath(); ctx.ellipse(0,-3,10,4,0,0,7); ctx.fill(); ctx.fillStyle=v.skin; ctx.beginPath(); ctx.arc(-10,-4,3.6,0,7); ctx.fill(); ctx.restore();
    ctx.fillStyle='#ffffffaa'; ctx.font='bold 9px sans-serif'; ctx.fillText('z',x+6,y-10-Math.sin(t*2+v.id)*3); return; }
  const walk=v.moving?Math.sin(v.anim):0, kneel=praying||cowering||sitting||(chanting&&!v.isLead), bob=v.moving?Math.abs(Math.sin(v.anim))*1.2:0;
  ctx.strokeStyle='#3a2a1a'; ctx.lineWidth=2.2; ctx.lineCap='round';
  if(kneel){ ctx.beginPath(); ctx.moveTo(-1,-3); ctx.lineTo(-6,0); ctx.lineTo(3,0); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(-1,-8); ctx.lineTo(-2+walk*3,0); ctx.moveTo(1,-8); ctx.lineTo(2-walk*3,0); ctx.stroke(); }
  const by=(kneel?5:0)-bob+(cowering?2:0);
  const ERA=HSTYLE?HSTYLE.era:0, CL=[null,null,['#7a4a3a','#4a5a7a','#6a6a3a','#7a3a5a'],['#4a4a52','#5a4a3a','#3a4a5a'],['#3a5a8a','#4a5a3a','#6a3a3a'],['#d0d4da','#2a6ab0','#c04a4a','#e0c040']][ERA];
  if(ERA>=2&&!kneel){ ctx.strokeStyle=ERA>=3?'#2a2a32':'#5a4a3a'; ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(-1,-8); ctx.lineTo(-2+walk*3,0); ctx.moveTo(1,-8); ctx.lineTo(2-walk*3,0); ctx.stroke(); }   // trousers
  ctx.fillStyle=CL?CL[v.id%CL.length]:v.hide; ctx.beginPath(); ctx.moveTo(-5,-7+by); ctx.lineTo(-4,-18+by); ctx.lineTo(4,-18+by); ctx.lineTo(6,-7+by); ctx.lineTo(3,-8+by); ctx.lineTo(0,-6.5+by); ctx.lineTo(-2,-8+by); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=v.skin; ctx.lineWidth=2;
  if(praying||(chanting&&v.isLead)){ ctx.beginPath(); ctx.moveTo(-3,-16+by); ctx.lineTo(-5,-25+by+Math.sin(t*4)*1.5); ctx.moveTo(3,-16+by); ctx.lineTo(5,-25+by-Math.sin(t*4)*1.5); ctx.stroke(); }
  else if(cowering){ ctx.beginPath(); ctx.moveTo(-3,-16+by); ctx.lineTo(-4,-24+by); ctx.lineTo(1,-26+by); ctx.moveTo(3,-16+by); ctx.lineTo(5,-23+by); ctx.lineTo(2,-26+by); ctx.stroke(); }
  else if(chanting||sitting){ ctx.beginPath(); ctx.moveTo(-3,-16+by); ctx.lineTo(4,-12+by+Math.sin(t*3+v.id)); ctx.moveTo(3,-16+by); ctx.lineTo(6,-12+by); ctx.stroke(); }
  else { const sw=v.working?Math.sin(t*10)*4:walk*2; ctx.beginPath(); ctx.moveTo(3,-16+by); ctx.lineTo(6+sw,-10+by); ctx.moveTo(-3,-16+by); ctx.lineTo(-5-walk*2,-10+by); ctx.stroke(); }
  if(v.carry&&v.carry.type==='brand'){ ctx.strokeStyle='#5a3a1e'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(6,-8+by); ctx.lineTo(10,-26+by); ctx.stroke(); flame(10.5,-26+by,0.35,t); }
  else if(v.tool>0 && !praying && !chanting && !cowering){ const len=v.tool===1?22:32; ctx.strokeStyle='#7a5530'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(6,-2+by); ctx.lineTo(6+len*0.1,-2-len+by); ctx.stroke();
    if(v.tool>=2){ ctx.fillStyle=TIPC[v.tool]; const tx=6+len*0.1; ctx.beginPath(); ctx.moveTo(tx-1.4,-1-len+by); ctx.lineTo(tx+0.4,-8-len+by); ctx.lineTo(tx+1.8,-1-len+by); ctx.fill(); } }
  if(v.carry&&v.carry.type!=='brand'){ if(v.carry.type==='sticks'){ ctx.strokeStyle='#6b4a2a'; ctx.lineWidth=2; for(let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(-8,-19+by-i*1.5); ctx.lineTo(8,-21+by-i*1.5); ctx.stroke(); } }
    else if(v.carry.type==='food'){ ctx.fillStyle='#7a6440'; ctx.beginPath(); ctx.ellipse(-6,-12+by,4.5,3.5,0,0,7); ctx.fill(); ctx.fillStyle='#c4283a'; ctx.beginPath(); ctx.arc(-7,-15+by,1.6,0,7); ctx.arc(-4.5,-14.5+by,1.6,0,7); ctx.fill(); }
    else { ctx.fillStyle='#2b2933'; ctx.beginPath(); ctx.arc(-6,-12+by,3,0,7); ctx.fill(); } }
  const hy=-22+by+(sitting?-0:0);
  ctx.fillStyle=v.skin; ctx.beginPath(); ctx.arc(0,hy,4.4,0,7); ctx.fill();
  ctx.fillStyle=v.role==='Elder'?'#c9c3b8':v.hair; ctx.beginPath(); ctx.arc(-0.8,hy-1.5,4.6,Math.PI*0.95,Math.PI*2.05); ctx.fill(); ctx.fillRect(-5,hy-2,2.4,6);
  ctx.fillStyle='#1a120c'; ctx.fillRect(1.8,hy-0.5-(sitting?1:0),1.2,1.2);
  if(v.isLead){ ctx.fillStyle='#c8642a'; ctx.fillRect(-4.6,hy-2.5,9.2,1.6); ctx.fillStyle='#efe2c4'; for(let i=0;i<4;i++) ctx.fillRect(-3+i*2,-17.5+by,1.2,2.2); }
  if(v.role==='Chief'){ ctx.strokeStyle='#e8dcc0'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(-2,hy-4); ctx.lineTo(-4,hy-12); ctx.moveTo(1,hy-4); ctx.lineTo(2,hy-12); ctx.stroke(); }
  if(v.role==='Ruler'){ ctx.fillStyle='#d0702a'; ctx.fillRect(-4.8,hy-4.5,9.6,2); for(let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(-4+i*4,hy-4.5); ctx.lineTo(-3+i*4,hy-8); ctx.lineTo(-2+i*4,hy-4.5); ctx.fill(); } }
  if(v.hp<60){ ctx.fillStyle='#b8202a'; ctx.fillRect(-4,-14+by,2.5,2.5); }
  ctx.restore();
  if(cam.follow===v||dir.focus===v){ ctx.strokeStyle='#ffd27a'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.ellipse(x,y,11,4.5,0,0,7); ctx.stroke(); }
}
function drawPred(p){
  ctx.save(); ctx.translate(p.x,p.y); ctx.scale(p.face,1);
  if(p.dead){ ctx.globalAlpha=Math.max(0,1-p.corpse/40); shadow(0,0,22,5); ctx.fillStyle='#3b3548'; ctx.beginPath(); ctx.ellipse(0,-5,22,7,0,0,7); ctx.fill(); ctx.fillStyle='#d8d2c0'; for(let i=0;i<5;i++){ ctx.beginPath(); ctx.moveTo(-12+i*5,-11); ctx.lineTo(-10+i*5,-15); ctx.lineTo(-8+i*5,-11); ctx.fill(); } ctx.restore(); return; }
  const g=Math.sin(p.anim);
  shadow(0,0,22,5);
  ctx.strokeStyle='#2a2534'; ctx.lineWidth=3; ctx.lineCap='round';
  for(const [lx,ph] of [[-13,0],[-8,Math.PI],[9,Math.PI],[14,0]]){ ctx.beginPath(); ctx.moveTo(lx,-9); ctx.lineTo(lx+Math.sin(p.anim+ph)*4,0); ctx.stroke(); }
  ctx.strokeStyle='#3b3548'; ctx.lineWidth=3.5; ctx.beginPath(); ctx.moveTo(-18,-12); ctx.quadraticCurveTo(-30,-20+g*3,-36,-10+g*4); ctx.stroke();
  ctx.fillStyle=p.hurtBy>0?'#7a3a48':'#3b3548'; ctx.beginPath(); ctx.ellipse(0,-13,21,7.5,0,0,7); ctx.fill();
  ctx.fillStyle='#4a4258'; ctx.beginPath(); ctx.ellipse(-2,-16,15,3.5,0,0,7); ctx.fill();
  ctx.fillStyle='#d8d2c0'; for(let i=0;i<6;i++){ const sx=-13+i*5; ctx.beginPath(); ctx.moveTo(sx,-19); ctx.lineTo(sx+2,-25-(i%2)*2); ctx.lineTo(sx+4,-19); ctx.fill(); }
  ctx.fillStyle='#332d40'; ctx.beginPath(); ctx.moveTo(16,-18); ctx.lineTo(31,-14); ctx.lineTo(30,-9); ctx.lineTo(16,-8); ctx.fill();
  ctx.fillStyle='#d8d2c0'; ctx.beginPath(); ctx.moveTo(26,-9); ctx.lineTo(27,-3); ctx.lineTo(29,-9); ctx.fill();
  ctx.fillStyle='#b8f07a'; ctx.beginPath(); ctx.arc(24,-14,1.8,0,7); ctx.fill();
  ctx.restore();
}
/* the claimed land: a ring of ochre-marked posts that grows with the people */
function claimRadius(){ return Math.min(1700,220+30*Math.sqrt(home.pop)); }
function drawClaim(){
  if(!knows('fire')) return; const r=claimRadius();
  // v3.6.5: at huge population the ring is far bigger than the view — skip it when the view lies wholly inside or
  // wholly outside the ring (a long dashed ellipse is one of the most expensive strokes on a canvas)
  { const hw=VW/2/cam.z+20, hh=VH/2/cam.z+20, e=(x,y)=>Math.hypot((x-FIRE.x)/r,(y-FIRE.y)/(r*0.72));
    const ds=[e(cam.x-hw,cam.y-hh),e(cam.x+hw,cam.y-hh),e(cam.x-hw,cam.y+hh),e(cam.x+hw,cam.y+hh)];
    if(Math.max(...ds)<0.98) return;
    const nx=clamp(FIRE.x,cam.x-hw,cam.x+hw), ny=clamp(FIRE.y,cam.y-hh,cam.y+hh); if(e(nx,ny)>1.02) return; }
  const vis=(x,y)=>Math.abs(x-cam.x)<VW/2/cam.z+20&&Math.abs(y-cam.y)<VH/2/cam.z+30;
  ctx.save(); ctx.strokeStyle='rgba(200,110,50,.45)'; ctx.setLineDash([10,14]); ctx.lineWidth=2.5; ctx.beginPath(); ctx.ellipse(FIRE.x,FIRE.y,r,r*0.72,0,0,7); ctx.stroke(); ctx.setLineDash([]);
  const n=Math.max(8,Math.round(r/30)); for(let i=0;i<n;i++){ const a=i/n*6.283, x=FIRE.x+Math.cos(a)*r, y=FIRE.y+Math.sin(a)*r*0.72; if(!vis(x,y)||y<ridgeEdge(x)+10) continue; ctx.fillStyle='#5a3c22'; ctx.fillRect(x-1.5,y-12,3,12); ctx.fillStyle='#c8642a'; ctx.fillRect(x-1.5,y-12,3,3); }
  ctx.restore();
}
function planPos(p,L){ if(L==='grid'){ const q=95; return {x:FIRE.x+Math.round((p.x-FIRE.x)/q)*q, y:FIRE.y+Math.round((p.y-FIRE.y)/(q*0.75))*q*0.75}; }
  if(L==='ring'){ const dx=p.x-FIRE.x, dy=(p.y-FIRE.y)/0.8, r=Math.round(Math.hypot(dx,dy)/120)*120, a=Math.atan2(dy,dx); return {x:FIRE.x+Math.cos(a)*r, y:FIRE.y+Math.sin(a)*r*0.8}; }
  if(L==='spiral'){ const dx=p.x-FIRE.x, dy=(p.y-FIRE.y)/0.8, r=Math.hypot(dx,dy), a=Math.atan2(dy,dx)+r/260; return {x:FIRE.x+Math.cos(a)*r, y:FIRE.y+Math.sin(a)*r*0.8}; }
  return p; }
function outlyingHuts(){ const out=[], n=Math.min(54,Math.floor(home.extra/8)), L=HSTYLE&&HSTYLE.layout, seen=new Set(); let i=0,k=24; while(out.length<n&&k<200){ const p=planPos(slotPos(k++),L), kk=Math.round(p.x/30)+','+Math.round(p.y/30); if(seen.has(kk)) continue; seen.add(kk); if(p.y>ridgeEdge(p.x)+40&&p.x>40&&p.x<W-40&&p.y<H-40&&Math.hypot(p.x-POND.x,p.y-POND.y)>POND.r+40) out.push({type:'hut',built:true,small:true,x:p.x,y:p.y}); i++; } return out; }

/* ------------------------------ bubbles ------------------------------ */
const EMO={afraid:'#d77a6a',terrified:'#e05a4a',hurt:'#e05a4a',fierce:'#d85a3a',sad:'#7a9ad0',calm:'#e0b860',curious:'#a88ae0',proud:'#7ac070',awed:'#b8d8f0',hungry:'#e09a40',content:'#c8b898',busy:'#c8b898',wary:'#c8b898'};
function face(x,y,emo){ const c=EMO[emo]||'#c8b898'; ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,6,0,7); ctx.fill(); ctx.fillStyle='#2a1d12'; ctx.fillRect(x-2.6,y-2,1.4,1.6); ctx.fillRect(x+1.2,y-2,1.4,1.6);
  ctx.strokeStyle='#2a1d12'; ctx.lineWidth=1.2; ctx.beginPath();
  if(['afraid','terrified','hurt','awed'].includes(emo)) ctx.arc(x,y+2.4,1.6,0,7); else if(emo==='sad'||emo==='hungry') ctx.arc(x,y+4,2.4,Math.PI*1.15,Math.PI*1.85); else if(emo==='fierce'){ ctx.moveTo(x-2.5,y+2.5); ctx.lineTo(x+2.5,y+2.5); } else if(emo==='curious'){ ctx.moveTo(x-2,y+2.5); ctx.lineTo(x+2.5,y+1.5); } else ctx.arc(x,y+0.6,2.6,Math.PI*0.2,Math.PI*0.8); ctx.stroke(); }
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function drawBubble(v){
  const sx=(v.x-cam.x)*cam.z+VW/2, sy=(v.y-cam.y)*cam.z+VH/2-(v.child?26:38)*cam.z;
  ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0); ctx.font='13px system-ui,sans-serif'; const tw=ctx.measureText(v.bubble.text).width, w=Math.min(250,tw+30);
  ctx.globalAlpha=Math.min(1,v.bubble.t*2); ctx.fillStyle='#fbf6eaf2'; roundRect(sx-w/2,sy-24,w,21,9); ctx.fill(); ctx.beginPath(); ctx.moveTo(sx-4,sy-3.5); ctx.lineTo(sx,sy+3); ctx.lineTo(sx+4,sy-3.5); ctx.fill();
  ctx.strokeStyle=EMO[v.mood]||'#c8b898'; ctx.lineWidth=1.6; roundRect(sx-w/2,sy-24,w,21,9); ctx.stroke();
  face(sx-w/2+11,sy-13.5,v.mood);
  ctx.fillStyle='#2a1d12'; ctx.textAlign='left'; ctx.fillText(v.bubble.text,sx-w/2+21,sy-9,w-26); ctx.restore();
}

/* -------------------------------- render -------------------------------- */
function worldXform(){ ctx.setTransform(DPR*cam.z,0,0,DPR*cam.z,DPR*(VW/2-cam.x*cam.z),DPR*(VH/2-cam.y*cam.z)); }
let HSTYLE=null;    // the architecture pack in use while drawing (home or the visited people)
function render(t){
  HSTYLE=knows('hut')&&typeof archOf==='function'?archOf(world.factions[0]):null;
  ctx.setTransform(DPR,0,0,DPR,0,0); ctx.fillStyle='#1b1712'; ctx.fillRect(0,0,VW,VH);
  worldXform(); ctx.drawImage(bg,0,0);
  drawClaim();
  if(home.bl!=null&&home.bl<1){ ctx.fillStyle=`rgba(${home.bl<0.5?'70,50,40':'90,90,40'},${(1-home.bl)*0.45})`; ctx.fillRect(0,0,W,H); }   // v3.7: poisoned / sickened land
  for(const s of tribe.structures) if(s.type==='plot') drawStructure(s);
  if(HSTYLE) drawCivic(HSTYLE,FIRE.x,FIRE.y,620,t);
  for(const r of roots) drawRoot(r);
  drawFire(t);
  const ents=[];
  // v3.6.3: cull sprites outside the camera view (+ margin for tall sprites)
  const hw=VW/2/cam.z+160, hh=VH/2/cam.z+220, on=o=>Math.abs(o.x-cam.x)<hw&&Math.abs(o.y-cam.y)<hh;
  for(const tr of trees) if(on(tr)) ents.push([tr.y,()=>drawTree(tr,t)]);
  for(const b of bushes) if(on(b)) ents.push([b.y,()=>drawBush(b)]);
  for(const f of flints) if(on(f)) ents.push([f.y,()=>drawFlint(f)]);
  for(const s of skitters) if(on(s)) ents.push([s.y,()=>drawSkitter(s)]);
  for(const c of cairns) if(on(c)) ents.push([c.y,()=>drawCairn(c)]);
  for(const s of tribe.structures) if(s.type!=='plot'&&on(s)) ents.push([s.y,()=>drawStructure(s)]);
  for(const m of (tribe.landmarks||[]).slice(-40)) if(on(m)) ents.push([m.y,()=>drawLandmark(m,t)]);
  for(const s of outlyingHuts()) if(on(s)) ents.push([s.y,()=>drawStructure(s)]);
  ents.push([STONE.y,()=>drawStone(t)]);
  for(const v of villagers) if(!v.dead) ents.push([v.y,()=>drawVillager(v,t)]);
  for(const p of preds) ents.push([p.y,()=>drawPred(p)]);
  if(STRANGER&&STRANGER.where==='home') ents.push([STRANGER.y,()=>drawStranger(STRANGER,t)]);
  ents.sort((a,b)=>a[0]-b[0]); for(const e of ents) e[1]();
  // day/night
  const f=phase(); let a=0; if(f>0.64&&f<0.76) a=(f-0.64)/0.12*0.6; else if(f>=0.76) a=0.68; else if(f<0.08) a=0.68*(1-f/0.08);
  if(a>0.01){ dctx.setTransform(1,0,0,1,0,0); dctx.globalCompositeOperation='source-over'; dctx.clearRect(0,0,dark.width,dark.height); dctx.fillStyle=`rgba(14,16,42,${a})`; dctx.fillRect(0,0,dark.width,dark.height);
    dctx.globalCompositeOperation='destination-out';
    const L=(x,y,r,s)=>{ const sx=((x-cam.x)*cam.z+VW/2)*DPR, sy=((y-cam.y)*cam.z+VH/2)*DPR, rr=r*cam.z*DPR; const g=dctx.createRadialGradient(sx,sy,0,sx,sy,rr); g.addColorStop(0,`rgba(0,0,0,${s})`); g.addColorStop(1,'rgba(0,0,0,0)'); dctx.fillStyle=g; dctx.beginPath(); dctx.arc(sx,sy,rr,0,7); dctx.fill(); };
    if(fireLit()) L(FIRE.x,FIRE.y-10,200+Math.sin(t*7)*6,1);
    if(tribe.ritual) L(tribe.ritual.at.x,tribe.ritual.at.y+10,120,.8);
    if(tribe.burning) L(tribe.burning.x,tribe.burning.y-30,170,1);
    for(const v of villagers) if(!v.dead&&v.carry&&v.carry.type==='brand') L(v.x,v.y-20,80,.9);
    for(const s of tribe.structures) if(s.built&&s.type==='hut') L(s.x,s.y-6,knows('electricity')?70:42,knows('electricity')?.8:.5);
    for(const m of (tribe.landmarks||[]).slice(-40)) if(knows('electricity')||m.kind==='lamps') L(m.x,m.y-20,m.kind==='lamps'?110:70,.85);
    ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(dark,0,0); worldXform();
    if(fireLit()){ ctx.globalCompositeOperation='lighter'; const fg=ctx.createRadialGradient(FIRE.x,FIRE.y-10,0,FIRE.x,FIRE.y-10,160); fg.addColorStop(0,`rgba(255,140,40,${0.3*a})`); fg.addColorStop(1,'rgba(255,140,40,0)'); ctx.fillStyle=fg; ctx.fillRect(FIRE.x-170,FIRE.y-180,340,340); ctx.globalCompositeOperation='source-over'; }
    for(const p of preds) if(!p.dead){ ctx.fillStyle='#c8ff8a'; ctx.shadowColor='#c8ff8a'; ctx.shadowBlur=8; ctx.beginPath(); ctx.arc(p.x+p.face*24,p.y-14,2,0,7); ctx.fill(); ctx.shadowBlur=0; }
  }
  if(world.dis&&world.dis.winterT>tribe.time){ ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='rgba(120,120,130,.32)'; ctx.fillRect(0,0,cv.width,cv.height); ctx.fillStyle='rgba(60,60,64,.7)'; for(let i=0;i<70;i++){ const ax=((i*137.5+t*20*(1+i%3))%VW)*DPR, ay=((i*91.3+t*40*(1+i%2))%VH)*DPR; ctx.fillRect(ax,ay,2*DPR,2*DPR); } worldXform(); }   // v3.7: nuclear winter — grey sky, falling ash
  if(tribe.flash>0&&tribe.burning){ const b=tribe.burning; ctx.strokeStyle='#fffbe0'; ctx.lineWidth=3; ctx.beginPath(); let x=b.x, y=b.y-b.r*1.4; ctx.moveTo(x,y); for(let i=0;i<7;i++){ x+=R(-18,18); y-=70; ctx.lineTo(x,y); } ctx.stroke();
    ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle=`rgba(255,255,240,${Math.min(.55,tribe.flash)})`; ctx.fillRect(0,0,cv.width,cv.height); worldXform(); }
  if(placing){ ctx.strokeStyle='#c8ff8a'; ctx.setLineDash([4,4]); ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(mouse.wx,mouse.wy,22,0,7); ctx.stroke(); ctx.setLineDash([]); }
  // bubbles: at most 7, those nearest the centre of view (readability)
  const bs=villagers.filter(v=>!v.dead&&v.bubble&&!v.inCave).map(v=>[Math.hypot(v.x-cam.x,v.y-cam.y),v]).sort((a,b)=>a[0]-b[0]).slice(0,7);
  if(cam.z>0.7) for(const [,v] of bs) drawBubble(v);
}

/* ------------------------- director (auto camera) ------------------------- */
const PRI={predator:6,invent:5,lightning:5,age:5,gov:5,worldmap:5,belief:4,ritual:3,build:3,conquest:3,rival:3,role:2,birth:2,settle:1,contact:2,world:1};
const dir={on:true,cur:null,q:[],manualT:0,idleT:0,idleTarget:null,focus:null};
const capQ=[]; let capT=0;
const SAVE_KINDS={invent:1,age:1,gov:1,worldmap:1,belief:1,settle:1,rival:1,conquest:1,war:1,peace:1,alliance:1,trade:1,battle:1,lightning:1};
const GLANCE_KINDS={war:1,battle:1,conquest:1,peace:1,alliance:1,trade:1,rival:1,gov:1};
function director(target,ev){
  if(SAVE_KINDS[ev.kind]&&typeof saveSoon!=='undefined') saveSoon=true;
  if(ev.sett&&!ev.sett.home&&GLANCE_KINDS[ev.kind]&&typeof visit!=='undefined') dir.glance={s:ev.sett,pri:ev.big?2:1,age:0};
  if(ev.caption){ const last=capQ[capQ.length-1]; if(!last||last.caption!==ev.caption) capQ.push({caption:ev.caption,sub:ev.sub||'',big:ev.big}); if(capQ.length>4) capQ.splice(0,capQ.length-4); }
  if(target){ dir.q.push({target,ev,pri:PRI[ev.kind]||1,age:0}); if(dir.q.length>8){ dir.q.sort((a,b)=>b.pri-a.pri); dir.q.length=8; } }
}
function posOf(t){ return t&&t.x!=null?{x:t.x,y:t.y-(t.name?12:20)}:null; }
function updateDirector(rdt){
  // captions (always, even with the director off)
  capT-=rdt; const el=document.getElementById('caption');
  if(capT<=0){ if(capQ.length){ const c=capQ.shift(); el.innerHTML=c.caption+(c.sub?`<small>${c.sub}</small>`:''); el.style.opacity=1; el.style.borderColor=c.big?'#ffb35c':'#8a6a40'; capT=c.big?5:3.2; } else el.style.opacity=0; }
  for(const q of dir.q) q.age+=rdt; dir.q=dir.q.filter(q=>q.age<25);
  if(dir.glance){ dir.glance.age+=rdt; if(dir.glance.age>20) dir.glance=null; }
  if(dir.manualT>0){ dir.manualT-=rdt; dir.focus=null; return; }
  if(!dir.on){ dir.focus=null; return; }
  // now and then, glance at another people's war / pact / new realm (≈ once a minute at most, never over the user)
  if(dir.glance&&!visit.on&&!wmv.open&&!(dir.cur&&dir.cur.hold>0&&dir.cur.pri>=5)&&performance.now()/1000-visit.lastGlance>(dir.glance.pri>1?40:70)&&world.setts.includes(dir.glance.s)){
    visit.lastGlance=performance.now()/1000; const g=dir.glance; dir.glance=null; startVisit(g.s,{auto:true,dur:15}); }
  if(visit.on){ dir.idleT-=rdt; if(dir.idleT<=0||!dir.idleTarget||!visit.cast.concat(visit.enemies).includes(dir.idleTarget)){ dir.idleT=R(6,10); const A=visit.cast.concat(visit.enemies), I=A.filter(v=>v.bubble||v.enemy); dir.idleTarget=I.length?pick(I):pick(A); }
    const p=posOf(dir.idleTarget)||VC; cam.follow=null; dir.focus=dir.idleTarget; const k=Math.min(1,rdt*1.4); cam.x+=(p.x-cam.x)*k; cam.y+=(p.y-cam.y)*k; cam.z+=(1.6-cam.z)*Math.min(1,rdt*0.8); return; }
  let tx,ty,tz;
  if(dir.cur&&dir.cur.hold>0){ dir.cur.hold-=rdt; }
  else if(dir.q.length){ dir.q.sort((a,b)=>b.pri-a.pri||a.age-b.age); const n=dir.q.shift(); dir.cur={...n,hold:n.ev.kind==='ritual'?9:6}; }
  else dir.cur=null;
  if(dir.cur && !(dir.cur.target.dead)){ const p=posOf(dir.cur.target); tx=p.x; ty=p.y; tz=dir.cur.ev.zoom||1.9; dir.focus=dir.cur.target.name?dir.cur.target:null; }
  else {
    dir.idleT-=rdt;
    if(dir.idleT<=0||!dir.idleTarget||dir.idleTarget.dead){ dir.idleT=R(9,14);
      const ph=phaseName(), A=alive();
      const interesting=A.filter(v=>v.bubble||(v.task&&['brand','ritual','build','hunt','ponder','tend','pray','craft','feed'].includes(v.task.kind))||v.child);
      dir.idleTarget=(ph==='Night'&&fireLit())?FIRE:(interesting.length?pick(interesting):pick(A)); }
    const p=posOf(dir.idleTarget)||FIRE; tx=p.x; ty=p.y; tz=dir.idleTarget===FIRE?1.3:1.65; dir.focus=dir.idleTarget&&dir.idleTarget.name?dir.idleTarget:null;
  }
  cam.follow=null;
  const k=Math.min(1,rdt*1.4); cam.x+=(tx-cam.x)*k; cam.y+=(ty-cam.y)*k; cam.z+=(tz-cam.z)*Math.min(1,rdt*0.8);
}
function manual(){ dir.manualT=25; }

/* ------------------------------- world map ------------------------------- */
const wm=document.getElementById('wm'), wmc=document.getElementById('wmc'), wctx=wmc.getContext('2d');
const wmv={x:0,y:0,cell:6,open:false,drawT:0};   // zoomed out: continents and oceans   // was 18 — wider default view for the roomier world
const TCOL={ocean:'#1d3f57',grass:'#6f7a3a',forest:'#4a5e2c',hills:'#8a7d55',peak:'#d0cbc2',water:'#3e6d7a'};
/* v3.6.4 finite-world map. The world is bounded (WORLD_X × WORLD_Y regions, world.js), so the whole planet is
   cached as two 1-px-per-region canvases:
     terrain   – static; filled progressively in 32×32 chunks under a per-frame time budget (starts when the
                 map unlocks). Chunks far from every continent are pure ocean and are skipped without any
                 landAt/noise work. The canvas starts ocean-coloured, so unfinished chunks just look like sea.
     territory – tint per people (+ stronger edge cells), rebuilt only when the territory signature changes
                 (checked at most every 0.5 s while the map is open).
   Every frame then just blits the visible part of both canvases (any zoom, any pan — no rebuild hitch) and
   draws the cheap overlay (diplomacy capped at 40, battles, culled markers, labels). */
const wbase={pairs:null}, WPRI={war:0,allied:1,trade:2};
const WW=Math.ceil(WORLD_X*2), WH=Math.ceil(WORLD_Y*2), TER_CODE={ocean:0,water:1,grass:2,forest:3,hills:4,peak:5};
const wterr={cv:document.createElement('canvas'),grid:new Uint8Array(WW*WH).fill(255),next:0,done:false,chunks:[],ms:0};
const wown={cv:document.createElement('canvas'),sig:null,t:0,img:null,own:new Int16Array(WW*WH),sc:new Float32Array(WW*WH),ms:0};
wterr.cv.width=WW; wterr.cv.height=WH; wown.cv.width=WW; wown.cv.height=WH;
{ const g=wterr.cv.getContext('2d'); g.fillStyle=TCOL.ocean; g.fillRect(0,0,WW,WH);
  const CH=32; for(let y=0;y<WH;y+=CH) for(let x=0;x<WW;x+=CH) wterr.chunks.push([x,y]);
  wterr.chunks.sort((p,q)=>Math.hypot(p[0]-WW/2,p[1]-WH/2)-Math.hypot(q[0]-WW/2,q[1]-WH/2)); }   // home outward
function worldTerrainStep(budgetMs){
  if(wterr.done) return; const t0=performance.now(), g=wterr.cv.getContext('2d'), CH=32;
  const rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)], TR={}; for(const k in TCOL) TR[TER_CODE[k]]=rgb(TCOL[k]);
  const conts=[]; for(let i=-WORLD_CI;i<=WORLD_CI;i++) for(let j=-WORLD_CJ;j<=WORLD_CJ;j++){ const c=contAt(i,j); if(c) conts.push(c); }
  while(wterr.next<wterr.chunks.length && performance.now()-t0<budgetMs){
    const [x0,y0]=wterr.chunks[wterr.next++], w=Math.min(CH,WW-x0), h=Math.min(CH,WH-y0), cx0=x0-WORLD_X, cy0=y0-WORLD_Y;
    const mx=cx0+w/2, my=cy0+h/2, near=conts.some(c=>Math.hypot(c.x-mx,c.y-my)<c.r*1.9+CH)||Math.hypot(mx,my)<CH*1.5;
    if(!near){ for(let j=0;j<h;j++) wterr.grid.fill(0,(y0+j)*WW+x0,(y0+j)*WW+x0+w); continue; }   // deep ocean: no noise work
    const img=g.createImageData(w,h), D=img.data;
    for(let j=0;j<h;j++) for(let i=0;i<w;i++){ const code=TER_CODE[terrain_(cx0+i,cy0+j)], k=(j*w+i)*4, C=TR[code]; wterr.grid[(y0+j)*WW+x0+i]=code; D[k]=C[0]; D[k+1]=C[1]; D[k+2]=C[2]; D[k+3]=255; }
    g.putImageData(img,x0,y0); }
  wterr.ms+=performance.now()-t0; if(wterr.next>=wterr.chunks.length){ wterr.done=true; wown.sig=null; }
}
function territorySig(){ let h=world.setts.length+(wmv.ideas?7777:0); if(wmv.ideas) for(const f of world.factions) h=(h*17+(f.idea==null?-1:f.idea))|0; for(const s of world.setts) h=(h*31+s.f*7+Math.round(claimR(s)*2))|0; return h; }
function buildTerritory(){
  const t0=performance.now(), own=wown.own, sc=wown.sc, g=wown.cv.getContext('2d'); own.fill(-1);
  if(!wown.img) wown.img=g.createImageData(WW,WH); const D=wown.img.data; D.fill(0); const touched=[];
  for(const s of world.setts){ const r=claimR(s), X=s.cx+WORLD_X, Y=s.cy+WORLD_Y;
    for(let y=Math.max(0,Math.floor(Y-r));y<=Math.min(WH-1,Math.ceil(Y+r));y++) for(let x=Math.max(0,Math.floor(X-r));x<=Math.min(WW-1,Math.ceil(X+r));x++){
      const v=r-Math.hypot(x-X,y-Y); if(v<0) continue; const k=y*WW+x; if(own[k]<0){ touched.push(k); own[k]=s.f; sc[k]=v; } else if(v>sc[k]){ own[k]=s.f; sc[k]=v; } } }
  const FR=world.factions.map(f=>{ const I=wmv.ideas&&typeof ideaOf==='function'?ideaOf(f):null, h=wmv.ideas?(I?I.color:'#3a3a3a'):(f.color||'#888888'); return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; });
  for(const k of touched){ const t=wterr.grid[k]; if(t===0||t===1) continue; const o=own[k], x=k%WW;
    const edge=(x>0&&own[k-1]!==o)||(x<WW-1&&own[k+1]!==o)||(k>=WW&&own[k-WW]!==o)||(k<WW*(WH-1)&&own[k+WW]!==o);
    const C=FR[o], p=k*4; D[p]=C[0]; D[p+1]=C[1]; D[p+2]=C[2]; D[p+3]=edge?215:107; }
  g.putImageData(wown.img,0,0); wown.sig=territorySig(); wown.t=performance.now(); wown.ms=performance.now()-t0; wbase.pairs=null;
}
const WORLD_INFO=()=>({world:[WW,WH],terrainDone:wterr.done,terrainChunks:wterr.next+'/'+wterr.chunks.length,terrainBuildMs:Math.round(wterr.ms),territoryMs:+wown.ms.toFixed(1),claimed:world.claimed!=null?+world.claimed.toFixed(3):null});
const mapMinCell=()=>Math.max(0.8,Math.min(VW/WW,VH/WH)*0.95);   // farthest zoom shows the whole world
function drawWorld(){
  wmv.cell=clamp(wmv.cell,mapMinCell(),48); wmv.x=clamp(wmv.x,-WORLD_X,WORLD_X); wmv.y=clamp(wmv.y,-WORLD_Y,WORLD_Y);   // finite world: no panning past the edge
  const c=wmv.cell, sx=cx=>(cx-wmv.x)*c+VW/2, sy=cy=>(cy-wmv.y)*c+VH/2;
  if(!wterr.done) worldTerrainStep(12);
  if(wown.sig===null||((world.dirty||performance.now()-wown.t>2000)&&performance.now()-wown.t>500&&territorySig()!==wown.sig)){ buildTerritory(); world.dirty=false; }
  wctx.setTransform(DPR,0,0,DPR,0,0); wctx.fillStyle='#071019'; wctx.fillRect(0,0,VW,VH);   // beyond the World's Edge
  { const L=Math.max(0,Math.floor(wmv.x-VW/c/2+WORLD_X)-1), T=Math.max(0,Math.floor(wmv.y-VH/c/2+WORLD_Y)-1), R2=Math.min(WW,Math.ceil(wmv.x+VW/c/2+WORLD_X)+1), B2=Math.min(WH,Math.ceil(wmv.y+VH/c/2+WORLD_Y)+1);
    if(R2>L&&B2>T){ const dx=sx(L-WORLD_X)-c/2, dy=sy(T-WORLD_Y)-c/2, dw=(R2-L)*c, dh=(B2-T)*c; wctx.imageSmoothingEnabled=false;
      wctx.drawImage(wterr.cv,L,T,R2-L,B2-T,dx,dy,dw,dh); wctx.drawImage(wown.cv,L,T,R2-L,B2-T,dx,dy,dw,dh); }
    wctx.strokeStyle='#9fc3d855'; wctx.lineWidth=2; wctx.setLineDash([10,8]); wctx.strokeRect(sx(-WORLD_X)-c/2,sy(-WORLD_Y)-c/2,WW*c,WH*c); wctx.setLineDash([]); }
  const vis=(X,Y,m)=>X>-m&&X<VW+m&&Y>-m&&Y<VH+m;
  // diplomacy: war = red dashed, alliance = gold, trade = pale caravan dots. Capped at 40 lines (war first).
  if(typeof world.rel==='object'){
    if(!wbase.pairs||performance.now()-(wbase.pairsT||0)>2000){ const BY={}; for(const s of world.setts) (BY[s.f]=BY[s.f]||[]).push(s);
      const near=(fa,fb)=>{ let b=null,bd=1e9; const A=(BY[fa]||[]).slice(0,40), Bb=(BY[fb]||[]).slice(0,40); for(const a of A) for(const q of Bb){ const d=(a.cx-q.cx)**2+(a.cy-q.cy)**2; if(d<bd){bd=d;b=[a,q];} } return b; };
      wbase.pairs=Object.values(world.rel).filter(r=>r.state in WPRI).sort((a,b)=>WPRI[a.state]-WPRI[b.state]).map(r=>[r,near(r.a,r.b)]).filter(p=>p[1]); wbase.pairsT=performance.now(); }
    const tt=performance.now()/1000; let drawn=0; wctx.font='14px system-ui'; wctx.textAlign='center';
    for(const [r,[a,b]] of wbase.pairs){ if(drawn>=40) break; if(!(r.state in WPRI)) continue; const X1=sx(a.cx),Y1=sy(a.cy),X2=sx(b.cx),Y2=sy(b.cy);
      if(Math.max(X1,X2)<0||Math.min(X1,X2)>VW||Math.max(Y1,Y2)<0||Math.min(Y1,Y2)>VH) continue; drawn++;
      if(r.state==='war'){ wctx.strokeStyle='#ff4a3a'; wctx.lineWidth=3; wctx.setLineDash([7,5]); } else if(r.state==='allied'){ wctx.strokeStyle='#ffd36a'; wctx.lineWidth=2.5; wctx.setLineDash([]); } else { wctx.strokeStyle='#e8dcc0aa'; wctx.lineWidth=1.5; wctx.setLineDash([2,6]); }
      wctx.beginPath(); wctx.moveTo(X1,Y1); wctx.lineTo(X2,Y2); wctx.stroke();
      const mx=(X1+X2)/2, my=(Y1+Y2)/2;
      if(r.state!=='war'){ const u=(tt*0.15)%1; wctx.fillStyle='#f6e2a8'; wctx.beginPath(); wctx.arc(X1+(X2-X1)*u,Y1+(Y2-Y1)*u,2.6,0,7); wctx.fill(); }
      wctx.fillStyle=r.state==='war'?'#ff8a7a':r.state==='allied'?'#ffd36a':'#e8dcc0'; wctx.fillText(r.state==='war'?'⚔':r.state==='allied'?'☍':'⇄',mx,my+5); }
    wctx.setLineDash([]);
    for(const b of world.battles||[]) if(b.at){ const X=sx(b.at.cx),Y=sy(b.at.cy); if(!vis(X,Y,30)) continue; wctx.strokeStyle='#ff4a3a'; wctx.lineWidth=2; wctx.beginPath(); wctx.arc(X,Y,14+Math.sin(tt*6)*3,0,7); wctx.stroke(); }
  }
  wctx.font='12px system-ui,sans-serif'; wctx.textAlign='center';
  wmv.hits=[]; const cheap=c<4, LEAN={};
  for(const s of world.setts){ const X=sx(s.cx),Y=sy(s.cy); if(!vis(X,Y,50)) continue; const F=world.factions[s.f], r=3+Math.log10(Math.max(10,s.pop))*2.2*(c/18); wmv.hits.push([X,Y,r+6,s]);
    if(cheap&&!s.home&&F.capital!==s){ wctx.fillStyle=F.color; wctx.fillRect(X-r-1,Y-r-1,2*r+2,2*r+2); continue; }   // far out: one rect per small settlement
    const L=LEAN[s.f]||(LEAN[s.f]=typeof cultureLean==='function'?cultureLean(F):'mixed');
    wctx.fillStyle='#1b1712'; wctx.beginPath(); wctx.arc(X,Y,r+2,0,7); wctx.fill(); wctx.fillStyle=F.color; wctx.beginPath();
    if(L==='war'){ wctx.moveTo(X,Y-r*1.2); wctx.lineTo(X+r*1.2,Y); wctx.lineTo(X,Y+r*1.2); wctx.lineTo(X-r*1.2,Y); }
    else if(L==='piety'){ wctx.moveTo(X,Y-r*1.4); wctx.lineTo(X+r*1.2,Y+r*0.9); wctx.lineTo(X-r*1.2,Y+r*0.9); }
    else wctx.arc(X,Y,r,0,7); wctx.fill(); if(L==='open'&&!cheap){ wctx.fillStyle='#f6e2a8'; wctx.beginPath(); for(let i=0;i<6;i++){ const a=i*1.047, px=X+Math.cos(a)*(r+3), py=Y+Math.sin(a)*(r+3); wctx.moveTo(px+1.3,py); wctx.arc(px,py,1.3,0,7); } wctx.fill(); }
    if(F.capital===s){ wctx.strokeStyle='#ffe2b0'; wctx.lineWidth=2; wctx.beginPath(); wctx.arc(X,Y,r+5,0,7); wctx.stroke(); }
    { const I=typeof ideaOf==='function'?ideaOf(F):null; if(I){ wctx.strokeStyle=I.color; wctx.lineWidth=wmv.ideas?3:1.6; wctx.beginPath(); wctx.arc(X,Y,r+(F.capital===s?8:3),0,7); wctx.stroke(); } }   // v3.7: ring in the colour of the idea they hold
    if(s.ruin&&s.ruin.kind==='nuke'){ wctx.fillStyle='#ffdf5a'; wctx.fillText('☢',X+r+8,Y+4); }
    if(s.home){ wctx.fillStyle='#ff9a2a'; wctx.beginPath(); wctx.moveTo(X-3,Y+1); wctx.quadraticCurveTo(X,Y-9,X+3,Y+1); wctx.fill(); }
    if((c>=9&&s.pop>250)||c>=24||s.home||(F.capital===s&&c>=3.5)){ const tx=s.name+' · '+Math.round(s.pop).toLocaleString(); wctx.fillStyle='#000a'; wctx.fillText(tx,X+1,Y-r-5); wctx.fillStyle='#f1e6d2'; wctx.fillText(tx,X,Y-r-6); } }
  // v3.7: poisoned and sickened ground
  if(world.dis) for(const z of world.dis.blight){ const X=sx(z.cx),Y=sy(z.cy),R=Math.max(4,z.r*c); if(!vis(X,Y,R)) continue; wctx.fillStyle=z.kind==='nuke'?'rgba(255,90,40,.22)':'rgba(140,150,40,.22)'; wctx.strokeStyle=z.kind==='nuke'?'#ff7a3a':'#b8c050'; wctx.lineWidth=2; wctx.setLineDash([4,4]); wctx.beginPath(); wctx.arc(X,Y,R,0,7); wctx.fill(); wctx.stroke(); wctx.setLineDash([]); }
  // continent names over the ocean-ringed land
  { const cols=VW/c, rows=VH/c, ci=Math.round(wmv.x/CONT_CELL), cj=Math.round(wmv.y/CONT_CELL), R_=Math.ceil(Math.max(cols,rows)/CONT_CELL/2)+1; wctx.textAlign='center';
    wctx.font=`italic ${Math.round(clamp(c*2.4,13,30))}px Georgia,serif`;
    for(let a=-R_;a<=R_;a++) for(let b=-R_;b<=R_;b++){ const C=contAt(ci+a,cj+b); if(!C) continue; const X=sx(C.x), Y=sy(C.y-C.r*0.75); if(X<-200||X>VW+200||Y<-50||Y>VH+50) continue;
      wctx.fillStyle='#0008'; wctx.fillText(C.name.toUpperCase(),X+1.5,Y+1.5); wctx.fillStyle='#f3e3bccc'; wctx.fillText(C.name.toUpperCase(),X,Y);
      const D=world.dis, rid=C.id!=null?C.id:null; if(D&&rid!=null&&D.res[rid]!=null){ const q=D.res[rid]/D.resMax[rid]; if(q<0.3){ const f2=wctx.font; wctx.font='12px system-ui'; wctx.fillStyle=q<0.08?'#ff7a6a':'#ffb35c'; wctx.fillText(q<0.08?'⛏ mines spent':'⛏ ore & fuel scarce ('+Math.round(q*100)+'%)',X,Y+16); wctx.font=f2; } } } }
  wctx.font='12px system-ui,sans-serif';
  if(!wdrag&&performance.now()-(wmv.legT||0)>1000){ wmv.legT=performance.now(); drawWorldLegend(); }
}
function drawWorldLegend(){
  const F=world.factions.filter(f=>f.setts>0).sort((a,b)=>b.pop-a.pop);
  const bi=document.getElementById('wmideas'); if(bi){ bi.textContent=wmv.ideas?'🗺 Peoples (I)':'💡 Ideas (I)'; bi.classList.toggle('on',!!wmv.ideas); }
  if(wmv.ideas&&typeof ideaOf==='function'){ const I=(world.ideas||[]).filter(i=>i.peoples>0).sort((a,b)=>b.pop-a.pop), S=world.ideaStats||{};
    document.querySelector('#wmside h3').textContent='Ideas & philosophies';
    document.getElementById('wmleg').innerHTML=(I.length?I.slice(0,14).map(i=>`<div class="fac"><span class="sw" style="background:${i.color}"></span><div><b>${cap(i.name)}</b><br><span style="opacity:.75">“${i.gloss}” · ${ideaLine(i)} · from ${i.originName==='Ash Hollow'?'Ash Hollow':'the '+i.originName+'-folk'}${i.cont?' of '+i.cont:''} · held by ${i.peoples} people${i.peoples>1?'s':''} (${Math.round(i.pop).toLocaleString()})</span></div></div>`).join(''):'<div style="opacity:.7">No idea has taken root anywhere yet. Peoples coin ideas once they keep myths and reach the Iron Age.</div>')+
      `<div style="opacity:.6;margin-top:6px;font-size:11px">${S.born||0} ideas born · ${S.adopt||0} times taken up by another people · ${S.extinct||0} forgotten. Duller peoples adopt more readily; sharper ones question and coin their own.</div>`; return; }
  document.querySelector('#wmside h3').textContent='Peoples & realms';
  document.getElementById('wmleg').innerHTML=F.slice(0,14).map(f=>`<div class="fac" data-f="${f.id}" title="Click to watch this people" style="cursor:pointer"><span class="sw" style="background:${f.color}"></span><div><b>${govName(f.gov)} of ${f.home?coinRealm():f.root}</b>${f.home?' (Ash Hollow)':''}<br><span style="opacity:.75">${(continentOf(f.capital.cx,f.capital.cy)||{name:'?'}).name} · ${typeof cultureLean==='function'?CULT_ADJ[cultureLean(f)]:''} · rivalry ${(pressMult(f)).toFixed(1)}× · ${Math.round(f.pop).toLocaleString()} people · ${f.setts} settlement${f.setts>1?'s':''}${f.ruler?' · led by '+f.ruler:''}${!f.home&&relOf(0,f.id)?' · '+STATE_ICON[relOf(0,f.id).state]+' '+relOf(0,f.id).state+' with Ash Hollow':''}</span></div></div>`).join('')+(F.length>14?`<div style="opacity:.6">…and ${F.length-14} more peoples</div>`:'');
  document.getElementById('wmsub').textContent=`${Math.round(totalPop()).toLocaleString()} people · ${world.setts.length} settlements · ${F.length} peoples · a finite world of ${(()=>{let n=0;for(let i=-WORLD_CI;i<=WORLD_CI;i++)for(let j=-WORLD_CJ;j<=WORLD_CJ;j++)if(contAt(i,j))n++;return n;})()} continents · ${world.claimed!=null?Math.round(world.claimed*100):0}% of the land claimed — drag to explore, wheel to zoom · click a settlement to watch it`;
}
function openWorld(b){ if(b&&!world.unlocked) return; wmv.open=b; wm.style.display=b?'block':'none'; if(b){ wmv.x=0; wmv.y=0; wmv.legT=0; world.dirty=true; drawWorld(); } }
let wdrag=null;
wmc.addEventListener('mousedown',e=>{ wdrag={x:e.clientX,y:e.clientY,vx:wmv.x,vy:wmv.y,moved:false}; });
addEventListener('mouseup',e=>{ if(wdrag&&!wdrag.moved&&wmv.open&&e.target===wmc){ let best=null,bd=1e9; for(const [X,Y,r,s] of wmv.hits||[]){ const d=Math.hypot(e.clientX-X,e.clientY-Y); if(d<r&&d<bd){bd=d;best=s;} } if(best) watchSett(best); } wdrag=null; });
function watchSett(s){ openWorld(false); if(s.home) endVisit(); else startVisit(s); manual(); dir.manualT=0; visit.auto=0; }
document.getElementById('wmleg').addEventListener('click',e=>{ const el=e.target.closest('[data-f]'); if(!el) return; const f=+el.dataset.f, ss=world.setts.filter(s=>s.f===f).sort((a,b)=>b.pop-a.pop); if(ss[0]) watchSett(ss[0]); });
addEventListener('mousemove',e=>{ if(wdrag&&wmv.open&&Math.hypot(e.clientX-wdrag.x,e.clientY-wdrag.y)>4) wdrag.moved=true; if(wdrag&&wmv.open&&wdrag.moved){ wmv.x=wdrag.vx-(e.clientX-wdrag.x)/wmv.cell; wmv.y=wdrag.vy-(e.clientY-wdrag.y)/wmv.cell; wmv.need=true; } });   // v3.6.2: coalesced to one draw per frame
wmc.addEventListener('wheel',e=>{ e.preventDefault(); wmv.cell=clamp(wmv.cell*(e.deltaY<0?1.15:1/1.15),mapMinCell(),48); wmv.zoomT=performance.now(); wmv.need=true; },{passive:false});
document.getElementById('wmclose').onclick=()=>openWorld(false);
function toggleIdeas(){ wmv.ideas=!wmv.ideas; wown.sig=null; wmv.legT=0; wmv.need=true; drawWorld(); }
document.getElementById('wmideas').onclick=toggleIdeas;

/* ---------------------------------- UI ---------------------------------- */
const $=id=>document.getElementById(id);
let paused=false, speed=1, placing=false; const mouse={x:0,y:0,wx:0,wy:0,down:false,drag:false};
const ERA_TASK=[null,null,null,{forage:'working the fields',sticks:'carting timber',haul:'hauling goods',build:'building in brick',craft:'at the workshop',hunt:'out hunting',farm:'working the fields',feed:'stoking the hearth',ritual:'at the assembly'},
  {forage:'at the market garden',sticks:'at the sawmill',haul:'driving a cart',build:'wiring a new house',craft:'at the factory',farm:'driving the plough-engine',feed:'tending the furnace',ritual:'at the assembly'},
  {forage:'at the grocery hall',sticks:'at the materials plant',haul:'running deliveries',build:'raising a tower',craft:'at the lab',farm:'running the farm machines',feed:'checking the power',ritual:'at the gathering'}];
function stateText(v){ const k=v.task?v.task.kind:'idle', ET=ERA_TASK[HSTYLE?HSTYLE.era:0]; if(ET&&ET[k]) return ET[k]; return ({idle:fireLit()?'sitting by the fire':'resting',wander:'wandering',eat:'eating from the pile',forage:v.task&&v.task.root?'digging roots':'gathering berries',pickstick:'picking up a good stick',sticks:'gathering sticks',haul:'hauling sticks',build:'building',craft:'shaping a tool',hunt:v.tool>=2?'hunting skitters':'chasing a skitter bare-handed',flint:'knapping flint',farm:'tending the planted patch',flee:'fleeing to safety',fight:v.puppet?(v.enemy?'raiding':'defending the village'):'facing the Gloamjaw',pray:v.task&&v.task.cower?'cowering in fear':'praying',ritual:v.isLead?'leading the rite':'at the rite',feed:'feeding the fire',relight:'striking sparks',brand:v.carry?'carrying fire home!':'running to the burning tree',ponder:'watching, wondering',tend:'caring for a child',sleep:v.home?'asleep in a '+(v.home.type==='hut'?'hut':'lean-to'):v.sleepSpot==='cave'?'asleep in the cave':'asleep in the open'})[k]||k; }
const meter=(l,val,c)=>`<div class="lbl"><span>${l}</span><span>${Math.round(val)}</span></div><div class="meter"><i style="width:${clamp(val,0,100)}%;background:${c}"></i></div>`;
const TOOLN=['bare hands','a stick','a pointed stick','a flint-tipped spear','a copper spear','a bronze spear','an iron spear','a steel spear','a musket'];
const SPEECH=['no words — only cries','first sounds (no meanings)','shared words','myths'];
const TR_L={wit:'Wit',bold:'Boldness',hands:'Hands',care:'Care',forage:'Foraging',social:'Talk'};
function trBars(v){ return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px 8px;margin:3px 0 6px">`+TRAITS.map(k=>`<div style="font-size:10px;opacity:.85">${TR_L[k]}<div class="meter" style="margin:1px 0"><i style="width:${clamp((v.tr[k]-0.5)/1.1*100,4,100)}%;background:${k===v.type?'#ffb35c':'#8a7a60'}"></i></div></div>`).join('')+`</div>`; }
function iqWord(q){ return q>=1.35?'a learned people':q>=1.15?'sharp, restless minds':q>=0.95?'steady minds':'slow to question'; }
function craft37(f){ if(typeof stapleOf!=='function'||!knows('planting')) return ''; const ST=stapleOf(f), GD=goodOf(f), out=[];
  out.push(`🌾 Staple: <b style="color:${ST.color}">${ST.name}</b> (${AGRI[ST.sys]?AGRI[ST.sys].n:ST.sys})`);
  out.push(`⇄ They trade <b>${GD.name}</b>`+((f.goodsIn&&f.goodsIn.length)?` for ${f.goodsIn.map(([g,o])=>g+' from the '+o+'-folk').join(', ')}`:' — no trading partners with other goods yet'));
  const rr=typeof resRatio==='function'?resRatio(f):1; if(fEra(f)>=2) out.push(`⛏ Ore &amp; fuel at home: <b style="color:${rr<0.08?'#ff7a6a':rr<0.3?'#ffb35c':'inherit'}">${Math.round(rr*100)}%</b>${rr<0.08?' — spent':rr<0.3?' — scarce':''}`);
  if((f.harm||0)>0.15) out.push(`☁ Strain on the land: <b style="color:${f.harm>0.7?'#ff7a6a':'#ffb35c'}">${Math.round(f.harm*100)}%</b>${f.harm>0.7?' — the fields may fail':''}`);
  if(home.bl!=null&&home.bl<1) out.push(`<span style="color:#ff9a7a">☠ Harvests here at ${Math.round(home.bl*100)}% — poisoned or sickened ground</span>`);
  if(world.dis&&world.dis.winterT>tribe.time) out.push(`<span style="color:#c8c8d8">❄ Nuclear winter — harvests fail worldwide</span>`);
  if(f.fallen) out.push(`<span style="opacity:.8">Fell from the ${f.fallen.from} to the ${f.fallen.to} — ${AGES[fAge(f)].n===f.fallen.from?'rebuilt':'rebuilding, step by step'}</span>`);
  return `<div style="font-size:11px;margin-top:4px;line-height:1.45">${out.join('<br>')}</div>`; }
function updateUI(){
  const L=langLevel(), f=world.factions[0];
  const nxt=AGES[tribe.age+1], key=nxt&&nxt.key;
  $('age').textContent=ageName(); $('agesub').textContent='· '+AGES[tribe.age].sub+(tribe.latest?' · latest: '+tribe.latest:'');
  let prog=1; if(nxt&&nxt.test){ const id=nextInvention(knows,pathOf(f)); prog=id?(tribe.ideas[id]||0)/INV[id].need:1; } else if(key){ prog=key==='fire'?(knows('sticks')?0.5:Math.min(.5,(tribe.ideas.sticks||0)/INV.sticks.need*0.5)):(prereqOK(key)?(tribe.ideas[key]||0)/INV[key].need:0.1); }
  $('lorefill').style.width=clamp(prog*100,0,100)+'%';
  $('gov').textContent=govName(f.gov)+(f.ruler?' · '+f.ruler:'');
  $('clock').textContent=`${season()} · ${fmtYear(nowDay())} · ${phaseName()}${tribe.ritual?' · ✦ rite':''}`;
  $('speech').textContent='Speech: '+SPEECH[L];
  const lp=huntingPreds().length, tp=Math.round(totalPop());
  $('pop').innerHTML=`People ${tp.toLocaleString()}${lp?` · <span style="color:#ff9a7a">Gloamjaw!</span>`:''}`;
  const v=cam.follow||dir.focus;
  $('visiting').style.display=visit.on&&!wmv.open?'block':'none'; if(visit.on) $('visiting').innerHTML=`Watching <b>${visit.s.name}</b> — ${govName(visit.f.gov)} of ${visit.f.root} · ${Math.round(visit.s.pop).toLocaleString()} people${visit.auto>0?' · <i>a glance — back soon</i>':''} <button onclick="endVisit()">⌂ Back to Ash Hollow (H)</button>`;
  $('sel').innerHTML = v&&!v.dead ? `<b style="font-size:14px">${v.name}</b> <span style="color:#ffb35c">· ${TYPES[v.type]}</span>${v.child?' · child':''}${v.role?` · <b>${v.role}</b>`:''}${v.isLead?' · Fire-Singer':''}<br><i style="opacity:.7;font-size:11px">${TYPE_NOTE[v.type]}</i><br><span style="opacity:.85">${stateText(v)} · feels ${v.mood}</span>`+trBars(v)+
     meter('Hunger',v.hunger,'#d9a23a')+meter('Fear',v.fear,'#c84a3a')+meter('Faith',v.faith,'#9a7ad0')+
     `<div style="font-size:12px">Holds: ${TOOLN[v.tool]} · deeds ${v.deeds}</div>`+(v.thought?`<div style="font-size:12px;margin-top:4px">“${v.thought}”${v.gloss?` <i style="opacity:.65">— ${v.gloss}</i>`:''}</div>`:'')+(cam.follow?'':'<div style="font-size:10px;opacity:.5;margin-top:3px">(the director is watching this person)</div>')
     : '<span style="opacity:.7">The director will show you what matters. Click anyone to watch them yourself.</span>';
  const ng=GOV[f.gov+1];
  const roles=['Ruler','Chief','Elder'].map(r=>{ const p=villagers.find(x=>x.role===r&&!x.dead); return p?`${r}: <b>${p.name}</b>`:''; }).filter(Boolean); const FS=villagers.find(x=>x.isLead&&!x.dead); if(FS) roles.push(`Fire-Singer: <b>${FS.name}</b>`);
  const rivals=world.factions.filter(x=>!x.home&&x.setts>0).length;
  $('realm').innerHTML=`<div style="font-size:12px"><b>${govName(f.gov)}</b>${ng?` <span style="opacity:.6">→ ${ng.n} at ${ng.min} people${ng.sett?', '+ng.sett+' settlements':''}</span>`:''}<br>${roles.length?roles.join(' · '):'<span style="opacity:.6">no leaders yet</span>'}<br>`+
    `${tp.toLocaleString()} people (${alive().length} watched up close${home.extra>=1?`, ${Math.round(home.extra).toLocaleString()} more in the outlying huts`:''})<br>${world.setts.length} settlement${world.setts.length>1?'s':''}${rivals?` · ${rivals} rival people${rivals>1?'s':''}`:''}<br>`+
    (knows('hut')&&typeof archOf==='function'?(()=>{const A=archOf(f);return `Culture: <b>${CULT_ADJ[A.lean]}</b> · ${A.shape} houses${A.agri?' · '+AGRI[A.agri].n:''}${A.mark?' · mark of the '+A.mark:''}<br>`+(A.gene?`<span style="opacity:.8">Builders: the <b>${A.gene.style}</b> style · towns of ${LAYOUT_N[A.layout]||A.layout}</span><br>`:'');})():'')+(typeof canThink==='function'&&canThink(f)?`<span title="Intellect rises with schooling, trade and wealth, and falls with war, isolation and disaster. Sharper peoples question and invent more; duller ones take up others' ideas more readily." style="color:${iqOf(f)>=1.15?'#9fd4ff':iqOf(f)<0.95?'#c8a080':'inherit'}">Intellect ${iqOf(f).toFixed(2)} — ${iqWord(iqOf(f))}${(f.doubt||0)>1.5?' · <i>questioning the old ideas</i>':''}</span><br>`:'')+(knows('planting')?`<span title="Rival pressure: nearby rivals, wars and trade competition speed up ideas; a people alone plateaus" style="color:${pressMult(f)>=1.15?'#ffb35c':pressMult(f)<0.8?'#9ab0c8':'inherit'}">Rivalry: ideas ${pressMult(f).toFixed(1)}×${pressMult(f)<0.8?' (no rivals — slow)':''}</span><br>`:'')+(world.unlocked?'<span style="color:#9fd48a">World map open (M)</span>':`<span style="opacity:.6">World map at ${WORLD_UNLOCK.toLocaleString()} people</span>`)+`</div>`;
  const MATS={fire:1,flint:1,copper:1,bronze:1,iron:1,steel:1};
  const known=Object.keys(INV).filter(id=>knows(id)&&!MATS[id]), stir=Object.keys(INV).filter(id=>!knows(id)&&!INV[id].event&&prereqOK(id)&&(tribe.ideas[id]||0)>0).sort((a,b)=>(tribe.ideas[b]/INV[b].need)-(tribe.ideas[a]/INV[a].need)).slice(0,3);
  const knownAll=known.length; if(known.length>14) known.splice(0,known.length-14);
  $('inv').innerHTML=(knownAll>14?`<div style="opacity:.6;font-size:11px">…${knownAll-14} earlier inventions</div>`:'')+(known.length?known.map(id=>`<div>✓ <b>${INV[id].name}</b></div>`).join(''):'<div style="opacity:.6">nothing yet — bare hands</div>')+
    (stir.length?'<div style="opacity:.6;margin-top:4px;font-size:11px">STIRRING</div>'+stir.map(id=>`<div style="opacity:.85">${INV[id].name}<div class="meter"><i style="width:${(tribe.ideas[id]/INV[id].need*100).toFixed(0)}%;background:#8fb0d0"></i></div></div>`).join(''):'')+
    (!fireLit()&&knows('sticks')&&!knows('fire')?'<div style="opacity:.7;font-size:11px">waiting for sky-fire…</div>':'');
  const B=tribe.beliefs, w=tribe.words, bl=[];
  if(B.fire) bl.push(['the Fire that Watches',w&&w.fire]); if(B.tooth) bl.push(['the Tooth in the Dark',w&&w.tooth]); if(B.stone) bl.push(['the Stone that Listens',w&&w.stone]); if(B.seed) bl.push(['the Mother Under',w&&w.bury]); if(B.warmyth) bl.push([tribe.warMyths?'the Spear that Remembers':'the Long Grief',w&&w.keep]); if(B.watcher) bl.push(['the Watcher beyond the sky',w&&w.see]);
  // v3.6: materials are NOT beliefs — they live in the Crafting & resources card
  const MAT=[['fire','Kept fire','fire'],['flint','Knapped stone (flint)','stone'],['copper','Copper','copper'],['bronze','Bronze','bronze'],['iron','Iron','iron'],['steel','Steel','steel']];
  const mk=MAT.filter(m=>knows(m[0]));
  $('craft').innerHTML=(mk.length?mk.map(m=>`<div>⚒ <b>${m[1]}</b></div>`).join(''):'<div style="opacity:.6">bare hands — no worked materials yet</div>')+
    `<div style="font-size:11px;opacity:.75;margin-top:3px">Stores: food ${Math.round(tribe.food)} · sticks ${tribe.sticks} · flint ${tribe.flint} · best tool: ${TOOLN[maxTier()]}</div>`+craft37(f);
  const FA=faithOf(world.factions[0]);
  if(FA.name) bl.unshift([`<span style="color:#ffb35c">${FA.name}</span> <span style="opacity:.7;font-weight:normal">(${FA.kind}${FA.ideology?' · '+FA.ideology:''})</span>`,null,true]);
  { const I=typeof ideaOf==='function'?ideaOf(f):null; if(I) bl.splice(FA.name?1:0,0,[`<span style="color:${I.color}">${cap(I.name)}</span> <span style="opacity:.75;font-weight:normal;font-size:11px">“${I.gloss}” — ${ideaLine(I)}; a ${I.form} born among ${I.originName==='Ash Hollow'?'Ash Hollow':'the '+I.originName+'-folk'} in ${I.year<=0?(-I.year||1).toLocaleString('en-US')+' BCE':I.year+' CE'}, held by ${I.peoples} people${I.peoples>1?'s':''}</span>`,null,true]); }
  $('beliefs').innerHTML=bl.length?bl.map((b,i)=>`<div style="${FA.name&&i>0?'opacity:.7;font-size:11px;padding-left:8px':''}">${FA.name&&i===1?'<div style="font-size:10px;opacity:.7">ROOTS</div>':''}✦ <b>${b[0]}</b>${b[2]?'':b[1]?` <i>— “${b[1]}”</i>`:' <i>(no word for it yet)</i>'}</div>`).join(''):'<div style="opacity:.6">none — they only feel fear</div>';
  $('log').innerHTML=tribe.log.map(e=>`<div><span style="opacity:.5">${fmtYear(e.d)}</span> ${e.msg}</div>`).join('');
  $('bPause').textContent=paused?'▶ Resume':'⏸ Pause'; $('bPause').classList.toggle('on',paused); $('paused').style.display=paused?'block':'none';
  { const yl=strangerYearsLeft(), ok=canSpawnStranger(); $('bStranger').disabled=!ok; $('bStranger').textContent=STRANGER?'🧭 A stranger is here':ok?'🧭 A stranger (X)':yl>0?`🧭 Stranger in ${Math.round(yl).toLocaleString()} yrs`:'🧭 A stranger (X)'; }
  $('bSpeed').textContent=`Speed ${speed}×`+(!paused&&speed>=16&&simEff>0&&simEff<speed*0.85?` (≈${Math.round(simEff)}× here)`:''); $('bPred').classList.toggle('on',placing);
  $('bDir').textContent=dir.on?(dir.manualT>0?`🎥 Director resumes in ${Math.ceil(dir.manualT)}s`:'🎥 Director on'):'🎥 Director off'; $('bDir').classList.toggle('on',dir.on);
  const others=world.factions.filter(x=>!x.home&&x.setts>0).length;
  $('bWatch').disabled=!others&&!visit.on; $('bWatch').textContent=visit.on?`👁 ${visit.s.name} (${visit.f.root}) · next ▸`:`👁 Watch another people${others?` (${others})`:''}`; $('bWatch').classList.toggle('on',visit.on);
  $('saved').textContent=window.__noSave?'autosave off (test/demo URL)':lastSave?`saved ${Math.round((performance.now()-lastSave)/1000)}s ago`:'not saved yet';
  $('bWorld').disabled=!world.unlocked; $('bWorld').title=world.unlocked?'M':`Unlocks at ${WORLD_UNLOCK.toLocaleString()} people (now ${tp.toLocaleString()})`;
}
function screenToWorld(sx,sy){ return {x:(sx-VW/2)/cam.z+cam.x, y:(sy-VH/2)/cam.z+cam.y}; }
cv.addEventListener('mousedown',e=>{ mouse.down=true; mouse.drag=false; mouse.sx=e.clientX; mouse.sy=e.clientY; mouse.cx=cam.x; mouse.cy=cam.y; });
addEventListener('mousemove',e=>{ const w=screenToWorld(e.clientX,e.clientY); mouse.wx=w.x; mouse.wy=w.y;
  if(mouse.down&&!wmv.open){ const dx=e.clientX-mouse.sx, dy=e.clientY-mouse.sy; if(Math.hypot(dx,dy)>5){ mouse.drag=true; manual(); cam.follow=null; cam.x=mouse.cx-dx/cam.z; cam.y=mouse.cy-dy/cam.z; } } });
addEventListener('mouseup',e=>{ if(mouse.down&&!mouse.drag&&e.target===cv){ const w=screenToWorld(e.clientX,e.clientY);
    if(placing&&!visit.on){ spawnPred(w.x,w.y); placing=false; }
    else { let best=null,bd=26/cam.z+8; for(const v of (visit.on?visit.cast.concat(visit.enemies):alive())){ const d=Math.hypot(v.x-w.x,(v.y-12)-w.y); if(d<bd){bd=d;best=v;} } if(best){ cam.follow=best; manual(); } }
    updateUI(); }
  mouse.down=false; });
cv.addEventListener('wheel',e=>{ e.preventDefault(); manual(); const w=screenToWorld(e.clientX,e.clientY); cam.z=clamp(cam.z*(e.deltaY<0?1.12:1/1.12),0.35,3.5); if(!cam.follow){ cam.x=w.x-(e.clientX-VW/2)/cam.z; cam.y=w.y-(e.clientY-VH/2)/cam.z; } },{passive:false});
const keys={};
addEventListener('keydown',e=>{ const k=e.key.toLowerCase(); keys[k]=true;
  if(k===' '){ paused=!paused; e.preventDefault(); } else if(k==='p') spawnPred(); else if(k==='x') spawnStranger(); else if(k==='c'){ dir.on=!dir.on; dir.manualT=0; } else if(k==='m') openWorld(!wmv.open); else if(k==='i'&&wmv.open) toggleIdeas(); else if(k==='v'){ cycleWatch(); visit.auto=0; } else if(k==='h') endVisit();
  else if(k==='escape'){ placing=false; cam.follow=null; dir.manualT=0; if(wmv.open) openWorld(false); else if(visit.on) endVisit(); }
  else if(k==='1') speed=1; else if(k==='2') speed=2; else if(k==='3') speed=4; else if(k==='4') speed=8; else if(k==='5') speed=16; else if(k==='6') speed=25; else if(k==='7') speed=50;
  else if(k==='='||k==='+'){ manual(); cam.z=clamp(cam.z*1.15,.35,3.5); } else if(k==='-'){ manual(); cam.z=clamp(cam.z/1.15,.35,3.5); }
  updateUI(); });
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
$('bPause').onclick=()=>{paused=!paused;updateUI();};
$('bSpeed').onclick=()=>{const SPEEDS=[1,2,4,8,16,25,50]; const i=SPEEDS.indexOf(speed); speed=SPEEDS[(i<0?0:i+1)%SPEEDS.length]; updateUI();};
$('bDir').onclick=()=>{ if(dir.manualT>0){ dir.manualT=0; dir.on=true; } else dir.on=!dir.on; updateUI(); };
$('bWorld').onclick=()=>openWorld(true);
$('bWatch').onclick=()=>{ cycleWatch(); visit.auto=0; updateUI(); };
$('bNew').onclick=()=>{ if(!confirm('Start a NEW world? The current world (saved automatically) will be erased.')) return; window.__noSave=true; wipeSave(); location.href=location.pathname+'?new=1'; };
$('bStranger').onclick=()=>{ spawnStranger(); updateUI(); };
$('bPred').onclick=e=>{ if(e.shiftKey) spawnPred(); else placing=!placing; updateUI(); };
addEventListener('resize',resize);

/* --------------------------------- boot --------------------------------- */
genWorld(); paintBG(); resize();
const N=clamp((+Q.get('n'))||4,2,12);
if(SAVED){ restore(SAVED); dir.on=SAVED.prefs.director!==false; speed=([1,2,4,8,16,25,50].includes(SAVED.prefs.speed)?SAVED.prefs.speed:1); cam.x=FIRE.x; cam.y=FIRE.y-60;
  director(null,{caption:'The world resumes',sub:`${fmtYear(nowDay())} · ${ageName()} · ${Math.round(totalPop()).toLocaleString()} people — saved ${new Date(SAVED.savedAt).toLocaleString()}`,big:true}); }
else {
for(let i=0;i<N;i++) mkVillager(CAVE_IN.x+R(-30,30),CAVE_IN.y+R(30,70));
log(`${['','one','two','three','four','five','six'][N]||N} people shelter in a cave under the ridge. No fire, no tools, no words.`);
director(null,{caption:`${N} people. No fire, no tools, no words.`,sub:'sit back — they will have to invent everything',big:true}); }
function fastForward(sec,dt){ dt=dt||0.05; const n=Math.ceil(sec/dt); for(let i=0;i<n;i++) step(dt); }
if(Q.get('ff')) fastForward(+Q.get('ff'),0.1);
if(Q.get('demo')==='world'){ let g=0; while(!world.unlocked&&g++<900) fastForward(10,0.1); dir.q.length=0; capQ.length=0; openWorld(true); }
if(Q.get('zoom')) cam.z=+Q.get('zoom');
if(Q.get('director')==='off') dir.on=false;
let last=performance.now(), uiT=0, simEff=0; const SIM_BUDGET_MS=14;
function frame(now){
  const rdt=Math.min(0.05,(now-last)/1000); last=now;
  /* v3.6.5 speed ladder 1·2·4·8·16·25·50. High speeds use bigger local sub-steps and batch the world layer
     (SIM_BATCH), and the sim gets a per-frame time budget (SIM_BUDGET_MS): if a slow machine cannot keep up,
     the rest of that frame's sim time is dropped (the game runs a bit slower than nominal instead of freezing);
     the speed button then shows the speed actually achieved. */
  if(!paused){ const sub=speed>=50?0.125:speed>=25?0.1:0.05, vsub=speed>=25?0.25:0.1; SIM_BATCH=speed>=50?0.5:speed>=16?0.25:0;
    const t0=performance.now(), want=rdt*speed; let d=want;
    while(d>1e-6){ const s=Math.min(sub,d); step(s); d-=s; if(performance.now()-t0>SIM_BUDGET_MS) break; }
    let vd=want-d; while(vd>1e-6){ const q=Math.min(vsub,vd); visitStep(q); vd-=q; }
    simEff=simEff*0.9+((want-d)/Math.max(1e-6,rdt))*0.1; } else simEff=0;   /* FIX: was rdt*min(speed,2) — visited people ran at ≤2× while the world ran at speed; now same multiplier, sub-stepped */
  if(!window.__noSave&&(performance.now()-lastSave>45000||(saveSoon&&performance.now()-lastSave>4000))) saveNow();
  const pan=420/cam.z*rdt; for(const [k,dx,dy] of [['w',0,-1],['arrowup',0,-1],['s',0,1],['arrowdown',0,1],['a',-1,0],['arrowleft',-1,0],['d',1,0],['arrowright',1,0]]) if(keys[k]){ cam.x+=dx*pan; cam.y+=dy*pan; cam.follow=null; manual(); }
  updateDirector(rdt);
  if(cam.follow){ if(cam.follow.dead) cam.follow=null; else { const fx=cam.follow.inCave?CAVE.x:cam.follow.x, fy=cam.follow.inCave?CAVE.y:cam.follow.y; cam.x+=(fx-cam.x)*Math.min(1,rdt*5); cam.y+=(fy-12-cam.y)*Math.min(1,rdt*5); } }
  if(visit.on){ cam.x=clamp(cam.x,0,VW_W); cam.y=clamp(cam.y,0,VW_H); } else { cam.x=clamp(cam.x,0,W); cam.y=clamp(cam.y,0,H); }
  if(!wmv.open){ if(visit.on) renderVisit(now/1000); else render(now/1000); } else { wmv.drawT-=rdt; if(wmv.need||wmv.drawT<=0){ wmv.drawT=0.2; wmv.need=false; drawWorld(); } }   // v3.6.2: overlay 5 fps idle, every frame while dragging/zooming (base is cached)
  if(world.unlocked&&!wterr.done&&!wmv.open) worldTerrainStep(3);   // v3.6.4: pre-bake the planet's terrain in the background, ~3 ms a frame
  uiT-=rdt; if(uiT<=0){ uiT=0.25; updateUI(); }
  requestAnimationFrame(frame);
}
updateUI(); requestAnimationFrame(frame);
// test/debug hook — used by tools/shoot.py; no effect on normal watching
window.SIM={saveNow,loadSave,wipeSave,visit,startVisit,endVisit,cycleWatch,SAVED:!!SAVED,tribe,villagers,preds,world,home,AGES,INV,Mind,RuleMind,LlmMind,step:fastForward,spawnPred,cam,dir,phaseName,langLevel,totalPop,openWorld,govName,
  setPaused:b=>{paused=b;updateUI();}};
