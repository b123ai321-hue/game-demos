window.__auto={q:{battle:0,capture:0,rally:0,research:0},right:0,wrong:0,numeric:0,listen:0,builds:0,recruits:0,dips:[]};
window.autoAnswer=function(pRight){const c=DOTS.curQ;if(!c)return false;const A=window.__auto;A.q[c.kind]=(A.q[c.kind]||0)+1;
  const good=Math.random()<pRight;if(c.q.s)A.listen++;
  if(c.choices){let i=c.choices.findIndex(x=>x.ok);if(!good)i=(i+1+Math.floor(Math.random()*3))%4;document.querySelector(`.choice[data-i="${i}"]`).click();}
  else{A.numeric++;document.getElementById('num').value=good?String(c.q.n):String(c.q.n+7);document.getElementById('numSub').click();}
  if(DOTS.curQ.ok)A.right++;else A.wrong++;
  document.getElementById('qCont').click();return true;};
// resolve a peace offer through the real buttons (alternate puppet / peace)
window.autoDip=function(){if(getComputedStyle(document.getElementById('dipov')).display!=='flex')return false;const A=window.__auto;const ch=A.dips.length%4===3?'dipPeace':'dipPuppet';
  A.dips.push(document.getElementById('dipT').textContent+' -> '+ch);document.getElementById(ch).click();return true;};
window.autoPlayer=function(){const G=DOTS.G,P=DOTS.provs,PL=DOTS.PL;G.noSkirmish=true;  // the bot auto-resolves: skirmish prompts are for humans
  const A=window.__auto;A.decl=A.decl||[];A.lastDecl=A.lastDecl||0;
  const capName=P.find(p=>p.orig===PL&&p.type==='capital').name;
  // economy: workshops/barracks first, then research, then recruit divisions
  const mine=P.filter(p=>p.owner===PL);
  for(const p of mine){if(!p.workshop&&G.money>=110&&DOTS.build(p.id,'workshop')){A.builds++;break;}if(!p.barracks&&G.money>=140&&DOTS.build(p.id,'barracks')){A.builds++;break;}}
  if(G.money>=120&&!G.modal){const t=DOTS.TECH.find(t=>!G.tech[t[0]]&&!((G.techCd[t[0]]||0)>G.t)&&G.money>=t[2]);if(t){DOTS.research(t[0]);return;}}
  if(G.money>=120&&G.mp>=10){const fr=mine.filter(p=>DOTS.ADJ()[p.id].some(e=>DOTS.rel(P[e.to].owner)==='war'));const c=fr.length?fr[Math.floor(Math.random()*fr.length)]:P.find(p=>p.name===capName);if(DOTS.recruit(c.id))A.recruits++;}
  const friendly=o=>['me','puppet','ally'].includes(DOTS.rel(o));
  // diplomacy test (not for the small Black Knights): ally with a neutral side, later betray it once
  if(PL!=='BK'&&!G.modal){if(!A.allied&&G.t>100){const k=Object.keys(DOTS.BLOC).concat(['CF','IN','ME','AU']).find(k=>k!==PL&&DOTS.rel(k)==='peace'&&DOTS.ownedN(k)>0);if(k&&DOTS.offerAlliance(k))A.allied=k;}
    else if(A.allied&&!A.betrayed&&G.t>400&&DOTS.rel(A.allied)==='ally'){A.betrayed=A.allied;DOTS.betray(A.allied);return;}}
  // tactics (only when ready): Checkmate on a surrounded enemy capital, Landslide on enemy squads in hills/mountains, Feint on a front province
  if(!G.modal){const tk=k=>{A.tac=A.tac||{};A.tac[k]=(A.tac[k]||0)+1;};
    for(const p of P)if(DOTS.tacOK('mate',p.id)&&DOTS.tactic('mate',p.id)){tk('mate');return;}
    let bl=null;for(const p of P)if(DOTS.tacOK('land',p.id)&&DOTS.hostStr(p.id,PL)>3&&(!bl||DOTS.hostStr(p.id,PL)>DOTS.hostStr(bl.id,PL)))bl=p;if(bl&&DOTS.tactic('land',bl.id)){tk('land');return;}
    const fr=mine.find(p=>p.type!=='capital'&&DOTS.armies().filter(a=>a.owner===PL&&a.prov===p.id).length>=2&&DOTS.ADJ()[p.id].some(e=>DOTS.rel(P[e.to].owner)==='war'));if(fr&&DOTS.tactic('feint',fr.id)){tk('feint');return;}}
  // Geass: when charged, target the enemy province next to us holding the strongest enemy squad
  if(!G.modal&&!((G.geassCd||0)>G.t)){let best=null,bs=0;for(const p of P){if(DOTS.rel(p.owner)!=='war'||!DOTS.ADJ()[p.id].some(e=>friendly(P[e.to].owner)))continue;const h=DOTS.hostStr(p.id,PL)+(p.type==='capital'?0:0.5);if(h>bs){bs=h;best=p;}}
    if(best){G.geassAim=false;if(DOTS.geass()&&DOTS.geassClick(best.id)){A.geass=(A.geass||0)+1;return;}}}
  if(!G.auto){  // with 🤖 Auto ON (the default) the game itself moves idle units; we only steer when it is off
  // units (direct orders, same as box-selecting units then clicking a province): for each target, gather enough
  // nearby idle units and send them together; defend invaded provinces first, prefer capitals
  const D=DOTS.DIST(),friendly=o=>['me','puppet','ally'].includes(DOTS.rel(o));A.orders=A.orders||0;
  let idle=DOTS.armies().filter(a=>a.owner===PL&&a.role!=='king'&&!a.path.length&&DOTS.rel(P[a.prov].owner)!=='war'&&!(DOTS.hostStr(a.prov,PL)>0));
  const cap=P.find(p=>p.name===capName);{const g=idle.find(a=>a.prov===cap.id);if(g)idle=idle.filter(a=>a!==g);}
  const C=[];for(const t of P){const h=DOTS.hostStr(t.id,PL);
    if(friendly(t.owner)){if(h>0)C.push({t,need:h*0.9,s:-150});}
    else if(DOTS.rel(t.owner)==='war'){const g=(t.type==='capital'||t.type==='fort')?4:1.5;C.push({t,need:(h+g)*1.3,s:h*6-(t.type==='capital'?100:0)});}}
  for(const c of C){let d=1e9;for(const a of idle)d=Math.min(d,D[a.prov][c.t.id]);c.d=d;c.sc=c.s+d;}
  C.sort((x,y)=>x.sc-y.sc);
  for(const c of C){if(!idle.length)break;if(c.d>600)continue;const near=idle.filter(a=>D[a.prov][c.t.id]<=c.d+160).sort((x,y)=>D[x.prov][c.t.id]-D[y.prov][c.t.id]);
    let sum=0;const go=[];for(const a of near){go.push(a.id);sum+=a.str;if(sum>=c.need)break;}if(sum<c.need)continue;
    if(DOTS.order(go,c.t.id))A.orders++;idle=idle.filter(a=>!go.includes(a.id));}
  }
  const F={};for(const p of P)if(DOTS.rel(p.owner)==='war'&&DOTS.ADJ()[p.id].some(e=>friendly(P[e.to].owner)))F[p.owner]=1;
  // no fronts (or few, for a long time): declare war on the weakest bordering neutral
  const nf=Object.keys(F).length;
  if(nf===0||(nf<2&&G.t-A.lastDecl>200)){const nb=new Set();for(const p of P.filter(q=>friendly(q.owner)))for(const ed of DOTS.ADJ()[p.id]){const o=P[ed.to].owner;if(DOTS.rel(o)==='peace'&&o!=='BB')nb.add(o);}
    if(G.chess&&!nb.size)for(const k of Object.keys(DOTS.BLOC).concat(['CF','IN','ME','AU','A2']))if(k!==PL&&DOTS.rel(k)==='peace'&&DOTS.ownedN(k)>0)nb.add(k);
    const BL=DOTS.BLOC;const mate=o=>BL[o]&&BL[o]===BL[PL];const k=[...nb].filter(o=>(nf===0||!mate(o))&&(G.chess||DOTS.totStr(o)<DOTS.totStr(PL)*1.3)).sort((x,y)=>(mate(x)-mate(y))||(DOTS.totStr(x)-DOTS.totStr(y)))[0];if(k&&DOTS.declareWar(k)){A.decl.push(Math.round(G.t)+'s:'+k);A.lastDecl=G.t;}}
};
