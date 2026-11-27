import {F, F1, fadd, fmul, fdiv, fparse} from './fraction.js';
import {UNIT, RESERVED, MotError} from './constants.js';

function parseProgram(src){
  let i=0;const L=src.length;
  const err=(m,p)=>{throw new MotError(m,p===undefined?i:p);};
  const IDENT=/[A-Za-z_][A-Za-z0-9_]*(?:-[A-Za-z][A-Za-z0-9_]*)*/y;
  const NUM=/\d+(?:\.\d+)?/y;
  const INT=/\d+/y;
  const isDigit=c=>c!==undefined&&c>='0'&&c<='9';
  const isWordChar=c=>c!==undefined&&/[A-Za-z0-9_]/.test(c);
  function skipInline(){for(;;){const c=src[i];if(c===' '||c==='\t'||c==='\r')i++;else if(c==='/'&&src[i+1]==='/'){while(i<L&&src[i]!=='\n')i++;}else break;}}
  function skipWS(){for(;;){skipInline();if(src[i]==='\n')i++;else break;}}
  function peekIdent(){IDENT.lastIndex=i;const m=IDENT.exec(src);return m?m[0]:null;}
  function ident(what){const w=peekIdent();if(!w)err('Expected '+(what||'a name'));i+=w.length;return w;}
  function found(){return i>=L?'the end':(src[i]==='\n'?'the end of the line':'"'+src[i]+'"');}
  function expect(ch,ctx){skipInline();if(src[i]!==ch)err('Expected "'+ch+'"'+(ctx?' '+ctx:'')+', found '+found());i++;}
  function number(what){skipInline();NUM.lastIndex=i;const m=NUM.exec(src);if(!m)err('Expected a number'+(what?' for '+what:'')+', found '+found());i+=m[0].length;return m[0];}
  function signedInt(){let neg=false;if(src[i]==='-'){neg=true;i++;}else if(src[i]==='+')i++;INT.lastIndex=i;const r=INT.exec(src);if(!r)err('Expected a whole number');i+=r[0].length;const v=parseInt(r[0],10);return neg?-v:v;}
  function intList(){skipInline();if(src[i]!=='[')err('Expected "[" to start a list of note numbers');i++;const out=[];for(;;){skipWS();while(src[i]===','){i++;skipWS();}if(src[i]===']'){i++;break;}if(i>=L)err('Missing "]"');INT.lastIndex=i;const r=INT.exec(src);if(!r)err('Expected a whole number, found '+found());i+=r[0].length;out.push(parseInt(r[0],10));}return out;}

  function parseDur(spaced){
    let v;
    if(isDigit(src[i])){
      NUM.lastIndex=i;const m=NUM.exec(src);i+=m[0].length;let a=fparse(m[0]);
      if(src[i]==='/'&&isDigit(src[i+1])){i++;INT.lastIndex=i;const r=INT.exec(src);i+=r[0].length;v=fdiv(a,F(parseInt(r[0],10)));}
      else{
        let u=null;
        if(spaced){const save=i;skipInline();const w=peekIdent();if(w&&UNIT[w]){i+=w.length;u=w;}else i=save;}
        else if(UNIT[src[i]]&&!isWordChar(src[i+1])){u=src[i];i++;}
        v=u?fmul(a,UNIT[u]):a;
      }
    }else{
      const u=src[i];
      if(!u||!UNIT[u]||isWordChar(src[i+1]))err('Expected a duration such as q, e, h or 1/8, found '+found());
      i++;v=UNIT[u];
    }
    let add=v;while(src[i]==='.'){i++;add=fdiv(add,F(2));v=fadd(v,add);}
    if(src[i]==='*'){i++;NUM.lastIndex=i;const m=NUM.exec(src);if(!m)err('Expected a number after *');i+=m[0].length;let k=fparse(m[0]);if(src[i]==='/'&&isDigit(src[i+1])){i++;INT.lastIndex=i;const r=INT.exec(src);i+=r[0].length;k=fdiv(k,F(parseInt(r[0],10)));}v=fmul(v,k);}
    if(v.n<=0)err('A duration must be longer than zero');
    return v;
  }

  const PITCH=/^(n?)(-?\d+)([#b]*)(?:\^(-?\d+))?$/;
  const NAMEW=/^([A-Za-z][A-Za-z0-9#_-]*)(?:\^(-?\d+))?$/;
  function pitchFromWord(w,pos){
    let m=PITCH.exec(w);
    if(m){const alt=(m[3].match(/#/g)||[]).length-(m[3].match(/b/g)||[]).length;return{type:'pitch',kind:m[1]?'note':'deg',v:parseInt(m[2],10),alt,reg:m[4]?parseInt(m[4],10):0,pos};}
    m=NAMEW.exec(w);
    if(m)return{type:'word',name:m[1],reg:m[2]?parseInt(m[2],10):0,pos};
    err('Can\u2019t read "'+w+'" as a note',pos);
  }
  const WORD=/[^\s\[\]\(\):,]+/y;
  function readWord(){WORD.lastIndex=i;const m=WORD.exec(src);if(!m)err('Unexpected '+found()+' in motif');i+=m[0].length;return m[0];}
  function motif(pos){
    const items=[];
    for(;;){
      skipWS();while(src[i]===','){i++;skipWS();}
      if(src[i]===']'){i++;break;}
      if(i>=L)err('This motif is missing its closing "]"',pos);
      const p=i;let item;
      if(src[i]==='('){
        i++;const ps=[];
        for(;;){skipWS();if(src[i]===')'){i++;break;}if(i>=L)err('Missing ")" after chord',p);const q=i;ps.push(pitchFromWord(readWord(),q));}
        if(!ps.length)err('Empty chord',p);
        item={type:'chord',pitches:ps,pos:p};
      }else{
        const w=readWord();
        if(w==='.'||w==='rest'||w==='r')item={type:'rest',pos:p};
        else if(w==='_')item={type:'tie',pos:p};
        else if(w==='x')item={type:'hit',pos:p};
        else item=pitchFromWord(w,p);
      }
      skipInline();
      if(src[i]===':'){i++;skipInline();item.dur=parseDur(false);}
      items.push(item);
    }
    return{type:'motif',items,pos};
  }

  function setting(){
    const pos=i;const kind=ident('a setting');
    if(kind==='tuning'){const n=parseInt(number('the number of notes'),10);if(n<1||n>128)err('A tuning needs between 1 and 128 notes',pos);let ratio=null;skipInline();if(peekIdent()==='of'){i+=2;ratio=parseFloat(number('the register ratio'));}return{kind,n,ratio,pos};}
    if(kind==='register'){const r=parseFloat(number('the register ratio'));return{kind,ratio:r,pos};}
    if(kind==='names'){skipInline();if(src[i]!=='[')err('Expected "[" after names');i++;const out=[];for(;;){skipWS();while(src[i]===','){i++;skipWS();}if(src[i]===']'){i++;break;}if(i>=L)err('Missing "]"');const w=readWord();out.push(w);}return{kind,names:out,pos};}
    if(kind==='mode'){skipInline();if(src[i]==='[')return{kind,arr:intList(),pos};return{kind,name:ident('a mode name'),pos};}
    if(kind==='tempo'){const t=fparse(number('the tempo'));if(t.n<=0)err('Tempo must be above zero',pos);return{kind,value:t,pos};}
    if(kind==='root'){const r=parseFloat(number('the root frequency in Hz'));if(!(r>0))err('Root must be above zero',pos);return{kind,hz:r,pos};}
    err('Unknown setting "'+kind+'". Use tuning, register, names, mode, tempo or root',pos);
  }

  function modifiers(){
    const mods=[];
    for(;;){
      skipInline();const c=src[i],pos=i;
      if((c==='+'||c==='-')&&isDigit(src[i+1])){mods.push({t:'deg',v:signedInt(),pos});continue;}
      if(c==='~'){i++;mods.push({t:'note',v:signedInt(),pos});continue;}
      if(c==='^'){i++;mods.push({t:'reg',v:signedInt(),pos});continue;}
      if(c==='*'&&isDigit(src[i+1])){i++;const f=fparse(number());mods.push({t:'scale',f:fdiv(F1,f),pos});continue;}
      if(c==='/'&&src[i+1]!=='/'){i++;const f=fparse(number());if(f.n===0)err('Can\u2019t divide by zero',pos);mods.push({t:'scale',f,pos});continue;}
      const w=peekIdent();
      if(w==='rev'||w==='inv'||w==='fit'||w==='loop'||w==='sets-length'){i+=w.length;mods.push({t:w,pos});continue;}
      if(w&&/^x\d+$/.test(w)){i+=w.length;const n=parseInt(w.slice(1),10);if(n<1)err('Repeat at least once',pos);mods.push({t:'rep',n,pos});continue;}
      break;
    }
    return mods;
  }

  function term(){skipInline();const pos=i;const base=primary();const mods=modifiers();return{type:'term',base,mods,pos};}

  function primary(){
    skipInline();const pos=i;const c=src[i];
    if(c==='['){i++;return motif(pos);}
    if(c==='('){i++;const s=seq(true,')');expect(')');return s;}
    const w=peekIdent();
    if(!w)err(i>=L?'Expected a motif, a name or a block, but the line ended':'Unexpected "'+src[i]+'" \u2014 expected a motif, a name or a block');
    if(w==='section'||w==='staff'){i+=w.length;expect('{','after '+w);const items=staffBody();expect('}');return{type:'staff',kind:w,items,pos};}
    if(w==='with'){
      i+=4;const settings=[];
      for(;;){skipInline();settings.push(setting());skipInline();if(src[i]===','){i++;continue;}if(src[i]==='{')break;if(peekIdent())continue;err('Expected "," or "{" after the setting, found '+found());}
      expect('{');const body=seq(true,'}');expect('}','to close the with block');
      return{type:'with',settings,body,pos};
    }
    if(w==='rest'){i+=4;skipInline();return{type:'rest',dur:parseDur(true),pos};}
    i+=w.length;skipInline();
    if(src[i]===':'&&src[i+1]!==':'){i++;const t=term();return{type:'inst',name:w,term:t,pos};}
    return{type:'ref',name:w,pos};
  }

  function seq(nl,close){
    const items=[];const pos=i;
    for(;;){
      if(nl)skipWS();else skipInline();
      if(nl&&src[i]===close)break;
      if(i>=L){if(nl)err('Missing "'+close+'"',pos);break;}
      items.push(term());
      skipInline();
      if(src[i]===','){i++;skipWS();continue;}
      if(nl){if(src[i]==='\n'||src[i]===close)continue;err('Unexpected '+found()+' \u2014 separate items with commas or new lines');}
      break;
    }
    if(!nl&&!items.length)err('Expected something to play, found '+found());
    return{type:'seq',items,pos};
  }

  function staffBody(){
    const items=[];
    for(;;){
      skipWS();while(src[i]===','){i++;skipWS();}
      if(src[i]==='}')break;
      if(i>=L)err('Missing "}"');
      if(peekIdent()==='length'){const pos=i;i+=6;skipInline();items.push({type:'length',dur:parseDur(true),pos});}
      else items.push(term());
      skipInline();
      if(i<L&&src[i]!=='\n'&&src[i]!==','&&src[i]!=='}')err('Unexpected '+found()+' \u2014 put each block on its own line');
    }
    return items;
  }

  function statement(){
    const pos=i;const w=peekIdent();
    const defName=(n,p)=>{if(RESERVED.has(n))err('"'+n+'" is a keyword and can\u2019t be used as a name',p);return n;};
    if(w==='motif'){i+=5;skipInline();const np=i;const name=defName(ident('a motif name'),np);expect('=','after the motif name');skipInline();return{type:'def',name,expr:seq(false,null),pos};}
    if(w==='mode'){
      const save=i;i+=4;skipInline();const nm=peekIdent();
      if(nm){i+=nm.length;skipInline();if(src[i]==='='&&src[i+1]!=='='){i++;return{type:'modedef',name:nm,arr:intList(),pos};}}
      i=save;return{type:'setting',s:setting(),pos};
    }
    if(w==='tuning'||w==='register'||w==='names'||w==='tempo'||w==='root')return{type:'setting',s:setting(),pos};
    if(w==='play'){i+=4;skipInline();return{type:'expr',expr:seq(false,null),pos};}
    if(w){
      const save=i;i+=w.length;skipInline();
      if(src[i]==='='&&src[i+1]!=='='){defName(w,pos);i++;skipInline();return{type:'def',name:w,expr:seq(false,null),pos};}
      i=save;
    }
    return{type:'expr',expr:seq(false,null),pos};
  }

  const stmts=[];
  skipWS();
  while(i<L){
    stmts.push(statement());
    skipInline();
    if(i<L&&src[i]!=='\n')err('Unexpected '+found()+' \u2014 separate items with commas, or start a new line');
    skipWS();
  }
  return stmts;
}

export {parseProgram};
