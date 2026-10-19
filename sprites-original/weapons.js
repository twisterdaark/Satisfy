// Held weapons v2 (SAT-ART-001, Claude-B): the weapon drawn in the character's hand, replacing weapPix's 1px sticks.
// Each sprite points up (tip at the top) with its grip at {gx,gy}; the engine rotates it around the grip for swings.
// Same ids as WSH/iconC in index.html. Rarity (0..4) adds a tip glint and, from unique up, an edge glow.
(function(root){'use strict';const A=root.SatArt=root.SatArt||{};
const mk=(w,h)=>{const c=root.document?root.document.createElement('canvas'):A.makeCanvas(w,h);c.width=w;c.height=h;return c;};
const hex=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
const OUT=[26,18,32];
const RAR=['#d8dde6','#4aa8ff','#b46aff','#ffd23a','#ff8a1e'];
function Img(w,h){const d=new Uint8ClampedArray(w*h*4);const I={w,h,d,
 set(x,y,c){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=w||y>=h)return;const i=(y*w+x)*4,col=hex(c);d[i]=col[0];d[i+1]=col[1];d[i+2]=col[2];d[i+3]=255;},
 rect(x,y,ww,hh,c){for(let j=y;j<y+hh;j++)for(let i=x;i<x+ww;i++)I.set(i,j,c);},
 vline(x,y0,y1,c){for(let y=y0;y<=y1;y++)I.set(x,y,c);}};return I;}
function outline(I){const {w,h,d}=I,src=d.slice();for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(src[i+3])continue;
 if([[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>{const xx=x+a,yy=y+b;return xx>=0&&yy>=0&&xx<w&&yy<h&&src[(yy*w+xx)*4+3];})){d[i]=OUT[0];d[i+1]=OUT[1];d[i+2]=OUT[2];d[i+3]=230;}}}

// sword: blade [len] px tall, [bw] px wide (1-3), colors [mid, dark edge, light edge], guard color
function sword(len,bw,c,guard,extra){const W=9,H=len+8,I=Img(W,H),cx=4,top=1;
 for(let y=top+1;y<top+len;y++){I.set(cx,y,c[0]);if(bw>=2)I.set(cx+1,y,c[1]);if(bw>=3)I.set(cx-1,y,c[2]);}
 I.set(cx,top,c[2]);if(bw>=2)I.set(cx+1,top+1,c[2]);I.vline(cx,top+1,top+Math.min(len-2,3),c[2]);
 const gy=top+len;I.rect(cx-2,gy,5+(bw>=3?0:0),1,guard);I.set(cx-2,gy,'#5a3a18');I.set(cx+2,gy,'#5a3a18');
 I.vline(cx,gy+1,gy+3,'#6b4428');I.set(cx,gy+2,'#8a5a32');I.set(cx,gy+4,guard);
 if(extra)extra(I,cx,top,len);return {I,gx:cx,gy:gy+2};}
const DEF={
 rusty:()=>sword(8,2,['#9b8b78','#6e6052','#c4b4a0'],'#8a6a3a',(I,cx,top)=>{I.set(cx,top+4,'#7a5a3a');I.set(cx+1,top+6,'#7a5a3a');I.set(cx+1,top+3,'#5a4a3c');}),
 isword:()=>sword(10,2,['#c4c8d0','#7a808c','#eef0f4'],'#9a9aa6'),
 ssword:()=>sword(11,2,['#dfe6ee','#8a94a4','#ffffff'],'#d8b04a',(I,cx,top,len)=>{for(let y=top+3;y<top+len-1;y+=3)I.set(cx,y,'#b8c4d4');}),
 gsword:()=>sword(14,3,['#6ab0ff','#2a5ab0','#d0e8ff'],'#c8a050',(I,cx,top,len)=>{for(let y=top+2;y<top+len;y+=2)I.set(cx,y,'#9fd0ff');I.rect(cx-3,top+len,7,1,'#c8a050');I.set(cx-3,top+len,'#6a4a1a');I.set(cx+3,top+len,'#6a4a1a');}),
 bow:()=>bow(['#8a5a32','#5e3e20','#b07a46'],null),
 sbow:()=>bow(['#5a3a22','#3e2616','#7a5230'],'#d0d4dc'),
 staff:()=>staff(['#2a5ab0','#4a90ff','#bfe8ff'],'#7a5634'),
 sstaff:()=>staff(['#5a2a90','#b07aff','#e8d0ff'],'#3e2a5a',true),
 hammer:()=>hammer(['#9aa0aa','#6a707a','#d0d4dc']),
 shammer:()=>hammer(['#c8ccd6','#8a909a','#ffffff'],true),
 // spear: long shaft with a leaf head; dagger: short blade on a stub grip (SAT-EQUIP-001)
 spear:()=>{const I=Img(7,22);I.vline(3,5,21,'#7a5634');I.vline(3,12,13,'#c8a050');I.set(3,0,'#eef0f4');I.rect(2,1,3,3,'#c4c8d0');I.vline(3,1,3,'#eef0f4');I.set(4,3,'#7a808c');I.set(3,4,'#9a9aa6');return {I,gx:3,gy:15};},
 dagger:()=>sword(5,2,['#c4c8d0','#7a808c','#eef0f4'],'#9a9aa6')};
function bow(w,tip){const I=Img(8,18);for(let i=0;i<=14;i++){const a=i/14*Math.PI,x=Math.round(2+Math.sin(a)*3.4);I.set(x,1+i,w[0]);I.set(x+1,1+i,i<3||i>11?w[0]:w[1]);if(i===7){I.set(x,1+i,w[2]);I.set(x+1,1+i,w[2]);}}
 I.vline(2,1,15,'#e8e0d0');I.set(2,1,tip||w[2]);I.set(2,15,tip||w[2]);I.rect(5,7,2,3,'#3a2414');return {I,gx:5,gy:8};}
function staff(orb,wood,prong){const I=Img(9,20);I.vline(4,5,18,wood);I.vline(5,6,17,'#5a3a20');I.set(4,10,'#c8a050');I.set(4,15,'#c8a050');
 for(let y=0;y<5;y++)for(let x=0;x<5;x++){const nx=x-2,ny=y-2;if(nx*nx+ny*ny<=5)I.set(2+x,y+1,nx+ny<-1?orb[2]:nx+ny<1?orb[1]:orb[0]);}
 if(prong){I.set(1,1,'#c8a050');I.set(7,1,'#c8a050');I.set(1,2,'#c8a050');I.set(7,2,'#c8a050');}I.set(3,2,'#ffffff');return {I,gx:4,gy:14};}
function hammer(h,silver){const I=Img(10,16);I.vline(4,4,14,'#7a5634');I.vline(4,9,9,'#5a3a20');I.set(4,15,'#5a3a20');
 I.rect(1,1,8,4,h[0]);I.rect(1,1,8,1,h[2]);I.rect(1,4,8,1,h[1]);I.rect(8,1,1,4,h[1]);if(silver){I.set(3,2,'#ffffff');I.rect(1,1,1,4,'#d8b04a');}return {I,gx:4,gy:11};}

const CACHE={};
// sprite(id, rarity) -> {canvas, gx, gy, w, h}; null for an unknown id
function sprite(id,r){const k=id+'|'+(r||0);if(CACHE[k])return CACHE[k];const f=DEF[id];if(!f)return null;const {I,gx,gy}=f();
 r=r||0;if(r>=2){let ty=0;for(let y=0;y<I.h&&!ty;y++)for(let x=0;x<I.w;x++)if(I.d[(y*I.w+x)*4+3]){ty=y;I.set(x,y,RAR[r]);break;}}
 outline(I);
 if(r>=3){const d=I.d,c=hex(RAR[r]);for(let i=0;i<d.length;i+=4)if(d[i+3]===230&&d[i]===OUT[0]&&d[i+1]===OUT[1]){d[i]=c[0]*.55|0;d[i+1]=c[1]*.55|0;d[i+2]=c[2]*.55|0;}}
 const cv=mk(I.w,I.h);cv.getContext('2d').putImageData(new ImageData(I.d,I.w,I.h),0,0);return CACHE[k]={canvas:cv,gx,gy,w:I.w,h:I.h};}
// Draw a held weapon with its grip at (x,y). rot: radians from pointing up (0 = up); flip mirrors it (facing left).
function draw(g,id,r,x,y,rot,flip){const s=sprite(id,r);if(!s)return false;g.save();g.translate(Math.round(x),Math.round(y));if(rot)g.rotate(rot);if(flip)g.scale(-1,1);g.drawImage(s.canvas,-s.gx,-s.gy);g.restore();return true;}
A.weapons={IDS:Object.keys(DEF),sprite,draw,RARITY:RAR};
})(typeof window!=='undefined'?window:globalThis);
