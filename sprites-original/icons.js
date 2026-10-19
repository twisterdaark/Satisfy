// Item icons v2 (SAT-ART-001): same keys and size (16x16) as iconC() in index.html.
// Shapes are drawn flat, then one pass adds a dark outline and a top-left light edge, so every icon
// reads at 1x in the bag and stays crisp when the UI scales it up with image-rendering: pixelated.
(function(root){'use strict';const A=root.SatArt=root.SatArt||{};
const hex=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
const OUT=hex('#1a1220');
function Img(){const d=new Uint8ClampedArray(16*16*4);const I={d,
 set(x,y,c,a){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>15||y>15)return;const i=(y*16+x)*4,col=typeof c==='string'?hex(c):c;d[i]=col[0];d[i+1]=col[1];d[i+2]=col[2];d[i+3]=a===undefined?255:a;},
 on(x,y){return x>=0&&y>=0&&x<16&&y<16&&d[(y*16+x)*4+3]>0;},
 rect(x,y,w,h,c){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)I.set(i,j,c);},
 line(x0,y0,x1,y1,c){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));for(let k=0;k<=n;k++)I.set(x0+(x1-x0)*k/n,y0+(y1-y0)*k/n,c);},
 ell(cx,cy,rx,ry,c){for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){const nx=(x-cx)/rx,ny=(y-cy)/ry;if(nx*nx+ny*ny<=1)I.set(x,y,c);}}};return I;}
function finish(I,ghost){const d=I.d,src=d.slice();
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4;if(src[i+3])continue;
  const n=[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>{const xx=x+a,yy=y+b;return xx>=0&&yy>=0&&xx<16&&yy<16&&src[(yy*16+xx)*4+3]>0;});if(n)I.set(x,y,OUT,ghost?70:255);}
 if(!ghost)for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4;if(!src[i+3])continue;const up=y>0&&src[((y-1)*16+x)*4+3],left=x>0&&src[(y*16+x-1)*4+3];
  if(!up||!left){d[i]=Math.min(255,d[i]+40);d[i+1]=Math.min(255,d[i+1]+40);d[i+2]=Math.min(255,d[i+2]+40);}}
 return d;}

// PER_CODE: weapon colors and the great sword's blue edge from WSH
const BLADE={rusty:['#9b8b78','#6e6052','#c4b4a0'],isword:['#c4c8d0','#7a808c','#eef0f4'],ssword:['#dfe6ee','#8a94a4','#ffffff'],gsword:['#6ab0ff','#2a5ab0','#d0e8ff']};
function sword(I,k){const [b,dk,lt]=BLADE[k]||BLADE.rusty,long=k==='gsword';const tx=long?14:13,ty=long?1:2;
 for(let i=0;i<=tx-5;i++){I.set(5+i,10-i,b);I.set(6+i,10-i,dk);I.set(5+i,9-i,lt);}I.set(tx,ty,lt);
 if(long)for(let i=1;i<tx-5;i+=2)I.set(6+i,10-i,'#9fd0ff');
 if(k==='rusty'){I.set(8,7,'#7a5a3a');I.set(10,5,'#7a5a3a');I.set(11,4,dk);}
 I.line(3,8,7,12,'#c8a050');I.set(3,8,'#e8c870');I.line(4,11,2,13,'#6b4428');I.set(1,14,'#c8a050');}
function bow(I,k){const wood=k==='sbow'?['#5a3a22','#3e2616','#7a5230']:['#8a5a32','#5e3e20','#b07a46'];
 for(let i=0;i<=12;i++){const a=i/12*Math.PI,x=Math.round(10-Math.sin(a)*6);I.set(x,2+i,wood[0]);I.set(x+1,2+i,wood[1]);}I.set(10,2,wood[2]);I.set(10,14,wood[2]);
 if(k==='sbow'){I.set(10,2,'#d0d4dc');I.set(10,14,'#d0d4dc');}I.line(11,2,11,14,'#e8e0d0');I.line(2,8,12,8,'#a0703a');I.rect(12,7,2,3,'#c8c8d0');I.set(1,7,'#e8e8e8');I.set(1,9,'#e8e8e8');I.set(2,8,'#e8e8e8');}
function staff(I,k){const orb=k==='sstaff'?['#7a4ab0','#b07aff','#e8d0ff']:['#2a5ab0','#4a90ff','#bfe8ff'];
 I.line(3,14,10,7,'#7a5634');I.line(4,14,11,7,'#5a3a20');I.ell(11.5,4.5,3,3,orb[0]);I.ell(11,4,2,2,orb[1]);I.set(10,3,orb[2]);I.set(11,3,orb[2]);I.set(9,7,'#c8a050');I.set(10,8,'#c8a050');}
function hammer(I,k){const h=k==='shammer'?['#c8ccd6','#8a909a','#ffffff']:['#9aa0aa','#6a707a','#d0d4dc'];
 I.line(3,14,9,8,'#7a5634');I.line(4,14,10,8,'#5a3a20');I.rect(8,2,6,5,h[0]);I.rect(8,2,6,1,h[2]);I.rect(13,3,1,4,h[1]);I.rect(8,6,6,1,h[1]);I.set(10,4,h[1]);}
function armor(I,k){const a=k==='larmor'?['#8a5a32','#a8743f','#5a3a20']:k==='parmor'?['#9aa4b4','#c8d0dc','#5a6474']:['#dfe2ea','#f2f4f8','#7a3a2c'];
 I.rect(4,3,8,10,a[0]);I.rect(2,3,3,4,a[1]);I.rect(11,3,3,4,a[1]);I.rect(6,3,4,2,'#2a1a10');I.set(6,5,'#2a1a10');I.set(9,5,'#2a1a10');I.rect(4,9,8,1,a[2]);I.rect(7,5,1,7,a[2]);I.rect(5,13,6,1,a[2]);
 if(k==='larmor')for(let y=6;y<12;y+=2){I.set(5,y,a[1]);I.set(10,y,a[1]);}
 if(k==='parmor'){I.set(5,6,'#ffffff');I.set(10,6,'#ffffff');I.set(5,11,a[1]);I.set(10,11,a[1]);}
 if(k==='warmor'){I.rect(7,5,1,7,'#a83a2c');I.rect(4,9,8,1,'#a83a2c');}}
const DRAW={
 bread:I=>{I.ell(8,9,6,4,'#8a4a1a');I.ell(8,8,6,3,'#c8803a');I.ell(7,7,4,1.5,'#d8964a');for(const x of [5,8,11]){I.set(x,7,'#e8b070');I.set(x+1,8,'#8a4a1a');}},
 wood:I=>{I.rect(2,4,10,4,'#7a4e2c');I.rect(2,4,10,1,'#a06a3a');I.rect(4,9,10,4,'#6e4428');I.rect(4,9,10,1,'#946038');I.ell(12,6,2,2,'#c49a62');I.set(12,6,'#8a5a32');I.ell(14,11,1.5,2,'#c49a62');I.set(14,11,'#8a5a32');I.set(5,6,'#5a3418');I.set(8,11,'#4e2e16');},
 ore:I=>{I.ell(8,9,6,5,'#55504c');I.ell(8,8,5,4,'#7f7a76');I.ell(7,7,3,2,'#9a958f');I.rect(5,8,2,2,'#c8743a');I.rect(9,10,2,1,'#d9894a');I.set(10,6,'#e8a060');I.set(4,11,'#45403c');},
 leather:I=>{I.rect(3,3,10,10,'#8a5a3a');I.rect(2,5,1,6,'#8a5a3a');I.rect(13,5,1,6,'#8a5a3a');I.rect(5,1,6,2,'#8a5a3a');I.rect(6,13,4,2,'#8a5a3a');I.rect(4,4,8,1,'#a8744a');for(let x=4;x<12;x+=2)I.set(x,11,'#d8b080');I.rect(5,7,6,1,'#6a4228');},
 blue:I=>{I.line(8,1,8,14,'#3a7ad8');I.rect(5,4,6,8,'#4a90ff');I.rect(6,3,4,10,'#5aa2ff');I.line(7,4,7,10,'#bfe0ff');I.rect(4,6,1,4,'#2a5ab0');I.rect(11,6,1,4,'#2a5ab0');I.set(9,12,'#2a5ab0');I.set(10,11,'#2a5ab0');},
 mstone:I=>{I.ell(8,8,4,6,'#2a5ab0');I.ell(8,7,3,5,'#4a90ff');I.line(7,4,7,7,'#bfe8ff');I.set(9,11,'#1a3a80');I.set(10,9,'#3a70d0');},
 arrows:I=>{for(let i=0;i<3;i++){const o=i*2-2;I.line(3+o,12+o,12+o,3+o,'#a0703a');I.rect(12+o,2+o,2,2,'#c8c8d0');I.set(13+o,2+o,'#ffffff');I.set(2+o,12+o,'#e8e8e8');I.set(3+o,13+o,'#e8e8e8');}},
 book:I=>{I.rect(3,2,10,12,'#7a2a26');I.rect(4,2,9,1,'#a03a34');I.rect(3,2,1,12,'#4a1a18');I.rect(12,3,1,10,'#e8dcc0');I.rect(6,6,4,1,'#f2c14e');I.rect(6,8,4,1,'#f2c14e');I.rect(11,7,2,2,'#c8a050');}};
// potions: round flask, cork, liquid with a highlight
const flask=(liq,lt)=>I=>{I.rect(7,2,2,2,'#8a5a32');I.rect(6,4,4,1,'#c8d0dc');I.rect(7,5,2,2,'#c8d0dc');I.ell(8,10.5,4.5,4,'#c8d0dc');I.ell(8,11,3.5,3,liq);I.rect(5,9,6,1,lt);I.set(6,10,'#ffffff');I.set(6,11,lt);I.set(10,13,'#00000000'==='x'?lt:liq);};
DRAW.hpot=flask('#d8283a','#ff7a8a');DRAW.mpot=flask('#2a5ad8','#7ab0ff');
DRAW.jaffa=DRAW.arrows;
const SLOT={slotW:I=>{for(let i=0;i<8;i++)I.set(5+i,10-i,'#bfe0ff');I.line(3,10,5,12,'#bfe0ff');I.set(3,12,'#bfe0ff');},slotA:I=>{I.rect(4,3,8,10,'#bfe0ff');I.rect(2,3,3,4,'#bfe0ff');I.rect(11,3,3,4,'#bfe0ff');},
 slotH:I=>{I.rect(4,4,8,7,'#bfe0ff');I.rect(3,8,10,2,'#bfe0ff');},slotG:I=>{I.rect(4,5,7,8,'#bfe0ff');I.rect(11,7,2,3,'#bfe0ff');},slotB:I=>{I.rect(5,3,4,9,'#bfe0ff');I.rect(5,10,8,3,'#bfe0ff');},slotX:I=>{I.rect(6,3,4,4,'#bfe0ff');I.rect(7,7,2,6,'#bfe0ff');}};

function iconRGBA(k){const I=Img();
 if(SLOT[k]){SLOT[k](I);for(let i=3;i<I.d.length;i+=4)if(I.d[i])I.d[i]=64;return finish(I,true);}
 if(DRAW[k])DRAW[k](I);else if(k==='bow'||k==='sbow')bow(I,k);else if(k==='staff'||k==='sstaff')staff(I,k);else if(k==='hammer'||k==='shammer')hammer(I,k);
 else if(k==='larmor'||k==='parmor'||k==='warmor')armor(I,k);else sword(I,k);
 return finish(I,false);}
function iconCanvas(k){const c=document.createElement('canvas');c.width=c.height=16;c.getContext('2d').putImageData(new ImageData(iconRGBA(k),16,16),0,0);return c;}
const KEYS=['rusty','isword','ssword','gsword','bow','sbow','staff','sstaff','hammer','shammer','larmor','parmor','warmor','jaffa','arrows','bread','wood','ore','leather','blue','mstone','book','hpot','mpot','slotW','slotA','slotH','slotG','slotB','slotX'];
A.icons={KEYS,iconRGBA,iconCanvas};
})(typeof window!=='undefined'?window:globalThis);
