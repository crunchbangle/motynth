import {esc} from './dom.js';

const TOK=/(\/\/.*$)|(\b(?:tuning|register|names|mode|tempo|root|motif|play|with|section|staff|length|rest|of)\b)|(\b(?:rev|inv|fit|loop|sets-length|x\d+)\b)|(\b[A-Za-z_][A-Za-z0-9_]*(?=\s*:(?!\s*[whqest][.*\d\/]*(?![A-Za-z0-9_]))))|(:[whqest][.*\d\/]*(?![A-Za-z0-9_]))|(\bn?\d+(?:\.\d+)?[#b]*(?:\^-?\d+)?)|([\[\]\(\)\{\}])/g;
function hi(line){
  let out='',last=0;TOK.lastIndex=0;let m;
  while((m=TOK.exec(line))){
    if(m.index>last)out+=esc(line.slice(last,m.index));
    const cls=m[1]?'com':m[2]?'kw':m[3]?'mod':m[4]?'inst':m[5]?'dur':m[6]?'num':'pun';
    out+='<span class="tk-'+cls+'">'+esc(m[0])+'</span>';last=m.index+m[0].length;
    if(m[0].length===0)TOK.lastIndex++;
  }
  return out+esc(line.slice(last));
}

export {hi};
