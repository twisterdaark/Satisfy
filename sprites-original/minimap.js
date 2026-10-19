// Map art v2 (SAT-ART-001, Claude-B): painted terrain base for the HUD minimap and the world map (M),
// plus the markers both draw on top. Cosmetic only; reads the tile grid through env.at like tiles.js.
//   const base=SatArt.minimap.buildBase(env,{W,H,buildings,px:8});   // canvas, px pixels per tile
//   SatArt.minimap.marker(g,'npc',x,y,size)  // npc | quest | ret | mon | elite | boss | anvil | ally
//   SatArt.minimap.player(g,x,y,angle,size,t) // arrow + pulse ring
//   SatArt.minimap.label(g,text,x,y,{size,color,font,band})
(function(root){'use strict';const A=root.SatArt=root.SatArt||{};
const T=A.tiles,{GR,FL,PA,TR,WA,CF,CW,BL,WL,SN,DR,RK,PL}=T.IDS,hash=T.hash,vn=T.vnoise;
const hex=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
const mix=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
const C={grass:['#3f7a35','#4b8a3c','#5a9a46'].map(hex),forestFloor:hex('#2f5e2c'),leaf:['#173a1c','#25562a','#3a7638','#5a9a4c'].map(hex),
 snowLeaf:['#3e5a5a','#5a7a74','#c8d8e6','#f2f7ff'].map(hex),path:['#9c7c50','#b8996a','#cdb084'].map(hex),dirt:['#a07a4e','#b98d5e','#c9a070'].map(hex),
 water:['#1f4f8f','#2c66a8','#4a8ad0','#7ab4e8'].map(hex),sand:hex('#e2d3a0'),snow:['#bccbe0','#dbe5f1','#f4f8fc'].map(hex),
 rock:['#4e3a2a','#6e5238','#8a6a4a','#a8885e'].map(hex),wall:['#6a655e','#9a958e','#c4beb5'].map(hex),cave:['#221c2c','#3a3248','#4e4560'].map(hex),
 ink:hex('#141020'),flower:['#f28bb0','#f2e36b','#ffffff','#9fd0ff'].map(hex),fence:hex('#6e4828')};
const ROOF={house:['#a8322a','#7a2420','#c8483a'],forge:['#4a4f5c','#3a3e4a','#5c6272'],hall:['#3a4a6a','#2a3850','#52648a'],lodge:['#3f6a3a','#2c4e28','#5a8a52'],
 tower:['#5a3a7a','#3e2658','#7a58a0'],shop:['#b06a2a','#844c1a','#d08a44'],inn:['#8a3a5a','#64263f','#ac5276'],armory:['#5a5f6a','#40444e','#7a808c'],
 palace:['#c8a040','#9a7a28','#e8c868'],temple:['#e4e0d6','#b4b0a6','#fbf8f0']};   // the palaces and Rebecca's temples (Titan, Reinhardt)
const groundKind=v=>v===FL?GR:v===BL||v===TR||v===PL?-1:v;

function buildBase(env,o){const W=o.W,H=o.H,s=o.px||8,cw=W*s,ch=H*s,doc=root.document,NY=o.noiseRow||0;   // noiseRow: the tile row the texture noise is anchored to, so rows added above keep the old land's look
 const cv=doc?doc.createElement('canvas'):A.makeCanvas(cw,ch);cv.width=cw;cv.height=ch;const g=cv.getContext('2d');
 const img=g.createImageData(cw,ch),D=img.data,kind=new Int8Array(cw*ch);
 const at=(x,y)=>x<0||y<0||x>=W||y>=H?-9:env.at(x,y);
 // ground under trees, props and fences = the most common open neighbour (same idea as tiles.js baseAt)
 const base=(x,y)=>{const v=at(x,y),k=groundKind(v);if(k!==-1)return k;const n={};let best=GR,bc=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const q=groundKind(at(x+dx,y+dy));if(q<0||q===-9||q===WA||q===WL||q===RK||q===CW)continue;n[q]=(n[q]||0)+1;}
  for(const k2 in n)if(n[k2]>bc){bc=n[k2];best=+k2;}return best===GR&&env.snowAt(x,y)?SN:best;};
 const put=(px,py,c,k)=>{const i=(py*cw+px)*4;D[i]=c[0];D[i+1]=c[1];D[i+2]=c[2];D[i+3]=255;if(k!==undefined)kind[py*cw+px]=k;};
 const tri=(r,v)=>v<.36?r[0]:v<.64?r[1]:r[2];
 for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){const k=base(tx,ty),raw=at(tx,ty);
  for(let j=0;j<s;j++)for(let i=0;i<s;i++){const wx=tx*s+i,wy=ty*s+j,ny=wy-NY*s,fx=wx/s,fy=wy/s,n=vn(fx*1.6,(ty-NY+j/s)*1.6,1,301)*.7+hash(wx,ny,302)*.3;let c;
   if(k===WA){// depth: distance to the nearest non-water tile, sampled per pixel
    let d=9;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){if(at(tx+dx,ty+dy)===WA||at(tx+dx,ty+dy)===-9)continue;const ex=Math.max(0,Math.abs(fx-(tx+dx+.5))-.5),ey=Math.max(0,Math.abs(fy-(ty+dy+.5))-.5);d=Math.min(d,Math.hypot(ex,ey));}
    c=d<.12?C.sand:d<.3?C.water[3]:mix(C.water[2],C.water[0],Math.min(1,(d-.3)/1.6));if(d>.4&&hash(wx>>1,ny,303+(ny>>2))<.025)c=C.water[3];}
   else if(k===SN)c=tri(C.snow,n);
   else if(k===PA)c=tri(C.path,n);
   else if(k===DR)c=tri(C.dirt,n);
   else if(k===RK){c=C.rock[1+((n*2.4)|0)%3];if(((wx+ny)%5)===0)c=C.rock[0];}
   else if(k===WL){c=C.wall[1];if(i===0||j===0)c=C.wall[2];if(i===s-1||j===s-1)c=C.wall[0];}
   else if(k===CW)c=C.cave[0];else if(k===CF)c=tri(C.cave,n);
   else c=tri(C.grass,n);
   if(raw===FL&&hash(wx,ny,304)<.035)c=C.flower[(hash(wx,ny,305)*4)|0];
   put(wx,wy,c,k);}}
 // ink: a darker 1px line where one terrain meets another (lower/right side), so regions read as a drawn map
 for(let y=1;y<ch;y++)for(let x=1;x<cw;x++){const k=kind[y*cw+x],u=kind[(y-1)*cw+x],l=kind[y*cw+x-1];if(k===u&&k===l)continue;
  const i=(y*cw+x)*4;if(k===WA||u===WA||l===WA)continue;const c=mix([D[i],D[i+1],D[i+2]],C.ink,.32);D[i]=c[0];D[i+1]=c[1];D[i+2]=c[2];}
 g.putImageData(img,0,0);
 // forests: a canopy blob per tree tile, back to front, with a soft shadow; snowy trees get white tops
 for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){if(at(tx,ty)!==TR)continue;const sn=env.snowAt(tx,ty),L=sn?C.snowLeaf:C.leaf,r=s*.62,cx=tx*s+s/2+(hash(tx,ty-NY,310)-.5)*s*.3,cy=ty*s+s/2+(hash(tx,ty-NY,311)-.5)*s*.3;
  g.fillStyle='rgba(10,20,10,.35)';g.beginPath();g.ellipse(cx+s*.12,cy+s*.22,r,r*.8,0,0,7);g.fill();
  const rgb=c=>`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;g.fillStyle=rgb(L[0]);g.beginPath();g.arc(cx,cy,r,0,7);g.fill();
  g.fillStyle=rgb(L[1]);g.beginPath();g.arc(cx-r*.1,cy-r*.12,r*.8,0,7);g.fill();g.fillStyle=rgb(L[2]);g.beginPath();g.arc(cx-r*.28,cy-r*.3,r*.42,0,7);g.fill();
  if(s>=6){g.fillStyle=rgb(L[3]);g.fillRect(Math.round(cx-r*.4),Math.round(cy-r*.45),Math.max(1,s/8|0),Math.max(1,s/8|0));}}
 // fences: dotted posts along PL tiles
 for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){if(at(tx,ty)!==PL)continue;g.fillStyle='#6e4828';const hor=at(tx-1,ty)===PL||at(tx+1,ty)===PL;
  if(hor)g.fillRect(tx*s,ty*s+s/2-1,s,Math.max(1,s/6|0));else g.fillRect(tx*s+s/2-1,ty*s,Math.max(1,s/6|0),s);}
 // buildings: roof with ridge, outline and a drop shadow to the lower right
 for(const b of o.buildings||[]){const R=(ROOF[b.k]||ROOF.house),x=b.x*s,y=b.y*s,w=b.w*s,h=b.h*s,sh=Math.max(1,s*.35);
  g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x+sh,y+sh,w,h);g.fillStyle=R[1];g.fillRect(x,y,w,h);g.fillStyle=R[0];g.fillRect(x+1,y+1,w-2,h/2-1);
  g.fillStyle=R[2];g.fillRect(x+1,y+h/2-1,w-2,Math.max(1,s/5));g.fillStyle='#1a1018';g.fillRect(x+w/2-s*.35,y+h-s*.6,s*.7,s*.6);
  g.strokeStyle='#1a1018';g.lineWidth=1;g.strokeRect(x+.5,y+.5,w-1,h-1);}
 return cv;}

// ---- markers (screen pixels; size = base unit, about 1 css px * zoom) ----
function poly(g,pts){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();}
function marker(g,kind,x,y,u){u=u||1;g.save();g.lineJoin='round';
 if(kind==='npc'||kind==='quest'||kind==='ret'){const r=(kind==='npc'?3.4:4.6)*u,col=kind==='npc'?'#ffd23a':kind==='ret'?'#ffd23a':'#7ee0ff';
  poly(g,[[x,y-r],[x+r,y],[x,y+r],[x-r,y]]);g.fillStyle=col;g.fill();g.lineWidth=1.4*u;g.strokeStyle='#0a0f1e';g.stroke();
  g.fillStyle='rgba(255,255,255,.7)';poly(g,[[x,y-r*.62],[x+r*.38,y-r*.24],[x,y+r*.1],[x-r*.38,y-r*.24]]);g.fill();}
 else if(kind==='mon'||kind==='elite'){const r=(kind==='elite'?2.4:1.9)*u;g.beginPath();g.arc(x,y,r,0,7);g.fillStyle=kind==='elite'?'#e2493a':'#ffb04a';g.fill();g.lineWidth=1*u;g.strokeStyle='#1a0a0a';g.stroke();}
 else if(kind==='ally'){g.beginPath();g.arc(x,y,2*u,0,7);g.fillStyle='#5ad06a';g.fill();g.lineWidth=1*u;g.strokeStyle='#0a1a0a';g.stroke();}
 else if(kind==='boss'){const r=5*u;g.beginPath();g.arc(x,y,r+2*u,0,7);g.fillStyle='rgba(192,80,255,.28)';g.fill();g.beginPath();g.arc(x,y,r,0,7);g.fillStyle='#c050ff';g.fill();g.lineWidth=1.4*u;g.strokeStyle='#1a0a24';g.stroke();
  g.fillStyle='#fff';g.fillRect(x-r*.45,y-r*.25,r*.3,r*.3);g.fillRect(x+r*.15,y-r*.25,r*.3,r*.3);g.fillRect(x-r*.3,y+r*.3,r*.6,r*.18);}
 else if(kind==='anvil'){const w=7*u,h=4*u;g.fillStyle='#bfe8ff';g.strokeStyle='#0a0f1e';g.lineWidth=1.2*u;poly(g,[[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w*.25,y],[x+w*.2,y+h/2],[x-w*.2,y+h/2],[x-w*.25,y]]);g.fill();g.stroke();}
 g.restore();}
function player(g,x,y,ang,u,t){u=u||1;g.save();const pr=(t||0)%1.2/1.2;g.beginPath();g.arc(x,y,(4+pr*9)*u,0,7);g.strokeStyle=`rgba(255,255,255,${.6*(1-pr)})`;g.lineWidth=1.5*u;g.stroke();
 g.translate(x,y);g.rotate(ang);const r=6*u;poly(g,[[r,0],[-r*.7,-r*.62],[-r*.35,0],[-r*.7,r*.62]]);g.fillStyle='#ffffff';g.fill();g.lineJoin='round';g.lineWidth=1.6*u;g.strokeStyle='#c8281e';g.stroke();g.restore();}
// text with a crisp thin outline (no heavy 5px stroke); band = rounded navy pill behind it
function label(g,text,x,y,o){o=o||{};const sz=o.size||12;g.save();g.font=`${o.weight||600} ${sz}px ${o.font||'Tajawal, sans-serif'}`;g.textAlign=o.align||'center';g.textBaseline='middle';
 if('letterSpacing' in g)g.letterSpacing=o.spacing||'0px';
 if(o.band){const w=g.measureText(text).width+sz*.9,h=sz*1.45,bx=o.align==='left'?x-sz*.45:x-w/2;g.fillStyle=o.band;g.beginPath();if(g.roundRect)g.roundRect(bx,y-h/2,w,h,h/2);else g.rect(bx,y-h/2,w,h);g.fill();
  g.strokeStyle=o.edge||'rgba(143,216,255,.45)';g.lineWidth=1;g.stroke();}
 else{g.lineJoin='round';g.lineWidth=Math.max(2,sz*.22);g.strokeStyle='rgba(8,12,26,.88)';g.strokeText(text,x,y);}
 g.fillStyle=o.color||'#ffe7a8';g.fillText(text,x,y);g.restore();}
A.minimap={buildBase,marker,player,label,ROOF};
})(typeof window!=='undefined'?window:globalThis);
