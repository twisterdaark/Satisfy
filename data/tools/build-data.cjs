// Builds data/*.js from the tables in index.html (SAT-CONTENT-001, parity only: no value is changed).
// Run: node data/tools/build-data.cjs [path/to/index.html]
// Functions in the source become declarative conditions (vocabulary: docs/content/CONTENT_SCHEMA.md),
// and the original source text is kept next to them as _srcFn so a reviewer can check each conversion.
'use strict';
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const {readTables}=require('./index-tables.cjs');

const SRC='PER_CODE';
const fnText=f=>f.toString();

// RC unlock functions are && chains of four known checks; anything else must be converted by hand
function condFromFn(f){
  const body=fnText(f).replace(/^\(\)=>/,'');
  const parts=body.split('&&').map(p=>p.trim()).map(p=>{let m;
    if((m=/^!!S\.qs\.(\w+)$/.exec(p)))return {questTaken:m[1]};
    if((m=/^qDone\('(\w+)'\)$/.exec(p)))return {questDone:m[1]};
    if((m=/^S\.smith>=(\d+)$/.exec(p)))return {smithLv:{gte:+m[1]}};
    if((m=/^S\.cls==='(\w+)'$/.exec(p)))return {cls:m[1]};
    if(p==='isSm()')return {cls:['smith','pagma']};   // smith or Pagma's Successor (SAT-PAGMA-001)
    throw new Error('no declarative form for: '+p+' in '+body);});
  return parts.length===1?parts[0]:{all:parts};}

// a dialogue field is either a constant key, a function returning one constant key, or logic kept as text
function dialogField(v){
  if(typeof v==='string')return v;
  const s=fnText(v),m=/^\(\)=>'([\w]+)'$/.exec(s);
  return m?{key:m[1],_srcFn:s}:{_srcFn:s};}

function build(T,sourceVersion){
  const meta=(tables)=>({schema:1,src:SRC,sourceFile:'index.html',sourceVersion,tables});

  const monsters={...meta(['MT','BOSSES','SPAWN']),types:{},bosses:[],spawns:[]};
  for(const [id,m] of Object.entries(T.MT))monsters.types[id]={id,...m,src:SRC};
  for(const [type,tx,ty] of T.BOSSES)monsters.bosses.push({id:type,type,tx,ty,src:SRC});
  const seen={};for(const [type,x0,x1,y0,y1,n] of T.SPAWN){seen[type]=(seen[type]||0)+1;monsters.spawns.push({id:type+'-'+seen[type],type,x0,x1,y0,y1,n,src:SRC});}

  const quests={...meta(['QD']),quests:{}};
  for(const [id,q] of Object.entries(T.QD)){
    const all=[{not:{questTaken:id}}];if(q.pre)all.push({questDone:q.pre});if(q.cl2)all.push({cls:q.cl2});if(q.from)all.push({cls:q.from},{not:{promoQuestActive:true}},{mastery:{k:q.mst[0],gte:q.mst[1]}});
    if(q.cls)all.push({cls:'novice'},{not:{classQuestActive:true}});if(q.hid)all.push({hiddenCondition:q.cond});all.push({lv:{gte:q.lv||1}});
    quests.quests[id]={id,...q,offer:{all},_srcFn:'qAvail(id)&&S.lv>=(QD[id].lv||1)',src:SRC};}

  const recipes={...meta(['RC']),recipes:{}};
  for(const r of T.RC){const {unlock,...rest}=r;recipes.recipes[r.id]={...rest,unlock:condFromFn(unlock),_srcFn:fnText(unlock),src:SRC};}

  const skills={...meta(['SKD','TLS']),skills:{},titleSkills:{...T.TLS}};
  for(const [id,s] of Object.entries(T.SKD))skills.skills[id]={id,...s,unlock:s.title?{title:s.title}:{lv:{gte:s.lv}},_srcFn:T.SRC.skOK,src:SRC};

  const npcs={...meta(['NPCS','NPCS.push','NPCT']),npcs:{}};
  const dlg=id=>{const d=T.NPCT[id];if(!d)return undefined;const o={};for(const [k,v] of Object.entries(d))o[k]=dialogField(v);return o;};
  for(const n of T.NPCS)npcs.npcs[n.id]={...n,interior:false,dialog:dlg(n.id),src:SRC};
  for(const n of T.NPCS_INTERIOR)npcs.npcs[n.id]={...n,interior:true,_srcFn:`rmP(${n.room.bi},${n.room.dx},${n.room.dy})`,dialog:dlg(n.id),src:SRC};

  const zones={...meta(['TOWNS','ZR','ZL']),world:{...T.WORLD},fallback:'zPlains',interiorZone:'room.z (zBai or zWin), from the building the room belongs to',
    towns:T.TOWNS.map(({k,...r})=>({id:k,...r,src:SRC})),
    regions:T.ZR.map(([id,x0,y0,x1,y1],order)=>({id,order,x0,y0,x1,y1,src:SRC})),
    labels:T.ZL.map(([id,tx,ty])=>({id,tx,ty,src:SRC}))};

  // class path: one class quest per class at Lv5 (QD entries with cls), skills from SKD by cls
  const classes={...meta(['QD(cls)','SKD']),start:'novice',sharedSkills:Object.keys(T.SKD).filter(k=>T.SKD[k].cls==='any'),classes:{
    novice:{id:'novice',start:true,skills:[],src:SRC}}};
  for(const [qid,q] of Object.entries(T.QD))if(q.cls)classes.classes[q.cls]={id:q.cls,quest:qid,trainer:q.by,lv:q.lv,...(q.pre?{pre:q.pre}:{}),item:q.item,
    skills:Object.keys(T.SKD).filter(k=>T.SKD[k].cls===q.cls),src:SRC};
  // legendary classes come from an item, not a trainer, and exist once per world (SAT-PAGMA-001)
  if(Object.values(T.SKD).some(d=>d.cls==='pagma'))classes.classes.pagma={id:'pagma',legendary:true,source:'pbook',unique:'world',skills:Object.keys(T.SKD).filter(k=>T.SKD[k].cls==='pagma'),src:SRC};
  if(Object.values(T.SKD).some(d=>d.cls==='braham'))classes.classes.braham={id:'braham',legendary:true,source:'bsoul',base:'mage',unique:'world',skills:Object.keys(T.SKD).filter(k=>T.SKD[k].cls==='braham'),src:SRC};   // Braham's Successor (SAT-BRAHAM-001)
  if(Object.values(T.SKD).some(d=>d.cls==='saint'))classes.classes.saint={id:'saint',legendary:true,source:'msword',base:'warrior',unique:'world',skills:Object.keys(T.SKD).filter(k=>T.SKD[k].cls==='saint'),src:SRC};   // Muller's Successor (SAT-MULLER-001)

  // Tier-2 classes (major 6): from a trainer's trial, for one who has a base class and the weapon mastery; the base class's skills stay
  for(const [qid,q] of Object.entries(T.QD))if(q.promo)classes.classes[q.promo]={id:q.promo,tier:2,base:q.from,quest:qid,trainer:q.by,lv:q.lv,mastery:{k:q.mst[0],gte:q.mst[1]},skills:Object.keys(T.SKD).filter(k=>T.SKD[k].cls===q.promo),src:SRC};
  // hidden classes (major 10): no trainer; the system offers the quest once a hidden condition is met; one per character
  for(const [qid,q] of Object.entries(T.QD))if(q.hcls)classes.classes[q.hcls]={id:q.hcls,hidden:true,rating:'rare',quest:qid,cond:q.cond,lv:q.lv,skills:Object.keys(T.SKD).filter(k=>T.SKD[k].cls===q.hcls),src:SRC};
  return {monsters,quests,recipes,skills,npcs,zones,classes};}

// one record per line keeps diffs readable
function render(name,obj){
  const lines=[];
  for(const [k,v] of Object.entries(obj)){
    const isRecs=v&&typeof v==='object'&&(Array.isArray(v)?v.length&&typeof v[0]==='object':Object.values(v).length&&Object.values(v).every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&'id' in x));
    if(!isRecs){lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)}`);continue;}
    const rows=Array.isArray(v)?v.map(r=>'      '+JSON.stringify(r)):Object.entries(v).map(([id,r])=>`      ${JSON.stringify(id)}: ${JSON.stringify(r)}`);
    lines.push(`    ${JSON.stringify(k)}: ${Array.isArray(v)?'[':'{'}\n${rows.join(',\n')}\n    ${Array.isArray(v)?']':'}'}`);}
  return `// Generated by data/tools/build-data.cjs from index.html @ ${obj.sourceVersion.slice(0,7)}. Do not edit by hand before the content handoff.
(function (root) {
  'use strict';
  var D = root.SATISFY_DATA = root.SATISFY_DATA || {};
  D.${name} = {
${lines.join(',\n')}
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;}

if(require.main===module){
  const repo=path.join(__dirname,'..','..'),file=process.argv[2]||path.join(repo,'index.html');
  const sha=execSync('git log -1 --format=%H -- index.html',{cwd:repo}).toString().trim();
  const out=build(readTables(fs.readFileSync(file,'utf8')),sha);
  for(const [name,obj] of Object.entries(out))fs.writeFileSync(path.join(repo,'data',name+'.js'),render(name,obj));
  console.log('wrote',Object.keys(out).map(n=>'data/'+n+'.js').join(' '),'from',sha.slice(0,7));}

module.exports={build,render,condFromFn};
