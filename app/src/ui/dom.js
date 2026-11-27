const $=(s,r=document)=>r.querySelector(s);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function h(tag,attrs,...kids){
  const el=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(v==null||v===false)continue;
    if(k==='class')el.className=v;
    else if(k==='style')el.style.cssText=v;
    else if(k.startsWith('on'))el.addEventListener(k.slice(2),v);
    else if(k==='html')el.innerHTML=v;
    else if(k in el){try{el[k]=v;}catch(e){el.setAttribute(k,v);}}
    else el.setAttribute(k,v);
  }
  for(const kid of kids.flat(Infinity)){if(kid==null||kid===false)continue;el.append(kid.nodeType?kid:document.createTextNode(String(kid)));}
  return el;
}
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const debounce=(fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const uid=()=>Math.random().toString(36).slice(2,9);
const PALETTE=['--blue','--pink','--amber','--teal','--violet','--red'];
const fmtTime=s=>{s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const fmtT=v=>v<1?Math.round(v*1000)+' ms':v.toFixed(2)+' s';
const ICON_PLAY='<svg viewBox="0 0 8 8" aria-hidden="true"><path d="M1 0h2v1h1v1h1v1h1v2H5v1H4v1H3v1H1z"/></svg>';
const ICON_STOP='<svg viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1h6v6H1z"/></svg>';

export {$, clamp, h, store, cssv, debounce, esc, uid, PALETTE, fmtTime, fmtT, ICON_PLAY, ICON_STOP};
