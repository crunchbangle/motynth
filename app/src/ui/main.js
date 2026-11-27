import {$, store, debounce} from './dom.js';
import {Lib} from './library.js';
import {Player, Snd} from './audio.js';
import {Compose, drawRoll} from './compose.js';
import {refreshTransport, frame} from './transport.js';
import {Test, TESTS} from './test-bar.js';
import {Learn} from './learn.js';
import {showTab} from './tabs.js';

function buildLogo(){
  const cols=[2,3,5,6,5,3,1,2,4,5],cols2=['#7d90ff','#ff6fa3','#ffc04a','#2ed3bf','#a98cff'];
  const S=5,G=1,svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 '+cols.length*(S+G)+' '+6*(S+G));svg.setAttribute('width',cols.length*(S+G)*.9);svg.setAttribute('height',6*(S+G)*.9);svg.setAttribute('aria-hidden','true');
  cols.forEach((n,i)=>{for(let k=0;k<n;k++){const r=document.createElementNS('http://www.w3.org/2000/svg','rect');r.setAttribute('x',i*(S+G));r.setAttribute('y',(5-k)*(S+G));r.setAttribute('width',S);r.setAttribute('height',S);r.setAttribute('fill',cols2[(i+k)%5]);svg.append(r);}});
  $('#logo').replaceChildren(svg);
}
function boot(){
  Lib.load();
  buildLogo();
  Compose.init();Test.init();Learn.init();
  Player.on(refreshTransport);
  $('#playbtn').addEventListener('click',()=>{Snd.ensure();Compose.play();});
  ['compose','sounds','learn'].forEach(t=>$('#tab-'+t).addEventListener('click',()=>showTab(t)));
  $('#testMotif').value=TESTS[0][1];
  refreshTransport();
  const t=store.get('motynth.tab');showTab(['compose','sounds','learn'].includes(t)?t:'compose');
  window.addEventListener('resize',debounce(()=>{if(!$('#view-compose').hidden)drawRoll(Compose.last&&Compose.last.ok?Compose.last:null);},150));
  if(window.matchMedia)window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>showTab(store.get('motynth.tab')||'compose'));
  requestAnimationFrame(frame);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&Player.s)Player.stop();});

boot();
