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
const BLADE={mgsword:['#e0e4ec','#2a3a6a','#ffffff'],failure:['#5a6a7a','#2e3a48','#a8b8c8'],iyarugt:['#c8282a','#6a0a0e','#ff7a6a'],dpgs:['#5ac8a0','#1e6a50','#d8fff0'],dains:['#e8c050','#9a7418','#fff4c0'],wisdom:['#e8f4ff','#7a9ab8','#ffffff'],rusty:['#9b8b78','#6e6052','#c4b4a0'],isword:['#c4c8d0','#7a808c','#eef0f4'],ssword:['#dfe6ee','#8a94a4','#ffffff'],gsword:['#6ab0ff','#2a5ab0','#d0e8ff'],msword:['#c8e8f4','#7aa0b8','#ffffff']};
function sword(I,k){const [b,dk,lt]=BLADE[k]||BLADE.rusty,long=k==='gsword'||k==='failure'||k==='dains'||k==='dpgs';const tx=long?14:13,ty=long?1:2;
 for(let i=0;i<=tx-5;i++){I.set(5+i,10-i,b);I.set(6+i,10-i,dk);I.set(5+i,9-i,lt);}I.set(tx,ty,lt);
 if(long)for(let i=1;i<tx-5;i+=2)I.set(6+i,10-i,'#9fd0ff');
 if(k==='rusty'){I.set(8,7,'#7a5a3a');I.set(10,5,'#7a5a3a');I.set(11,4,dk);}
 I.line(3,8,7,12,'#c8a050');I.set(3,8,'#e8c870');I.line(4,11,2,13,'#6b4428');I.set(1,14,'#c8a050');}
const BOWC={rpbow:['#c82a1a','#7a1a0a','#ffd24a']};
function bow(I,k){const wood=BOWC[k]||(k==='sbow'?['#5a3a22','#3e2616','#7a5230']:['#8a5a32','#5e3e20','#b07a46']);
 for(let i=0;i<=12;i++){const a=i/12*Math.PI,x=Math.round(10-Math.sin(a)*6);I.set(x,2+i,wood[0]);I.set(x+1,2+i,wood[1]);}I.set(10,2,wood[2]);I.set(10,14,wood[2]);
 if(k==='sbow'){I.set(10,2,'#d0d4dc');I.set(10,14,'#d0d4dc');}I.line(11,2,11,14,'#e8e0d0');I.line(2,8,12,8,'#a0703a');I.rect(12,7,2,3,'#c8c8d0');I.set(1,7,'#e8e8e8');I.set(1,9,'#e8e8e8');I.set(2,8,'#e8e8e8');}
const STAFFC={blstaff:['#2a0614','#8a1a4a','#ff8ac8']};
function staff(I,k){const orb=STAFFC[k]||(k==='sstaff'?['#7a4ab0','#b07aff','#e8d0ff']:['#2a5ab0','#4a90ff','#bfe8ff']);
 I.line(3,14,10,7,'#7a5634');I.line(4,14,11,7,'#5a3a20');I.ell(11.5,4.5,3,3,orb[0]);I.ell(11,4,2,2,orb[1]);I.set(10,3,orb[2]);I.set(11,3,orb[2]);I.set(9,7,'#c8a050');I.set(10,8,'#c8a050');}
function hammer(I,k){const h=k==='shammer'?['#c8ccd6','#8a909a','#ffffff']:['#9aa0aa','#6a707a','#d0d4dc'];
 I.line(3,14,9,8,'#7a5634');I.line(4,14,10,8,'#5a3a20');I.rect(8,2,6,5,h[0]);I.rect(8,2,6,1,h[2]);I.rect(13,3,1,4,h[1]);I.rect(8,6,6,1,h[1]);I.set(10,4,h[1]);}
const ARMC={rparmor:['#c82a1a','#ff7a3a','#ffd24a'],tgarmor:['#e8e4d8','#ffffff','#2a2a2a'],dgarmor:['#2a6ab8','#5ac8ff','#c8e8ff'],ttshell:['#1a2a3a','#3a5a6a','#5ad8c8']};
function armor(I,k){const a=ARMC[k]||(k==='larmor'?['#8a5a32','#a8743f','#5a3a20']:k==='parmor'?['#9aa4b4','#c8d0dc','#5a6474']:k==='marmor'?['#a8d0e4','#e0f2fa','#4a7890']:k==='ocarmor'?['#d8dce4','#ffffff','#7a8494']:k==='emarmor'?['#3a3e4a','#6a7080','#c8a050']:k==='mgarmor'?['#c8d0dc','#eef2f8','#2a3a6a']:['#dfe2ea','#f2f4f8','#7a3a2c']);
 I.rect(4,3,8,10,a[0]);I.rect(2,3,3,4,a[1]);I.rect(11,3,3,4,a[1]);I.rect(6,3,4,2,'#2a1a10');I.set(6,5,'#2a1a10');I.set(9,5,'#2a1a10');I.rect(4,9,8,1,a[2]);I.rect(7,5,1,7,a[2]);I.rect(5,13,6,1,a[2]);
 if(k==='larmor')for(let y=6;y<12;y+=2){I.set(5,y,a[1]);I.set(10,y,a[1]);}
 if(k==='parmor'){I.set(5,6,'#ffffff');I.set(10,6,'#ffffff');I.set(5,11,a[1]);I.set(10,11,a[1]);}
 if(k==='marmor'){I.set(5,6,'#ffffff');I.set(10,6,'#ffffff');I.rect(7,5,1,7,'#4a90c0');}
 if(k==='ocarmor'){I.set(6,8,'#c8282a');I.set(9,8,'#c8282a');I.rect(2,2,1,2,'#ffffff');I.rect(13,2,1,2,'#ffffff');}
 if(k==='emarmor'){I.rect(7,5,1,7,'#c8a050');I.set(5,6,'#e8c870');I.set(10,6,'#e8c870');}
 if(k==='mgarmor'){I.rect(7,5,1,7,'#2a3a6a');I.set(5,6,'#ffffff');I.set(10,6,'#ffffff');I.rect(6,10,4,1,'#e8c050');}
 if(k==='warmor'){I.rect(7,5,1,7,'#a83a2c');I.rect(4,9,8,1,'#a83a2c');}}
function helm(I,a,visor){I.ell(8,8,5,5,a[0]);for(let y=11;y<16;y++)for(let x=0;x<16;x++)I.d[(y*16+x)*4+3]=0;
 I.rect(2,9,12,2,a[2]);I.rect(5,4,4,1,a[1]);I.set(4,5,a[1]);if(visor){I.rect(5,7,6,1,'#1a1220');I.rect(7,4,2,4,a[1]);}else I.rect(7,3,2,6,a[1]);}
function glove(I,a){I.rect(4,6,7,7,a[0]);I.rect(4,12,7,2,a[2]);for(let x=4;x<11;x+=2)I.rect(x,3,1,3,a[0]);I.rect(11,7,2,3,a[0]);I.rect(5,7,5,1,a[1]);I.set(12,7,a[1]);}
function boot(I,a){I.rect(5,2,5,10,a[0]);I.rect(5,10,9,3,a[0]);I.rect(5,13,9,1,a[2]);I.rect(5,2,5,1,a[1]);I.rect(6,5,3,1,a[2]);I.set(13,10,a[1]);}
function ring(I,c,lt,gem){I.ell(8,10,4.5,4,c);for(let y=8;y<=12;y++)for(let x=6;x<=10;x++){const nx=(x-8)/2.5,ny=(y-10)/2;if(nx*nx+ny*ny<=1)I.d[(y*16+x)*4+3]=0;}
 I.set(5,8,lt);I.set(6,7,lt);I.ell(8,4.5,2,2,gem);I.set(7,4,'#ffffff');}
function gemI(I,c){I.rect(5,4,6,2,c[1]);I.rect(4,6,8,2,c[1]);I.rect(5,8,6,2,c[0]);I.rect(6,10,4,2,c[0]);I.rect(7,12,2,1,c[0]);I.rect(6,4,2,2,c[2]);I.set(5,6,c[2]);I.set(7,5,'#ffffff');}
// a divine beast's breath (second ten, major 5): a swirl of its element held in a glass orb
// Elizabeth's jewelry (v1.22): a chain with a pendant, and a band with a set stone
function essI(I,c){I.ell(8,10,4.5,4.5,c[0]);I.ell(8,10,3.5,3.5,c[1]);I.ell(7,9,1.6,1.6,c[2]);I.set(6,8,'#ffffff');I.line(8,3,8,5,c[1]);I.set(7,4,c[2]);I.set(9,2,c[1]);I.set(10,4,c[2]);I.set(5,5,c[1]);}
function neckI(I,ch,g){for(let i=0;i<=12;i++){const a=i/12*Math.PI;I.set(Math.round(8-Math.cos(a)*5.5),Math.round(2+Math.sin(a)*6.5),ch);}I.ell(8,11,2.5,3,g[0]);I.ell(8,11,1.6,2,g[1]);I.set(7,10,g[2]);I.set(8,8,ch);}
function braceI(I,b,g){I.ell(8,9,6.5,4.5,b[0]);I.ell(8,9,5.5,3.5,b[1]);for(let y=6;y<=12;y++)for(let x=3;x<=13;x++){const nx=(x-8)/4.2,ny=(y-9.3)/2.3;if(nx*nx+ny*ny<=1)I.d[(y*16+x)*4+3]=0;}I.ell(8,5,2,1.6,g[0]);I.set(8,5,g[1]);I.set(7,4,g[2]);}
function brI(I,c){I.ell(8,8,6,6,c[0]);I.ell(8,8,5,5,c[1]);I.line(5,9,8,6,c[2]);I.line(8,6,11,8,c[2]);I.line(11,8,8,11,c[2]);I.set(8,8,'#ffffff');I.set(6,5,'#ffffff');I.set(5,6,c[2]);I.rect(7,13,3,1,c[0]);}
function fishI(I,c){I.ell(7,8,5,3,c[0]);I.ell(7,7,4,1.5,c[1]);for(let i=0;i<4;i++)I.rect(12+i,8-i,1,1+i*2,c[2]);I.rect(5,10,5,1,c[2]);I.set(4,7,'#101010');I.set(8,4,c[2]);I.set(9,4,c[2]);}
function herbI(I,c,c2){I.line(8,14,8,6,'#3a7a2a');I.line(5,14,6,8,'#3a7a2a');I.line(11,14,10,9,'#3a7a2a');I.set(7,11,'#5aa83a');I.set(9,10,'#5aa83a');I.ell(8,5,2,2,c);I.ell(6,8,1.5,1.5,c);I.ell(10,9,1.5,1.5,c);I.set(8,5,c2);I.set(6,8,c2);}
const DRAW={
 bread:I=>{I.ell(8,9,6,4,'#8a4a1a');I.ell(8,8,6,3,'#c8803a');I.ell(7,7,4,1.5,'#d8964a');for(const x of [5,8,11]){I.set(x,7,'#e8b070');I.set(x+1,8,'#8a4a1a');}},
 wood:I=>{I.rect(2,4,10,4,'#7a4e2c');I.rect(2,4,10,1,'#a06a3a');I.rect(4,9,10,4,'#6e4428');I.rect(4,9,10,1,'#946038');I.ell(12,6,2,2,'#c49a62');I.set(12,6,'#8a5a32');I.ell(14,11,1.5,2,'#c49a62');I.set(14,11,'#8a5a32');I.set(5,6,'#5a3418');I.set(8,11,'#4e2e16');},
 ore:I=>{I.ell(8,9,6,5,'#55504c');I.ell(8,8,5,4,'#7f7a76');I.ell(7,7,3,2,'#9a958f');I.rect(5,8,2,2,'#c8743a');I.rect(9,10,2,1,'#d9894a');I.set(10,6,'#e8a060');I.set(4,11,'#45403c');},
 leather:I=>{I.rect(3,3,10,10,'#8a5a3a');I.rect(2,5,1,6,'#8a5a3a');I.rect(13,5,1,6,'#8a5a3a');I.rect(5,1,6,2,'#8a5a3a');I.rect(6,13,4,2,'#8a5a3a');I.rect(4,4,8,1,'#a8744a');for(let x=4;x<12;x+=2)I.set(x,11,'#d8b080');I.rect(5,7,6,1,'#6a4228');},
 blue:I=>{I.line(8,1,8,14,'#3a7ad8');I.rect(5,4,6,8,'#4a90ff');I.rect(6,3,4,10,'#5aa2ff');I.line(7,4,7,10,'#bfe0ff');I.rect(4,6,1,4,'#2a5ab0');I.rect(11,6,1,4,'#2a5ab0');I.set(9,12,'#2a5ab0');I.set(10,11,'#2a5ab0');},
 coin:I=>{I.ell(8,9,5,5,'#8a5a10');I.ell(8,8,5,5,'#e8b030');I.ell(8,8,3,3,'#f8d870');I.line(8,6,8,10,'#b07818');I.set(6,6,'#fff6c0');I.set(7,5,'#fff6c0');},
 estone:I=>{I.rect(5,3,6,10,'#6a3a12');I.rect(4,5,8,6,'#8a4a16');I.rect(5,4,6,8,'#d8862a');I.rect(6,5,4,6,'#f0b048');I.line(7,5,7,8,'#fff0b8');I.set(10,11,'#6a3a12');I.set(5,4,'#6a3a12');},
 mstone:I=>{I.ell(8,8,4,6,'#2a5ab0');I.ell(8,7,3,5,'#4a90ff');I.line(7,4,7,7,'#bfe8ff');I.set(9,11,'#1a3a80');I.set(10,9,'#3a70d0');},
 arrows:I=>{for(let i=0;i<3;i++){const o=i*2-2;I.line(3+o,12+o,12+o,3+o,'#a0703a');I.rect(12+o,2+o,2,2,'#c8c8d0');I.set(13+o,2+o,'#ffffff');I.set(2+o,12+o,'#e8e8e8');I.set(3+o,13+o,'#e8e8e8');}},
 // gear pieces (SAT-EQUIP-001): helmets, gloves, boots, rings; leather or iron colors
 lhelm:I=>helm(I,['#8a5a32','#a8743f','#5a3a20']),ihelm:I=>helm(I,['#9aa4b4','#c8d0dc','#5a6474'],1),
 lgloves:I=>glove(I,['#8a5a32','#a8743f','#5a3a20']),igloves:I=>glove(I,['#9aa4b4','#c8d0dc','#5a6474']),
 lboots:I=>boot(I,['#7a4e2c','#a06a3a','#4e2e16']),iboots:I=>boot(I,['#8a94a4','#c8d0dc','#4e5664']),
 mhelm:I=>helm(I,['#a8d0e4','#e0f2fa','#4a7890'],1),
 // tailoring (production specializations): cloth hood, soft leather gloves and boots, cloth robe
 tHood:I=>{helm(I,['#2a6a6a','#3a8a8a','#1a4a4a']);I.rect(4,9,8,2,'#1a4a4a');I.rect(6,7,4,3,'#f1c193');I.set(7,8,'#2a1a10');I.set(9,8,'#2a1a10');},
 tGloves:I=>glove(I,['#b8946a','#d8b48a','#7a5a3a']),tBoots:I=>boot(I,['#a8845a','#c8a47a','#6a4a2a']),
 tRobe:I=>{I.rect(5,2,6,13,'#2a6a6a');I.rect(3,3,3,6,'#3a8a8a');I.rect(10,3,3,6,'#3a8a8a');I.rect(6,2,4,2,'#1a4a4a');I.rect(5,8,6,1,'#c8a050');I.rect(7,9,2,6,'#1a4a4a');I.set(6,4,'#5aaaaa');I.set(9,4,'#5aaaaa');},
 // mithril ore (SAT-REIDAN-001): pale silver-blue nuggets in dark rock
 mith:I=>{I.ell(8,9,6,5,'#3e4650');I.ell(8,8,5,4,'#5a6470');I.rect(5,7,3,2,'#a8d8f0');I.rect(9,9,2,2,'#c8ecff');I.set(6,7,'#ffffff');I.set(10,6,'#bfe8ff');I.set(4,11,'#2e343c');},
 // life skills (SAT-LIFE-001): fish, herbs and cooked dishes
 fish:I=>fishI(I,['#6a8aa8','#8aaac8','#4a6a88']),sfish:I=>fishI(I,['#c8909a','#e8c0c8','#9a6a78']),gfish:I=>{fishI(I,['#d8a830','#f2d060','#a87a18']);I.set(9,5,'#ffffff');I.set(3,11,'#fff3b0');},
 // gems (SAT-GEM-001): cut stones in five colours
 ruby:I=>gemI(I,['#7a1020','#c82a3a','#ff8a9a']),topaz:I=>gemI(I,['#a86a10','#e8a830','#fff0a0']),emer:I=>gemI(I,['#0e5a2a','#28a050','#9af0b0']),sapph:I=>gemI(I,['#102a7a','#2a5ad8','#9ac0ff']),diam:I=>gemI(I,['#7a90a8','#d8e8f8','#ffffff']),
 // a red dragon scale (SAT-DRAGON-001)
 dscale:I=>{I.ell(8,8,6,6,'#7a161a');I.ell(8,7,5,5,'#b8282a');I.ell(7,6,3,3,'#d84a3a');I.line(8,3,8,13,'#7a161a');I.set(6,4,'#ff9a7a');I.set(5,5,'#ff9a7a');I.rect(7,13,2,2,'#5a1012');},
 brphx:I=>brI(I,['#7a1a0a','#e8501e','#ffd24a']),brdrg:I=>brI(I,['#0e2a7a','#2a8aff','#bfe8ff']),brtig:I=>brI(I,['#5a4a2a','#c8b890','#ffffff']),brtor:I=>brI(I,['#0a1a3a','#1a5a8a','#5ad8c8']),
 // the divine beasts' legendary sets (second ten, major 6)
 rpbow:I=>bow(I,'rpbow'),rparmor:I=>{armor(I,'rparmor');I.set(7,7,'#ffffff');},rphelm:I=>{helm(I,['#c82a1a','#ff7a3a','#ffd24a'],0);I.set(7,2,'#ffd24a');I.set(8,2,'#ffd24a');},rpboots:I=>{boot(I,['#c82a1a','#ff7a3a','#ffd24a']);I.set(8,4,'#ffd24a');},
 tgarmor:I=>{armor(I,'tgarmor');I.set(5,7,'#2a2a2a');I.set(10,7,'#2a2a2a');},tghelm:I=>{helm(I,['#e8e4d8','#ffffff','#2a2a2a'],1);I.set(5,6,'#2a2a2a');I.set(10,6,'#2a2a2a');},tggloves:I=>{glove(I,['#e8e4d8','#ffffff','#2a2a2a']);I.set(4,2,'#ffffff');I.set(6,2,'#ffffff');I.set(8,2,'#ffffff');I.set(10,2,'#ffffff');},tgboots:I=>{boot(I,['#e8e4d8','#ffffff','#2a2a2a']);I.rect(6,7,3,1,'#2a2a2a');},
 dgspear:I=>{I.line(2,14,11,5,'#2a4a7a');I.line(3,14,12,5,'#1a2a4a');I.set(6,10,'#c8e8ff');I.set(7,10,'#c8e8ff');I.rect(11,3,2,2,'#5ac8ff');I.set(13,2,'#e8f8ff');I.set(14,1,'#ffffff');I.set(12,2,'#5ac8ff');I.set(13,3,'#2a6aff');I.set(10,4,'#5ac8ff');I.set(11,5,'#5ac8ff');},
 dggaunt:I=>{glove(I,['#2a6ab8','#5ac8ff','#c8e8ff']);I.set(7,9,'#ffffff');},dgarmor:I=>{armor(I,'dgarmor');I.set(6,7,'#c8e8ff');I.set(9,7,'#c8e8ff');},dghelm:I=>{helm(I,['#2a6ab8','#5ac8ff','#c8e8ff'],1);I.set(4,4,'#c8e8ff');I.set(11,4,'#c8e8ff');},
 ttthorn:I=>{for(let i=0;i<5;i++){I.set(7+i,8-i,'#3a5a6a');I.set(8+i,8-i,'#1a2a3a');I.set(7+i,7-i,'#5ad8c8');}I.set(12,3,'#ffffff');I.line(5,7,8,10,'#1a3a3a');I.line(4,11,6,9,'#2a2a2a');I.set(3,12,'#5ad8c8');},
 ttshell:I=>{armor(I,'ttshell');I.rect(6,6,4,4,'#3a5a6a');I.set(7,7,'#5ad8c8');I.set(8,8,'#5ad8c8');},tthelm:I=>{helm(I,['#1a2a3a','#3a5a6a','#5ad8c8'],1);I.set(8,4,'#5ad8c8');},ttboots:I=>{boot(I,['#1a2a3a','#3a5a6a','#5ad8c8']);I.set(7,7,'#5ad8c8');},
 // the 32nd Great Demon Belial (second ten, major 7)
 gdneck:I=>neckI(I,'#c8a050',['#7a5a1a','#e8c860','#fff4c0']),gdbrace:I=>braceI(I,['#8a6a2a','#d8b050'],['#e8c860','#fff4c0','#ffffff']),
 ezneck:I=>neckI(I,'#d8dce4',['#1a3a8a','#4a7ae8','#cfe0ff']),ezbrace:I=>braceI(I,['#8a8e9a','#e0e4ec'],['#2a5ad8','#9fc0ff','#ffffff']),
 bjneck:I=>neckI(I,'#6a6a72',['#14060e','#4a1a3a','#c87aa8']),bjbrace:I=>braceI(I,['#2a2430','#5a5060'],['#2a0a1e','#8a3a6a','#e8a8d0']),
 slotN:I=>{for(let i=0;i<=10;i++){const a=i/10*Math.PI;I.set(Math.round(8-Math.cos(a)*5),Math.round(3+Math.sin(a)*6),'#bfe0ff');}I.rect(7,9,3,4,'#bfe0ff');},
 slotR:I=>{I.ell(8,9,6,4,'#bfe0ff');for(let y=6;y<=12;y++)for(let x=3;x<=13;x++){const nx=(x-8)/4,ny=(y-9)/2.2;if(nx*nx+ny*ny<=1)I.d[(y*16+x)*4+3]=0;}},
 wheat:I=>{for(const x of [5,8,11]){I.line(x,15,x,6,'#9a8a3a');for(let y=2;y<=7;y+=2){I.set(x-1,y,'#e8c860');I.set(x+1,y+1,'#e8c860');I.set(x,y,'#f4dc8a');}}I.rect(4,11,9,1,'#c8a040');},
 straw:I=>{for(const [cx,cy] of [[6,10],[10,9]]){I.ell(cx,cy,3,3.5,'#c81a2a');I.ell(cx,cy-1,2.4,2.6,'#e83a4a');I.set(cx-1,cy,'#ffe08a');I.set(cx+1,cy+1,'#ffe08a');I.set(cx,cy+2,'#ffe08a');I.rect(cx-2,cy-4,4,1,'#3a8a2a');I.set(cx,cy-5,'#5aa83a');}},
 melon:I=>{I.ell(8,9,6.5,5,'#2a6a2a');I.ell(8,9,5.5,4,'#3a9a3a');for(const x of [4,7,10,13])I.line(x,5,x-1,13,'#1e4a1e');I.set(5,6,'#8ad88a');I.set(6,5,'#8ad88a');I.rect(8,3,1,2,'#6a4a2a');},
 pumpk:I=>{I.ell(8,10,6.5,4.5,'#b85a10');I.ell(8,10,5.5,3.5,'#e8801a');I.line(5,7,5,13,'#b85a10');I.line(11,7,11,13,'#b85a10');I.line(8,6,8,14,'#c86a14');I.set(6,8,'#ffb060');I.rect(7,3,2,3,'#4a6a2a');I.set(9,3,'#6a9a3a');},
 fcab:I=>{I.ell(8,10,6,4.5,'#5a9a8a');I.ell(8,9,5,3.6,'#8ad0c0');I.ell(8,9,3,2.2,'#c8f0e8');I.line(8,6,8,12,'#5a9a8a');I.line(5,8,8,11,'#5a9a8a');I.line(11,8,8,11,'#5a9a8a');I.set(4,6,'#ffffff');I.set(12,7,'#ffffff');I.set(10,5,'#e8ffff');},
 compost:I=>{I.rect(3,7,10,8,'#6a4a2a');I.rect(3,7,10,1,'#8a6a3a');I.rect(3,11,10,1,'#4a2e18');I.ell(8,6,4.5,2,'#4a3a1e');I.set(6,5,'#6a9a3a');I.set(9,4,'#8ab84a');I.set(10,6,'#a8784a');I.set(5,6,'#c8a060');},
 ppie:I=>{I.ell(8,11,6.5,3,'#c8ccd6');I.ell(8,10,5.5,2.4,'#c88a3a');I.ell(8,9,4.5,1.8,'#e8801a');I.ell(8,9,3,1,'#f4a040');I.rect(3,10,11,1,'#a86a2a');I.set(8,6,'#f8f0e0');I.set(7,5,'#f8f0e0');},
 sjam:I=>{I.ell(8,11,6.5,3,'#c8ccd6');I.ell(8,10,5.5,2.4,'#d8a860');I.ell(8,9,4.5,1.6,'#e8d8b0');for(const x of [5,8,11]){I.ell(x,8,1.4,1.2,'#e83a4a');I.set(x,7,'#3a8a2a');}},
 kink:I=>{I.rect(7,2,2,2,'#5a4a3a');I.rect(5,4,6,1,'#8a8e9a');I.ell(8,10,4.5,4.5,'#2a2238');I.ell(8,10,3.5,3.5,'#14101e');I.set(6,8,'#5a5078');I.set(7,7,'#7a70a0');I.rect(5,14,6,1,'#3a3448');},
 kpearl:I=>{I.ell(8,11,6,3,'#8a5a6a');I.ell(8,10,5,2.2,'#c88aa0');I.ell(8,8,3,3,'#e8e4f0');I.ell(8,8,2.2,2.2,'#f8f6ff');I.set(7,7,'#ffffff');I.set(9,9,'#c8c0e0');},
 kneck:I=>neckI(I,'#c8c0d0',['#8a7aa0','#f8f6ff','#ffffff']),
 fess:I=>essI(I,['#7a1a0a','#e8501e','#ffd24a']),iess:I=>essI(I,['#1a3a6a','#4aa8e8','#d8f4ff']),sess:I=>essI(I,['#1e2640','#5a6a9a','#fff27a']),
 bvial:I=>{I.rect(7,2,2,2,'#8a6a3a');I.rect(6,4,4,1,'#c8d0dc');I.rect(5,5,6,9,'#c8d0dc');I.rect(6,6,4,7,'#e8eef4');I.rect(6,8,4,5,'#a81a2a');I.rect(6,8,4,1,'#d83a4a');I.set(7,10,'#ff7a8a');I.rect(5,14,6,1,'#8a8e9a');},
 wegg:I=>{I.ell(8,9,4.5,5.5,'#6a7a3a');I.ell(8,9,3.5,4.5,'#a8b878');I.set(6,6,'#e8f0c8');I.set(7,5,'#e8f0c8');I.rect(9,8,2,1,'#5a6a2a');I.set(6,11,'#5a6a2a');I.rect(8,12,1,1,'#5a6a2a');},
 flneck:I=>neckI(I,'#c8a050',['#7a1a0a','#e8501e','#ffd24a']),frbrace:I=>braceI(I,['#8a8e9a','#e0e4ec'],['#1a5aa8','#7ac8f0','#ffffff']),stbrace:I=>braceI(I,['#2a3040','#5a6478'],['#2a3450','#9aa8c8','#fff27a']),
 bljewel:I=>gemI(I,['#1a0a14','#4a1a3a','#c87aa8']),blhorn:I=>{for(let i=0;i<9;i++){const x=4+i,y=13-Math.round(Math.sqrt(i)*3.6);I.rect(x,y,2,3-Math.floor(i/4),i<6?'#e8d8c0':'#c8b8a0');}I.set(13,2,'#ffffff');I.rect(3,13,3,2,'#6a1a2a');},blstaff:I=>staff(I,'blstaff'),
 herb:I=>herbI(I,'#d83a3a','#ff8a7a'),bherb:I=>herbI(I,'#3a7ad8','#bfe8ff'),
 cfish:I=>{I.line(1,14,14,1,'#8a6a3a');fishI(I,['#a8642a','#c8843a','#6a3a18']);I.set(6,7,'#4a2a10');I.set(8,7,'#4a2a10');I.set(10,7,'#4a2a10');},
 stew:I=>{I.ell(8,10,6,3.5,'#7a4a2a');I.rect(2,9,13,1,'#9a6a40');I.ell(8,9,5,1.5,'#c8843a');I.set(6,9,'#5aa83a');I.set(9,8,'#d83a3a');I.set(11,9,'#5aa83a');for(const x of [5,8,11]){I.set(x,6,'#e8e8f0');I.set(x+1,4,'#e8e8f0');I.set(x,2,'#e8e8f0');}},
 feast:I=>{I.ell(8,11,7,3,'#c8ccd6');I.ell(8,10,6,2,'#e8ecf2');I.ell(7,9,4,1.6,'#d8a830');I.ell(7,8,3,1,'#f2d060');I.rect(11,8,2,2,'#a87a18');I.set(4,10,'#5aa83a');I.set(12,11,'#d83a3a');I.set(13,10,'#3a7ad8');},
 cring:I=>ring(I,'#c87a3a','#e8a060','#4ad070'),mring:I=>ring(I,'#c8a050','#f2d27a','#4a90ff'),
 spear:I=>{I.line(2,14,11,5,'#7a5634');I.line(3,14,12,5,'#5a3a20');I.set(6,10,'#c8a050');I.set(7,10,'#c8a050');I.rect(11,3,2,2,'#c4c8d0');I.set(13,2,'#eef0f4');I.set(14,1,'#eef0f4');I.set(12,2,'#c4c8d0');I.set(13,3,'#7a808c');I.set(10,4,'#9a9aa6');I.set(11,5,'#9a9aa6');},
 dagger:I=>{for(let i=0;i<5;i++){I.set(7+i,8-i,'#c4c8d0');I.set(8+i,8-i,'#7a808c');I.set(7+i,7-i,'#eef0f4');}I.line(5,7,8,10,'#9a9aa6');I.line(4,11,6,9,'#6b4428');I.set(3,12,'#c8a050');},
 // named items from the novel (item skills)
 ideal:I=>{for(let i=0;i<6;i++){I.set(6+i,9-i,'#bfe8ff');I.set(7+i,9-i,'#5a8ab0');I.set(6+i,8-i,'#ffffff');}I.line(4,8,7,11,'#4a90c0');I.line(3,12,5,10,'#6b4428');I.set(2,13,'#4a90c0');},
 gale:I=>{I.line(2,14,11,5,'#3a6a5a');I.line(3,14,12,5,'#2a4a40');I.set(6,10,'#9fe3c8');I.rect(11,2,3,3,'#9fe3c8');I.set(14,1,'#ffffff');I.set(13,1,'#e8fff4');I.set(12,3,'#ffffff');I.set(10,4,'#5aa890');I.set(14,4,'#5aa890');},
 tbow:I=>{for(let i=0;i<=12;i++){const a=i/12*Math.PI,x=Math.round(10-Math.sin(a)*6);I.set(x,2+i,'#4a6ab0');I.set(x+1,2+i,'#2a3a70');}I.set(10,2,'#fff07a');I.set(10,14,'#fff07a');I.line(11,2,11,14,'#fff07a');I.line(3,8,12,8,'#bfe0ff');I.set(2,8,'#ffffff');I.set(5,7,'#fff07a');I.set(7,9,'#fff07a');},
 elfin:I=>ring(I,'#8a8a96','#c8c8d8','#4ad070'),vring:I=>ring(I,'#3a1a22','#7a3a4a','#d8283a'),doran:I=>ring(I,'#c8a050','#f2d27a','#8a3ad8'),absurd:I=>ring(I,'#e8e8f0','#ffffff','#ff8a1e'),
 bboots:I=>{boot(I,['#2a2a34','#5a5a6a','#1a1a20']);I.set(6,4,'#d8dce8');I.set(8,6,'#d8dce8');I.set(7,8,'#d8dce8');I.rect(5,9,5,1,'#4a4a58');},
 ochelm:I=>{helm(I,['#d8dce4','#ffffff','#7a8494'],1);I.set(3,5,'#d8dce4');I.set(12,5,'#d8dce4');I.set(2,4,'#ffffff');I.set(13,4,'#ffffff');I.set(6,8,'#c8282a');I.set(9,8,'#c8282a');},
 book:I=>{I.rect(3,2,10,12,'#7a2a26');I.rect(4,2,9,1,'#a03a34');I.rect(3,2,1,12,'#4a1a18');I.rect(12,3,1,10,'#e8dcc0');I.rect(6,6,4,1,'#f2c14e');I.rect(6,8,4,1,'#f2c14e');I.rect(11,7,2,2,'#c8a050');},
 // the death knights' gear from the Behen Archipelago, and the cure for Sticks
 lantd:I=>{for(let i=0;i<5;i++){I.set(7+i,8-i,'#e8eef8');I.set(8+i,8-i,'#8a94a4');I.set(7+i,7-i,'#ffffff');}I.line(5,7,8,10,'#a81a1a');I.line(4,11,6,9,'#3a2a1e');I.set(3,12,'#a81a1a');},
 alexb:I=>{I.rect(2,8,10,2,'#4a5a7a');I.rect(2,8,10,1,'#9ab0d0');I.rect(11,7,4,1,'#e8eef8');I.set(14,6,'#ffffff');I.rect(3,10,2,4,'#5a3a20');I.rect(6,10,2,2,'#3a2a1e');I.set(9,7,'#c8a050');},
 ocgloves:I=>{glove(I,['#d8dce4','#ffffff','#7a8494']);I.set(6,9,'#c8282a');I.set(8,9,'#c8282a');},ocboots:I=>{boot(I,['#d8dce4','#ffffff','#7a8494']);I.set(7,7,'#c8282a');},
 ocring:I=>ring(I,'#d8dce4','#ffffff','#c8282a'),emhelm:I=>{helm(I,['#3a3e4a','#6a7080','#c8a050'],1);I.set(7,4,'#e8c870');I.set(8,4,'#e8c870');},
 emgloves:I=>{glove(I,['#3a3e4a','#6a7080','#c8a050']);I.set(7,9,'#e8c870');},emboots:I=>{boot(I,['#3a3e4a','#6a7080','#c8a050']);I.set(7,7,'#e8c870');},
 mghelm:I=>{helm(I,['#c8d0dc','#eef2f8','#2a3a6a'],1);I.set(7,9,'#e8c050');I.set(8,9,'#e8c050');},mggloves:I=>{glove(I,['#c8d0dc','#eef2f8','#2a3a6a']);I.set(7,9,'#2a3a6a');},
 mgboots:I=>{boot(I,['#c8d0dc','#eef2f8','#2a3a6a']);I.set(7,7,'#2a3a6a');},
 alexg:I=>{glove(I,['#2a3a5a','#6a7a9a','#141c30']);I.set(6,9,'#c8a050');I.set(8,9,'#c8a050');},
 kcloth:I=>{I.rect(3,3,10,10,'#6a6a74');I.rect(3,3,10,1,'#9a9aa6');for(let y=5;y<13;y+=2)I.rect(4,y,8,1,'#4a4a52');I.rect(12,4,1,9,'#4a4a52');I.set(6,6,'#c8c0ff');I.set(9,9,'#c8c0ff');},
 gisp:I=>{I.line(3,14,10,7,'#6a4a2a');I.line(4,14,11,7,'#4a3020');I.line(6,4,13,4,'#8a9aa8');I.line(6,4,5,7,'#8a9aa8');I.line(13,4,14,7,'#8a9aa8');I.set(9,4,'#c8d0dc');I.set(10,5,'#6a7480');},
 povt:I=>{ring(I,'#3a6a3a','#7ab07a','#c8e8a8');I.set(10,8,'#c8a050');},
 wtneck:I=>{for(let i=0;i<=10;i++){const a=i/10*Math.PI;I.set(Math.round(8-Math.cos(a)*5),Math.round(3+Math.sin(a)*6),'#c8a050');}I.ell(8,11,2,2.5,'#3a9a4a');I.set(7,10,'#a8f0a0');I.set(8,13,'#1a6a2a');},
 mnring:I=>{ring(I,'#5a6a8a','#b8c8e8','#e8f0ff');I.set(10,8,'#fff8c8');I.set(9,7,'#8ab0ff');},
 bcoco:I=>{I.ell(8,9,5,5,'#2a5ab0');I.ell(7,8,4,4,'#3a7ad8');I.set(6,6,'#bfe0ff');I.set(7,6,'#bfe0ff');I.rect(7,2,2,3,'#3a6a2a');I.set(10,3,'#5aa83a');I.set(5,3,'#5aa83a');},
 wtleaf:I=>{I.ell(8,8,3.5,6,'#3a9a4a');I.line(8,3,8,14,'#1a6a2a');I.set(6,6,'#9af0a0');I.set(7,5,'#9af0a0');I.line(8,14,9,15,'#6a4a2a');I.set(10,9,'#1a6a2a');I.set(6,10,'#1a6a2a');}};
// potions: round flask, cork, liquid with a highlight
const flask=(liq,lt)=>I=>{I.rect(7,2,2,2,'#8a5a32');I.rect(6,4,4,1,'#c8d0dc');I.rect(7,5,2,2,'#c8d0dc');I.ell(8,10.5,4.5,4,'#c8d0dc');I.ell(8,11,3.5,3,liq);I.rect(5,9,6,1,lt);I.set(6,10,'#ffffff');I.set(6,11,lt);I.set(10,13,'#00000000'==='x'?lt:liq);};
DRAW.respec=I=>{I.rect(3,3,10,10,'#e8d8a8');I.rect(3,3,10,1,'#b89858');I.rect(3,12,10,1,'#b89858');I.rect(2,2,2,12,'#9a7a48');I.rect(12,2,2,12,'#9a7a48');I.rect(5,5,6,1,'#5a4a8a');I.rect(5,7,5,1,'#5a4a8a');I.rect(5,9,6,1,'#5a4a8a');I.rect(7,10,2,2,'#c83a3a');};
DRAW.hpot=flask('#d8283a','#ff7a8a');DRAW.mpot=flask('#2a5ad8','#7ab0ff');
// the Reputation Store (v0.96): Sweet Candy, the sunglasses, the drawing machine and what it gives
DRAW.xpot=flask('#e8b030','#fff0a0');
Object.assign(DRAW,{
 candy:I=>{I.line(3,13,7,9,'#e8e0d0');I.ell(10,6,4,4,'#e84a7a');I.ell(10,6,3,3,'#ff8ab0');I.line(8,4,12,8,'#ffffff');I.set(9,5,'#ffffff');I.set(11,4,'#ffd0e0');},
 sgl:I=>{I.rect(1,6,6,4,'#141418');I.rect(9,6,6,4,'#141418');I.rect(7,6,2,1,'#141418');I.rect(0,6,1,1,'#141418');I.rect(15,6,1,1,'#141418');I.set(2,7,'#6a7a9a');I.set(10,7,'#6a7a9a');I.set(3,7,'#3a4a6a');I.set(11,7,'#3a4a6a');},
 rsdraw:I=>{I.rect(3,6,10,9,'#c82a3a');I.rect(3,6,10,1,'#ff6a7a');I.ell(8,5,4,4,'#bfe8ff');I.ell(8,5,3,3,'#e8f6ff');I.set(7,4,'#ffd24a');I.set(9,6,'#4ad070');I.set(8,3,'#e84a7a');I.rect(6,10,4,2,'#2a1a20');I.rect(13,8,1,4,'#c8ccd6');I.rect(13,7,2,1,'#f2c14e');},
 hairpin:I=>{I.line(2,13,11,4,'#c8ccd6');I.line(3,13,12,4,'#8a909a');I.ell(11,4,3,3,'#3a7ad8');I.set(11,4,'#bfe0ff');I.set(9,3,'#ff8ab0');I.set(13,6,'#ffd24a');I.set(12,2,'#ff8ab0');},
 dskewer:I=>{I.line(1,14,14,1,'#c8a070');for(const [x,y,c] of [[5,10,'#8a3a1a'],[8,7,'#a8481e'],[11,4,'#8a3a1a']]){I.ell(x,y,2.5,2.5,c);I.set(x-1,y-1,'#d87a3a');}I.set(4,11,'#5a2010');I.set(10,5,'#5a2010');},
 choco:I=>{I.rect(3,4,10,9,'#5a2e16');for(let x=3;x<13;x+=3)I.rect(x,4,1,9,'#3e1e0e');for(let y=4;y<13;y+=3)I.rect(3,y,10,1,'#3e1e0e');I.rect(3,10,10,3,'#c8a050');I.rect(3,10,10,1,'#f2d27a');I.set(5,5,'#8a4e2a');I.set(8,5,'#8a4e2a');},
 // a thunder stone (v0.97): a transparent stone containing a thunderbolt
 tstone:I=>{I.ell(8,9,5,5,'#5a6a8a');I.ell(8,8,4,4,'#a8c8f0');I.ell(7,7,2,2,'#e8f4ff');I.line(9,4,7,8,'#ffe060');I.line(7,8,10,9,'#ffe060');I.line(10,9,8,13,'#ffe060');I.set(6,6,'#ffffff');},
 blocks:I=>{I.rect(2,9,5,5,'#d83a3a');I.rect(8,9,5,5,'#3a7ad8');I.rect(5,3,5,5,'#e8b030');I.set(3,10,'#ff8a8a');I.set(9,10,'#9ac0ff');I.set(6,4,'#fff0a0');I.rect(3,8,1,1,'#d83a3a');I.rect(9,8,1,1,'#3a7ad8');}});
DRAW.jaffa=DRAW.arrows;
const SLOT={slotW:I=>{for(let i=0;i<8;i++)I.set(5+i,10-i,'#bfe0ff');I.line(3,10,5,12,'#bfe0ff');I.set(3,12,'#bfe0ff');},slotA:I=>{I.rect(4,3,8,10,'#bfe0ff');I.rect(2,3,3,4,'#bfe0ff');I.rect(11,3,3,4,'#bfe0ff');},
 slotH:I=>{I.rect(4,4,8,7,'#bfe0ff');I.rect(3,8,10,2,'#bfe0ff');},slotG:I=>{I.rect(4,5,7,8,'#bfe0ff');I.rect(11,7,2,3,'#bfe0ff');},slotB:I=>{I.rect(5,3,4,9,'#bfe0ff');I.rect(5,10,8,3,'#bfe0ff');},slotX:I=>{I.rect(6,3,4,4,'#bfe0ff');I.rect(7,7,2,6,'#bfe0ff');}};

function iconRGBA(k){const I=Img();
 if(SLOT[k]){SLOT[k](I);for(let i=3;i<I.d.length;i+=4)if(I.d[i])I.d[i]=64;return finish(I,true);}
 if(DRAW[k])DRAW[k](I);else if(k==='bow'||k==='sbow')bow(I,k);else if(k==='staff'||k==='sstaff')staff(I,k);else if(k==='hammer'||k==='shammer')hammer(I,k);
 else if(k==='larmor'||k==='parmor'||k==='marmor'||k==='warmor'||k==='ocarmor'||k==='emarmor'||k==='mgarmor'||ARMC[k])armor(I,k);else sword(I,k);
 return finish(I,false);}
function iconCanvas(k){const c=document.createElement('canvas');c.width=c.height=16;c.getContext('2d').putImageData(new ImageData(iconRGBA(k),16,16),0,0);return c;}
const KEYS=['rusty','isword','ssword','gsword','bow','sbow','staff','sstaff','hammer','shammer','larmor','parmor','warmor','jaffa','arrows','bread','wood','ore','leather','blue','mstone','book','hpot','mpot','lhelm','ihelm','lgloves','igloves','lboots','iboots','cring','mring','spear','dagger','mith','msword','marmor','mhelm','tHood','tGloves','tBoots','tRobe','dscale','ruby','topaz','emer','sapph','diam','fish','sfish','gfish','herb','bherb','cfish','stew','feast','slotW','slotA','slotH','slotG','slotB','slotX','coin','estone','respec','failure','ideal','gale','iyarugt','dains','tbow','wisdom','elfin','vring','doran','absurd','bboots','ochelm','lantd','alexb','alexg','kcloth','gisp','povt','wtneck','bcoco','wtleaf','mnring','candy','sgl','rsdraw','xpot','hairpin','dskewer','choco','blocks','tstone','ocarmor','ocgloves','ocboots','ocring','emarmor','emhelm','emgloves','emboots','mgsword','mgarmor','mghelm','mggloves','mgboots','brphx','brdrg','brtig','brtor','rpbow','rparmor','rphelm','rpboots','tgarmor','tghelm','tggloves','tgboots','dgspear','dggaunt','dgarmor','dghelm','ttthorn','ttshell','tthelm','ttboots','bljewel','blhorn','blstaff','gdneck','gdbrace','ezneck','ezbrace','bjneck','bjbrace','slotN','slotR','fess','iess','sess','bvial','wegg','flneck','frbrace','stbrace','wheat','straw','melon','pumpk','fcab','compost','ppie','sjam','kink','kpearl','kneck','dpgs'];
A.icons={KEYS,iconRGBA,iconCanvas};
})(typeof window!=='undefined'?window:globalThis);
