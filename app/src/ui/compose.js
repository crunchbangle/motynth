import {compile} from '../engine/index.ts';
import {EXAMPLES} from '../content/examples.ts';
import {h, $, store, debounce, fmtTime, cssv, clamp} from './dom.js';
import {Lib, instColor} from './library.js';
import {Player, Snd} from './audio.js';
import {hi} from './highlight.js';

const Compose={
  last:null,prev:null,
  compileNow(src){return compile(src,{instruments:Lib.names(),defaultInstrument:Lib.defaultName()});},
  init(){
    this.ta=$('#code');this.hlIn=$('#hlIn');this.gut=$('#gutIn');
    const saved=store.get('motynth.code.v1');
    this.ta.value=saved!=null&&saved.trim()?saved:EXAMPLES[0].code;
    this.errLine=0;
    const redo=debounce(()=>this.live(),220);
    this.ta.addEventListener('input',()=>{this.render();redo();store.set('motynth.code.v1',this.ta.value);$('#restore').hidden=true;});
    this.ta.addEventListener('scroll',()=>this.sync());
    this.ta.addEventListener('keydown',e=>{
      if(e.key==='Tab'){
        e.preventDefault();const t=this.ta,a=t.selectionStart,b=t.selectionEnd;
        t.setRangeText('  ',a,b,'end');t.dispatchEvent(new Event('input'));
      }else if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();this.play(true);}
    });
    const sel=$('#examples');
    EXAMPLES.forEach((x,i)=>sel.append(h('option',{value:String(i)},x.name)));
    sel.addEventListener('change',()=>{
      if(sel.value==='')return;
      this.prev=this.ta.value;this.ta.value=EXAMPLES[+sel.value].code;sel.value='';
      this.render();this.live();store.set('motynth.code.v1',this.ta.value);$('#restore').hidden=false;
    });
    $('#restore').addEventListener('click',()=>{if(this.prev!=null){this.ta.value=this.prev;this.render();this.live();store.set('motynth.code.v1',this.ta.value);}$('#restore').hidden=true;});
    this.render();this.live();
  },
  render(){
    const lines=this.ta.value.split('\n');
    this.hlIn.innerHTML=lines.map((l,i)=>'<div class="ln'+(this.errLine===i+1?' bad':'')+'">'+(hi(l)||' ')+'</div>').join('');
    this.gut.innerHTML=lines.map((_,i)=>'<div class="'+(this.errLine===i+1?'bad':'')+'">'+(i+1)+'</div>').join('');
    this.sync();
  },
  sync(){
    this.hlIn.style.transform='translate('+(-this.ta.scrollLeft)+'px,'+(-this.ta.scrollTop)+'px)';
    this.gut.style.transform='translateY('+(-this.ta.scrollTop)+'px)';
  },
  live(){
    const res=this.compileNow(this.ta.value);this.last=res;
    this.errLine=res.ok?0:res.error.line;
    this.render();
    const st=$('#status');
    st.className='status'+(res.ok?'':' err');
    st.replaceChildren(h('span',{class:'dot'}),res.ok
      ?h('span',{},'Ready. ',h('b',{},fmtTime(res.durationSeconds)),' long, ',res.events.length+' notes, '+Math.round(res.bpm*10)/10+' bpm.')
      :h('span',{},h('b',{},'Line '+res.error.line+': '),res.error.message));
    drawRoll(res.ok?res:null);
    return res;
  },
  play(restart){
    if(!restart&&Player.tag()==='compose'){Player.stop();return;}
    Snd.ensure();
    const res=this.live();
    if(!res.ok){this.ta.focus();return;}
    if(!res.events.length){return;}
    Player.start({tag:'compose',events:res.events,total:res.durationSeconds,loop:$('#loop').checked,resolve:n=>Lib.inst(n)});
  }
};

/* piano roll */
let rollState=null;
function drawRoll(res){
  const cv=$('#roll'),box=cv.parentElement;
  const dpr=window.devicePixelRatio||1,W=box.clientWidth-4,H=box.clientHeight-4;
  if(W<=0||H<=0)return;
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
  g.fillStyle=cssv('--cell-bg');g.fillRect(0,0,W,H);
  rollState=res;
  const empty=$('#rollEmpty'),leg=$('#legend'),stats=$('#stats');
  if(!res||!res.events.length){
    empty.hidden=false;leg.replaceChildren();stats.replaceChildren();return;
  }
  empty.hidden=true;
  const pad=6,total=Math.max(res.durationSeconds,.1);
  const pitched=[],unp=[];
  for(const e of res.events){const ins=Lib.inst(e.instrument);((ins&&!ins.follow)||e.isHit&&!(ins&&ins.follow)?unp:pitched).push(e);}
  const unpNames=[...new Set(unp.map(e=>e.instrument))];
  const bandRow=Math.min(10,Math.max(5,Math.floor((H*.38)/Math.max(1,unpNames.length))));
  const bandH=unpNames.length?unpNames.length*bandRow+6:0;
  const topH=H-bandH-pad*2;
  const spw=240/res.bpm;
  g.fillStyle=cssv('--cell-grid');
  for(let t=0;t<total;t+=spw)g.fillRect(Math.round(pad+t/total*(W-pad*2)),0,1,H);
  if(bandH){g.fillRect(0,H-bandH-pad+2,W,1);}
  if(pitched.length){
    let lo=1e9,hi_=-1e9;for(const e of pitched){lo=Math.min(lo,e.step);hi_=Math.max(hi_,e.step);}
    const rows=hi_-lo+3;const rh=clamp(topH/rows,2,14);const used=rh*rows;const oy=pad+(topH-used)/2;
    for(const e of pitched){
      const x=pad+e.start/total*(W-pad*2),w=Math.max(2,e.duration/total*(W-pad*2)-1);
      g.fillStyle=instColor(e.instrument);
      g.fillRect(Math.round(x),Math.round(oy+(hi_-e.step+1)*rh),Math.round(w),Math.max(2,Math.floor(rh)-1));
    }
  }
  const by0=H-bandH-pad+5;
  for(const e of unp){
    const row=unpNames.indexOf(e.instrument);
    const x=pad+e.start/total*(W-pad*2);
    g.fillStyle=instColor(e.instrument);
    g.fillRect(Math.round(x),by0+row*bandRow,Math.max(2,Math.min(6,Math.round(e.duration/total*(W-pad*2)))),Math.max(2,bandRow-2));
  }
  leg.replaceChildren(...res.instrumentsUsed.map(n=>h('span',{},h('i',{style:'background:'+instColor(n)}),n)));
  stats.replaceChildren(h('span',{},'Length ',h('b',{},fmtTime(res.durationSeconds))),h('span',{},'Notes ',h('b',{},res.events.length)),h('span',{},'Tempo ',h('b',{},Math.round(res.bpm*10)/10)));
}

export {Compose, rollState, drawRoll};
