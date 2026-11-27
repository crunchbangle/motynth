import {h, $, cssv, PALETTE, uid, clamp, fmtT} from './dom.js';
import {Lib, uniqueName, mkWave, shape} from './library.js';
import {Compose} from './compose.js';
import {drawThumb, drawEnv, drawWave} from './wave-draw.js';
import {Test} from './test-bar.js';

const curInst=()=>Lib.inst(Lib.selInst);
const curWave=()=>Lib.wave(Lib.selWave);
function touch(){Lib.save();Test.schedule();}

function renderSounds(){renderLists();renderInstEditor();renderWaveEditor();}
function renderLists(){
  const host=$('#lists');host.replaceChildren();
  host.append(
    h('div',{class:'listhead'},h('h2',{},'Instruments'),h('button',{class:'btn small',onclick:()=>{
      const base=curInst()||Lib.insts[0];const n=uniqueName('inst',Lib.names());
      const c=JSON.parse(JSON.stringify(base));c.name=n;Lib.insts.push(c);Lib.selInst=n;touch();renderSounds();
    }},'New')),
    h('ul',{class:'list'},Lib.insts.map((i,k)=>h('li',{},h('button',{'aria-current':i.name===Lib.selInst?'true':'false',onclick:()=>{Lib.selInst=i.name;const w=Lib.wave(i.waveA);if(w)Lib.selWave=w.id;renderSounds();Test.schedule();}},
      h('i',{style:'background:'+cssv(PALETTE[k%PALETTE.length])}),i.name)))),
    h('div',{class:'listhead'},h('h2',{},'Waves'),h('button',{class:'btn small',onclick:()=>{
      const id='w-'+uid();Lib.waves.push(mkWave(id,'Wave '+(Lib.waves.length+1),'sine'));Lib.selWave=id;Lib.save();renderSounds();
    }},'New')),
    h('ul',{class:'list'},Lib.waves.map(w=>{const cv=h('canvas',{});const b=h('li',{},h('button',{'aria-current':w.id===Lib.selWave?'true':'false',onclick:()=>{Lib.selWave=w.id;renderSounds();}},cv,w.name));drawThumb(cv,w);return b;})),
    (()=>{const b=h('button',{class:'btn small',onclick:()=>{
      if(!b.dataset.sure){b.dataset.sure='1';b.textContent='Click again to replace everything';setTimeout(()=>{b.dataset.sure='';b.textContent='Restore starter sounds';},3000);return;}
      Lib.reset();Lib.save();renderSounds();
    }},'Restore starter sounds');return b;})()
  );
}

function slider(label,min,max,step,value,fmt,onInput){
  const out=h('output',{},fmt(value));
  const inp=h('input',{type:'range',min,max,step,value,oninput:e=>{const v=parseFloat(e.target.value);out.textContent=fmt(v);onInput(v);}});
  return h('label',{class:'sl'},h('span',{class:'sl-l'},label),inp,out);
}
function timeSlider(label,max,value,onInput){
  const toV=t=>Math.round(Math.sqrt(clamp(t/max,0,1))*1000),toT=v=>Math.round((v/1000)**2*max*1000)/1000;
  return slider(label,0,1000,1,toV(value),v=>fmtT(toT(v)),v=>onInput(toT(v)));
}
function envBlock(env,withDepth,onChange){
  const cv=h('canvas',{class:'envcv'});
  const redraw=()=>drawEnv(cv,env);redraw();
  const ch=()=>{redraw();onChange();};
  const out=[cv,
    timeSlider('Attack',1.5,env.a,v=>{env.a=v;ch();}),
    timeSlider('Decay',2,env.d,v=>{env.d=v;ch();}),
    slider('Sustain',0,1,.01,env.s,v=>Math.round(v*100)+'%',v=>{env.s=v;ch();}),
    timeSlider('Release',2,env.r,v=>{env.r=v;ch();})];
  if(withDepth)out.push(slider('Amount of B',0,1,.01,env.depth,v=>Math.round(v*100)+'%',v=>{env.depth=v;ch();}));
  return out;
}

function renderInstEditor(){
  const host=$('#instEd');host.replaceChildren();
  const inst=curInst();
  if(!inst){host.append(h('h2',{},'Instrument'),h('p',{class:'hint'},'Pick an instrument on the left.'));return;}
  const rerender=()=>{renderInstEditor();renderLists();};
  const warn=h('div',{class:'warn',role:'alert'});
  const name=h('input',{type:'text',value:inst.name,maxLength:24,'aria-label':'Instrument name',
    oninput:e=>{const v=e.target.value;warn.textContent=v===inst.name||(/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)&&!Lib.inst(v))?'':'Use letters, digits and _ (starting with a letter), and a name no other instrument has.';},
    onchange:e=>{const v=e.target.value;if(v===inst.name)return;
      if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)&&!Lib.inst(v)&&!['x','r','rest'].includes(v)){inst.name=v;Lib.selInst=v;warn.textContent='';touch();renderLists();Compose.live();}
      else{e.target.value=inst.name;warn.textContent='Kept the old name: use letters, digits and _ (starting with a letter), unused by other instruments.';}}});
  const modeDesc={single:'One waveform, played at the pitch of each note.',pair:'Two waveforms that crossfade by pitch. Low notes use A, high notes use B, and in between they blend. The reference pitches say where each one is at full strength.',morph:'The timbre changes during each note. It starts on A and blends toward B following the morph envelope.'};
  const seg=h('div',{class:'seg',role:'group','aria-label':'Sound type'},[['single','Single'],['pair','Pitch pair'],['morph','Morph']].map(([k,l])=>h('button',{'aria-pressed':inst.mode===k?'true':'false',onclick:()=>{
    inst.mode=k;if(k!=='single'&&(!inst.waveB||!Lib.wave(inst.waveB)))inst.waveB=(Lib.waves.find(w=>w.id!==inst.waveA)||Lib.waves[0]).id;
    touch();renderInstEditor();}},l)));
  function slot(label,key,refKey,isB){
    const w=Lib.wave(inst[key]);
    const cv=h('canvas',{title:'Edit this wave',onclick:()=>{Lib.selWave=inst[key];renderLists();renderWaveEditor();}});if(w)drawThumb(cv,w);
    const sel=h('select',{'aria-label':'Wave '+label,onchange:e=>{inst[key]=e.target.value;touch();renderInstEditor();}},Lib.waves.map(x=>h('option',{value:x.id,selected:x.id===inst[key]},x.name)));
    const needRef=inst.mode==='pair'||!inst.follow||(w&&w.type==='shot');
    const ref=needRef?h('label',{class:'hint'},'Reference ',h('input',{type:'number',min:20,max:12000,step:1,value:Math.round(inst[refKey]*100)/100,'aria-label':'Reference pitch '+label+' in Hz',onchange:e=>{const v=parseFloat(e.target.value);if(v>0){inst[refKey]=v;touch();}}}),' Hz'):null;
    return h('div',{class:'slot'},h('span',{class:'l'},'Wave '+label),sel,cv,ref);
  }
  const follow=h('label',{class:'field'},h('input',{type:'checkbox',checked:inst.follow,onchange:e=>{inst.follow=e.target.checked;touch();renderInstEditor();}}),h('span',{},'Follows the note\u2019s pitch'));
  host.append(
    h('h2',{},'Instrument'),
    h('div',{class:'field'},h('span',{class:'l'},'Name in code'),name),warn,
    h('div',{class:'field'},h('span',{class:'l'},'Sound type'),seg),
    h('p',{class:'hint'},modeDesc[inst.mode]),
    slot('A','waveA','refA'),
    inst.mode!=='single'?slot('B','waveB','refB'):null,
    follow,
    !inst.follow?h('p',{class:'hint'},'It plays at its reference pitch whatever the note. Good for drums.'):null,
    slider('Volume',0,2,.01,inst.gain,v=>Math.round(v*100)+'%',v=>{inst.gain=v;touch();}),
    h('h3',{},'Volume envelope'),
    ...envBlock(inst.amp,false,touch),
    inst.mode==='morph'?[h('h3',{},'Morph envelope (A to B)'),h('p',{class:'hint'},'Same controls, but it moves the blend: 0% is all A, 100% is all B.'),...envBlock(inst.morph,true,touch)]:null,
    h('h3',{},'Pitch envelope'),
    h('p',{class:'hint'},'Starts off-pitch and glides to the note. A big drop is what makes a kick.'),
    slider('Start offset',-4800,4800,50,inst.pitch.cents,v=>(v>0?'+':'')+(v/100)+' st',v=>{inst.pitch.cents=v;touch();}),
    timeSlider('Glide time',.6,inst.pitch.time,v=>{inst.pitch.time=Math.max(.005,v);touch();}),
    h('div',{class:'row',style:'margin-top:16px'},
      h('button',{class:'btn small',onclick:()=>{const c=JSON.parse(JSON.stringify(inst));c.name=uniqueName(inst.name,Lib.names());Lib.insts.push(c);Lib.selInst=c.name;touch();renderSounds();}},'Duplicate'),
      h('button',{class:'btn small danger',disabled:Lib.insts.length<2,onclick:()=>{Lib.insts=Lib.insts.filter(x=>x!==inst);Lib.selInst=Lib.insts[0].name;Lib.save();renderSounds();Compose.live();}},'Delete'))
  );
}

function resampleData(data,W,D,nW,nD){
  const out=[];for(let i=0;i<nW;i++){const v=data[Math.min(W-1,Math.floor(i/nW*W))];out.push(clamp(Math.round(v/(D-1)*(nD-1)),0,nD-1));}return out;
}
function renderWaveEditor(){
  const host=$('#waveEd');host.replaceChildren();
  const w=curWave();
  if(!w){host.append(h('h2',{},'Wave'));return;}
  const change=()=>{Lib.save();Test.schedule();};
  const lists=()=>renderLists();
  host.append(h('h2',{},'Wave'));
  host.append(h('div',{class:'field'},h('span',{class:'l'},'Name'),h('input',{type:'text',value:w.name,maxLength:28,'aria-label':'Wave name',onchange:e=>{w.name=e.target.value||w.name;Lib.save();renderLists();renderInstEditor();}})));
  host.append(h('div',{class:'field'},h('span',{class:'l'},'Kind'),h('div',{class:'seg',role:'group','aria-label':'Wave kind'},[['cycle','Cycle'],['shot','One-shot'],['noise','Noise']].map(([k,l])=>h('button',{'aria-pressed':w.type===k?'true':'false',onclick:()=>{w.type=k;change();renderWaveEditor();lists();renderInstEditor();}},l)))));
  if(w.type==='noise'){
    host.append(
      h('p',{class:'hint'},'Random steps, held for a short grain. A low rate sounds crunchy; a high rate sounds like static. Metallic repeats a short 127-step pattern, which rings like a hi-hat.'),
      slider('Grain rate',500,44100,100,w.hz,v=>Math.round(v)+' Hz',v=>{w.hz=v;change();}),
      h('label',{class:'field'},h('input',{type:'checkbox',checked:w.metal,onchange:e=>{w.metal=e.target.checked;change();lists();}}),h('span',{},'Metallic (short repeating pattern)'))
    );
    return;
  }
  const cv=h('canvas',{class:'wavecv',role:'img','aria-label':'Waveform pixel grid. Click or drag to draw.'});
  const redraw=()=>{drawWave(cv,w);};
  redraw();
  let drawing=false,lastCol=-1,lastVal=0;
  const setAt=(ev)=>{
    const r=cv.getBoundingClientRect(),W=w.data.length,D=w.d;
    const col=clamp(Math.floor((ev.clientX-r.left)/r.width*W),0,W-1),row=clamp(Math.floor((ev.clientY-r.top)/r.height*D),0,D-1),val=D-1-row;
    if(lastCol>=0&&Math.abs(col-lastCol)>1){const a=Math.min(col,lastCol),b=Math.max(col,lastCol);for(let c=a;c<=b;c++){const t=(c-lastCol)/(col-lastCol);w.data[c]=Math.round(lastVal+(val-lastVal)*t);}}
    else w.data[col]=val;
    lastCol=col;lastVal=val;redraw();
  };
  cv.addEventListener('pointerdown',e=>{drawing=true;lastCol=-1;cv.setPointerCapture(e.pointerId);setAt(e);e.preventDefault();});
  cv.addEventListener('pointermove',e=>{if(drawing)setAt(e);});
  const end=()=>{if(!drawing)return;drawing=false;lastCol=-1;change();lists();renderInstEditor();};
  cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  host.append(cv);
  host.append(h('div',{class:'row'},
    h('span',{class:'rowl'},'Width'),
    h('select',{'aria-label':'Width in pixels',onchange:e=>{const nW=+e.target.value;w.data=resampleData(w.data,w.data.length,w.d,nW,w.d);change();renderWaveEditor();lists();}},[8,16,32,64].map(n=>h('option',{value:n,selected:w.data.length===n},n+' px'))),
    h('span',{class:'rowl'},'Levels'),
    h('select',{'aria-label':'Number of levels',onchange:e=>{const nD=+e.target.value;w.data=resampleData(w.data,w.data.length,w.d,w.data.length,nD);w.d=nD;change();renderWaveEditor();lists();}},[2,4,8,16].map(n=>h('option',{value:n,selected:w.d===n},n)))));
  host.append(h('label',{class:'field'},h('input',{type:'checkbox',checked:w.smooth,onchange:e=>{w.smooth=e.target.checked;redraw();change();}}),h('span',{},'Smooth the steps (off keeps the crunch)')));
  if(w.type==='shot')host.append(slider('Length',10,600,5,w.shotMs,v=>Math.round(v)+' ms',v=>{w.shotMs=v;change();}),h('p',{class:'hint'},'Plays once through the grid at the instrument\u2019s reference pitch, and is sped up or slowed down to follow other notes.'));
  else host.append(h('p',{class:'hint'},'One cycle of the wave. It repeats at the pitch of each note.'));
  const apply=(fn)=>()=>{fn();redraw();change();lists();renderInstEditor();};
  const gen=k=>apply(()=>{w.data=shape(k,w.data.length,w.d,k==='pulse'?.25:undefined);});
  host.append(h('div',{class:'row'},h('span',{class:'rowl'},'Start from'),
    ...[['sine','Sine'],['tri','Triangle'],['saw','Saw'],['pulse','Pulse'],['organ','Organ'],['random','Random']].map(([k,l])=>h('button',{class:'btn small',onclick:gen(k)},l))));
  host.append(h('div',{class:'row'},h('span',{class:'rowl'},'Edit'),
    h('button',{class:'btn small',onclick:apply(()=>{w.data=w.data.map(v=>w.d-1-v);})},'Flip'),
    h('button',{class:'btn small',onclick:apply(()=>{w.data=w.data.slice().reverse();})},'Mirror'),
    h('button',{class:'btn small',onclick:apply(()=>{w.data.unshift(w.data.pop());})},'Shift right'),
    h('button',{class:'btn small',onclick:apply(()=>{w.data.push(w.data.shift());})},'Shift left'),
    h('button',{class:'btn small',onclick:apply(()=>{w.data=w.data.map(()=>Math.floor(w.d/2));})},'Clear'),
    h('button',{class:'btn small danger',disabled:Lib.waves.length<2,onclick:()=>{
      const id=w.id;const other=Lib.waves.find(x=>x.id!==id);
      for(const i of Lib.insts){if(i.waveA===id)i.waveA=other.id;if(i.waveB===id)i.waveB=other.id;}
      Lib.waves=Lib.waves.filter(x=>x.id!==id);Lib.selWave=other.id;Lib.save();renderSounds();
    }},'Delete wave')));
  host.append(h('ul',{class:'tiplist'},h('li',{},'Click and drag on the grid to set each column.'),h('li',{},'The pink line is silence; a wave that sits above or below it is re-centered automatically.')));
}

export {curInst, renderSounds};
