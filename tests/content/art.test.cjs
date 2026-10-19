// SAT-ART-001 content tests: sheet layout, manifest integrity, VFX preset surface. No dependencies.
'use strict';
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const dir=path.join(__dirname,'..','..','sprites-original');
const load=(...files)=>{const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f}));return ctx.SatArt;};
const plainObj=o=>JSON.parse(JSON.stringify(o));
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

test('monster PAL snapshot matches index.html and every non-humanoid MT type has a sheet',()=>{const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
 const M=load('monsters.js').monsters;const line=s=>s.slice(s.indexOf('const PAL='),s.indexOf(';',s.indexOf('const PAL='))+1);
 assert.strictEqual(line(fs.readFileSync(path.join(dir,'monsters.js'),'utf8')),line(html),'PAL drifted: re-run the snapshot');
 // drawMon draws these types with dedicated painters; the rest are humanoids drawn from FIG
 for(const t of ['wolf','pwolf','boar','bear','gbear','rabbit','golem','cgolem','guardian'])assert.ok(M.KINDS.includes(t),'no monster sheet for '+t);
 assert.strictEqual(M.POSES.map(p=>p.join(':')).join(),'idle:2,walk:4,atk:2,hurt:1');for(const [pose,n] of M.POSES)assert.strictEqual(M.TIMING[pose].length,n,pose);});

test('monster manifest matches the exported PNGs and anchors sit on the feet line',()=>{const M=load('monsters.js').monsters;const mm=JSON.parse(fs.readFileSync(path.join(dir,'sheets','manifest.json'),'utf8')).monsters;
 const cols=Math.max(...mm.rows.map(r=>r.frames));assert.strictEqual(mm.rows.length,M.POSES.length);
 for(const k of M.KINDS){const s=mm.sheets[k];assert.ok(s,'missing '+k);const sz=pngSize(path.join(dir,s.file));
  assert.deepStrictEqual(sz,{w:s.frame.w*cols,h:s.frame.h*mm.rows.length},k);assert.ok(s.anchor.y>=s.frame.h-2&&s.anchor.y<=s.frame.h,k+' anchor y on the feet line');assert.ok(s.anchor.x>0&&s.anchor.x<s.frame.w,k+' anchor x');
  assert.strictEqual(s.scale,M.PAL[k]?M.PAL[k][3]:1,k+' scale');}
 const r=M.rect('wolf',36,22,'atk',1);assert.strictEqual(r.sx,36);assert.strictEqual(r.sy,22*2);});

test('terrain v2 keeps the game tile ids and the legacy snapshot matches index.html',()=>{const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
 const T=load('tiles.js','legacy-tiles.js');const line=/const GR=0,[^;]+;/.exec(html)[0];
 const ids=Object.fromEntries(line.slice(6,-1).split(',').map(p=>{const [k,v]=p.split('=');return [k,+v];}));
 assert.deepStrictEqual(plainObj(T.tiles.IDS),ids);assert.deepStrictEqual(plainObj(T.legacyTiles.IDS),ids);
 const snap=fs.readFileSync(path.join(dir,'legacy-tiles.js'),'utf8'),grab=(s,a,b)=>{const i=s.indexOf(a);return s.slice(i,s.indexOf(b,i));};
 // once index.html runs tiles.js the legacy painter is gone and the snapshot is only history
 if(html.includes('function drawTile(x,y){'))assert.strictEqual(grab(snap,'function drawTile(x,y){','\nreturn {drawTile').replace('if(v===TR&&env.tree)env.tree(x,y,r);','if(v===TR)VT.push(vtree(x,y,r));'),grab(html,'function drawTile(x,y){','\nfunction drawBuilding'),'drawTile drifted: re-run the snapshot');});

test('every tile id renders a full opaque 16x16 ground, deterministic, with overlays near the tile',()=>{const T=load('tiles.js').tiles,I=T.IDS;
 // a 5x5 neighborhood per id: the id in a plus shape on grass, so edge and corner code paths run
 for(const [name,id] of Object.entries(I))for(const [snow,WMH] of [[false,120],[true,120],[false,0]]){
  const at=(x,y)=>(x<0||y<0||x>4||y>4)?I.CW:((x===2||y===2)&&Math.abs(x-2)+Math.abs(y-2)<=1?id:I.GR);const env={at,snowAt:()=>snow,WMH};
  const a=T.ground(env,2,2,0),b=T.ground(env,2,2,0);assert.strictEqual(a.length,1024,name);
  for(let i=3;i<1024;i+=4)assert.strictEqual(a[i],255,`${name} pixel ${(i-3)/4} transparent`);assert.deepStrictEqual(Array.from(a),Array.from(b),name+' not deterministic');
  for(const [x,y,w,h,c] of T.overlay(env,2,2)){assert.ok(x>=0&&x+w<=16&&y>=-10&&y+h<=16,`${name} overlay rect out of range`);assert.match(c,/^#[0-9a-f]{6}$/);}}
 const w0=T.ground({at:()=>I.WA,snowAt:()=>false,WMH:120},3,3,0),w1=T.ground({at:()=>I.WA,snowAt:()=>false,WMH:120},3,3,1);assert.notDeepStrictEqual(Array.from(w0),Array.from(w1),'water frames should differ');
 for(const snowy of [false,true]){const c=T.canopyRGBA(3,snowy);assert.strictEqual(c.d.length,28*26*4);let n=0;for(let i=3;i<c.d.length;i+=4)if(c.d[i])n++;assert.ok(n>250&&n<28*26,'canopy coverage '+n);}});

test('buildings v2 cover every kind and prop in index.html and keep footprints, doors and the roof line',()=>{const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
 const B=load('buildings.js','legacy-buildings.js');const N=B.buildings;
 const snap=fs.readFileSync(path.join(dir,'legacy-buildings.js'),'utf8'),grab=(s,a,b)=>{const i=s.indexOf(a);return s.slice(i,s.indexOf(b,i));};
 if(html.includes('function drawBuilding(b){'))assert.strictEqual(grab(snap,'function drawBuilding(b){','\nfunction drawWorld'),grab(html,'function drawBuilding(b){','\nfor(let y=0;y<MH;y++)'),'drawBuilding drifted: re-run the snapshot');
 const kinds=[...new Set([...html.matchAll(/k:'(\w+)'\}/g)].map(m=>m[1]).filter(k=>/^(house|forge|hall|shop|tower|lodge|inn|armory)$/.test(k)))];
 assert.ok(kinds.length>=8,'kinds found: '+kinds);for(const k of kinds){assert.ok(N.ROOF[k],'roof color for '+k);assert.ok(N.WALLK[k],'wall style for '+k);}
 const props=[...new Set([...html.matchAll(/P0\('(\w+)'/g)].map(m=>m[1]))];for(const k of props)assert.ok(N.PROP[k],'prop '+k);
 for(const k of kinds)for(const w of [6,7]){const b={x:3,y:4,w,h:5,k},wl=N.wallRGBA(b),rf=N.roofRGBA(b);
  assert.deepStrictEqual([wl.x,wl.y,wl.w,wl.h],[48,64+30,w*16,50],k+' wall box');for(let i=3;i<wl.d.length;i+=4)assert.strictEqual(wl.d[i],255,k+' wall has a hole');
  assert.deepStrictEqual([rf.x,rf.w],[44,w*16+8],k+' roof box');const eave=(rf.h-2)*rf.w*4+3;assert.strictEqual(rf.d[eave],255,k+' eave line');assert.strictEqual(rf.y+rf.h,64+34,k+' roof ends at py+34 like today');
  if(k!=='forge'){const px=(i,j)=>Array.from(wl.d.slice((j*wl.w+i)*4,(j*wl.w+i)*4+3)).join();assert.notStrictEqual(px((wl.w>>1)+3,wl.h-6),px(5,wl.h-20),k+' door at the bottom centre');}}
 for(const [k,f] of Object.entries(N.PROP))for(const [x,y,w,h,c] of f(48,{tx:1})){assert.ok(x>=-2&&x+w<=50&&y>=-10&&y+h<=16,`${k} rect out of range`);assert.match(c,/^(#[0-9a-f]{6}|rgba\([^)]+\))$/);}
 for(const [k,f] of Object.entries(N.WORLD))for(const [x,y,w,h,c] of f()){assert.ok(x>=-2&&x+w<=34&&y>=-12&&y+h<=16,`${k} rect out of range`);assert.match(c,/^(#[0-9a-f]{6}|rgba\([^)]+\))$/);}});

test('item icons v2 cover every key iconC handles and every craftable item',()=>{const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
 const I=load('icons.js').icons,snap=fs.readFileSync(path.join(dir,'legacy-icons.js'),'utf8'),grab=(s,a,b)=>{const i=s.indexOf(a);return s.slice(i,s.indexOf(b,i));};
 const live=grab(html,'function iconC(k){','\nfunction icon(k)'),src=live.includes('SatArt')||live.includes('SA.icons')?grab(snap,'function iconC(k){','\nA.legacyIcon'):live;
 if(src===live)assert.strictEqual(grab(snap,'function iconC(k){','\nA.legacyIcon'),src,'iconC drifted: re-run the snapshot');
 const keys=new Set([...src.matchAll(/k==='(\w+)'/g)].map(m=>m[1]));for(const m of html.match(/const WSH=\{[^\n]+/)[0].matchAll(/(\w+):\{l:/g))keys.add(m[1]);
 for(const m of html.matchAll(/\{id:'(\w+)',slot:'[waxhgbk]'/g))keys.add(m[1]);
 for(const k of keys)assert.ok(I.KEYS.includes(k),'no v2 icon for '+k);
 for(const k of I.KEYS){const d=I.iconRGBA(k);assert.strictEqual(d.length,1024);let n=0;for(let i=3;i<1024;i+=4)if(d[i])n++;assert.ok(n>=12,k+' is nearly empty');}
 const m=JSON.parse(fs.readFileSync(path.join(dir,'sheets','manifest.json'),'utf8')).icons;assert.deepStrictEqual(m.keys,[...I.KEYS]);assert.deepStrictEqual(pngSize(path.join(dir,m.file)),{w:16*I.KEYS.length,h:16});});

test('index.html draws every layer with the v2 art',()=>{const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
 for(const f of ['chars','monsters','tiles','buildings','icons'])assert.ok(html.includes(`<script src="sprites-original/${f}.js"></script>`),f+'.js not loaded');
 for(const hook of ['SA.chars.buildSheet(FIG[n])','SA.monsters.buildSheet(k)','SA.tiles.drawMap(','SA.buildings.drawBuilding(','SA.buildings.drawWorld(','SA.icons.iconCanvas(k)'])assert.ok(html.includes(hook),'missing hook '+hook);
 for(const gone of ['function figure(','function drawTile(','function drawBuilding(','function drawWolf('])assert.ok(!html.includes(gone),'legacy painter still present: '+gone);});
