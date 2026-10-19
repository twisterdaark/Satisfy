// Buildings, roofs and props v2 (SAT-ART-001). Same inputs as index.html: drawBuilding(b) with
// b = {x, y, w, h, k} in tiles, and the world/room prop lists. Footprints, doors and windows stay where
// they are today, so collision, door triggers and room entry do not change.
// Walls and roofs are computed as RGBA (testable in Node) and composited with drawImage, so the
// translucent shadow and anything already on og stay intact. Props are rect lists drawn with fillRect.
(function(root){'use strict';const A=root.SatArt=root.SatArt||{};
const hex=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
const shade=(c,f)=>c.map(v=>Math.max(0,Math.min(255,Math.round(f>0?v+(255-v)*f:v*(1+f)))));
function hash(x,y,s){let h=(x|0)*374761393+(y|0)*668265263+(s|0)*1442695041;h=Math.imul(h^h>>>13,1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>(v+.5)/16);
const pick=(ramp,t,x,y)=>ramp[Math.max(0,Math.min(ramp.length-1,Math.round(t+BAYER[(y&3)*4+(x&3)]-.5)))];

// PER_CODE: roof colors per kind from drawBuilding ([body, dark, light]); house is the fallback
const ROOF={forge:['#4a4f5c','#3a3e4a','#5c6272'],hall:['#3a4a6a','#2a3850','#52648a'],lodge:['#3f6a3a','#2c4e28','#5a8a52'],tower:['#5a3a7a','#3e2658','#7a58a0'],
 shop:['#b8862a','#8a6418','#d8a848'],armory:['#5a6474','#3e4654','#7a8698'],inn:['#a85a2a','#7e3e18','#c8784a'],house:['#a8443a','#8c3530','#c05a48'],
 palace:['#c8a040','#9a7a28','#e8c868'],temple:['#e4e0d6','#b4b0a6','#fbf8f0']};   // Titan (major #2): the Celestial Palace and Rebecca's great temple
const rampOf=k=>{const [b,d,l]=(ROOF[k]||ROOF.house).map(hex);return [shade(d,-.35),d,b,l,shade(l,.25)];};
const STONE=['#46423e','#5d5853','#75706a','#8c8781','#a39e97','#bcb7b0'].map(hex),WOOD=['#4a2e18','#5e3e26','#7a5230','#946640','#ad7c50','#c4925e'].map(hex);
const PLANK=['#8a6a3f','#a07e50','#b8925e','#c9a46b','#d8b680','#e6c896'].map(hex),PLASTER=['#b8a888','#cdbd9a','#ddd0b0','#e9dfc4','#f4ecd8'].map(hex);
const SHUTTER={house:'#4a7a48',shop:'#8a6418',inn:'#8a3a2a',hall:'#3a4a6a',lodge:'#4a6a3a',tower:'#5a3a7a',armory:'#4a5464',palace:'#7a1a1e',temple:'#c8a040'};
const WALLK={house:'plank',shop:'timber',inn:'timber',hall:'timber',lodge:'log',tower:'stone',armory:'stone',forge:'stone',palace:'stone',temple:'stone'};

function Img(w,h){const d=new Uint8ClampedArray(w*h*4);return {w,h,d,set(x,y,c,a){x|=0;y|=0;if(x<0||y<0||x>=w||y>=h)return;const i=(y*w+x)*4;d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=a===undefined?255:a;},
 rect(x,y,rw,rh,c){for(let j=y;j<y+rh;j++)for(let i=x;i<x+rw;i++)this.set(i,j,c);}};}

// ---- wall (ground layer): x px..px+w, y wy..py+h, wy = py+30 like today ----
function wallRGBA(b){const w=b.w*16,h=b.h*16-30,k=b.k,forge=k==='forge',I=Img(w,h),style=WALLK[k]||'plank',X=b.x*16,Y=b.y*16;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let c;
  if(style==='plank'){const row=y>>2,t=2.2+hash(X+((x+row*5)/14|0),Y+row,3)*1.4;c=(y&3)===0?PLANK[0]:pick(PLANK,t+((y&3)===1?.6:0),X+x,Y+y);if((x+row*5)%14===0&&(y&3))c=PLANK[1];}
  else if(style==='timber')c=pick(PLASTER,2.2+hash(X+x,Y+y,5)*.8,X+x,Y+y);
  else if(style==='log'){const row=Math.floor(y/5),j=y%5;c=pick(WOOD,[1.2,3.4,3,2.4,1.6][j]+hash(X+x,Y+row,7)*.6,X+x,Y+y);if(j===0)c=WOOD[0];}
  else{const row=y>>2,off=row%2?0:5,bi=Math.floor((x+off)/10),t=(forge?1.6:2.1)+hash(X+bi,Y+row,9)*1.8;c=pick(STONE,t+((y&3)===1?.7:0),X+x,Y+y);if((y&3)===0||(x+off)%10===0)c=STONE[0];}
  I.set(x,y,c);}
 // stone foundation, posts and beams
 for(let y=h-5;y<h;y++)for(let x=0;x<w;x++){const off=y-(h-5)<2?0:4;I.set(x,y,(y===h-5||(x+off)%8===0)?STONE[0]:pick(STONE,2+hash(X+((x+off)/8|0),Y+(y>h-3),11)*1.5,X+x,Y+y));}
 if(!forge){const post=(x0,wd)=>{for(let y=0;y<h-5;y++)for(let x=x0;x<x0+wd;x++)I.set(x,y,x===x0?WOOD[3]:x===x0+wd-1?WOOD[0]:WOOD[1]);};
  post(0,3);post(w-3,3);if(style!=='log')post((w>>1)-1,2);for(let x=0;x<w;x++){I.set(x,0,WOOD[2]);I.set(x,1,WOOD[0]);}
  if(style==='timber')for(let x=0;x<w;x++){I.set(x,21,WOOD[2]);I.set(x,22,WOOD[0]);}}
 if(forge){// furnace mouth with a hot core, door on the right, anvil plaque
  for(let y=10;y<31;y++)for(let x=8;x<34;x++){const edge=y<12||x<10||x>31;if(edge){I.set(x,y,STONE[y===10?5:1]);continue;}
   const cx=(x-21)/11,cy=(y-24)/10,r=Math.sqrt(cx*cx+cy*cy),hot=Math.max(0,1-r);I.set(x,y,hot>.75?hex('#ffe08a'):hot>.5?hex('#ffb040'):hot>.3?hex('#d8601c'):hot>.12?hex('#7a2a10'):hex('#2a1510'));}
  const dx=w-26;for(let y=16;y<h-5;y++)for(let x=dx;x<dx+12;x++)I.set(x,y,x===dx||x===dx+11||y===16?WOOD[0]:((x-dx)%4===0?WOOD[1]:WOOD[2]));
  I.rect(dx+1,22,10,1,STONE[1]);I.rect(dx+1,h-12,10,1,STONE[1]);I.rect(dx+8,28,2,2,hex('#d8b050'));
  const sx=(w>>1)-6;I.rect(sx,2,12,9,WOOD[1]);I.rect(sx+1,3,10,7,hex('#c8a050'));I.rect(sx+3,4,6,2,hex('#3a3a40'));I.rect(sx+2,4,2,1,hex('#3a3a40'));I.rect(sx+5,6,2,3,WOOD[2]);}
 else{// windows with shutters and sills, flower boxes on houses
  for(const wx of [8,w-20]){I.rect(wx-1,6,13,12,WOOD[0]);for(let y=7;y<17;y++)for(let x=wx;x<wx+11;x++){const t=(y-7)/9;I.set(x,y,shade(hex('#a8d0f4'),-t*.45));}
   I.rect(wx+5,7,1,10,WOOD[1]);I.rect(wx,11,11,1,WOOD[1]);I.set(wx+1,8,[255,255,255]);I.set(wx+2,8,[230,244,255]);I.set(wx+1,9,[230,244,255]);I.set(wx+7,12,[230,244,255]);
   const sh=hex(SHUTTER[k]||SHUTTER.house);I.rect(wx-4,6,3,12,sh);I.rect(wx+12,6,3,12,sh);I.rect(wx-4,6,1,12,shade(sh,.25));I.rect(wx+14,6,1,12,shade(sh,-.3));I.rect(wx-3,9,1,1,shade(sh,-.3));I.rect(wx+13,13,1,1,shade(sh,-.3));
   I.rect(wx-2,17,15,2,WOOD[3]);I.rect(wx-2,18,15,1,WOOD[1]);
   if(k==='house'){I.rect(wx,19,11,3,WOOD[2]);I.rect(wx,21,11,1,WOOD[0]);const fl=['#f28bb0','#f2e36b','#ffffff','#9ec8ff'];for(let i=0;i<5;i++){const fx=wx+1+i*2,c=hex(fl[(b.x+b.y+i)%4]);I.set(fx,18,hex('#3f7a36'));I.set(fx,17,c);}}}
  // door: frame, planks, bands, knob
  const dx=(w>>1)-6,dy=h-16;I.rect(dx-2,dy-2,16,18,WOOD[0]);I.rect(dx-1,dy-1,14,1,WOOD[3]);
  for(let y=dy;y<h;y++)for(let x=dx;x<dx+12;x++)I.set(x,y,(x-dx)%4===0?WOOD[1]:pick(WOOD,2.8+hash(b.x*16+((x-dx)>>2),b.y,13)*.8,x,y));
  I.rect(dx,dy+3,12,1,STONE[1]);I.rect(dx,dy+11,12,1,STONE[1]);I.rect(dx+9,dy+7,2,2,hex('#e0c060'));I.set(dx+9,dy+7,hex('#fff0a0'));
  if(k!=='house'){const sx=(w>>1)-6,sy=3;I.rect(sx-1,sy-1,14,12,WOOD[0]);I.rect(sx,sy,12,10,WOOD[2]);I.rect(sx,sy,12,1,WOOD[4]);signIcon(I,k,sx,sy);}}
 return {x:X,y:Y+30,w,h,d:I.d};}

// sign icons, same shapes as today with one shadow pixel row
function signIcon(I,k,sx,sy){const e=hex('#f2e6c8'),R_=(x,y,w,h,c)=>I.rect(sx+x,sy+y,w,h,c||e);
 if(k==='hall'){R_(5,1,2,7);R_(3,6,6,1);}
 else if(k==='lodge'){for(let i=0;i<8;i++)R_(3+Math.round(Math.sin(i/7*Math.PI)*3),1+i,1,1);R_(3,1,1,8);}
 else if(k==='tower'){R_(5,1,2,8);R_(2,4,8,2);R_(4,3,4,4,hex('#bfe8ff'));}
 else if(k==='armory'){R_(3,1,1,7);R_(2,6,3,1);R_(6,2,4,5,hex('#c8ccd6'));R_(7,7,2,1,hex('#c8ccd6'));}
 else if(k==='palace'){R_(2,4,8,4,hex('#f2c14e'));R_(2,2,2,2,hex('#f2c14e'));R_(5,1,2,3,hex('#f2c14e'));R_(8,2,2,2,hex('#f2c14e'));R_(5,5,2,2,hex('#d83a3a'));}
 else if(k==='temple'){R_(5,1,2,8,hex('#fff3b0'));R_(2,3,8,2,hex('#fff3b0'));R_(4,6,4,1);}
 else if(k==='inn'){R_(3,3,5,6,hex('#e8c070'));R_(3,2,5,2,hex('#ffffff'));R_(8,4,2,3,hex('#e8c070'));}
 else {R_(4,3,4,4,hex('#f2c14e'));R_(3,4,6,2,hex('#f2c14e'));R_(5,4,2,2,hex('#fff3b0'));}}

// ---- roof (over layer): x px-4..px+w+4, y py-16..py+34 ----
// chimney stack: staggered brick courses with mortar lines, lit from the left, darker on the right edge
const BRICK=['#4e2a22','#6a3a2e','#8a4a3a','#a85a46','#c06a52','#d88a6e'].map(hex);
function chimney(I,x0,y0,w,h,P,sx,sy){const bw=w>8?6:4;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const row=y>>2,off=row%2?bw>>1:0,mortar=(y&3)===3||(x+off)%bw===bw-1;
  let c=mortar?P[1]:P[(hash(sx+((x+off)/bw|0),sy+row,23)>.5?3:2)];if(x===0&&!mortar)c=P[4];if(x>=w-2)c=mortar?P[0]:P[1];I.set(x0+x,y0+y,c);}}
function roofRGBA(b){const w=b.w*16,W=w+8,top=12,H=top+38,k=b.k,R=rampOf(k),I=Img(W,H),X=b.x*16,Y=b.y*16,forge=k==='forge';
 for(let i=0;i<9;i++){const inset=Math.max(0,8-i*2),y0=top+i*4,off=i%2?3:0;
  for(let j=0;j<4;j++)for(let x=inset;x<W-inset;x++){const y=y0+j,col=Math.floor((x+off)/6),light=(1-x/W)*.9-.2;let c;
   if(j===3)c=R[0];else if((x+off)%6===0)c=R[1];else c=pick(R,1.8+hash(X+col,Y+i,17)*1.1+light+(j===0?.8:0),X+x,Y+y);
   if(x===inset||x===W-inset-1)c=R[0];if(i===0&&j===0)c=R[4];I.set(x,y,c);}}
 I.rect(0,top+36,W,2,hex('#2a1d18'));I.rect(0,top+35,W,1,R[0]);
 if(forge){const cx=W-26;chimney(I,cx,top-14,12,22,STONE,X+cx,Y);
  I.rect(cx-2,top-16,16,4,STONE[4]);I.rect(cx-2,top-16,16,1,STONE[5]);I.rect(cx,top-12,12,1,STONE[0]);I.rect(cx+2,top-15,8,2,hex('#1a1414'));}
 else if(k==='house'||k==='inn'){const cx=Math.round(W*.68);chimney(I,cx,top-6,6,16,BRICK,X+cx,Y);
  I.rect(cx-1,top-8,8,2,STONE[3]);I.rect(cx-1,top-8,8,1,STONE[5]);I.rect(cx+1,top-7,4,1,hex('#1a1414'));}
 return {x:X-4,y:Y-4-top,w:W,h:H,d:I.d};}

// ---- props: rect lists [x, y, w, h, color, layer] relative to the prop tile; layer 0 = gg, 1 = og ----
const PROP={
 bed:(w)=>[[1,1,w-2,15,'#5e3e26'],[1,1,w-2,1,'#7a5230'],[2,2,w-4,13,'#e8e0d0'],[2,2,10,6,'#ffffff'],[3,3,8,1,'#f2ecdf'],[2,7,10,1,'#c8c0b0'],[12,4,w-14,11,'#4a6aa8'],[12,4,w-14,2,'#6a8ac8'],[12,9,w-14,1,'#3a5490'],[14,6,1,8,'#5a7ab8'],[w-4,6,1,8,'#5a7ab8'],[1,15,w-2,1,'#3e2616']],
 table:(w)=>[[2,12,w-4,4,'rgba(0,0,0,.25)',0],[3,8,2,7,'#4e3018',0],[w-5,8,2,7,'#4e3018',0],[1,2,w-2,7,'#8a5a34',1],[1,2,w-2,2,'#a87a4a',1],[1,8,w-2,1,'#5e3e26',1],[4,4,6,1,'#7a4e2c',1],[6,-1,4,3,'#d8d0c0',1],[7,-1,2,1,'#ffffff',1],[w-10,0,3,2,'#c8a050',1],[w-10,0,3,1,'#e8c070',1]],
 chest:()=>[[1,12,14,4,'rgba(0,0,0,.25)'],[2,5,12,10,'#7a4e2c'],[2,5,12,3,'#9a6a3a'],[2,5,12,1,'#b8864e'],[2,8,12,1,'#3e2616'],[2,5,1,10,'#5a6474'],[13,5,1,10,'#5a6474'],[7,8,2,3,'#e0c060'],[7,8,1,1,'#fff0a0'],[2,14,12,1,'#4e3018']],
 shelf:(w,p)=>{const o=[[0,1,w,15,'#5e3e26'],[0,1,w,1,'#7a5230']];for(let s=0;s<3;s++){o.push([1,5+s*4,w-2,1,'#3e2616']);for(let b=2;b<w-2;b+=3){const c=['#a03a34','#3a6aa8','#4a8a4a','#c8a050','#7a4aa0'][(b+s+p.tx)%5],t=(b+s)%3===0?1:0;o.push([b,2+s*4+t,2,3-t,c],[b,2+s*4+t,1,3-t,'rgba(255,255,255,.18)']);}}return o;},
 counter:(w)=>{const o=[[0,12,w,4,'rgba(0,0,0,.25)',0],[0,-2,w,14,'#7a5634',1],[0,-2,w,3,'#a07a4a',1],[0,-2,w,1,'#c09a6a',1],[0,11,w,1,'#4e3018',1]];for(let x=4;x<w-2;x+=8)o.push([x,3,1,7,'#5e3e26',1]);for(let b=6;b<w-4;b+=14)o.push([b,-5,4,3,'#c8c8d0',1],[b,-5,4,1,'#ffffff',1],[b+5,-4,3,2,'#e8c070',1]);return o;},
 rack:()=>[[1,13,14,3,'rgba(0,0,0,.25)',0],[2,-6,12,2,'#5e3e28',1],[2,6,12,2,'#5e3e28',1],[2,-6,12,1,'#7a5634',1],[4,-8,1,14,'#d4d8e0',1],[7,-8,1,14,'#c8ccd6',1],[10,-7,1,13,'#9aa0aa',1],[4,-8,1,2,'#ffffff',1],[7,-8,1,2,'#ffffff',1],[3,2,10,1,'#5e3e28',1],[4,4,1,2,'#7a5634',1],[7,4,1,2,'#7a5634',1]],
 barrel:()=>[[2,12,12,4,'rgba(0,0,0,.25)',0],[3,1,10,13,'#8a5a34',1],[4,1,8,13,'#9a6a3a',1],[6,1,1,13,'#7a4e2c',1],[9,1,1,13,'#7a4e2c',1],[3,3,10,1,'#4a4642',1],[3,10,10,1,'#4a4642',1],[4,1,8,2,'#b8864e',1],[4,1,3,1,'#d0a070',1]]};
const WORLD={
 anvil:()=>[[1,12,14,3,'rgba(0,0,0,.3)',0],[5,8,6,6,'#2e2e35',0],[2,12,12,3,'#26262c',0],[2,12,12,1,'#3a3a44',0],[0,3,16,5,'#3c3c44',0],[-2,3,4,3,'#3c3c44',0],[0,3,16,1,'#8a8a98',0],[-2,3,3,1,'#6a6a78',0],[0,7,16,1,'#26262c',0],[2,0,4,3,'#7a5634',0],[3,-2,6,3,'#8a8f99',0],[3,-2,6,1,'#c8ccd6',0]],
 well:()=>[[0,13,16,3,'rgba(0,0,0,.3)',0],[1,4,14,11,'#7d7d84',0],[1,4,14,2,'#a39e97',0],[1,8,14,1,'#5d5853',0],[1,12,14,1,'#5d5853',0],[5,9,1,3,'#5d5853',0],[10,5,1,3,'#5d5853',0],[3,6,10,6,'#18304e',0],[4,7,5,1,'#4a78b0',0],[9,9,2,1,'#3a68a0',0],
  [0,-8,2,12,'#6b4428',1],[14,-8,2,12,'#6b4428',1],[0,-8,1,12,'#8a5c36',1],[-1,-11,18,4,'#8c3530',1],[-1,-11,18,1,'#c05a48',1],[-1,-8,18,1,'#5e2420',1],[3,-10,1,2,'#a8443a',1],[9,-10,1,2,'#a8443a',1],[7,-7,1,7,'#c8b088',1],[6,-1,3,3,'#7a5634',1]],
 board:()=>[[2,13,12,3,'rgba(0,0,0,.3)',0],[2,6,2,10,'#5e3e28',0],[12,6,2,10,'#5e3e28',0],[0,-4,16,12,'#7a5634',1],[0,-4,16,1,'#a07a4a',1],[0,7,16,1,'#4e3018',1],[2,-2,5,6,'#f2e6c8',1],[9,-2,5,4,'#f2e6c8',1],[9,3,4,3,'#e8d8b0',1],[3,0,3,1,'#8a7a5a',1],[3,2,2,1,'#8a7a5a',1],[10,0,3,1,'#8a7a5a',1],[10,4,2,1,'#a89a7a',1],[4,-3,1,1,'#c0392b',1],[11,-3,1,1,'#c0392b',1],[10,2,1,1,'#3a6aa8',1]],
 // the canvas sits on the ground: its bottom row is y=13, right on top of the shadow (it used to end at y=9 and float)
 tent:()=>{const o=[[-1,12,34,4,'rgba(0,0,0,.3)',0]];for(let i=0;i<16;i++){const x=16-i-1,w=i*2+2;o.push([x,-2+i,w,1,i%4===0?'#5a4028':'#7a5a36',1],[x,-2+i,Math.max(1,i>>1),1,'#9a7a4e',1],[x+w-1,-2+i,1,1,'#4a3020',1]);}
  o.push([0,13,32,1,'#3e2a18',1],[13,7,6,7,'#2a1a10',1],[14,8,4,6,'#1a100a',1],[15,-4,2,4,'#5e3e28',1],[17,-4,4,2,'#a8322a',1],[17,-4,4,1,'#d04a3a',1]);return o;},
 grave:()=>[[1,12,14,4,'rgba(0,0,0,.25)',0],[2,11,12,3,'#6a5a3a',0],[3,-4,10,16,'#8a8f99',1],[4,-6,8,2,'#8a8f99',1],[3,-4,10,1,'#b8bec9',1],[4,-6,8,1,'#c8ccd6',1],[12,-4,1,16,'#6a6e78',1],[7,-2,2,7,'#5a5e68',1],[5,0,6,2,'#5a5e68',1],[3,8,3,4,'#5a7a48',1],[3,8,2,1,'#7a9a5a',1],[1,13,3,2,'#f28bb0',0],[12,13,3,2,'#f2e36b',0],[2,13,1,1,'#ffffff',0]]};

// ---- canvas glue (browser only) ----
function blit(ctx,img){const c=document.createElement('canvas');c.width=img.w;c.height=img.h;c.getContext('2d').putImageData(new ImageData(img.d,img.w,img.h),0,0);ctx.drawImage(c,img.x,img.y);}
function rects(env,px,py,list,defLayer){for(const [x,y,w,h,c,l] of list){const g=(l===undefined?defLayer:l)?env.og:env.gg;g.fillStyle=c;g.fillRect(px+x,py+y,w,h);}}
function drawBuilding(env,b){const px=b.x*16,py=b.y*16,w=b.w*16,h=b.h*16;env.gg.fillStyle='rgba(0,0,0,.25)';env.gg.fillRect(px-1,py+h-2,w+2,4);blit(env.gg,wallRGBA(b));blit(env.og,roofRGBA(b));}
function drawWorld(env,{ANVILS=[],WELLS=[],BOARD,TENTS=[],GRAVE,PROPS=[]}){
 ANVILS.forEach(a=>rects(env,a.tx*16,a.ty*16,WORLD.anvil(),0));WELLS.forEach(a=>rects(env,a.tx*16,a.ty*16,WORLD.well(),0));
 if(BOARD)rects(env,BOARD.tx*16,BOARD.ty*16,WORLD.board(),0);TENTS.forEach(([x,y])=>rects(env,x*16,y*16,WORLD.tent(),0));if(GRAVE)rects(env,GRAVE.tx*16,GRAVE.ty*16,WORLD.grave(),0);
 PROPS.forEach(p=>{const f=PROP[p.k];if(f)rects(env,p.tx*16,p.ty*16,f(p.w*16,p),0);});}

A.buildings={ROOF,WALLK,wallRGBA,roofRGBA,PROP,WORLD,drawBuilding,drawWorld};
})(typeof window!=='undefined'?window:globalThis);
