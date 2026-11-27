import {clamp, store, debounce, cssv, PALETTE} from './dom.js';

function shape(kind,W,D,duty){
  const out=[],top=D-1;
  for(let i=0;i<W;i++){
    const x=i/W;let v;
    switch(kind){
      case 'sine':v=(Math.sin(x*2*Math.PI)+1)/2;break;
      case 'tri':v=x<.5?x*2:2-x*2;break;
      case 'saw':v=i/(W-1);break;
      case 'pulse':v=x<(duty||.5)?1:0;break;
      case 'organ':v=(Math.sin(x*2*Math.PI)+.5*Math.sin(x*4*Math.PI+.6)+.3*Math.sin(x*6*Math.PI+1.2));v=(v/1.8+1)/2;break;
      case 'random':v=Math.random();break;
      default:v=.5;
    }
    out.push(clamp(Math.round(v*top),0,top));
  }
  return out;
}
function mkWave(id,name,kind,o){
  o=o||{};const W=o.w||32,D=o.d||16;
  return{id,name,type:o.type||'cycle',w:W,d:D,data:shape(kind,W,D,o.duty),smooth:false,shotMs:o.shotMs||90,hz:o.hz||11025,metal:!!o.metal};
}
function mkInst(name,o){
  return Object.assign({name,mode:'single',waveA:'w-square',waveB:null,refA:261.63,refB:1046.5,follow:true,gain:.7,amp:{a:.004,d:.08,s:.7,r:.08},morph:{a:.002,d:.3,s:0,r:.05,depth:1},pitch:{cents:0,time:.08}},o);
}
function starterLibrary(){
  return{
    waves:[
      mkWave('w-pulse','Pulse 25%','pulse',{duty:.25}),
      mkWave('w-square','Square','pulse',{duty:.5}),
      mkWave('w-tri','Triangle','tri'),
      mkWave('w-saw','Saw','saw'),
      mkWave('w-sine','Sine','sine'),
      mkWave('w-organ','Organ','organ'),
      mkWave('w-noise','White noise','sine',{type:'noise',hz:16000}),
      mkWave('w-metal','Metal noise','sine',{type:'noise',hz:7000,metal:true})
    ],
    insts:[
      mkInst('pulse',{waveA:'w-pulse',gain:.6,amp:{a:.004,d:.07,s:.65,r:.07}}),
      mkInst('square',{waveA:'w-square',gain:.5}),
      mkInst('tri',{waveA:'w-tri',gain:.95,amp:{a:.005,d:.04,s:.9,r:.1}}),
      mkInst('saw',{waveA:'w-saw',gain:.5,amp:{a:.006,d:.12,s:.6,r:.1}}),
      mkInst('bass',{waveA:'w-organ',gain:.95,amp:{a:.003,d:.2,s:.5,r:.06}}),
      mkInst('pluck',{mode:'morph',waveA:'w-tri',waveB:'w-pulse',gain:.8,amp:{a:.002,d:.4,s:.1,r:.12},morph:{a:.002,d:.28,s:0,r:.05,depth:1}}),
      mkInst('keys',{mode:'pair',waveA:'w-tri',waveB:'w-pulse',refA:130.8,refB:1046.5,gain:.8,amp:{a:.004,d:.25,s:.35,r:.2}}),
      mkInst('kick',{waveA:'w-sine',follow:false,refA:50,gain:1.5,amp:{a:.001,d:.24,s:0,r:.02},pitch:{cents:3600,time:.1}}),
      mkInst('snare',{waveA:'w-noise',follow:false,gain:.8,amp:{a:.001,d:.14,s:0,r:.03}}),
      mkInst('hat',{waveA:'w-metal',follow:false,gain:.55,amp:{a:.001,d:.04,s:0,r:.01}}),
      mkInst('tom',{waveA:'w-sine',follow:true,gain:1.2,amp:{a:.001,d:.3,s:0,r:.04},pitch:{cents:900,time:.09}})
    ]
  };
}
const Lib={
  waves:[],insts:[],selInst:null,selWave:null,
  wave(id){return this.waves.find(w=>w.id===id);},
  inst(name){return this.insts.find(i=>i.name===name);},
  names(){return new Set(this.insts.map(i=>i.name));},
  defaultName(){return this.inst('pulse')?'pulse':(this.insts[0]&&this.insts[0].name)||null;},
  reset(){const s=starterLibrary();this.waves=s.waves;this.insts=s.insts;this.selInst=this.insts[0].name;this.selWave=this.waves[0].id;},
  load(){
    const raw=store.get('motynth.lib.v1');
    try{
      const o=JSON.parse(raw);
      if(o&&Array.isArray(o.waves)&&o.waves.length&&Array.isArray(o.insts)&&o.insts.length){
        this.waves=o.waves;this.insts=o.insts;
        for(const i of this.insts){i.amp=i.amp||{a:.004,d:.08,s:.7,r:.08};i.morph=i.morph||{a:.002,d:.3,s:0,r:.05,depth:1};i.pitch=i.pitch||{cents:0,time:.08};if(!this.wave(i.waveA))i.waveA=this.waves[0].id;if(i.waveB&&!this.wave(i.waveB))i.waveB=null;}
        this.selInst=this.insts[0].name;this.selWave=this.waves[0].id;return;
      }
    }catch(e){}
    this.reset();
  },
  save:debounce(function(){store.set('motynth.lib.v1',JSON.stringify({waves:Lib.waves,insts:Lib.insts}));},400)
};
function uniqueName(base,taken){let n=base,k=2;while(taken.has(n)){n=base+'_'+k++;}return n;}
function instColor(name){const i=Lib.insts.findIndex(x=>x.name===name);return cssv(PALETTE[(i<0?0:i)%PALETTE.length]);}

export {shape, mkWave, Lib, uniqueName, instColor};
