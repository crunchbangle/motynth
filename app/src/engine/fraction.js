const gcd=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){const t=a%b;a=b;b=t;}return a||1;};
const F=(n,d=1)=>{if(d<0){n=-n;d=-d;}const g=gcd(n,d);return{n:n/g,d:d/g};};
const fadd=(a,b)=>F(a.n*b.d+b.n*a.d,a.d*b.d);
const fsub=(a,b)=>F(a.n*b.d-b.n*a.d,a.d*b.d);
const fmul=(a,b)=>F(a.n*b.n,a.d*b.d);
const fdiv=(a,b)=>F(a.n*b.d,a.d*b.n);
const fcmp=(a,b)=>a.n*b.d-b.n*a.d;
const fnum=a=>a.n/a.d;
const F0=F(0),F1=F(1);
function fparse(s){const m=/^(\d+)(?:\.(\d+))?$/.exec(s);if(!m)return null;const dec=m[2]||'';return F(parseInt(m[1]+dec,10),Math.pow(10,dec.length));}

export {F, fadd, fsub, fmul, fdiv, fcmp, fnum, F0, F1, fparse};
