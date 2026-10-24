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
 msword:()=>sword(11,2,['#c8e8f4','#7aa0b8','#ffffff'],'#4a90c0',(I,cx,top,len)=>{for(let y=top+2;y<top+len-1;y+=3)I.set(cx,y,'#e8f8ff');}),
 bow:()=>bow(['#8a5a32','#5e3e20','#b07a46'],null),
 sbow:()=>bow(['#5a3a22','#3e2616','#7a5230'],'#d0d4dc'),
 staff:()=>staff(['#2a5ab0','#4a90ff','#bfe8ff'],'#7a5634'),
 sstaff:()=>staff(['#5a2a90','#b07aff','#e8d0ff'],'#3e2a5a',true),
 hammer:()=>hammer(['#9aa0aa','#6a707a','#d0d4dc']),
 shammer:()=>hammer(['#c8ccd6','#8a909a','#ffffff'],true),
 // spear: long shaft with a leaf head; dagger: short blade on a stub grip (SAT-EQUIP-001)
 spear:()=>{const I=Img(7,22);I.vline(3,5,21,'#7a5634');I.vline(3,12,13,'#c8a050');I.set(3,0,'#eef0f4');I.rect(2,1,3,3,'#c4c8d0');I.vline(3,1,3,'#eef0f4');I.set(4,3,'#7a808c');I.set(3,4,'#9a9aa6');return {I,gx:3,gy:15};},
 dagger:()=>sword(5,2,['#c4c8d0','#7a808c','#eef0f4'],'#9a9aa6'),
 // named items from the novel (item skills): Failure's shark-like greatsword, the Ideal Dagger, the Gale Spear, Iyarugt's
 // blood-red blade, Dainsleif (Reproduction) in gold, the Thunder Bow and the Sword of Wisdom
 failure:()=>sword(13,3,['#5a6a7a','#2e3a48','#a8b8c8'],'#3a4450',(I,cx,top,len)=>{for(let y=top+3;y<top+len-1;y+=3)I.set(cx+2,y,'#2e3a48');I.set(cx-1,top+2,'#ffffff');I.set(cx+2,top+len-3,'#a8b8c8');}),
 ideal:()=>sword(6,2,['#bfe8ff','#5a8ab0','#ffffff'],'#4a90c0',(I,cx,top)=>{I.set(cx,top+3,'#ffffff');}),
 gale:()=>{const I=Img(7,24);I.vline(3,6,23,'#3a6a5a');I.vline(3,13,14,'#9fe3c8');I.set(3,0,'#ffffff');I.rect(2,1,3,4,'#9fe3c8');I.vline(3,1,4,'#e8fff4');I.set(1,4,'#5aa890');I.set(5,4,'#5aa890');I.set(3,5,'#5aa890');return {I,gx:3,gy:16};},
 iyarugt:()=>sword(11,2,['#c8282a','#6a0a0e','#ff7a6a'],'#2a0a0e',(I,cx,top,len)=>{for(let y=top+2;y<top+len-1;y+=2)I.set(cx,y,'#ff3a2a');I.set(cx-2,top+len,'#c8282a');I.set(cx+2,top+len,'#c8282a');}),
 dains:()=>sword(12,3,['#e8c050','#9a7418','#fff4c0'],'#6a4a18',(I,cx,top,len)=>{for(let y=top+3;y<top+len-1;y+=3)I.set(cx,y,'#fff4c0');}),
 tbow:()=>bow(['#4a6ab0','#2a3a70','#9fc8ff'],'#fff07a'),
 wisdom:()=>sword(11,2,['#e8f4ff','#7a9ab8','#ffffff'],'#d8b04a',(I,cx,top,len)=>{I.set(cx,top+len-4,'#4a90ff');I.set(cx,top+len-6,'#4a90ff');}),
 // the death knights' weapons from the Behen Archipelago: Lantier's adamantium dagger, Alex's bayonet, Gis' pickaxe
 lantd:()=>sword(6,2,['#e8eef8','#8a94a4','#ffffff'],'#a81a1a',(I,cx,top)=>{I.set(cx,top+3,'#ffffff');}),
 alexb:()=>{const I=Img(7,20);I.rect(2,6,3,12,'#4a5a7a');I.vline(2,6,17,'#9ab0d0');I.vline(3,0,5,'#e8eef8');I.set(3,0,'#ffffff');I.rect(1,13,2,4,'#3a2a1e');I.set(4,9,'#c8a050');return {I,gx:3,gy:14};},
 // the divine beasts' legendary weapons (second ten, major 6)
 rpbow:()=>bow(['#c82a1a','#7a1a0a','#ffd24a'],'#ffd24a'),
 dgspear:()=>{const I=Img(7,22);I.vline(3,5,21,'#2a4a7a');I.vline(3,12,13,'#c8e8ff');I.set(3,0,'#ffffff');I.rect(2,1,3,3,'#5ac8ff');I.vline(3,1,3,'#e8f8ff');I.set(4,3,'#2a6aff');I.set(3,4,'#5ac8ff');I.set(1,4,'#5ac8ff');I.set(5,4,'#5ac8ff');return {I,gx:3,gy:15};},
 ttthorn:()=>sword(5,2,['#3a5a6a','#1a2a3a','#5ad8c8'],'#1a3a3a',(I,cx,top)=>{I.set(cx,top+2,'#ffffff');}),
 blstaff:()=>staff(['#2a0614','#8a1a4a','#ff8ac8'],'#1a0a10',1),
 // SAT-ONLINE-165 (Claude-A): the three that drew nothing in the hand: the Doppelganger's and Yetima's greatswords, and the
 // Mass-produced Grid Sword (the colours of their icons)
 dpgs:()=>sword(14,3,['#5ac8a0','#1e6a50','#d8fff0'],'#2a4a40',(I,cx,top,len)=>{for(let y=top+3;y<top+len-1;y+=3)I.set(cx,y,'#d8fff0');I.set(cx-1,top+len-3,'#1e6a50');}),
 yetgs:()=>sword(14,3,['#9aa0ac','#4a4e58','#e8eef8'],'#8a6a3a',(I,cx,top,len)=>{I.rect(cx-3,top+len,7,1,'#8a6a3a');for(let y=top+4;y<top+len-2;y+=4)I.set(cx+1,y,'#e8eef8');}),
 mgsword:()=>sword(10,2,['#e0e4ec','#2a3a6a','#ffffff'],'#2a3a6a',(I,cx,top,len)=>{I.set(cx,top+len-3,'#2a3a6a');}),
 gisp:()=>{const I=Img(11,16);I.vline(5,3,15,'#6a4a2a');I.vline(5,8,8,'#4a3020');I.rect(1,1,9,2,'#8a9aa8');I.set(0,3,'#8a9aa8');I.set(10,3,'#8a9aa8');I.rect(1,1,9,1,'#c8d0dc');return {I,gx:5,gy:11};}};
function bow(w,tip){const I=Img(8,18);for(let i=0;i<=14;i++){const a=i/14*Math.PI,x=Math.round(2+Math.sin(a)*3.4);I.set(x,1+i,w[0]);I.set(x+1,1+i,i<3||i>11?w[0]:w[1]);if(i===7){I.set(x,1+i,w[2]);I.set(x+1,1+i,w[2]);}}
 I.vline(2,1,15,'#e8e0d0');I.set(2,1,tip||w[2]);I.set(2,15,tip||w[2]);I.rect(5,7,2,3,'#3a2414');return {I,gx:5,gy:8};}
function staff(orb,wood,prong){const I=Img(9,20);I.vline(4,5,18,wood);I.vline(5,6,17,'#5a3a20');I.set(4,10,'#c8a050');I.set(4,15,'#c8a050');
 for(let y=0;y<5;y++)for(let x=0;x<5;x++){const nx=x-2,ny=y-2;if(nx*nx+ny*ny<=5)I.set(2+x,y+1,nx+ny<-1?orb[2]:nx+ny<1?orb[1]:orb[0]);}
 if(prong){I.set(1,1,'#c8a050');I.set(7,1,'#c8a050');I.set(1,2,'#c8a050');I.set(7,2,'#c8a050');}I.set(3,2,'#ffffff');return {I,gx:4,gy:14};}
function hammer(h,silver){const I=Img(10,16);I.vline(4,4,14,'#7a5634');I.vline(4,9,9,'#5a3a20');I.set(4,15,'#5a3a20');
 I.rect(1,1,8,4,h[0]);I.rect(1,1,8,1,h[2]);I.rect(1,4,8,1,h[1]);I.rect(8,1,1,4,h[1]);if(silver){I.set(3,2,'#ffffff');I.rect(1,1,1,4,'#d8b04a');}return {I,gx:4,gy:11};}

// swords drawn from their shape (icons.js A.blade): each its own length, width, line, guard and grip (owner 2026-10-24)
function fromBlade(sp){const B=A.blade.bladeHeld(sp),I=Img(B.w,B.h);for(const [x,y,c] of B.px)I.set(x,y,c);return {I,gx:B.gx,gy:B.gy};}
const BLADED=['vipdag','shdag','bldag','rusty','isword','ssword','gsword','msword','failure','dains','iyarugt','wisdom','yetgs','dpgs','mgsword','lantd','ideal','ttthorn','dagger'];
// a creation (cw|ty.L.W.C.m1.m2): a sword from its blueprint, or a spear, bow, staff or hammer in its materials' colours
function cwDef(k){const B=A.blade,o=B&&B.cwParse(k);if(!o)return null;const P=B.MATP[o.m1][0],Q=o.m2?B.MATP[o.m2][0]:P,L=o.L/100;
 if(o.ty==='gs'||o.ty==='sw'||o.ty==='dg')return fromBlade(B.cwSpec(o));
 if(o.ty==='bw')return bow([P[0],P[1],Q[2]],Q[2]);if(o.ty==='st')return staff([Q[1],Q[0],Q[2]],P[1],B.MATP[o.m1]&&o.L>60);if(o.ty==='hm')return hammer(P,o.W>60);
 const h=20+Math.round(L*6),I=Img(7,h+1);I.vline(3,5,h,P[1]);I.vline(3,12,13,Q[2]);I.set(3,0,P[2]);I.rect(2,1,3,3,P[0]);I.vline(3,1,3,P[2]);I.set(4,3,P[1]);I.set(3,4,Q[0]);if(o.W>50){I.set(1,3,P[0]);I.set(5,3,P[0]);}return {I,gx:3,gy:15};}
// spears for the new weapons: shaft, head, light, trim; 0 a lance, 1 a trident, 2 a winged spear
function spearS(c,kind){const I=Img(9,24);I.vline(4,6,23,c[0]);I.vline(4,13,14,c[3]);if(kind===1){for(const x of [2,4,6])I.vline(x,0,4,c[1]);I.rect(2,4,5,1,c[1]);I.set(2,0,c[2]);I.set(4,0,c[2]);I.set(6,0,c[2]);}
 else{I.set(4,0,c[2]);I.rect(3,1,3,4,c[1]);I.vline(4,1,4,c[2]);I.set(5,4,shadeHex(c[1]));if(kind===2){I.set(1,5,c[3]);I.set(7,5,c[3]);I.set(2,4,c[3]);I.set(6,4,c[3]);I.rect(2,5,5,1,c[3]);}else I.rect(3,5,3,1,c[3]);}return {I,gx:4,gy:16};}
const shadeHex=c=>'#'+hex(c).map(v=>Math.max(0,v-60).toString(16).padStart(2,'0')).join('');
Object.assign(DEF,{oakst:()=>staff(['#3a7a3a','#7ac87a','#d8ffd8'],'#6a4a2a'),frstaff:()=>staff(['#2a5ab0','#9fe0ff','#ffffff'],'#c8d8e8',1),stormst:()=>staff(['#4a2a9a','#b08aff','#fff07a'],'#3a3a5a',1),abyssst:()=>staff(['#120814','#5a1a8a','#c86aff'],'#1a0a1a',1),hunbow:()=>bow(['#6a4a2a','#4a3018','#a8743f'],'#d0d4dc'),wyvbow:()=>bow(['#d8d0b8','#8a7a5a','#ffffff'],'#c8282a'),moonbow:()=>bow(['#c8d8ff','#5a6ab0','#ffffff'],'#fff4c0'),knspear:()=>spearS(['#7a5634','#c4c8d0','#eef0f4','#c8a050'],0),trident:()=>spearS(['#2a4a6a','#5ac8c8','#e8ffff','#3a8aa8'],1),skyspear:()=>spearS(['#e8e4d8','#ffd23a','#fff8c0','#ffffff'],2),warhm:()=>hammer(['#7a7a86','#4a4a56','#b8b8c4'],true),thhm:()=>hammer(['#4a6ab0','#2a3a70','#fff07a'],true),giantm:()=>hammer(['#5a4a3a','#3a2a1a','#9a8a6a'])});
const CACHE={};
// sprite(id, rarity) -> {canvas, gx, gy, w, h}; null for an unknown id
function sprite(id,r){const k=id+'|'+(r||0);if(CACHE[k])return CACHE[k];const f=String(id).startsWith('cw|')?()=>cwDef(id):A.blade&&BLADED.includes(id)?()=>fromBlade(A.blade.BSPEC[id]):DEF[id];if(!f)return null;const o=f();if(!o)return null;const {I,gx,gy}=o;
 r=r||0;if(r>=2){let ty=0;for(let y=0;y<I.h&&!ty;y++)for(let x=0;x<I.w;x++)if(I.d[(y*I.w+x)*4+3]){ty=y;I.set(x,y,RAR[r]);break;}}
 outline(I);
 if(r>=3){const d=I.d,c=hex(RAR[r]);for(let i=0;i<d.length;i+=4)if(d[i+3]===230&&d[i]===OUT[0]&&d[i+1]===OUT[1]){d[i]=c[0]*.55|0;d[i+1]=c[1]*.55|0;d[i+2]=c[2]*.55|0;}}
 const cv=mk(I.w,I.h);cv.getContext('2d').putImageData(new ImageData(I.d,I.w,I.h),0,0);return CACHE[k]={canvas:cv,gx,gy,w:I.w,h:I.h};}
// Draw a held weapon with its grip at (x,y). rot: radians from pointing up (0 = up); flip mirrors it (facing left).
function draw(g,id,r,x,y,rot,flip){const s=sprite(id,r);if(!s)return false;g.save();g.translate(Math.round(x),Math.round(y));if(rot)g.rotate(rot);if(flip)g.scale(-1,1);g.drawImage(s.canvas,-s.gx,-s.gy);g.restore();return true;}
A.weapons={IDS:Object.keys(DEF),sprite,draw,RARITY:RAR};
})(typeof window!=='undefined'?window:globalThis);
