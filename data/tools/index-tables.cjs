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
  const w=/const W=.*?,H=\d+,TS=(\d+),LW=(\d+),GAPS=(\[\[[\d,\[\]]*\]\]),(?:EX=.*?,EW=(\d+),)?(?:WMW=.*?,RSW=(\d+),EAX=.*?,EAW=(\d+),)?MW=.*?,(?:CSPL=.*?,)?MH=(\d+),WH=(\d+),BW=(\d+),WMH=(\d+)/.exec(html);if(!w)throw new Error('world constants not found');
  const GAPS=JSON.parse(w[3]),EX=+w[2]+GAPS.reduce((a,g)=>a+g[1],0),EW=+(w[4]||0),RSW=+(w[5]||0),EAW=+(w[6]||0);   // EX..WMW-1: the Saharan Empire, east of the logical map
  // WMW..: the Red Sea and the East Continent (owner 2026-10-23); MW is the whole map's width
  out.WORLD={TS:+w[1],LW:+w[2],GAPS,EX,EW,WMW:EX+EW,RSW,EAX:EX+EW+RSW,EAW,MW:EX+EW+RSW+EAW,MH:+w[7],WH:+w[8],BW:+w[9],WMH:+w[10],NR:+((/,NR=(\d+)/.exec(html)||[0,0])[1])};   // the open world is rows -NR..WMH-1
  // gen:1 quests are registered at runtime by regBQ; only static ones are content
  for(const id of Object.keys(out.QD))if(out.QD[id].gen)delete out.QD[id];
  // skill gate and class-quest gate, kept as text for _srcFn
  out.SRC={skOK:(/const skOK=(.+);\n/.exec(html)||[])[1],qAvail:(/function qAvail\(id\)\{([^\n]+)\}\n/.exec(html)||[])[1]};
  return out;}

module.exports={readTables,sliceLiteral};
