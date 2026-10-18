// SAT-ART-001 content tests: sheet layout, manifest integrity, VFX preset surface. No dependencies.
'use strict';
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const dir=path.join(__dirname,'..','..','sprites-original');
const load=(...files)=>{const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f}));return ctx.SatArt;};
const pngSize=f=>{const b=fs.readFileSync(f);assert.strictEqual(b.toString('ascii',1,4),'PNG');return {w:b.readUInt32BE(16),h:b.readUInt32BE(20)};};

test('art scripts load without a DOM and expose their API',()=>{const A=load('fig-data.js','chars.js','vfx.js');
 assert.ok(A.FIG&&A.LOOK&&typeof A.lookFig==='function');assert.ok(typeof A.chars.frame==='function');assert.ok(typeof A.vfx.create==='function');});

test('sheet layout keeps the game frame size and covers every pose frame',()=>{const C=load('fig-data.js','chars.js').chars;
 assert.strictEqual(C.FW,16);assert.strictEqual(C.FH,24);assert.strictEqual(C.ROWS.join(),'d,u,s');
 for(const [pose,n] of C.POSES){assert.strictEqual(C.TIMING[pose].length,n,pose+' timing');for(let f=0;f<n;f++){const r=C.rect('d',pose,f);assert.ok(r.sx>=0,pose+f);}}
 assert.strictEqual(C.rect('l','walk',2).flip,true);assert.strictEqual(C.rect('l','walk',2).sy,C.rect('s','walk',2).sy);});

test('manifest matches the exported PNGs and every FIG entry has a sheet',()=>{const A=load('fig-data.js','chars.js');const m=JSON.parse(fs.readFileSync(path.join(dir,'sheets','manifest.json'),'utf8'));
 assert.strictEqual(m.frame.w,16);assert.strictEqual(m.frame.h,24);assert.deepStrictEqual(m.frame.anchor,{x:8,y:24});
 assert.strictEqual(m.columns.length,A.chars.COLS.length);
 for(const n of Object.keys(A.FIG))assert.ok(m.sheets[n],'missing sheet for FIG.'+n);
 for(const [n,s] of Object.entries(m.sheets)){const sz=pngSize(path.join(dir,s.file));assert.deepStrictEqual(sz,{w:16*m.columns.length,h:24*m.rows.length},n);
  for(const d of m.rows)for(const [pose,n2] of A.chars.POSES)for(let f=0;f<n2;f++){const h=s.hands[d][pose][f];assert.ok(h&&h.x>=0&&h.x<16&&h.y>=0&&h.y<24,`${n} ${d} ${pose}${f} hand in frame`);}}});

test('fig-data snapshot is byte-identical to the FIG table in index.html',()=>{const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
 const snap=fs.readFileSync(path.join(dir,'fig-data.js'),'utf8');const grab=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);return s.slice(i,j);};
 assert.strictEqual(grab(snap,'const FIG=','const OUT='),grab(html,'const FIG=','const OUT='),'FIG drifted: re-run the snapshot');});

test('every VFX preset spawns, decays to zero and never throws',()=>{const V=load('vfx.js').vfx;const fx=V.create();
 const g=new Proxy({},{get:(t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{},set:()=>true});
 for(const k of fx.kinds){assert.ok(fx.spawn(k,100,100,{rarity:4,angle:0,x1:150,y1:90,seed:7}),k);}
 assert.ok(fx.count>50);for(let i=0;i<200;i++){fx.update(1/60);fx.draw(g);}assert.strictEqual(fx.count,0,'particles must expire');
 assert.strictEqual(fx.spawn('nope',0,0),false);assert.strictEqual(V.RARITY.length,5);});
