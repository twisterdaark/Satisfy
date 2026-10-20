// Reads the content tables out of index.html without running the game (read-only; PER_CODE source).
// Each table literal is sliced by a small bracket scanner and evaluated in an empty vm, with a stub for rmP.
// Functions stay functions here; build-data.cjs turns them into declarative conditions plus _srcFn text.
'use strict';
const vm=require('vm');

function sliceLiteral(src,marker){
  const i=src.indexOf(marker);if(i<0)throw new Error('marker not found: '+marker);
  let j=i+marker.length,depth=0,q=null;
  for(;j<src.length;j++){const c=src[j];
    if(q){if(c==='\\'){j++;continue;}if(c===q)q=null;continue;}
    if(c==="'"||c==='"'||c==='`'){q=c;continue;}
    if(c==='('||c==='['||c==='{')depth++;
    else if(c===')'||c===']'||c==='}'){depth--;if(depth===0){j++;break;}}}
  return src.slice(i+marker.length,j);}

const TABLES={MT:'const MT=',SPAWN:'const SPAWN=',BOSSES:'const BOSSES=',NPCS:'const NPCS=',RC:'const RC=',QD:'const QD=',
  NPCT:'const NPCT=',SKD:'const SKD=',TLS:'const TLS=',TOWNS:'const TOWNS=',ZR:'const ZR=',ZL:'const ZL='};

function readTables(html){
  const ctx=vm.createContext({rmP:(bi,dx,dy)=>({room:{bi,dx,dy}})}),out={};
  for(const [k,m] of Object.entries(TABLES))out[k]=vm.runInContext('('+sliceLiteral(html,m)+')',ctx,{filename:'index.html#'+k});
  // interior NPCs are appended right after the outdoor list
  const push=sliceLiteral(html,'NPCS.push');out.NPCS_INTERIOR=vm.runInContext('['+push.slice(1,-1)+']',ctx,{filename:'index.html#NPCS.push'});
  // tables keep logical columns (LW wide); the physical map inserts the GAPS wilderness belts (SAT-WORLD-002)
  const w=/const W=.*?,H=\d+,TS=(\d+),LW=(\d+),GAPS=(\[\[[\d,\[\]]*\]\]),(?:EX=.*?,EW=(\d+),)?MW=.*?,MH=(\d+),WH=(\d+),BW=(\d+),WMH=(\d+)/.exec(html);if(!w)throw new Error('world constants not found');
  const GAPS=JSON.parse(w[3]),EX=+w[2]+GAPS.reduce((a,g)=>a+g[1],0),EW=+(w[4]||0);   // EX..MW-1: the Saharan Empire, east of the logical map
  out.WORLD={TS:+w[1],LW:+w[2],GAPS,EX,EW,MW:EX+EW,MH:+w[5],WH:+w[6],BW:+w[7],WMH:+w[8]};
  // gen:1 quests are registered at runtime by regBQ; only static ones are content
  for(const id of Object.keys(out.QD))if(out.QD[id].gen)delete out.QD[id];
  // skill gate and class-quest gate, kept as text for _srcFn
  out.SRC={skOK:(/const skOK=(.+);\n/.exec(html)||[])[1],qAvail:(/function qAvail\(id\)\{([^\n]+)\}\n/.exec(html)||[])[1]};
  return out;}

module.exports={readTables,sliceLiteral};
