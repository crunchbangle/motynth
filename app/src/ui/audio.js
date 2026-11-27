import {clamp} from './dom.js';
import {Lib} from './library.js';

const Snd={
  ctx:null,master:null,analyser:null,cache:new Map(),
  ensure(){
    if(!this.ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      this.ctx=new AC();
      this.master=this.ctx.createGain();this.master.gain.value=.9;
      const comp=this.ctx.createDynamicsCompressor();
      comp.threshold.value=-14;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.003;comp.release.value=.2;
      this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=512;
      this.master.connect(comp);comp.connect(this.analyser);this.analyser.connect(this.ctx.destination);
    }
    if(this.ctx.state==='suspended')this.ctx.resume();
    return this.ctx;
  },
  buffer(w){
    const key=[w.type,w.d,w.smooth?1:0,w.shotMs,w.hz,w.metal?1:0,w.data.join(',')].join('|');
    let b=this.cache.get(key);if(b)return b;
    b=buildBuffer(this.ctx,w);this.cache.set(key,b);
    if(this.cache.size>240)this.cache.delete(this.cache.keys().next().value);
    return b;
  }
};
function buildBuffer(ctx,w){
  const sr=ctx.sampleRate;
  if(w.type==='noise'){
    const step=Math.max(1,Math.round(sr/Math.max(200,w.hz)));
    let buf,a;
    if(w.metal){
      const steps=127;buf=ctx.createBuffer(1,steps*step,sr);a=buf.getChannelData(0);
      let lf=0x7f;
      for(let s=0;s<steps;s++){const bit=(lf^(lf>>1))&1;lf=(lf>>1)|(bit<<6);const v=(lf&1)?1:-1;for(let k=0;k<step;k++)a[s*step+k]=v;}
    }else{
      const n=Math.floor(sr/step)*step;buf=ctx.createBuffer(1,n,sr);a=buf.getChannelData(0);
      for(let s=0;s<n;s+=step){const v=Math.random()*2-1;for(let k=0;k<step&&s+k<n;k++)a[s+k]=v;}
    }
    return{buf,type:'noise'};
  }
  const W=w.data.length,D=w.d,val=v=>(v/(D-1))*2-1;
  if(w.type==='shot'){
    const n=Math.max(16,Math.round(w.shotMs/1000*sr));const buf=ctx.createBuffer(1,n,sr),a=buf.getChannelData(0);
    for(let i=0;i<n;i++){
      const p=i/n*W,i0=Math.min(W-1,Math.floor(p));
      if(!w.smooth)a[i]=val(w.data[i0]);
      else{const f=p-i0;const v0=val(w.data[i0]),v1=val(w.data[Math.min(W-1,i0+1)]);a[i]=v0+(v1-v0)*f;}
    }
    const fade=Math.min(n>>2,Math.round(sr*.004));for(let k=0;k<fade;k++)a[n-1-k]*=k/fade;
    return{buf,type:'shot'};
  }
  const K=Math.ceil(512/W),Ln=W*K;const buf=ctx.createBuffer(1,Ln,sr),a=buf.getChannelData(0);
  let mean=0;
  for(let i=0;i<Ln;i++){
    const p=i/K,i0=Math.floor(p);
    if(!w.smooth)a[i]=val(w.data[i0]);
    else{const f=p-i0;const v0=val(w.data[i0]),v1=val(w.data[(i0+1)%W]);a[i]=v0+(v1-v0)*f;}
    mean+=a[i];
  }
  mean/=Ln;for(let i=0;i<Ln;i++)a[i]-=mean;
  let peak=0;for(let i=0;i<Ln;i++)peak=Math.max(peak,Math.abs(a[i]));
  if(peak>0)for(let i=0;i<Ln;i++)a[i]/=peak;
  return{buf,type:'cycle'};
}
function adsrPts(e,dur,peak){
  const a=Math.max(e.a,.002),d=Math.max(e.d,.002),s=e.s*peak,r=Math.max(e.r,.006);
  const pts=[[0,0]];
  if(dur<=a)pts.push([dur,peak*dur/a]);
  else if(dur<=a+d){pts.push([a,peak]);pts.push([dur,peak+(s-peak)*((dur-a)/d)]);}
  else{pts.push([a,peak]);pts.push([a+d,s]);pts.push([dur,s]);}
  const last=pts[pts.length-1][1];
  pts.push([dur+r,0]);
  return{pts,end:dur+r,last};
}
function playVoice(sess,inst,freq,t0,dur){
  const ctx=sess.ctx;
  if(sess.src.size>180)return;
  const wa=Lib.wave(inst.waveA);if(!wa)return;
  const wb=inst.mode!=='single'?Lib.wave(inst.waveB):null;
  dur=Math.max(dur,.02);
  const amp=ctx.createGain();amp.gain.value=0;amp.connect(sess.bus);
  const env=adsrPts(inst.amp,dur,1),base=.28*inst.gain;
  amp.gain.setValueAtTime(0,t0);
  for(let k=1;k<env.pts.length;k++)amp.gain.linearRampToValueAtTime(env.pts[k][1]*base,t0+env.pts[k][0]);
  const end=t0+env.end+.03;
  function slot(w,ref,out){
    const b=Snd.buffer(w);const src=ctx.createBufferSource();src.buffer=b.buf;
    let rate;
    if(b.type==='cycle'){src.loop=true;rate=(inst.follow?freq:ref)*b.buf.length/ctx.sampleRate;}
    else if(b.type==='shot'){rate=inst.follow?freq/ref:1;}
    else{src.loop=true;rate=inst.follow?freq/261.63:1;}
    src.playbackRate.value=clamp(rate,.001,256);
    if(inst.pitch&&inst.pitch.cents){src.detune.setValueAtTime(inst.pitch.cents,t0);src.detune.setTargetAtTime(0,t0,Math.max(.002,inst.pitch.time/4));}
    src.connect(out);src.start(t0);src.stop(end);
    sess.src.add(src);
    src.onended=()=>{sess.src.delete(src);try{src.disconnect();}catch(e){}};
  }
  if(!wb){slot(wa,inst.refA,amp);}
  else if(inst.mode==='pair'){
    let mix=0;
    if(inst.follow&&inst.refA>0&&inst.refB>0&&inst.refA!==inst.refB)mix=clamp(Math.log2(freq/inst.refA)/Math.log2(inst.refB/inst.refA),0,1);
    if(mix<.99){const g=ctx.createGain();g.gain.value=1-mix;g.connect(amp);slot(wa,inst.refA,g);}
    if(mix>.01){const g=ctx.createGain();g.gain.value=mix;g.connect(amp);slot(wb,inst.refB,g);}
  }else{
    const m=inst.morph,me=adsrPts(m,dur,clamp(m.depth,0,1));
    const ga=ctx.createGain(),gb=ctx.createGain();ga.connect(amp);gb.connect(amp);
    ga.gain.setValueAtTime(1,t0);gb.gain.setValueAtTime(0,t0);
    for(let k=1;k<me.pts.length;k++){const tt=t0+Math.min(me.pts[k][0],env.end);ga.gain.linearRampToValueAtTime(1-me.pts[k][1],tt);gb.gain.linearRampToValueAtTime(me.pts[k][1],tt);}
    slot(wa,inst.refA,ga);slot(wb,inst.refB,gb);
  }
}
const Player={
  s:null,listeners:[],
  on(fn){this.listeners.push(fn);},
  emit(){for(const f of this.listeners)f(this.s?this.s.o.tag:null);},
  tag(){return this.s?this.s.o.tag:null;},
  start(o){
    this.stop(true);
    const ctx=Snd.ensure();
    const bus=ctx.createGain();bus.connect(Snd.master);
    const s={o,ctx,bus,idx:0,t0:ctx.currentTime+.12,src:new Set(),timer:null,total:o.total};
    this.s=s;
    s.timer=setInterval(()=>this.tick(),50);
    this.tick();this.emit();
  },
  tick(){
    const s=this.s;if(!s)return;
    const now=s.ctx.currentTime,horizon=now+.8,ev=s.o.events;
    while(s.idx<ev.length){
      const e=ev[s.idx],at=s.t0+e.t;
      if(at>horizon)break;
      const inst=s.o.resolve(e.inst);
      if(inst)playVoice(s,inst,e.freq,Math.max(at,now+.003),e.d);
      s.idx++;
    }
    if(s.idx>=ev.length){
      const end=s.t0+s.total;
      if(s.o.loop&&s.total>.1){if(now+.8>=end){s.t0=end;s.idx=0;}}
      else if(now>end+1.8)this.stop();
    }
  },
  position(){const s=this.s;if(!s)return null;return clamp(s.ctx.currentTime-s.t0,0,s.total);},
  stop(quiet){
    const s=this.s;if(!s)return;
    clearInterval(s.timer);this.s=null;
    try{s.bus.gain.cancelScheduledValues(s.ctx.currentTime);s.bus.gain.setTargetAtTime(0,s.ctx.currentTime,.012);}catch(e){}
    setTimeout(()=>{for(const x of s.src){try{x.stop();}catch(e){}}try{s.bus.disconnect();}catch(e){}},120);
    if(!quiet)this.emit();
  }
};

export {Snd, Player};
