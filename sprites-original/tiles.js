// Terrain renderer v2 (SAT-ART-001). Same tile ids and the same env as drawTile() in index.html,
// so it can replace the per-tile branch without touching the map generator.
// Ground pixels are computed into a 16x16 RGBA buffer (testable in Node, one putImageData per tile).
// Colors are picked from short ramps with world-space noise and 4x4 ordered dithering, so patches
// flow across tile borders instead of repeating per tile. Overlays (cliff lips, wall tops, palisade)
// are returned as rects for the og layer, which keeps transparent gaps between logs intact.
(function(root){'use strict';const A=root.SatArt=root.SatArt||{};
const IDS={GR:0,FL:1,PA:2,TR:3,WA:4,CF:5,CW:6,BL:7,WL:8,SN:9,DR:10,RK:11,FW:12,IW:13,PL:14}; // PER_CODE, index.html line 701
const {GR,FL,PA,TR,WA,CF,CW,BL,WL,SN,DR,RK,FW,IW,PL}=IDS;
const hex=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
const RAMP={
 grass:['#2c6332','#377536','#43853c','#4f9444','#5ea44d','#72b85a'].map(hex),
 snow:['#a9bcd6','#c3d2e6','#d9e4f1','#eaf0f8','#f7faff'].map(hex),
 path:['#7e5f3a','#937048','#a78155','#b89262','#c8a372'].map(hex),
 sand:['#93693f','#a57a4b','#b78b5b','#c69c6c','#d4ae7e'].map(hex),
 water:['#173f74','#205090','#2b62a6','#3a76ba','#4f8ccc','#6ea8e0'].map(hex),
 rock:['#463222','#5a402c','#6e5038','#836246','#9a7756','#b28d68'].map(hex),
 stone:['#46423e','#5d5853','#75706a','#8c8781','#a39e97','#bcb7b0'].map(hex),
 wood:['#5a3a20','#6e4828','#835634','#9a6840','#b07c4e','#c4925e'].map(hex),
 cave:['#1c1822','#27222e','#332d3b','#3f3849','#4b4356'].map(hex),
 plaster:['#a07e50','#b08e5e','#c3a06c','#d2b27e','#e0c494'].map(hex)};
const SAND0=hex('#d8c088'),SAND1=hex('#b89a64'),FOAM=hex('#d8ecff');
const PEB=[hex('#8a8074'),hex('#b3a999'),hex('#6e5434')];
const FLOWERS=['#f2e36b','#f28bb0','#ffffff','#9ec8ff'].map(hex),FLC=hex('#e0a020');
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>(v+.5)/16);

function hash(x,y,s){let h=(x|0)*374761393+(y|0)*668265263+(s|0)*1442695041;h=Math.imul(h^h>>>13,1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
function vnoise(x,y,sc,s){const fx=x/sc,fy=y/sc,ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy,u=tx*tx*(3-2*tx),v=ty*ty*(3-2*ty);
 const a=hash(ix,iy,s),b=hash(ix+1,iy,s),c=hash(ix,iy+1,s),d=hash(ix+1,iy+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
// pick a ramp step: base (fractional index) + world noise, dithered
function step(ramp,wx,wy,base,amp,s){const n=vnoise(wx,wy,22,s)*.55+vnoise(wx,wy,6,s+7)*.3+hash(wx,wy,s+3)*.15;
 const t=base+(n-.5)*amp*2+BAYER[(wy&3)*4+(wx&3)]-.5;return ramp[Math.max(0,Math.min(ramp.length-1,Math.round(t)))];}

function Buf(o){const d=o||new Uint8ClampedArray(16*16*4);return {d,set(x,y,c){if(x<0||y<0||x>15||y>15)return;const i=(y*16+x)*4;d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255;},
 get(x,y){const i=(y*16+x)*4;return [d[i],d[i+1],d[i+2]];},rect(x,y,w,h,c){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)this.set(i,j,c);}};}
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];

// ---- ground fills ----
function grassFill(b,X,Y,flower){
 for(let y=0;y<16;y++)for(let x=0;x<16;x++)b.set(x,y,step(RAMP.grass,X+x,Y+y,2.4,1.5,11));
 // tufts: a light V with a dark root, placed by hash so neighbors never line up
 const tx=X>>4,ty=Y>>4;for(let k=0;k<3;k++){if(hash(tx,ty,40+k)>.55)continue;const a=1+(hash(tx,ty,50+k)*13|0),c=2+(hash(tx,ty,60+k)*12|0);
  b.set(a,c+1,RAMP.grass[1]);b.set(a+2,c+1,RAMP.grass[1]);b.set(a,c,RAMP.grass[4]);b.set(a+2,c,RAMP.grass[4]);b.set(a+1,c-1,RAMP.grass[5]);b.set(a+1,c,RAMP.grass[4]);b.set(a-1,c-1,RAMP.grass[5]);b.set(a+3,c-1,RAMP.grass[5]);}
 if(hash(tx,ty,70)<.12){const a=2+(hash(tx,ty,71)*11|0),c=3+(hash(tx,ty,72)*10|0);b.rect(a,c,2,1,hex('#8f8478'));b.set(a,c-1,hex('#b0a698'));b.set(a+1,c+1,RAMP.grass[0]);}
 if(flower)for(let k=0;k<3;k++){const a=2+(hash(tx,ty,80+k)*12|0),c=2+(hash(tx,ty,90+k)*12|0),col=FLOWERS[hash(tx,ty,99+k)*4|0];
  b.set(a,c+1,RAMP.grass[1]);b.set(a-1,c,col);b.set(a+1,c,col);b.set(a,c-1,col);b.set(a,c+1,col);b.set(a,c,FLC);}}
function snowFill(b,X,Y){for(let y=0;y<16;y++)for(let x=0;x<16;x++)b.set(x,y,step(RAMP.snow,X+x,Y+y,2.6,1.4,21));
 const tx=X>>4,ty=Y>>4;if(hash(tx,ty,22)<.25){const a=hash(tx,ty,23)*11|0,c=2+(hash(tx,ty,24)*12|0);for(let i=1;i<4;i++)b.set(a+i,c,RAMP.snow[2]);for(let i=1;i<4;i++)b.set(a+i,c-1,RAMP.snow[4]);}
 for(let k=0;k<2;k++)if(hash(tx,ty,25+k)<.5)b.set(hash(tx,ty,27+k)*16|0,hash(tx,ty,29+k)*16|0,[255,255,255]);}
function speckle(b,ramp,X,Y,base,amp,s){for(let y=0;y<16;y++)for(let x=0;x<16;x++)b.set(x,y,step(ramp,X+x,Y+y,base,amp,s));}
function pebbles(b,X,Y,n,s,pal){const [p0,p1,p2]=pal||PEB;const tx=X>>4,ty=Y>>4;for(let k=0;k<n;k++){if(hash(tx,ty,s+k)>.5)continue;const a=1+(hash(tx,ty,s+10+k)*13|0),c=1+(hash(tx,ty,s+20+k)*13|0),w=1+(hash(tx,ty,s+30+k)*2|0);
 b.rect(a,c,w+1,1,p0);b.rect(a,c-1,w,1,p1);b.rect(a,c+1,w+1,1,p2);}}

// ---- the tile ----
function isGrassy(v){return v===GR||v===FL||v===TR||v===SN;}
// Tiles that only hold an object (tree, board/prop blocker, fence) take the ground around them,
// so a tree or the quest board on a dirt square no longer sits on a hard-edged grass block.
const HOLDER=new Set([TR,BL,PL]),OPEN=new Set([GR,FL,DR,PA,SN,CF]);
function baseAt(env,x,y){const v=env.at(x,y);if(!HOLDER.has(v)||(v===BL&&y>=env.WMH))return v;const n={};let best=-1,bc=0;
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const q=env.at(x+dx,y+dy);if(!OPEN.has(q))continue;const k=q===FL?GR:q;n[k]=(n[k]||0)+(dx&&dy?1:2);}
 for(const k in n)if(n[k]>bc||(n[k]===bc&&+k===GR)){bc=n[k];best=+k;}
 return best<0?v:best;}
// out (optional): a 16x16 RGBA buffer to paint into (cleared first) instead of a new one; the caller copies it out before the
// next call (SAT-ONLINE-211: a new 1 KB buffer a tile, ~1,000 a chunk, kept the garbage collector busy while walking)
function ground(env,x,y,frame,out){
 const {snowAt,WMH}=env,at=(a,c)=>baseAt(env,a,c),X=x*16,Y=y*16,b=Buf(out&&out.length===1024?out.fill(0):null);let v=at(x,y);const snowy=snowAt(x,y);
 if(v===BL&&y>=WMH)v=FW;
 if(v===GR||v===FL||((v===TR||v===BL)&&!snowy))grassFill(b,X,Y,v===FL);
 else if(v===SN||((v===TR||v===BL)&&snowy))snowFill(b,X,Y);
 else if(v===DR){speckle(b,RAMP.sand,X,Y,2.3,1.4,31);pebbles(b,X,Y,2,300);}
 else if(v===PA){speckle(b,RAMP.path,X,Y,2.2,1.3,41);
  // worn middle: a little lighter where the path runs straight
  const ns=at(x,y-1)===PA&&at(x,y+1)===PA,ew=at(x-1,y)===PA&&at(x+1,y)===PA;
  if(ns||ew)for(let i=5;i<11;i++)for(let j=0;j<16;j++){const px=ns?i:j,py=ns?j:i;if(hash(X+px,Y+py,45)<.35)b.set(px,py,RAMP.path[3]);}
  pebbles(b,X,Y,2,400);
  // soft grass or snow edges, depth from world noise so the border wobbles continuously
  const side=(dx,dy)=>{const q=at(x+dx,y+dy);if(!isGrassy(q))return;const sn=snowAt(x+dx,y+dy),ramp=sn?RAMP.snow:RAMP.grass,base=sn?2.6:2.2;
   for(let i=0;i<16;i++){const wx=dx?X+(dx>0?16:0):X+i,wy=dy?Y+(dy>0?16:0):Y+i,d=1+Math.round(vnoise(wx+(dy?0:i),wy+(dx?0:i),5,49)*2.6);
    for(let k=0;k<=d;k++){const px=dx<0?k:dx>0?15-k:i,py=dy<0?k:dy>0?15-k:i;
     b.set(px,py,k===d?mix(b.get(px,py),RAMP.path[0],.55):step(ramp,X+px,Y+py,base+(k===d-1?-.6:0),1,11));}}};
  side(0,-1);side(0,1);side(-1,0);side(1,0);
  // inner corners: grass diagonal only
  for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]])if(isGrassy(at(x+dx,y+dy))&&!isGrassy(at(x+dx,y))&&!isGrassy(at(x,y+dy))){const ox=dx<0?0:13,oy=dy<0?0:13,sn=snowAt(x+dx,y+dy);
   for(let j=0;j<3;j++)for(let i=0;i<3;i++)if((dx<0?i:2-i)+(dy<0?j:2-j)<2)b.set(ox+i,oy+j,step(sn?RAMP.snow:RAMP.grass,X+ox+i,Y+oy+j,sn?2.6:2.2,1,11));}}
 else if(v===WA){
  const shore=(dx,dy)=>at(x+dx,y+dy)!==WA;
  for(let py=0;py<16;py++)for(let px=0;px<16;px++){
   // distance to the nearest shore edge inside this tile, 0..8
   let d=9;if(shore(0,-1))d=Math.min(d,py);if(shore(0,1))d=Math.min(d,15-py);if(shore(-1,0))d=Math.min(d,px);if(shore(1,0))d=Math.min(d,15-px);
   if(shore(-1,-1))d=Math.min(d,Math.max(px,py));if(shore(1,-1))d=Math.min(d,Math.max(15-px,py));if(shore(-1,1))d=Math.min(d,Math.max(px,15-py));if(shore(1,1))d=Math.min(d,Math.max(15-px,15-py));
   const bw=vnoise(X+px,Y+py,4,57)>.55?2:1;
   if(d<bw)b.set(px,py,d===0?SAND0:SAND1);
   else if(d===bw)b.set(px,py,hash(X+px,Y+py,58+frame)<.7?FOAM:RAMP.water[5]);
   else b.set(px,py,step(RAMP.water,X+px,Y+py,d<bw+5?4.2-(d-bw)*.4:2.4,.6,51));}
  // shimmer streaks drift with the frame (0..3)
  for(let k=0;k<3;k++){const a=(hash(x,y,60+k)*12|0)+frame%4,c=4+(hash(x,y,63+k)*9|0);for(let i=0;i<3;i++){const px=(a+i)%16;const cur=b.get(px,c);if(cur[2]>150&&cur[0]<150)b.set(px,c,RAMP.water[5]);}}}
 else if(v===RK){speckle(b,RAMP.rock,X,Y,2.4,1.4,61);
  const tx=x,ty=y;for(let k=0;k<3;k++){const a=1+(hash(tx,ty,64+k)*13|0),c=2+(hash(tx,ty,67+k)*10|0);b.set(a,c,RAMP.rock[0]);b.set(a+1,c+1,RAMP.rock[0]);b.set(a+1,c+2,RAMP.rock[1]);b.set(a,c-1,RAMP.rock[4]);}
  if(at(x,y-1)!==RK)for(let i=0;i<16;i++){const d=2+Math.round(vnoise(X+i,Y,3,69));for(let k=0;k<d;k++)b.set(i,k,RAMP.rock[k===0?5:4]);}
  if(at(x,y+1)!==RK)for(let i=0;i<16;i++)for(let k=12;k<16;k++)b.set(i,k,(i+(k>13?1:0))%5===0?RAMP.rock[1]:RAMP.rock[0]);}
 else if(v===FW){for(let row=0;row<4;row++){const seam=(x*7+row*5+((hash(x,row,70)*6)|0))%16,tone=1.8+hash(x*3+(row>1?1:0),y*4+row,71)*1.6;
   for(let j=0;j<4;j++)for(let i=0;i<16;i++){const py=row*4+j;let c=step(RAMP.wood,X+i,Y+py,tone,.5,73);if(j===0)c=RAMP.wood[0];else if(j===1)c=mix(c,RAMP.wood[5],.25);
    if(i===seam)c=RAMP.wood[0];if(hash(X+i,Y+py,74)<.05)c=RAMP.wood[1];b.set(i,py,c);}
   if(hash(x,y*4+row,75)<.5){b.set((seam+2)%16,row*4+2,RAMP.wood[0]);}}}
 else if(v===IW){const top=at(x,y+1)!==IW&&at(x,y+1)!==CW;
  if(top){for(let py=0;py<16;py++)for(let px=0;px<16;px++){let c;if(py<9)c=step(RAMP.plaster,X+px,Y+py,2.4,.8,81);else if(py<13)c=(px+(x&1)*2)%6===0?RAMP.wood[1]:RAMP.wood[py===9?4:3];else c=RAMP.wood[py===13?0:1];b.set(px,py,c);}
   for(let px=0;px<16;px++)b.set(px,8,RAMP.wood[2]);}
  else{b.rect(0,0,16,16,RAMP.wood[0]);b.rect(0,0,16,2,RAMP.wood[2]);for(let px=0;px<16;px+=4)b.set(px+(y&1)*2,1,RAMP.wood[1]);}}
 else if(v===PL)grassFill(b,X,Y,false);
 else if(v===WL){for(let py=0;py<16;py++){const row=py>>2,off=row%2?0:4;for(let px=0;px<16;px++){const bi=Math.floor((px+off)/8),tone=1.6+hash(x*2+bi,y*4+row,91)*2.2;
   let c=step(RAMP.stone,X+px,Y+py,tone,.4,93);if((py&3)===0||(px+off)%8===0)c=RAMP.stone[0];else if((py&3)===1)c=mix(c,RAMP.stone[5],.3);b.set(px,py,c);}}
  b.rect(0,0,16,2,RAMP.stone[5]);if(at(x,y+1)!==WL)b.rect(0,14,16,2,RAMP.stone[0]);}
 else if(v===CF){speckle(b,RAMP.cave,X,Y,2.2,1.3,101);pebbles(b,X,Y,1,500,[RAMP.cave[4],hex('#5e566a'),RAMP.cave[0]]);}
 else if(v===CW){for(let py=0;py<16;py++)for(let px=0;px<16;px++)b.set(px,py,step(RAMP.cave,X+px,Y+py,.4,.6,111));
  if(at(x,y+1)===CF)for(let py=6;py<16;py++)for(let px=0;px<16;px++){let c=step(RAMP.cave,X+px,Y+py,3.2-(py-6)*.15,.8,113);if(py<8)c=RAMP.cave[4];if((px*3+py+(x*5))%11===0&&py>8)c=RAMP.cave[1];b.set(px,py,c);}}
 else grassFill(b,X,Y,false);
 return b.d;}

// overlay rects for og, relative to the tile's top-left; [x,y,w,h,'#rrggbb']
function overlay(env,x,y){const {at}=env,v=at(x,y),o=[],P=(a,b2,w,h,c)=>o.push([a,b2,w,h,c]);
 if(v===RK&&at(x,y+1)!==RK){P(0,-6,16,6,'#836246');P(0,-6,16,2,'#b28d68');P(0,-4,16,1,'#9a7756');for(let i=0;i<16;i+=5)P(i+(x&1)*2,-3,1,3,'#6e5038');}
 if(v===WL&&at(x,y-1)!==WL){P(0,-5,16,5,'#8c8781');P(0,-5,16,1,'#bcb7b0');P(0,-1,16,1,'#5d5853');for(let xx=0;xx<16;xx+=6){P(xx+1,-8,4,3,'#8c8781');P(xx+1,-8,4,1,'#bcb7b0');P(xx+4,-8,1,3,'#5d5853');}}
 if(v===PL){const vert=at(x,y-1)===PL||at(x,y+1)===PL,hor=at(x-1,y)===PL||at(x+1,y)===PL;
  if(hor||!vert){for(let xx=0;xx<16;xx+=4){P(xx,-6,3,18,'#7a5230');P(xx,-6,1,18,'#a8794a');P(xx+2,-6,1,18,'#5a3a20');P(xx+1,-8,1,2,'#7a5230');P(xx+1,-9,1,1,'#c4925e');}P(0,1,16,2,'#4a2e18');P(0,7,16,2,'#4a2e18');P(0,1,16,1,'#6e4828');P(0,7,16,1,'#6e4828');}
  else{P(5,-6,6,22,'#7a5230');P(5,-6,2,22,'#a8794a');P(10,-6,1,22,'#5a3a20');P(7,-8,2,2,'#7a5230');P(7,-9,2,1,'#c4925e');}}
 return o;}

// trees: same canvas sizes as index.html (trunk 16x16, canopy 28x26 drawn at offset 6,11)
function trunkRects(){return [[1,11,14,4,'rgba(0,0,0,.25)'],[6,5,4,10,'#6b4428'],[6,5,1,10,'#8a5c36'],[9,5,1,10,'#4e3018'],[7,8,1,2,'#4e3018'],[8,11,1,2,'#5a3a20'],[4,14,2,1,'#4e3018'],[10,14,2,1,'#4e3018'],[5,13,1,2,'#5a3a20'],[10,13,1,1,'#5a3a20']];}
function canopyRGBA(seed,snowy){const W=28,H=26,d=new Uint8ClampedArray(W*H*4),cx=14,cy=10,rnd=k=>hash(seed,k,777);
 const lf=['#173a1c','#25562a','#336d36','#43863f','#5aa24f','#7cc263'].map(hex),sn=['#9fb3cc','#d4e0ee','#f2f7ff'].map(hex);
 const clumps=[[0,2,11,8]];for(let k=0;k<6;k++){const a=rnd(k)*Math.PI*2,r=4+rnd(k+10)*3;clumps.push([Math.cos(a)*r*1.2,Math.sin(a)*r*.8-1,4+rnd(k+20)*2.5,3.5+rnd(k+30)*2]);}
 clumps.sort((p,q)=>p[1]-q[1]);
 const put=(x,y,c)=>{if(x<0||y<0||x>=W||y>=H)return;const i=(y*W+x)*4;d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255;};
 // outline pass then body pass per clump, back to front; light from the top-left
 for(const pass of [0,1])for(const [ox,oy,rx,ry] of clumps){const ccx=cx+ox,ccy=cy+oy;
  for(let y=Math.floor(ccy-ry-1);y<=ccy+ry+1;y++)for(let x=Math.floor(ccx-rx-1);x<=ccx+rx+1;x++){const nx=(x-ccx)/rx,ny=(y-ccy)/ry,r2=nx*nx+ny*ny;
   if(pass===0){if(r2<=1.35)put(x,y,lf[0]);continue;}if(r2>1)continue;
   const lit=(-nx*.6-ny*.8)*.5+.5-r2*.25+(hash(x+seed*31,y,780)-.5)*.35;let i=Math.max(1,Math.min(5,Math.round(1+lit*4.2)));
   let c=lf[i];if(snowy&&ny<-.15&&lit>.45)c=sn[lit>.75?2:lit>.6?1:0];put(x,y,c);}}
 for(let k=0;k<6;k++){const x=4+(rnd(40+k)*20|0),y=3+(rnd(50+k)*14|0),i=(y*W+x)*4;if(d[i+3]&&!snowy){put(x,y,lf[5]);}}
 return {W,H,d};}

// ---- canvas glue (browser only) ----
function drawTile(env,x,y,frame){const px=x*16,py=y*16,d=ground(env,x,y,frame||0);
 env.gg.putImageData(new ImageData(d,16,16),px,py);
 for(const [a,b,w,h,c] of overlay(env,x,y)){env.og.fillStyle=c;env.og.fillRect(px+a,py+b,w,h);}
 if(env.at(x,y)===TR&&env.tree)env.tree(x,y);}
// whole map in one putImageData (much faster than one call per tile); overlays and trees as in drawTile
// env.y0 (default 0) = the first world row; the image lands at canvas row 0 and overlays use world rows, so a caller
// with rows above 0 translates og by -y0*16
function drawMap(env,W,H,frame){const y0=env.y0||0,img=env.gg.createImageData(W*16,H*16),D=img.data,row=W*16*4;
 for(let y=y0;y<y0+H;y++)for(let x=0;x<W;x++){const d=ground(env,x,y,frame||0);for(let j=0;j<16;j++)D.set(d.subarray(j*64,j*64+64),((y-y0)*16+j)*row+x*64);}
 env.gg.putImageData(img,0,0);
 for(let y=y0;y<y0+H;y++)for(let x=0;x<W;x++){const o=overlay(env,x,y);for(const [a,b,w,h,c] of o){env.og.fillStyle=c;env.og.fillRect(x*16+a,y*16+b,w,h);}if(env.at(x,y)===TR&&env.tree)env.tree(x,y);}}
function trunkCanvas(){const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');for(const [x,y,w,h,col] of trunkRects()){g.fillStyle=col;g.fillRect(x,y,w,h);}return c;}
function canopyCanvas(seed,snowy){const r=canopyRGBA(seed,snowy),c=document.createElement('canvas');c.width=r.W;c.height=r.H;c.getContext('2d').putImageData(new ImageData(r.d,r.W,r.H),0,0);return c;}

A.tiles={IDS,RAMP,ground,overlay,drawTile,drawMap,trunkRects,canopyRGBA,trunkCanvas,canopyCanvas,hash,vnoise};
})(typeof window!=='undefined'?window:globalThis);
