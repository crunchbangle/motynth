import {F} from './fraction.js';

const UNIT={w:F(1),h:F(1,2),q:F(1,4),e:F(1,8),s:F(1,16),t:F(1,32)};
const RESERVED=new Set(['tuning','register','names','mode','tempo','root','motif','play','with','section','staff','length','rest','of']);
const BUILTIN_MODES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],lydian:[0,2,4,6,7,9,11],mixolydian:[0,2,4,5,7,9,10],locrian:[0,1,3,5,6,8,10],'harmonic-minor':[0,2,3,5,7,8,11],pentatonic:[0,2,4,7,9],'minor-pentatonic':[0,3,5,7,10],blues:[0,3,5,6,7,10],'whole-tone':[0,2,4,6,8,10],chromatic:null};
const EVENT_LIMIT=40000, SECONDS_LIMIT=1800;

class MotError extends Error{constructor(msg,pos){super(msg);this.pos=pos;}}

export {UNIT, RESERVED, BUILTIN_MODES, EVENT_LIMIT, SECONDS_LIMIT, MotError};
