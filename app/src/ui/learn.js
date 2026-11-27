import {LESSONS, REFERENCE} from '../content/lessons.js';
import {compile} from '../engine/index.ts';
import {h, $, store} from './dom.js';
import {Lib} from './library.js';
import {Player, Snd} from './audio.js';
import {hi} from './highlight.js';
import {Compose} from './compose.js';
import {refreshTransport} from './transport.js';
import {showTab} from './tabs.js';

const Learn={
  idx:0,
  init(){this.render();},
  render(){
    const nav=$('#lessonNav');nav.replaceChildren(h('h2',{style:'margin-bottom:10px;font-size:18px'},'Lessons'),
      ...LESSONS.map((l,i)=>h('button',{'aria-current':i===this.idx?'true':'false',onclick:()=>{this.idx=i;this.render();window.scrollTo({top:0});}},l.title)));
    const art=$('#lesson');art.replaceChildren();
    const L=LESSONS[this.idx];
    art.append(h('h2',{},L.title));
    if(L.ref){
      art.append(h('p',{},'Everything the language understands, in one place.'));
      const ctx={instruments:Lib.names()};
      for(const [grp,rows] of REFERENCE)art.append(h('h3',{},grp),h('table',{class:'reftbl'},h('tbody',{},rows.map(r=>h('tr',{},h('td',{},r[0]),h('td',{},typeof r[1]==='function'?r[1](ctx):r[1]))))));
    }
    L.blocks.forEach((b,k)=>{
      if(b.p)art.append(h('p',{},b.p));
      else if(b.code)art.append(this.snippet(b.code,L.id+'-'+k));
    });
    art.append(h('div',{class:'pager'},
      this.idx>0?h('button',{class:'btn',onclick:()=>{this.idx--;this.render();window.scrollTo({top:0});}},'Previous: '+LESSONS[this.idx-1].title):h('span'),
      this.idx<LESSONS.length-1?h('button',{class:'btn',onclick:()=>{this.idx++;this.render();window.scrollTo({top:0});}},'Next: '+LESSONS[this.idx+1].title):h('span')));
    refreshTransport();
  },
  snippet(code,id){
    const msg=h('span',{class:'snip-msg',role:'alert'});
    const play=h('button',{class:'btn small','data-snip':id,onclick:()=>{
      if(Player.tag()===id){Player.stop();return;}
      msg.textContent='';
      const res=compile(code,{instruments:Lib.names(),defaultInstrument:Lib.defaultName()});
      if(!res.ok){msg.textContent='Line '+res.error.line+': '+res.error.message;return;}
      Snd.ensure();
      Player.start({tag:id,events:res.events,total:res.durationSeconds,loop:false,resolve:n=>Lib.inst(n)});
    }});
    const open=h('button',{class:'btn small',onclick:()=>{Compose.ta.value=code;store.set('motynth.code.v1',code);Compose.render();showTab('compose');Compose.live();}},'Open in Compose');
    return h('div',{class:'snip'},h('pre',{html:code.split('\n').map(hi).join('\n')}),h('div',{class:'snip-bar'},play,open,msg));
  }
};

export {Learn};
