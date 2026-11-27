import {$, store} from './dom.js';
import {Compose} from './compose.js';
import {renderSounds} from './sounds.js';

function showTab(name){
  for(const t of ['compose','sounds','learn']){
    $('#view-'+t).hidden=t!==name;
    $('#tab-'+t).setAttribute('aria-selected',t===name?'true':'false');
  }
  if(name==='compose'){Compose.render();Compose.live();}
  if(name==='sounds')renderSounds();
  store.set('motynth.tab',name);
}

export {showTab};
