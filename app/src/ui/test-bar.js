import {compile} from '../engine/index.js';
import {h, $, debounce} from './dom.js';
import {Player, Snd} from './audio.js';
import {curInst} from './sounds.js';

const TESTS=[['Melody','[1:e 3 5 8 5 3 1:q]'],['Scale','[1:e 2 3 4 5 6 7 8:q]'],['Chords','[(1 3 5):h (2 4 6):h]'],['Low line','[1:e 1 5 1 4 1 5:q]'],['Hits','[x:q x x:e x x:q]']];
const Test={
  inst:null,
  init(){
    const sel=$('#testPreset');
    TESTS.forEach((t,i)=>sel.append(h('option',{value:String(i)},t[0])));
    sel.addEventListener('change',()=>{$('#testMotif').value=TESTS[+sel.value][1];this.play();});
    $('#testPlay').addEventListener('click',()=>{if(Player.tag()==='test')Player.stop();else this.play();});
    $('#testMotif').addEventListener('change',()=>this.play());
    $('#testOct').addEventListener('change',()=>this.play());
    this.sched=debounce(()=>{if($('#testAuto').checked&&!$('#view-sounds').hidden)this.play();},380);
  },
  schedule(){this.sched();},
  play(){
    const inst=curInst();if(!inst)return;
    const msg=$('#testMsg');msg.textContent='';
    const oct=parseInt($('#testOct').value,10)||0;
    const res=compile('piece = ('+$('#testMotif').value+')^'+oct,{instruments:null,defaultInst:null});
    if(!res.ok){msg.textContent=res.error.msg;return;}
    Snd.ensure();
    Player.start({tag:'test',events:res.events,total:res.total,loop:false,resolve:()=>inst});
  }
};

export {TESTS, Test};
