import {F, F0, fadd, fsub, fmul, fdiv, fcmp, fnum} from './fraction.js';
import {BUILTIN_MODES, EVENT_LIMIT, SECONDS_LIMIT, MotError} from './constants.js';
import {parseProgram} from './parser.js';
import {degToNote, noteToDeg, modeArr, resolvePitch, freqOf} from './pitch.js';

function lineCol(src,pos){let line=1,col=1;for(let k=0;k<pos&&k<src.length;k++){if(src[k]==='\n'){line++;col=1;}else col++;}return{line,col};}
function rootScope(){return{N:12,ratio:2,mode:BUILTIN_MODES.major,names:null,root:261.6256,tempo:F(120),shift:{deg:0,note:0,reg:0}};}

function applySetting(S,s,env){
  const S2={...S};
  if(s.kind==='tuning'){
    if(s.n!==S.N){S2.mode=null;S2.names=null;}
    S2.N=s.n;if(s.ratio!==null){if(!(s.ratio>0)||s.ratio===1)throw new MotError('The register ratio must be above 0 and not 1',s.pos);S2.ratio=s.ratio;}
  }else if(s.kind==='register'){
    if(!(s.ratio>0)||s.ratio===1)throw new MotError('The register ratio must be above 0 and not 1',s.pos);S2.ratio=s.ratio;
  }else if(s.kind==='names'){
    if(s.names.length!==S.N)throw new MotError('This tuning has '+S.N+' notes, so names needs '+S.N+' entries (got '+s.names.length+')',s.pos);
    S2.names=s.names;
  }else if(s.kind==='mode'){
    let arr;
    if(s.arr)arr=s.arr;
    else{if(!env.modes.has(s.name))throw new MotError('Unknown mode "'+s.name+'". Built in: '+Object.keys(BUILTIN_MODES).join(', '),s.pos);arr=env.modes.get(s.name);}
    if(arr===null)S2.mode=null;
    else{
      if(!arr.length)throw new MotError('A mode needs at least one note',s.pos);
      const u=[...new Set(arr)].sort((a,b)=>a-b);
      if(u[0]<0||u[u.length-1]>=S.N)throw new MotError('This mode uses note '+(u[u.length-1]>=S.N?u[u.length-1]:u[0])+', which is outside the current tuning of '+S.N+' notes (0\u2013'+(S.N-1)+'). Set the tuning first, or use "mode chromatic".',s.pos);
      S2.mode=u;
    }
  }else if(s.kind==='tempo')S2.tempo=s.value;
  else if(s.kind==='root')S2.root=s.hz;
  return S2;
}

function compile(src,opts){
  opts=opts||{};
  try{return compileInner(src,opts);}
  catch(e){
    if(e instanceof MotError){const lc=lineCol(src,e.pos||0);return{ok:false,error:{msg:e.message.replace(/"([^"]*)"/g,'\u201c$1\u201d'),pos:e.pos||0,line:lc.line,col:lc.col}};}
    throw e;
  }
}

function compileInner(src,opts){
  const prog=parseProgram(src);
  const env={vars:new Map(),modes:new Map(Object.entries(BUILTIN_MODES))};
  let S=rootScope();const exprs=[];let lastDef=null;
  for(const st of prog){
    if(st.type==='setting')S=applySetting(S,st.s,env);
    else if(st.type==='modedef')env.modes.set(st.name,st.arr);
    else if(st.type==='def'){env.vars.set(st.name,st);lastDef=st.name;}
    else exprs.push(st);
  }
  const ctx={env,G:S.tempo,instruments:opts.instruments||null,stack:[],depth:0};
  const tscale=T=>fdiv(ctx.G,T.tempo);
  const mk=(dur,ev,flags)=>({dur,ev,flags:flags||{}});
  const sortEv=ev=>ev.sort((a,b)=>fcmp(a.t,b.t)||a.n-b.n);
  const guard=(m,pos)=>{if(m.ev.length>EVENT_LIMIT)throw new MotError('That makes more than '+EVENT_LIMIT+' notes \u2014 try something shorter',pos);return m;};

  function seqMusic(list,pos){
    let t=F0;const ev=[];
    for(const m of list){for(const e of m.ev)ev.push({...e,t:fadd(e.t,t)});t=fadd(t,m.dur);if(ev.length>EVENT_LIMIT)guard({ev},pos);}
    return mk(t,ev);
  }
  function scaleMusic(m,f){return mk(fmul(m.dur,f),m.ev.map(e=>({...e,t:fmul(e.t,f),d:fmul(e.d,f)})),m.flags);}
  function clipMusic(m,Lm){
    const ev=[];
    for(const e of m.ev){if(fcmp(e.t,Lm)>=0)continue;const room=fsub(Lm,e.t);ev.push(fcmp(e.d,room)>0?{...e,d:room}:e);}
    return mk(m.dur,ev,m.flags);
  }
  function loopTo(m,Lm,pos){
    if(m.dur.n===0)throw new MotError('Can\u2019t loop something with no length',pos);
    const ev=[];let off=F0;
    while(fcmp(off,Lm)<0){for(const e of m.ev){const t=fadd(e.t,off);if(fcmp(t,Lm)<0)ev.push({...e,t});}off=fadd(off,m.dur);if(ev.length>EVENT_LIMIT)guard({ev},pos);}
    return mk(Lm,ev,m.flags);
  }
  function mkEv(S,t,d,p){return{t,d,n:resolvePitch(S,p),N:S.N,ratio:S.ratio,root:S.root,mode:modeArr(S),inst:null,hit:false};}

  function applyMod(m,md,S){
    switch(md.t){
      case 'rev':return mk(m.dur,sortEv(m.ev.map(e=>({...e,t:fsub(fsub(m.dur,e.t),e.d)}))),m.flags);
      case 'inv':{
        if(!m.ev.length)return m;const first=m.ev[0];
        const ev=m.ev.map(e=>{const p=noteToDeg(first.n,e.mode,e.N),c=noteToDeg(e.n,e.mode,e.N);return{...e,n:degToNote(2*p.d-c.d,e.mode,e.N)+c.res};});
        return mk(m.dur,ev,m.flags);
      }
      case 'rep':return guard(seqMusic(new Array(md.n).fill(m),md.pos),md.pos);
      case 'scale':return scaleMusic(m,md.f);
      case 'fit':return{...m,flags:{...m.flags,fit:true}};
      case 'loop':return{...m,flags:{...m.flags,loop:true}};
      case 'sets-length':return{...m,flags:{...m.flags,sets:true}};
    }
    return m;
  }

  function evMotif(node,S){
    const sc=tscale(S);let t=F0,last=F(1,4);const ev=[];let prev=[];
    for(const it of node.items){
      const dd=it.dur||last;if(it.dur)last=it.dur;
      const ds=fmul(dd,sc);
      switch(it.type){
        case 'rest':t=fadd(t,ds);prev=[];break;
        case 'tie':if(!prev.length)throw new MotError('A tie (_) needs a note before it',it.pos);for(const e of prev)e.d=fadd(e.d,ds);t=fadd(t,ds);break;
        case 'hit':{const e=mkEv(S,t,ds,{kind:'deg',v:1,alt:0,reg:0});e.hit=true;ev.push(e);prev=[e];t=fadd(t,ds);break;}
        case 'pitch':{const e=mkEv(S,t,ds,it);ev.push(e);prev=[e];t=fadd(t,ds);break;}
        case 'chord':{const grp=[];for(const p of it.pitches){const r=wordPitch(S,p);if(r.music)throw new MotError('Only notes can go inside a chord',p.pos);const e=mkEv(S,t,ds,r.pitch);ev.push(e);grp.push(e);}prev=grp;t=fadd(t,ds);break;}
        case 'word':{
          const r=wordPitch(S,it);
          if(r.pitch){const e=mkEv(S,t,ds,r.pitch);ev.push(e);prev=[e];t=fadd(t,ds);}
          else{let m=r.music;if(it.dur&&m.dur.n>0)m=scaleMusic(m,fdiv(ds,m.dur));for(const e of m.ev)ev.push({...e,t:fadd(e.t,t)});t=fadd(t,m.dur);prev=[];}
          break;
        }
      }
      if(ev.length>EVENT_LIMIT)guard({ev},it.pos);
    }
    return mk(t,ev);
  }
  function wordPitch(S,w){
    if(w.type==='pitch')return{pitch:w};
    if(S.names){const idx=S.names.indexOf(w.name);if(idx>=0)return{pitch:{kind:'note',v:idx,alt:0,reg:w.reg}};}
    const d=env.vars.get(w.name);
    if(d){
      if(w.reg)throw new MotError('"'+w.name+'" is a motif, so ^ can\u2019t be attached here \u2014 put it after the closing bracket instead',w.pos);
      if(ctx.stack.includes(w.name))throw new MotError('"'+w.name+'" is defined in terms of itself',w.pos);
      ctx.stack.push(w.name);try{return{music:ev(d.expr,S)};}finally{ctx.stack.pop();}
    }
    throw new MotError('"'+w.name+'" isn\u2019t a note name or a motif here'+(S.names||!/^[A-G][b#]?$/.test(w.name)?'':' (to use note names, define them first, e.g. names [C Db D Eb E F Gb G Ab A Bb B])'),w.pos);
  }

  function gather(items,S,lanes,o){
    for(const it of items){
      if(it.type==='length'){o.length=fmul(it.dur,tscale(S));}
      else if(it.type==='term'&&it.base.type==='staff'&&!it.mods.length)gather(it.base.items,S,lanes,o);
      else lanes.push(ev(it,S));
    }
  }
  function evStaff(node,S){
    const lanes=[];const o={length:null};gather(node.items,S,lanes,o);
    if(!lanes.length)return mk(o.length||F0,[]);
    let Lm;
    if(o.length)Lm=o.length;
    else{
      const sets=lanes.filter(l=>l.flags.sets);
      const pool=sets.length?sets:lanes.filter(l=>!l.flags.fit&&!l.flags.loop);
      const use=pool.length?pool:lanes;
      Lm=use.reduce((a,l)=>fcmp(l.dur,a)>0?l.dur:a,F0);
    }
    const out=[];
    for(const l of lanes){
      let m=l;
      if(l.flags.fit){if(l.dur.n!==0&&Lm.n!==0)m=scaleMusic(l,fdiv(Lm,l.dur));}
      else if(l.flags.loop)m=loopTo(l,Lm,node.pos);
      m=clipMusic(m,Lm);
      for(const e of m.ev)out.push(e);
    }
    return guard(mk(Lm,sortEv(out)),node.pos);
  }

  function ev(node,S){
    if(++ctx.depth>150)throw new MotError('Nested too deeply \u2014 is something defined in terms of itself?',node.pos);
    try{return evInner(node,S);}finally{ctx.depth--;}
  }
  function evInner(node,S){
    switch(node.type){
      case 'seq':if(node.items.length===1)return ev(node.items[0],S);return guard(seqMusic(node.items.map(it=>ev(it,S)),node.pos),node.pos);
      case 'term':{
        let S2=S;const post=[];
        for(const m of node.mods){
          if(m.t==='deg')S2={...S2,shift:{...S2.shift,deg:S2.shift.deg+m.v}};
          else if(m.t==='note')S2={...S2,shift:{...S2.shift,note:S2.shift.note+m.v}};
          else if(m.t==='reg')S2={...S2,shift:{...S2.shift,reg:S2.shift.reg+m.v}};
          else post.push(m);
        }
        let m=ev(node.base,S2);
        for(const md of post)m=applyMod(m,md,S2);
        return m;
      }
      case 'motif':return evMotif(node,S);
      case 'rest':return mk(fmul(node.dur,tscale(S)),[]);
      case 'ref':{
        const d=env.vars.get(node.name);
        if(!d){
          const isInst=ctx.instruments&&ctx.instruments.has(node.name);
          throw new MotError(isInst?'"'+node.name+'" is an instrument. Give it something to play, like  '+node.name+': [1 3 5]':'Unknown name "'+node.name+'"',node.pos);
        }
        if(ctx.stack.includes(node.name))throw new MotError('"'+node.name+'" is defined in terms of itself',node.pos);
        ctx.stack.push(node.name);try{return ev(d.expr,S);}finally{ctx.stack.pop();}
      }
      case 'inst':{
        if(ctx.instruments&&!ctx.instruments.has(node.name))throw new MotError('Unknown instrument "'+node.name+'". Your instruments: '+[...ctx.instruments].join(', '),node.pos);
        const m=ev(node.term,S);
        return{dur:m.dur,flags:m.flags,ev:m.ev.map(e=>e.inst?e:{...e,inst:node.name})};
      }
      case 'staff':return evStaff(node,S);
      case 'with':{let S2=S;for(const s of node.settings)S2=applySetting(S2,s,env);return ev(node.body,S2);}
    }
    throw new MotError('Can\u2019t play this',node.pos);
  }

  let rootNode;
  if(env.vars.has('piece'))rootNode={type:'ref',name:'piece',pos:0};
  else if(exprs.length)rootNode={type:'seq',items:exprs.flatMap(x=>x.expr.items),pos:0};
  else if(lastDef)rootNode={type:'ref',name:lastDef,pos:0};
  else throw new MotError('Nothing to play yet. Try a line like  pulse: [1 3 5]',0);

  const m=ev(rootNode,S);
  const bpm=fnum(ctx.G);const spw=240/bpm;
  const total=fnum(m.dur)*spw;
  if(total>SECONDS_LIMIT)throw new MotError('That piece is over '+Math.round(SECONDS_LIMIT/60)+' minutes long',0);
  const used=new Set();
  const events=sortEv(m.ev.slice()).map(e=>{const inst=e.inst||opts.defaultInst||null;if(inst)used.add(inst);return{t:fnum(e.t)*spw,d:Math.max(fnum(e.d)*spw,0.01),n:e.n,freq:freqOf(e),inst,hit:e.hit};});
  return{ok:true,events,total,bpm,count:events.length,used:[...used],exact:{dur:m.dur}};
}

export {compile};
