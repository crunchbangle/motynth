import {cssv, clamp} from './dom.js';

function drawThumb(cv,w){
  const g=cv.getContext('2d');
  const W=w.type==='noise'?24:w.data.length,H=10;
  cv.width=W;cv.height=H;
  g.fillStyle=cssv('--cell-bg');g.fillRect(0,0,W,H);
  g.fillStyle=cssv('--cell-on');
  if(w.type==='noise'){
    let s=w.id.length*7+(w.metal?3:1);
    for(let i=0;i<W;i++){s=(s*1103515245+12345)&0x7fffffff;const v=Math.floor((s/0x7fffffff)*(H-2));g.fillRect(i,v,1,2);}
    return;
  }
  for(let i=0;i<W;i++){const v=Math.round((1-w.data[i]/(w.d-1))*(H-2));g.fillRect(i,v,1,2);}
}
function drawEnv(cv,e){
  const g=cv.getContext('2d'),W=56,H=14;cv.width=W;cv.height=H;
  g.fillStyle=cssv('--cell-bg');g.fillRect(0,0,W,H);
  const hold=Math.max(.12,(e.a+e.d)*.6),T=e.a+e.d+hold+e.r;
  const fill=cssv('--cell-fill'),on=cssv('--cell-on');
  for(let x=0;x<W;x++){
    const t=(x+.5)/W*T;let v;
    if(t<e.a)v=e.a>0?t/e.a:1;
    else if(t<e.a+e.d)v=1+(e.s-1)*((t-e.a)/Math.max(e.d,1e-6));
    else if(t<e.a+e.d+hold)v=e.s;
    else v=e.s*(1-(t-e.a-e.d-hold)/Math.max(e.r,1e-6));
    v=clamp(v,0,1);const hh=Math.round(v*(H-2));
    g.fillStyle=fill;g.fillRect(x,H-hh,1,hh);g.fillStyle=on;g.fillRect(x,H-hh-1,1,1);
  }
  g.fillStyle=cssv('--cell-grid');
  g.fillRect(Math.round((e.a+e.d)/T*W),0,1,H);g.fillRect(Math.round((e.a+e.d+hold)/T*W),0,1,H);
}
function drawWave(cv,w){
  const W=w.data.length,D=w.d,cw=Math.floor(448/W),ch=Math.floor(224/D);
  cv.width=W*cw;cv.height=D*ch;
  const g=cv.getContext('2d');
  g.fillStyle=cssv('--cell-bg');g.fillRect(0,0,cv.width,cv.height);
  const fill=cssv('--cell-fill'),on=cssv('--cell-on'),grid=cssv('--cell-grid'),zero=cssv('--cell-zero');
  const mid=D/2;
  for(let i=0;i<W;i++){
    const row=D-1-w.data[i];
    g.fillStyle=fill;
    if(row<mid)g.fillRect(i*cw,row*ch,cw,(mid-row)*ch);
    else g.fillRect(i*cw,mid*ch,cw,(row-mid+1)*ch);
  }
  g.fillStyle=grid;
  for(let i=1;i<W;i++)g.fillRect(i*cw,0,1,cv.height);
  for(let j=1;j<D;j++)g.fillRect(0,j*ch,cv.width,1);
  g.fillStyle=zero;g.fillRect(0,mid*ch-1,cv.width,2);
  g.fillStyle=on;
  for(let i=0;i<W;i++){const row=D-1-w.data[i];g.fillRect(i*cw+1,row*ch+1,cw-1,ch-1);}
  if(w.smooth){
    g.strokeStyle=zero;g.lineWidth=2;g.beginPath();
    for(let i=0;i<W;i++){const x=i*cw+cw/2,y=(D-1-w.data[i])*ch+ch/2;i?g.lineTo(x,y):g.moveTo(x,y);}
    g.stroke();
  }
}

export {drawThumb, drawEnv, drawWave};
