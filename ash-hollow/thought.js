"use strict";
/* ASH HOLLOW v3.7 — THOUGHT: intellect, philosophies, and the spread of ideas;
   plus each people's own building genome, town layout, staple crop and trade goods.
   Nothing here is pre-written lore: every idea is coined from that people's OWN
   words, out of that people's OWN history, and it changes how they behave.

   INTELLECT  f.iq (≈0.6–1.8, 1 = ordinary). Starts at 1 (home) or a small hash of the
     people's name, and only begins to drift once a people farms. It rises with
     schooling (era: print, engines, wires, computers), trade routes (exposure),
     wealth and ideas that prize inquiry; it falls with war, isolation, worship
     that frowns on questions, and catastrophe. Home also follows the Wit of its
     watched adults. Effects:
       · research  ×(0.7+0.3·iq)                   — sharper peoples invent more
       · questioning (new philosophy) ∝ iq³         — sharper peoples question more
       · taking up a neighbour's idea ×(2.3−1.3·iq) — plainer peoples adopt faster
   PHILOSOPHIES  world.ideas[] — {name, gloss, ax:{struggle,open,inquiry,sacred,earth}}.
     A people that thinks (Copper Age+, with myths) sometimes questions what it was
     taught and coins a new idea: half its old idea, half the LESSON of its own
     history (wars lost, trade, faith, its land, catastrophes), plus a regional
     character fixed per continent, plus novelty that grows with intellect. Named
     from that people's words ("the Kanavel teaching"); the form follows its era
     (saying → teaching → school → movement → philosophy).
   SPREAD  like myths: along relations (allied > trade > neutral > war > wary),
     faded by distance, eased by prestige/age gap and cultural fit, slowed by
     distrust of outsiders, sped by doubt.
   EFFECTS  struggle → tension & war appetite, a 'creed' war motive; open → warmth,
     trade, less distrust; inquiry → research & intellect; sacred → piety; earth →
     how hard industry strains the land (disasters.js). Ideas also move a people's
     culture leaning, so their buildings change with what they believe.          */
let TSEED=((typeof seed!=='undefined'?seed:1)^0x5bd1e995)>>>0;
function trng(){ TSEED=(TSEED+0x6D2B79F5)|0; let t=Math.imul(TSEED^TSEED>>>15,1|TSEED); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; }   // own stream: the blank-slate rng sequence is untouched
function hrand(n){ let a=(n*2654435761)>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; }; }
function wordsOf(f){ if(f.home) return tribe.words||null; if(f.words) return f.words; if(!tribe.words) return null; return (f.words=coinWords(hrand(1000+f.id*7))); }   // same words as visit.js factionWords
function wordOf(f,k){ const W=wordsOf(f); if(W&&W[k]) return W[k]; const h=nameHash((f.root||'x')+k); return SYL[h%SYL.length]+SYL[(h>>5)%SYL.length]; }
const fAge=f=>f.home?tribe.age:(f.age||0);
const fEra=f=>visEra(f.home?tribe.age:(f.age||1));
const fKnows=f=>f.home?knows:(id=>!!(f.known&&f.known[id]));
const canThink=f=>f.home?knows('planting'):(f.age||0)>=3;
const shockRecent=f=>!!(f.shock&&tribe.time-f.shock<300);

/* ------------------------------ intellect ------------------------------ */
function iqOf(f){ if(f.iq==null) f.iq=f.home?1:+(0.9+(nameHash(f.root||'x')%21)/100).toFixed(3); return f.iq; }
const iqMult=f=>f?0.7+0.3*clamp(iqOf(f),0.6,1.8):1;
const EDU=[0,0,0.08,0.14,0.2,0.28];
function intellectStep(f){
  const iq=iqOf(f), ax=ideaAx(f), R_=relsOf(f.id), routes=f.routes||0, atWar=R_.some(r=>r.state==='war');
  let T=1+EDU[fEra(f)]+0.04*Math.min(4,routes)+0.04*Math.min(3,f.wealth||0)+0.08*ax.inquiry-0.06*Math.max(0,ax.sacred)-(atWar?0.08:0)-(routes===0&&R_.length<=2?0.06:0)-(shockRecent(f)?0.15:0);
  if(f.home){ const A=adults(); if(A.length) T+=0.5*(A.reduce((n,v)=>n+v.tr.wit,0)/A.length-1); }
  else T+=((nameHash(f.root||'x')%13)-6)/100;
  f.iq=+(iq+(clamp(T,0.6,1.8)-iq)*0.015).toFixed(4);
  if(f.home){ if(iq<1.2&&f.iq>=1.2&&!f.iqSaid){ f.iqSaid=true; ripple('Ash Hollow grows learned','more questions are asked, more is invented — and the old teachings are doubted'); } }
}

/* ------------------------------ philosophies ------------------------------ */
const AXES=['struggle','open','inquiry','sacred','earth'];
const ZERO_AX={struggle:0,open:0,inquiry:0,sacred:0,earth:0};
const POLE={struggle:[['tooth','keep'],['good','child']],open:[['go','many'],['us','keep']],inquiry:[['why','see'],['hear','keep']],sacred:[['sky','sun'],['stone','food']],earth:[['wood','bury'],['stone','fire']]};
const PHRASE={struggle:['the strong must hold what is theirs','no field is worth the blood'],open:['every stranger brings a gift','keep to our own hearths'],inquiry:['ask why until the sky answers','the old ways are the true ways'],
  sacred:['the unseen weighs more than bread','only what the hand touches is real'],earth:['the land is kin, not a tool','the land is there to be used']};
const AX_NOTE={struggle:['struggle','peace'],open:['openness','keeping apart'],inquiry:['inquiry','tradition'],sacred:['the sacred','the worldly'],earth:['the land as kin','the land as a tool']};
const FORM=['saying','saying','teaching','school','movement','philosophy'];
let IDEAIX={v:-1,m:new Map()};
function ideasInit(){ if(!world.ideas) world.ideas=[]; if(world.ideaN==null) world.ideaN=world.ideas.reduce((n,i)=>Math.max(n,i.id+1),0); if(!world.ideaStats) world.ideaStats={born:0,adopt:0,extinct:0,bornIq:[0,0,0],adoptIq:[0,0,0]}; world.ideaV=(world.ideaV||0)+1; }
function ideaById(id){ if(IDEAIX.v!==world.ideaV||IDEAIX.obj!==world.ideas){ IDEAIX={v:world.ideaV,obj:world.ideas,m:new Map((world.ideas||[]).map(i=>[i.id,i]))}; } return IDEAIX.m.get(id); }
const ideaOf=f=>f&&f.idea!=null?ideaById(f.idea)||null:null;
const ideaAx=f=>{ const I=ideaOf(f); return I?I.ax:ZERO_AX; };
const axDist=(a,b)=>Math.sqrt(AXES.reduce((n,k)=>n+(a[k]-b[k])*(a[k]-b[k]),0));
const iqBin=iq=>iq<0.95?0:iq<1.15?1:2;
function topAxes(ax){ return AXES.slice().sort((p,q)=>Math.abs(ax[q])-Math.abs(ax[p])); }
function hslHex(h,s,l){ s/=100; l/=100; const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l), f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1))); return '#'+[f(0),f(8),f(4)].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join(''); }
function coinIdea(f){
  ideasInit();
  const c=cultureOf(f), iq=iqOf(f), par=ideaOf(f), P=par?par.ax:ZERO_AX, era=fEra(f), routes=f.routes||0, land=landOf(f), ag=agriOf(f)||'rows';
  const cont=f.capital?continentOf(f.capital.cx,f.capital.cy):null, ch=nameHash(cont?cont.name:'open sea');
  const reg=i=>((((ch>>>(i*4))&15)-7.5)/38);   // regional character: about ±0.2 per axis, fixed for each continent
  let lost=0; if(f.grudge) for(const k in f.grudge) if(tribe.time-f.grudge[k].t<900) lost++;   // war-weariness: recent defeats
  const L={struggle:(c.war-0.5)*1.2+0.4*(f.nation||0)-0.25*Math.min(3,lost)-(f.lesson==='horror'?1.3:0),
           open:(c.open-0.45)*1.6-0.8*(f.xeno||0)+0.08*Math.min(4,routes),
           inquiry:(iq-1)*1.6+(era>=2?0.2:0)-(c.piety-0.45),
           sacred:(c.piety-0.45)*1.6-(iq-1)*0.8,
           earth:(land==='forest'?0.3:0)+(['grove','shrine','fungus','paddy'].includes(ag)?0.25:0)-(era>=3?0.35:0)+(f.lesson==='earth'?1.3:0)};
  const amp=0.2+0.35*clamp(iq-0.6,0,1.2), ax={};   // sharper minds stray further from what they were taught
  AXES.forEach((k,i)=>{ ax[k]=+clamp(P[k]*0.45+L[k]*0.55+reg(i)+(trng()*2-1)*amp,-1,1).toFixed(2); });
  const [k1,k2]=topAxes(ax), w1=wordOf(f,POLE[k1][ax[k1]>=0?0:1][0]), w2=wordOf(f,POLE[k2][ax[k2]>=0?0:1][1]);
  let core=cap(w1)+w2; if(world.ideas.some(i=>i.core===core)) core+=SYL[Math.floor(trng()*SYL.length)];
  const form=FORM[era], h=nameHash(core);
  const I={id:world.ideaN++,core,name:`the ${core} ${form}`,form,gloss:`${PHRASE[k1][ax[k1]>=0?0:1]}; ${PHRASE[k2][ax[k2]>=0?0:1]}`,ax,origin:f.id,originName:f.home?'Ash Hollow':f.root,cont:cont?cont.name:'',year:calYear(nowDay()),born:tribe.time,parent:par?par.id:null,color:hslHex(h%360,58,60),peoples:1,pop:Math.round(f.pop||0),peak:1};
  world.ideas.push(I); world.ideaV++; world.ideaStats.born++; world.ideaStats.bornIq[iqBin(iq)]++;
  f.idea=I.id; f.ideaT=tribe.time; f.doubt=0; f.lesson=null;
  if(f.home){ const A=adults(), sage=A.length?A.reduce((b,v)=>v.tr.wit>b.tr.wit?v:b,A[0]):null;
    log(`${sage?'<b>'+sage.name+'</b>, '+(sage.type==='wit'?'a Deep-Looker, ':'')+'questions '+(par?'the '+par.core+' '+par.form:'what the elders taught')+': ':''}a new idea is born in Ash Hollow — <b>${I.name}</b> (“${I.gloss}”).`);
    if(sage) say(sage,`${cap(wordOf(f,'why'))}?`,'questioning the old teaching',4);
    if(typeof director==='function') director(sage,{kind:'belief',caption:`A new idea: ${I.name}`,sub:`“${I.gloss}” — ${sage?sage.name+' asks why':'Ash Hollow asks why'}`,big:true}); }
  return I;
}
const SPREAD_W={allied:0.06,trade:0.045,neutral:0.018,war:0.008,wary:0.006,hostile:0.004};
function ideaFit(I,Y){ const c=cultureOf(Y); return (I.ax.struggle*(c.war-0.5)+I.ax.open*(c.open-0.5)+I.ax.sacred*(c.piety-0.5))*0.67; }
function adoptIdea(Y,I,X){
  const old=ideaOf(Y); Y.idea=I.id; Y.ideaT=tribe.time-160; Y.doubt=Math.max(0,(Y.doubt||0)-0.5);
  world.ideaStats.adopt++; world.ideaStats.adoptIq[iqBin(iqOf(Y))]++;
  if(Y.home) ripple(`${cap(I.name)} reaches Ash Hollow from the ${X.root}-folk`,`“${I.gloss}”${old?' — it displaces '+old.name:''}`);
  else if(X.home&&!(world.ideaStats.homeOut>=6)){ world.ideaStats.homeOut=(world.ideaStats.homeOut||0)+1; log(`Ash Hollow's <b>${I.name}</b> spreads to the ${Y.root}-folk.`); }
}
function spreadIdeas(){
  for(const k in world.rel){ const r=world.rel[k], w=SPREAD_W[r.state]; if(!w) continue; const A=world.factions[r.a], B=world.factions[r.b];
    if(!A||!B||!A.setts||!B.setts||A.idea===B.idea) continue; const dF=1/(1+Math.max(0,(r.d||10)-8)/10);
    for(const [X,Y] of [[A,B],[B,A]]){ if(X.idea==null||!canThink(Y)) continue; const I=ideaById(X.idea); if(!I) continue;
      const recept=clamp(2.3-1.3*iqOf(Y),0.3,1.6)*(1-0.5*Math.min(1,Y.xeno||0))*(1+0.5*Math.min(3,Y.doubt||0))*(Y.idea==null?1.6:1);   // plainer minds take up new ideas more easily
      const appeal=1+0.15*clamp(fAge(X)-fAge(Y),0,3)+0.05*Math.max(0,(X.gov||0)-(Y.gov||0))+0.3*ideaFit(I,Y);
      const p0=w*dF*Math.max(0.2,appeal), S=world.ideaStats; (S.oppIq||(S.oppIq=[0,0,0]))[iqBin(iqOf(Y))]+=p0;   // opportunity, for tools/thought.js
      if(trng()<p0*recept){ adoptIdea(Y,I,X); break; } } }
}
function tallyIdeas(F){
  const n=new Map(), p=new Map(); for(const f of F){ if(f.idea==null) continue; n.set(f.idea,(n.get(f.idea)||0)+1); p.set(f.idea,(p.get(f.idea)||0)+(f.pop||0)); }
  let changed=false;
  for(const I of world.ideas){ const was=I.peoples; I.peoples=n.get(I.id)||0; I.pop=Math.round(p.get(I.id)||0); I.peak=Math.max(I.peak||1,I.peoples);
    for(const m of [3,10,25,60]) if(was<m&&I.peoples>=m&&!(I.said>=m)){ I.said=m; wlog(`<b>${cap(I.name)}</b>, first taught ${I.originName==='Ash Hollow'?'in Ash Hollow':'among the '+I.originName+'-folk'}${I.cont?' of '+I.cont:''}, now guides ${m} peoples (“${I.gloss}”).`,'belief',null,m>=10); } }
  const before=world.ideas.length;
  world.ideas=world.ideas.filter(I=>I.peoples>0||tribe.time-I.born<600);   // forgotten ideas fade from the record
  if(world.ideas.length>80){ const keep=world.ideas.filter(I=>I.peoples>0); world.ideas=keep.concat(world.ideas.filter(I=>!I.peoples).slice(-Math.max(0,80-keep.length))); }
  if(world.ideas.length!==before){ world.ideaStats.extinct+=before-world.ideas.length; changed=true; }
  if(changed) world.ideaV++;
}
function thoughtStep(){
  ideasInit(); const F=world.factions.filter(f=>f.setts>0), nF=F.length;
  for(const f of F){
    if(!canThink(f)) continue;
    intellectStep(f);
    if(f.idea!=null&&!ideaById(f.idea)) f.idea=null;
    if(f.idea==null&&f.parent!=null){ const pa=world.factions[f.parent]; if(pa&&pa.idea!=null&&ideaById(pa.idea)){ f.idea=pa.idea; f.ideaT=tribe.time; } }   // splits keep their parent's teaching
    if(f.ageSeen==null) f.ageSeen=fAge(f); if(fAge(f)>f.ageSeen){ f.doubt=(f.doubt||0)+0.4; f.ageSeen=fAge(f); } else if(fAge(f)<f.ageSeen) f.ageSeen=fAge(f);   // a new age unsettles old certainties
    f.doubt=Math.max(0,(f.doubt||0)*0.985+0.03*Math.max(0,iqOf(f)-1));   // sharper minds keep finding doubts
    const thinks=f.home?(knows('myths')&&tribe.age>=4):(f.age||0)>=4; if(!thinks) continue;
    const iq=iqOf(f), held=tribe.time-(f.ideaT||0);
    const p=0.0016*iq*iq*iq*(1+0.4*fEra(f))*(1+Math.min(4,f.doubt))*(f.idea==null?2.5:held<240?0.3:1)/Math.max(1,Math.sqrt(nF/10));   // sharper minds question more
    if(trng()<p) coinIdea(f);
  }
  spreadIdeas(); tallyIdeas(F);
}
// behaviour hooks (diplomacy.js / ripples.js / world.js / sim.js)
function ideaTension(A,B){ const a=ideaAx(A), b=ideaAx(B); let t=0.2*(a.struggle+b.struggle);
  if(A.idea!=null&&B.idea!=null){ if(A.idea===B.idea) t-=0.3; else if(a.struggle>0.4||b.struggle>0.4) t+=0.1*axDist(a,b); } return t; }
function ideaWarmth(A,B){ const a=ideaAx(A), b=ideaAx(B); return 0.2*(a.open+b.open)+(A.idea!=null&&A.idea===B.idea?0.4:0); }
const inquiryMult=f=>1+0.15*ideaAx(f).inquiry;
function creedClash(X,Y){ const IX=ideaOf(X), IY=ideaOf(Y); if(!IX||!IY||IX===IY) return null; if(IX.ax.struggle<=0.35||axDist(IX.ax,IY.ax)<=1.2) return null; return `a war of ideas — ${IX.name} against ${IY.name}`; }
function ideaLine(I){ const [k1,k2]=topAxes(I.ax); return `${AX_NOTE[k1][I.ax[k1]>=0?0:1]} · ${AX_NOTE[k2][I.ax[k2]>=0?0:1]}`; }

/* --------------------- ARCHITECTURE GENOME + TOWN LAYOUT ---------------------
   Every people's houses get a building genome hashed from its OWN coined words
   (home: its word for "us" + "stone"): roof steps, roof curve (swooping / straight /
   bulbed), finial (orb, horns, fin, ring, spike), wall pattern, door shape, stilts
   and proportions — so two "devout spire" peoples still build differently.
   Two new house shapes come from ideas: earth-kin peoples dig MOUNDs (sod houses
   under grass), inquiring peoples raise TOWERs (lookout/observatory houses).
   LAYOUT is chosen from culture + land + idea and has a real effect:
     ring (warlike / distrustful ≥0.6 / struggle >0.6)  — walled rings: +12% strength defending
     terraces (hills)                         — stepped rows on the slopes
     spiral (devout / sacred)                 — around sacred ground: piety rises faster
     grid (open-handed / open, once settled)  — streets: settlements hold +4% more
     scatter (otherwise)                      — loose clusters                            */
const FINIALS=['none','orb','horns','fin','ring','spike'], PATTERNS=['none','stripes','dots','zigzag','checks'], DOORS=['round','square','pointed'];
function archGene(f){ const key=f.home?(tribe.words?tribe.words.us+tribe.words.stone:'ash'):(f.root||'x'); if(f.gene&&f.gene.key===key) return f.gene;
  const h=nameHash(key+':gene');
  f.gene={key,steps:1+h%3,curve:[-1,0,1][(h>>>2)%3],finial:FINIALS[(h>>>4)%6],pattern:PATTERNS[(h>>>7)%5],door:DOORS[(h>>>10)%3],stilts:(h>>>12)%4===0,prop:+(0.85+((h>>>14)%8)/20).toFixed(2),style:cap(wordOf(f,'stone'))+wordOf(f,'us').slice(0,3)};
  return f.gene; }
const LAYOUT_N={ring:'walled rings',terraces:'stepped terraces',spiral:'a spiral round the sacred ground',grid:'streets in a grid',scatter:'loose clusters'};
function layoutOf(f){ const C=LAYC.get(f.id); if(C&&C[0]===AGTICK&&C[2]===f) return C[1]; const L=layout_(f); LAYC.set(f.id,[AGTICK,L,f]); return L; }   // cached for one culture tick
function layout_(f){ const ax=ideaAx(f), lean=cultureLean(f), land=landOf(f);
  if(lean==='war'||(f.xeno||0)>=0.6||ax.struggle>0.6) return 'ring';
  if(land==='hills') return 'terraces';
  if(lean==='piety'||ax.sacred>0.45) return 'spiral';
  if((lean==='open'||ax.open>0.45)&&fAge(f)>=2) return 'grid';
  return 'scatter'; }
const layoutCap=f=>fAge(f)>=4&&layoutOf(f)==='grid'?1.04:1;
const layoutDefence=f=>layoutOf(f)==='ring'?1.12:1;
function ideaShape(f,lean){ const ax=ideaAx(f); if(ax.earth>0.55) return 'mound'; if(ax.inquiry>0.5&&fAge(f)>=2) return 'tower'; return lean==='piety'?'spire':lean==='war'?'longhall':lean==='open'?'dome':'cone'; }

/* ---------------------- STAPLES + TRADE GOODS ----------------------
   Each people's farming system grows its own staple, named in its own words
   ("kunata grain"). From the early-modern era a people trades what its industry
   makes instead (forge → tools, spark → books, market → cloth). Trade between
   peoples with DIFFERENT goods is worth more (+0.12 wealth per route) than trade
   in the same good (+0.03): complementary goods, not one global market.   */
const STAPLE={rows:['grain','#d8b840'],terrace:['beans','#a8c050'],grove:['fruit','#d8503a'],herd:['wool','#e8e0d0'],shrine:['herbs','#7ad0a0'],paddy:['reed-rice','#c8d890'],fungus:['caps','#b89a70']};
function stapleOf(f){ const k=agriOf(f)||'rows', S=STAPLE[k]||STAPLE.rows, h=nameHash((f.root||'x')+k); return {sys:k,kind:S[0],color:S[1],name:`${wordOf(f,'food')}${SYL[h%SYL.length]} ${S[0]}`}; }
const GOOD_IND={forge:['tools','#9aa0a8'],spark:['books','#efe6cc'],market:['cloth',null]};
function goodOf(f){ if(fEra(f)>=2){ const G=GOOD_IND[f.path||'spark']; return {kind:G[0],color:G[1]||f.color||'#c08040',name:G[0]}; } const s=stapleOf(f); return {kind:s.kind,color:s.color,name:s.name}; }
function goodsBonus(f,GO){ let v=0, ins=[]; for(const r of relsOf(f.id)){ if(r.state!=='trade'&&r.state!=='allied') continue; const o=world.factions[r.a===f.id?r.b:r.a]; if(!o||!o.setts) continue;
    const a=GO?GO(f):goodOf(f), b=GO?GO(o):goodOf(o); if(a.kind!==b.kind){ v+=0.12; ins.push([b,o]); } else v+=0.03; }
  return {v:Math.min(0.6,v),ins}; }
