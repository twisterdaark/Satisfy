// SAT-CONTENT-001 acceptance: data/*.js load without functions, ids are unique, cross-references hold,
// and every value matches index.html (parity). Parity reads index.html directly until __G.defs() lands (#1).
'use strict';
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const repo=path.join(__dirname,'..','..'),dataDir=path.join(repo,'data');
const FILES=['monsters','quests','recipes','skills','npcs','zones','classes'];
const MATS=['ore','wood','leather','blue','mstone','mith','fish','sfish','gfish','herb','bherb','cfish','stew','feast','dscale'];
const VISIT_TARGETS=['grave','mural','yaltar']; // landmarks with their own trigger in the engine (visitGrave)

const loadAll=()=>{const ctx={};ctx.globalThis=ctx;vm.createContext(ctx);
  for(const f of FILES)vm.runInContext(fs.readFileSync(path.join(dataDir,f+'.js'),'utf8'),ctx,{filename:f+'.js'});return ctx.SATISFY_DATA;};
const plain=v=>JSON.parse(JSON.stringify(v)); // also strips anything a vm realm adds
const D=loadAll();

test('every data file loads in a vm and holds JSON-only values',()=>{
  for(const f of FILES){const d=D[f];assert.ok(d,'missing SATISFY_DATA.'+f);assert.strictEqual(d.schema,1,f);assert.strictEqual(d.src,'PER_CODE',f);
    const walk=(v,p)=>{const t=typeof v;assert.ok(t!=='function'&&t!=='undefined'&&t!=='symbol'&&t!=='bigint',p+' is '+t);
      if(t==='number')assert.ok(Number.isFinite(v),p+' not finite');if(v&&t==='object')for(const k of Object.keys(v))walk(v[k],p+'.'+k);};
    walk(d,f);assert.deepStrictEqual(plain(d),plain(d));}});

test('ids are unique and match their keys',()=>{
  const keyed=[['monsters','types'],['quests','quests'],['recipes','recipes'],['skills','skills'],['npcs','npcs'],['classes','classes']];
  for(const [f,t] of keyed)for(const [k,r] of Object.entries(D[f][t]))assert.strictEqual(r.id,k,`${f}.${t}.${k}`);
  const listed=[['monsters','bosses'],['monsters','spawns'],['zones','towns'],['zones','regions'],['zones','labels']];
  for(const [f,t] of listed){const ids=D[f][t].map(r=>r.id);assert.strictEqual(new Set(ids).size,ids.length,`${f}.${t} has duplicate ids`);}});

test('counts match the audited baseline',()=>{
  const n=o=>Array.isArray(o)?o.length:Object.keys(o).length;
  assert.deepStrictEqual({MT:n(D.monsters.types),BOSSES:n(D.monsters.bosses),SPAWN:n(D.monsters.spawns),QD:n(D.quests.quests),RC:n(D.recipes.recipes),
    SKD:n(D.skills.skills),NPC:n(D.npcs.npcs),interior:Object.values(D.npcs.npcs).filter(x=>x.interior).length,ZR:n(D.zones.regions),TOWNS:n(D.zones.towns),classes:n(D.classes.classes)},
    {MT:43,BOSSES:5,SPAWN:19,QD:82,RC:25,SKD:32,NPC:47,interior:8,ZR:17,TOWNS:3,classes:9});});

// condition vocabulary (docs/content/CONTENT_SCHEMA.md)
function checkCond(c,where){assert.ok(c&&typeof c==='object'&&!Array.isArray(c),where+': condition must be an object');
  const ks=Object.keys(c);assert.strictEqual(ks.length,1,where+': one operator per node');const [k]=ks,v=c[k];
  switch(k){
    case 'all':case 'any':assert.ok(Array.isArray(v)&&v.length,where);v.forEach((x,i)=>checkCond(x,`${where}.${k}[${i}]`));break;
    case 'not':checkCond(v,where+'.not');break;
    case 'questTaken':case 'questDone':assert.ok(D.quests.quests[v],`${where}: unknown quest ${v}`);break;
    case 'cls':[].concat(v).forEach(c=>assert.ok(D.classes.classes[c],`${where}: unknown class ${c}`));break;
    case 'title':assert.ok(D.skills.titleSkills[v],`${where}: unknown title ${v}`);break;
    case 'lv':case 'smithLv':assert.ok(Number.isInteger(v.gte)&&Object.keys(v).length===1,where+': expects {gte:int}');break;
    case 'classQuestActive':assert.strictEqual(v,true,where);break;
    default:assert.fail(`${where}: unknown operator ${k}`);}}

test('cross-references point at things that exist',()=>{
  const {types,bosses,spawns}=D.monsters,Q=D.quests.quests,R=D.recipes.recipes,SK=D.skills.skills,N=D.npcs.npcs,C=D.classes.classes,{MW,WMH}=D.zones.world;
  for(const m of Object.values(types))for(const [it,p] of m.drop){assert.ok(MATS.includes(it),`${m.id} drops ${it}`);assert.ok(p>0,m.id);}
  for(const b of bosses){assert.ok(types[b.type]&&types[b.type].boss,`boss ${b.id}`);assert.ok(b.tx>=0&&b.tx<MW&&b.ty>=0&&b.ty<WMH,`boss ${b.id} on map`);}
  for(const s of spawns){assert.ok(types[s.type],`spawn ${s.id}`);assert.ok(s.x0>=0&&s.x0<s.x1&&s.x1<=MW&&s.y0>=0&&s.y0<s.y1&&s.y1<=WMH,`spawn ${s.id} inside ${MW}x${WMH}`);assert.ok(s.n>0);}
  for(const r of Object.values(R)){for(const it of Object.keys(r.need))assert.ok(MATS.includes(it),`${r.id} needs ${it}`);checkCond(r.unlock,'recipe '+r.id);}
  for(const q of Object.values(Q)){assert.ok(N[q.by],`quest ${q.id} giver ${q.by}`);if(q.pre)assert.ok(Q[q.pre],`quest ${q.id} pre`);
    const o=q.obj;if(o.t==='kill')assert.ok(types[o.it],`quest ${q.id} kills ${o.it}`);else if(o.t==='have')assert.ok(MATS.includes(o.it),`quest ${q.id} has ${o.it}`);
    else if(o.t==='craft')assert.ok(R[o.it],`quest ${q.id} crafts ${o.it}`);else if(o.t==='visit')assert.ok(VISIT_TARGETS.includes(o.it),`quest ${q.id} visits ${o.it}`);
    else if(o.t==='block')assert.strictEqual(o.it,'guard',`quest ${q.id} blocks with the guard`);
    else if(o.t==='deliver')assert.ok(N[o.it]&&o.it!==q.by,`quest ${q.id} delivers to ${o.it}`);
    else if(o.t==='escort')assert.ok(Array.isArray(o.to)&&o.to.length===2&&o.hp>0&&typeof o.it==='string',`quest ${q.id} escort`);
    else assert.strictEqual(o.t,'craftR',`quest ${q.id} objective type`);
    assert.ok(Number.isInteger(o.n)&&o.n>0);if(q.item)assert.ok(R[q.item],`quest ${q.id} item`);if(q.cls)assert.ok(C[q.cls],`quest ${q.id} class`);if(q.cl2)assert.ok(C[q.cl2]);
    if(q.title)assert.ok(D.skills.titleSkills[q.title],`quest ${q.id} title`);checkCond(q.offer,'quest '+q.id);}
  for(const s of Object.values(SK)){if(s.cls)assert.ok(s.cls==='any'||C[s.cls],`skill ${s.id} class`);if(s.need)assert.ok(['melee','bow','staff'].includes(s.need));checkCond(s.unlock,'skill '+s.id);}
  for(const [t,k] of Object.entries(D.skills.titleSkills))assert.ok(SK[k]&&SK[k].title===t,`title ${t} -> ${k}`);
  for(const n of Object.values(N)){if(n.interior)assert.ok(n.room&&Number.isInteger(n.room.bi),`npc ${n.id} room`);else assert.ok(n.tx>=0&&n.tx<MW&&n.ty>=0&&n.ty<WMH,`npc ${n.id} inside ${MW}x${WMH}`);
    if(!n.obj)assert.ok(n.spr,`npc ${n.id} sprite`);assert.ok(n.dialog,`npc ${n.id} dialog`);}
  for(const z of [...D.zones.towns,...D.zones.regions])assert.ok(z.x0>=0&&z.x0<z.x1&&z.x1<MW&&z.y0>=0&&z.y0<z.y1&&z.y1<WMH,`zone ${z.id} inside map`);
  D.zones.regions.forEach((r,i)=>assert.strictEqual(r.order,i,'regions keep first-match order'));
  for(const t of D.zones.towns)assert.ok(D.zones.regions.some(r=>r.id===t.id),`town ${t.id} has a region`);
  for(const c of Object.values(C)){if(c.start)continue;if(c.legendary){c.skills.forEach(s=>assert.strictEqual(SK[s].cls,c.id));continue;}assert.ok(Q[c.quest]&&Q[c.quest].cls===c.id,`class ${c.id} quest`);assert.ok(N[c.trainer]);assert.ok(R[c.item]);c.skills.forEach(s=>assert.strictEqual(SK[s].cls,c.id));}});

test('parity: data/*.js equals a fresh build from index.html',()=>{
  const {readTables}=require(path.join(dataDir,'tools','index-tables.cjs')),{build}=require(path.join(dataDir,'tools','build-data.cjs'));
  const T=readTables(fs.readFileSync(path.join(repo,'index.html'),'utf8')),fresh=plain(build(T,'-'));
  for(const f of FILES){const got=plain(D[f]);got.sourceVersion='-';assert.deepStrictEqual(got,fresh[f],f+' drifted from index.html: run node data/tools/build-data.cjs');}});

test('parity: values read back into the original table shapes unchanged',()=>{
  const {readTables}=require(path.join(dataDir,'tools','index-tables.cjs'));const T=readTables(fs.readFileSync(path.join(repo,'index.html'),'utf8'));
  const strip=(r,...k)=>{const o={...r};for(const x of ['id','src','_srcFn',...k])delete o[x];return o;};
  for(const [id,m] of Object.entries(T.MT))assert.deepStrictEqual(plain(strip(D.monsters.types[id])),plain(m),'MT.'+id);
  assert.deepStrictEqual(plain(D.monsters.spawns.map(s=>[s.type,s.x0,s.x1,s.y0,s.y1,s.n])),plain(T.SPAWN));
  assert.deepStrictEqual(plain(D.monsters.bosses.map(b=>[b.type,b.tx,b.ty])),plain(T.BOSSES));
  for(const [id,q] of Object.entries(T.QD))assert.deepStrictEqual(plain(strip(D.quests.quests[id],'offer')),plain(q),'QD.'+id);
  T.RC.forEach(r=>{const {unlock,...rest}=r;assert.deepStrictEqual(plain(strip(D.recipes.recipes[r.id],'unlock')),plain({...rest,id:undefined}),'RC.'+r.id);assert.strictEqual(D.recipes.recipes[r.id]._srcFn,unlock.toString());});
  for(const [id,s] of Object.entries(T.SKD))assert.deepStrictEqual(plain(strip(D.skills.skills[id],'unlock')),plain(s),'SKD.'+id);
  assert.deepStrictEqual(plain(D.zones.regions.map(r=>[r.id,r.x0,r.y0,r.x1,r.y1])),plain(T.ZR));
  assert.deepStrictEqual(plain(D.zones.towns.map(({id,src,...r})=>({k:id,...r}))),plain(T.TOWNS));
  for(const n of [...T.NPCS,...T.NPCS_INTERIOR])assert.deepStrictEqual(plain(strip(D.npcs.npcs[n.id],'interior','dialog')),plain({...n,id:undefined}),'NPC.'+n.id);});

test('recipe conditions mean what the source functions do',()=>{
  const {condFromFn}=require(path.join(dataDir,'tools','build-data.cjs'));
  // evaluate both sides on sample states: the source function with a fake S, the condition with a tiny reference evaluator
  const ev=(c,s)=>{const [k]=Object.keys(c),v=c[k];switch(k){case 'all':return v.every(x=>ev(x,s));case 'any':return v.some(x=>ev(x,s));case 'not':return !ev(v,s);
    case 'questTaken':return !!s.qs[v];case 'questDone':return !!s.qs[v]&&s.qs[v].st===2;case 'smithLv':return s.smith>=v.gte;case 'cls':return [].concat(v).includes(s.cls);case 'lv':return s.lv>=v.gte;}throw new Error(k);};
  const states=[];for(const cls of ['novice','smith','warrior','pagma'])for(const smith of [0,3,5])for(const qs of [{},{kh3:{st:1}},{kh3:{st:2}},{kh3:{st:2},kh4:{st:2},sm3:{st:1}}])states.push({cls,smith,qs,lv:10});
  for(const r of Object.values(D.recipes.recipes)){
    for(const s of states){const f=new Function('S','qDone','isSm','return ('+r._srcFn+')()');assert.strictEqual(ev(r.unlock,s),f(s,id=>!!s.qs[id]&&s.qs[id].st===2,()=>s.cls==='smith'||s.cls==='pagma'),`${r.id} on ${JSON.stringify(s)}`);}
    assert.deepStrictEqual(condFromFn({toString:()=>r._srcFn}),plain(r.unlock));}});
