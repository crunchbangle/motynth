const mod=(a,b)=>((a%b)+b)%b;
function degToNote(a,mode,N){const M=mode.length;const q=Math.floor(a/M);return mode[a-q*M]+q*N;}
function noteToDeg(n,mode,N){
  const M=mode.length;let q=Math.floor(n/N);const r=n-q*N;let k=-1;
  for(let j=0;j<M;j++)if(mode[j]<=r)k=j;
  if(k<0){q-=1;k=M-1;return{d:q*M+k,res:r+N-mode[k]};}
  return{d:q*M+k,res:r-mode[k]};
}
function modeArr(S){if(S.mode)return S.mode;const a=[];for(let k=0;k<S.N;k++)a.push(k);return a;}
function resolvePitch(S,p){
  const mode=modeArr(S),N=S.N;let n;
  if(p.kind==='deg'){n=degToNote(p.v-1+S.shift.deg,mode,N)+p.alt;}
  else{n=p.v+p.alt;if(S.shift.deg){const x=noteToDeg(n,mode,N);n=degToNote(x.d+S.shift.deg,mode,N)+x.res;}}
  return n+(p.reg+S.shift.reg)*N+S.shift.note;
}
const freqOf=e=>e.root*Math.pow(e.ratio,e.n/e.N);

export {degToNote, noteToDeg, modeArr, resolvePitch, freqOf};
