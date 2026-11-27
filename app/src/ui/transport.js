import {$, ICON_STOP, ICON_PLAY, clamp} from './dom.js';
import {Player, Snd} from './audio.js';
import {rollState} from './compose.js';

function refreshTransport(){
  const b=$('#playbtn'),playing=Player.tag()==='compose';
  b.innerHTML=(playing?ICON_STOP:ICON_PLAY)+'<span>'+(playing?'Stop':'Play')+'</span>';
  b.setAttribute('aria-pressed',playing?'true':'false');
  document.querySelectorAll('[data-snip]').forEach(btn=>{
    const on=Player.tag()===btn.dataset.snip;
    btn.innerHTML=(on?ICON_STOP:ICON_PLAY)+'<span>'+(on?'Stop':'Play')+'</span>';
  });
  const tb=$('#testPlay');if(tb)tb.innerHTML=(Player.tag()==='test'?ICON_STOP:ICON_PLAY)+'<span>'+(Player.tag()==='test'?'Stop':'Play test')+'</span>';
}
function frame(){
  const ph=$('#playhead'),cv=$('#scope'),g=cv.getContext('2d');
  const pos=Player.position();
  if(Player.tag()==='compose'&&rollState&&rollState.ok!==false&&pos!=null){
    const box=$('#roll').parentElement,W=box.clientWidth-4,pad=6;
    ph.style.display='block';ph.style.left=Math.round(pad+pos/Math.max(rollState.durationSeconds,.1)*(W-pad*2))+'px';
  }else ph.style.display='none';
  g.fillStyle='#0a0c1b';g.fillRect(0,0,cv.width,cv.height);
  if(Player.s&&Snd.analyser){
    const data=new Uint8Array(Snd.analyser.fftSize);Snd.analyser.getByteTimeDomainData(data);
    g.fillStyle='#2ed3bf';
    for(let x=0;x<cv.width;x++){const v=data[Math.floor(x/cv.width*data.length*.5)]/255;const y=Math.round((1-v)*(cv.height-2));g.fillRect(x,clamp(y,0,cv.height-2),1,2);}
  }else{g.fillStyle='#3b4380';g.fillRect(0,cv.height/2,cv.width,1);}
  requestAnimationFrame(frame);
}

export {refreshTransport, frame};
