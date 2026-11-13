"use strict";
/* =====================================================================
   ASH HOLLOW — Mind layer. One place for dialogue + basic knowledge.
       Mind.think(agent, event) -> { bubbleText?, gloss?, emotion?, actionHint?, knows? }
   The tribe starts with NO language. What RuleMind can say depends on
   what the tribe has invented (ctx.lang()):
     0 = no language   -> wordless marks only: ! !! ? … ♥ ~
     1 = First Sounds  -> raw syllables, no fixed meaning ("ka! ka!")
     2 = Shared Words  -> the tribe's own invented words (ctx.words), glossed
     3 = Myths         -> short myths composed from those words
   Words are coined procedurally when "Shared Words" is invented, so every
   seed grows a different little language. No network, works from .
   Swap point: LlmMind (inert stub). See DESIGN.md "Mind layer".
   ===================================================================== */
const SYL=['ka','ru','om','mu','vel','ta','na','sha','do','ki','lu','ba','ne','ee','ush','ra','ti','po','hm','ya'];
const CONCEPTS=['fire','beast','run','us','go','food','good','wood','sleep','stone','see','keep','hear','dark','bury','sky','tooth','child','sun','why','many'];

function coinWords(rand){
  const w={}, used=new Set();
  for(const c of CONCEPTS){ let s, g=0; do{ const n=rand()<.45?1:2; s=''; for(let i=0;i<n;i++) s+=SYL[Math.floor(rand()*SYL.length)]; if(s.length<3) s+=SYL[Math.floor(rand()*SYL.length)]; }while(used.has(s)&&g++<50); used.add(s); w[c]=s; }
  return w;
}
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
function babble(rand,n){ let out=[]; for(let i=0;i<n;i++){ const s=SYL[Math.floor(rand()*SYL.length)]; out.push(rand()<.3?s+'-'+s:s); } return out.join(rand()<.5?'… ':'! ')+(rand()<.5?'!':'?'); }

function mythsFor(w,B,extra){
  const M=[];
  if(B.fire)  M.push([`${cap(w.fire)} ${w.see}. ${cap(w.fire)} ${w.keep} ${w.us}.`,'the fire sees; the fire keeps us'],[`${cap(w.fire)} ${w.sky}-born, ${w.keep} ${w.dark} thin.`,'sky-born fire keeps the dark thin']);
  if(B.tooth) M.push([`${cap(w.tooth)} in ${w.dark}, ${w.go}!`,'tooth in the dark, go away'],[`${cap(w.beast)} ${w.see} ${w.fire}, ${w.beast} ${w.run}.`,'the beast sees the fire and runs']);
  if(B.stone) M.push([`${cap(w.stone)} ${w.hear} ${w.us}.`,'the stone hears us'],[`${cap(w.us)} ${w.sleep}, ${w.stone} ${w.keep}.`,'we sleep, the stone keeps watch']);
  if(B.seed)  M.push([`${cap(w.bury)} one, ${w.food} many.`,'bury one, eat many']);
  if(B.bright)M.push([`${cap(w.stone)} ${w.fire}, ${w.stone} ${w.good}.`,'fire makes the stone good (bright)']);
  for(const e of (extra||[])) M.push(e);
  return M;
}

const RuleMind={
  name:'RuleMind (rules + invented words, no network)',
  think(a, ev, ctx){
    const L=ctx.lang(), w=ctx.words||{}, B=ctx.beliefs, r=ctx.rand, pk=ctx.pick, out={};
    const hasBelief=Object.keys(B).some(k=>B[k]);
    const set=(t,g)=>{ out.bubbleText=t; out.gloss=g||''; };
    const myth=()=>{ const M=mythsFor(w,B,ctx.extraMyths); if(M.length){ const m=pk(M); set(m[0],m[1]); } };
    switch(ev.type){
      case 'fear_high':
        out.emotion='afraid'; out.actionHint=hasBelief?'pray':'cower';
        if(L===0) set(pk(['!!','…!','?!']),'wordless fear');
        else if(L===1) set(babble(r,2),'frightened sounds');
        else if(hasBelief && B.fire) set(`${cap(w.fire)}, ${w.keep} ${w.us}…`,'fire, keep us');
        else if(hasBelief && B.stone) set(`${cap(w.stone)}, ${w.hear}…`,'stone, hear me');
        else set(`${cap(w.dark)}… ${w.dark}…`,'dark… dark…');
        break;
      case 'see_predator': out.emotion='terrified'; out.actionHint=(a.tool>=2 && ev.allies>=1)?'fight':'flee';
        if(L===0) set('!!!','alarm'); else if(L===1) set(babble(r,1).toUpperCase(),'alarm cry'); else set(`${cap(w.beast)}! ${cap(w.run)}!`,'beast! run!'); break;
      case 'fight': out.emotion='fierce'; if(L>=2) set(`${cap(w.us)}! ${cap(w.beast)} ${w.go}!`,'together! beast, go!'); else set(L?'HA! HA!':'!!','war cry'); break;
      case 'bitten': out.emotion='hurt'; set('!!!','pain'); break;
      case 'chant': out.emotion='calm';
        if(L>=2) set(a.isLead&&r()<.5? `${cap(w.us)} ${w.hear}. ${cap(w.fire)} ${w.see}.` : `♪ ${w.fire}, ${w.fire} ♪`, a.isLead?'we listen; the fire sees':'chanting the fire\'s name');
        else set('♪ '+babble(r,2).replace(/[!?]/g,'')+' ♪','wordless chant'); break;
      case 'ritual_end': out.emotion='calm'; if(L>=3) myth(); else if(L===2) set(`${cap(w.good)}. ${cap(w.us)}.`,'good. us.'); else set('~','calm'); break;
      case 'work': out.emotion='busy';
        if(L===0){ if(r()<.4) set(pk(['♥','~','!']),'pleased grunt'); }
        else if(L===1){ if(r()<.6) set(babble(r,1),'working sounds'); }
        else { const J={forage:[`${cap(w.food)}! ${cap(w.good)}!`,'food! good!'],root:[`${cap(w.food)}, ${w.bury}…`,'food in the ground'],sticks:[`${cap(w.wood)}.`,'wood'],build:[`${cap(w.sleep)} ${w.good}.`,'good sleeping place'],hunt:[`${cap(w.food)}… ${w.run}!`,'food runs!'],flint:[`${cap(w.stone)} ${w.tooth}.`,'stone tooth (a blade)'],farm:[`${cap(w.bury)}, ${w.bury}.`,'planting'],craft:[`${cap(w.tooth)} ${w.wood}.`,'tooth-wood (a spear)'],tend:[`${cap(w.child)}, ${w.food}.`,'little one, eat'],eat:[`${cap(w.good)}.`,'good'],feed:[`${cap(w.fire)} ${w.food}.`,'feeding the fire']}[ev.job]; if(J) set(J[0],J[1]); }
        break;
      case 'hungry': out.emotion='hungry'; if(L===0) set('…','hungry'); else if(L===1) set('mm… mm…','hungry sounds'); else set(`${cap(w.food)}…`,'food…'); break;
      case 'grief': out.emotion='sad'; if(L>=2) set(`${cap(w.sleep)} ${w.stone}…`,'sleeps under stone'); else set('oo… oo…','keening'); break;
      case 'discover': out.emotion='proud'; if(L>=2) set(`${cap(w.good)}! ${cap(w.see)}!`,'good! look!'); else set(pk(['!','!!','♥']),'surprise'); break;
      case 'age_up': out.emotion='proud'; if(L>=2) set(`${cap(w.good)}! ${cap(w.good)}!`,'good! good!'); else set('!!','joy'); break;
      case 'ponder': out.emotion='curious';
        if(L===0) set('?','wondering'); else if(L===1) set(babble(r,1).replace(/[!]/g,'')+'?','asking sounds');
        else { const c=pk([[`${cap(w.sky)}… ${w.why}?`,'the sky… why?'],[`${cap(w.fire)} ${w.why}?`,'why fire?'],[`${cap(w.stone)} ${w.hear}?`,'does the stone hear?'],[`${cap(w.why)} ${w.dark}?`,'why the dark?']]); set(c[0],c[1]); } break;
      case 'awe': out.emotion='awed'; if(L>=2) set(`${cap(w.sky)} ${w.fire}!`,'sky-fire!'); else set('!?','awe'); break;
      case 'idle': default: out.emotion='content';
        if(L===0){ if(r()<.25) set(pk(['~','?','♥']),'wordless'); }
        else if(L===1) set(babble(r,1+Math.floor(r()*2)),'trying sounds');
        else if(L===2) { const C=[[`${cap(w.food)} ${w.good}.`,'food is good'],[`${cap(w.fire)} ${w.good}.`,'the fire is good'],[`${cap(w.sleep)}?`,'sleep?'],[`${cap(w.child)}! ${cap(w.child)}!`,'little one!'],[`${cap(w.sun)} ${w.go}.`,'the sun goes']]; const c=pk(C); set(c[0],c[1]); }
        else { if(r()<.6) myth(); else set(`${cap(w.us)} ${w.good}.`,'we are good'); }
    }
    out.knows={ language:['none','sounds','words','myths'][L], safePlace: B.fire?'the fire':'the cave', beliefs:Object.keys(B).filter(k=>B[k]) };
    return out;
  }
};

/* LlmMind — SWAP POINT (stub, intentionally inert in v1).
   To plug in a real model later (e.g. a local server you run yourself):
     1. set LlmMind.endpoint to its URL and Mind.provider = LlmMind
     2. in think(): build a prompt from (agent summary + event + ctx.beliefs
        + ctx.words + ctx.lang()) — tell the model to speak ONLY in the
        tribe's current language level and invented words.
   Rules stay authoritative: this answers instantly with RuleMind, then
   patches the bubble asynchronously when the model replies. actionHint is
   advisory; agents validate it (a model can't make an unarmed child fight). */
const LlmMind={
  name:'LlmMind (stub — not connected)',
  endpoint:null,                         // null = disabled; v1 never calls out
  think(a, ev, ctx){
    const base=RuleMind.think(a, ev, ctx);
    if(!this.endpoint) return base;
    // Future adapter (left disabled on purpose):
    // fetch(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
    //   body:JSON.stringify({agent:{name:a.name,hunger:a.hunger,fear:a.fear,faith:a.faith},event:ev,lang:ctx.lang(),words:ctx.words,beliefs:base.knows.beliefs})})
    //  .then(r=>r.json()).then(t=>{ if(t&&t.bubbleText) ctx.say(a,String(t.bubbleText).slice(0,60)); }).catch(()=>{});
    return base;
  }
};

const Mind={
  provider: RuleMind,
  ctx: null,                              // set by sim.js
  think(a, ev){ try{ return this.provider.think(a, ev, this.ctx)||{}; }catch(e){ return RuleMind.think(a, ev, this.ctx); } }
};
