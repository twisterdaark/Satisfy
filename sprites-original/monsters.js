// Satisfy monster renderer v2 (SAT-ART-001, Claude-B). Side-view sheets facing right (the engine
// mirrors with m.face, as drawMon does today). Rows: one per pose; anchor = bottom-centre (feet).
// Humanoid monsters (goblin, gchief, merman, outlaw, praga, forc, fochief) use chars.js sheets.
(function(root){'use strict';
const A=root.SatArt=root.SatArt||{};
const canvas=(w,h)=>{const c=(root.document?root.document.createElement('canvas'):A.makeCanvas(w,h));c.width=w;c.height=h;return c;};
const R=(g,x,y,w,h,c)=>{if(!c||w<=0||h<=0)return;g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const hx=c=>{c=c.replace('#','');const n=parseInt(c,16);return [n>>16&255,n>>8&255,n&255];};
const toHex=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const mixC=(a,b,k)=>{const A_=hx(a),B=hx(b);return toHex(A_.map((v,i)=>v+(B[i]-v)*k));};
const shade=(c,k)=>k>0?mixC(c,'#fff4dc',k):mixC(c,'#140c1c',-k);
// filled pixel ellipse
function ell(g,cx,cy,rx,ry,c){g.fillStyle=c;for(let y=-ry;y<=ry;y++){const w=Math.round(rx*Math.sqrt(Math.max(0,1-(y*y)/(ry*ry||1))));g.fillRect(Math.round(cx-w),Math.round(cy+y),w*2+1,1);}}
// outline + top rim light for any size
function polish(g,W,H,out){const id=g.getImageData(0,0,W,H),d=id.data,OUT=out||'#120f18';const at=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&d[(y*W+x)*4+3]>0;const get=(x,y)=>{const i=(y*W+x)*4;return toHex([d[i],d[i+1],d[i+2]]);};
 const rim=[],o=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(at(x,y)){if(!at(x,y-1))rim.push([x,y,get(x,y)]);continue;}
  const b=at(x,y+1),a=at(x,y-1),s=at(x-1,y)||at(x+1,y);if(!(a||b||s))continue;let col=OUT;if(b&&!a)col=mixC(shade(get(x,y+1),-.62),OUT,.35);o.push([x,y,col]);}
 rim.forEach(([x,y,c])=>R(g,x,y,1,1,shade(c,.14)));o.forEach(([x,y,c])=>R(g,x,y,1,1,c));}

// PER_CODE snapshot of index.html PAL @ ce29772 (body, dark, light, scale). A test checks drift.
const PAL={gbear:['#7a5030','#553620','#9a7050',1.5],wolf:['#7a7a86','#55555f','#a8a8b4',1],bear:['#6a4a30','#4a321e','#8a6a48',1.5],pwolf:['#a08a5a','#7a6640','#c8b07a',1],boar:['#5a4030','#3e2c20','#7a5a40',1.15],hwolf:['#6e6258','#4e443c','#968878',1.05],rboar:['#7a3a2a','#55261a','#a05a40',1.3],cwolf:['#c8d4e0','#8a9cb0','#eef4fa',1.1],cbear:['#d8dce4','#9aa2b0','#f4f6fa',1.6],cboar:['#4a5a3a','#323e26','#6e7e52',1.35],fboar:['#8a6a5a','#5e4a3e','#b08a78',1.2],sanju1:['#8a8a90','#5e5e66','#b4b4bc',2.4],sanju2:['#7a7a82','#52525a','#a4a4ae',2.5],sanju3:['#6a6a74','#46464e','#94949e',2.6],sanju4:['#5a5660','#3a363e','#86828e',2.8],gargoyle:['#7a7a82','#55555e','#a2a2ac',1.25],salamander:['#c8603a','#8a3a22','#e89a6a',1.3],hydra:['#3e6a4a','#264a32','#6a9a6a',1.5],ogolem:['#3e3638','#221c1e','#5e5254',1.35],aweapon:['#8a7a4e','#5a4e2e','#c8b47a',2.7],sellobu:['#3a2e4a','#241a32','#6a5a8a',1.1],foxmouse:['#d8843a','#a85a22','#f4d0a0',.6],hrabbit:['#8a7a6a','#5e5040','#b4a490',1.15,'horn'],grabbit:['#e8c040','#b08a20','#fff0a0',1,'gold'],slime:['#5ac84a','#3a8a2e','#a8f08a',1.25],mslime:['#6ad85a','#3e9a32','#b8f8a0',.75],cbat:['#4a3a5a','#2a1e36','#7a6a8a',1.1],sscorp:['#c89a5a','#8a6a36','#ecc890',1.3],mimic:['#8a5a2e','#5a3a1a','#b07a44',1.2],felem:['#e8581e','#9a200c','#ffc04a',1],ielem:['#7ac8f0','#2a6aa8','#d8f4ff',1],selem:['#5a6a8a','#2a3450','#a8b8d8',1],slord:['#4a5878','#1e2640','#8a9ac0',1.9],vbat:['#6a1a2a','#3a0a14','#a83a4a',1.15],kraken:['#7a3a5a','#4a1e3a','#b86a8a',1.6],ktent:['#7a3a5a','#4a1e3a','#b86a8a',1.2]};
const POSES=[['idle',2],['walk',4],['atk',2],['hurt',1]];
const TIMING={idle:[.5,.5],walk:[.1,.1,.1,.1],atk:[.12,.16],hurt:[.2]};

// legs for a quadruped: diagonal pairs swing together. step: -1..1 per leg.
function legSteps(pose,f){if(pose==='walk'){const s=[[1,-1,-1,1],[0,0,0,0],[-1,1,1,-1],[0,0,0,0]][f];return s;}if(pose==='atk')return f===0?[-1,-1,1,1]:[1,1,-1,-1];return [0,0,0,0];}

// Canine (wolf, prairie wolf). 32x22 frame, anchor (16,22).
function wolf(g,p,pose,f){const [B,D,L]=p,W=36,H=22,AX=15,steps=legSteps(pose,f);let bob=pose==='walk'&&(f===1||f===3)?-1:0,lean=pose==='atk'?(f===0?-2:3):pose==='hurt'?-2:0,headY=pose==='atk'&&f===1?1:0;
 const by=11+bob,bx=14+lean;
 // tail
 const tw=pose==='idle'?f:pose==='walk'?(f%2):0;R(g,bx-12,by-3-tw,5,2,D);R(g,bx-14,by-4-tw,3,2,B);R(g,bx-15,by-5-tw,2,1,L);
 // back legs (far side darker)
 const leg=(x,s,col)=>{R(g,x+s,by+3,2,H-by-5,col);R(g,x+s-1+(s>0?1:0),H-2,3,1,shade(col,-.2));};
 leg(bx-7,steps[1],shade(D,-.15));leg(bx+5,steps[3],shade(D,-.15));
 // body
 ell(g,bx,by,10,4,D);ell(g,bx,by-1,9,4,B);R(g,bx-7,by+2,14,1,L);R(g,bx-6,by-4,8,1,shade(B,.15));
 // mane ridge
 R(g,bx+2,by-5,6,2,D);
 leg(bx-5,steps[0],D);leg(bx+7,steps[2],D);
 // head
 const hx_=bx+10,hy=by-5+headY;ell(g,hx_,hy,4,3,B);R(g,hx_+3,hy,4,2,B);R(g,hx_+4,hy+2,3,1,L);R(g,hx_+7,hy,1,1,'#1a1420');
 R(g,hx_-2,hy-5,2,3,D);R(g,hx_+1,hy-5,2,3,D);R(g,hx_-1,hy-4,1,1,shade(D,-.3));
 R(g,hx_+2,hy-1,1,1,pose==='hurt'?'#ffffff':'#e2331f');
 if(pose==='atk'&&f===1){R(g,hx_+4,hy+2,3,1,'#f4f0ea');R(g,hx_+4,hy+3,3,1,'#5a1a1a');}
 return {W,H,AX};}

// Boar: bulky, low, tusks and a bristly ridge. 32x20, anchor (16,20).
function boar(g,p,pose,f){const [B,D,L]=p,W=38,H=20,AX=15,steps=legSteps(pose,f);const bob=pose==='walk'&&(f%2)?-1:0,lean=pose==='atk'?(f===0?-2:4):pose==='hurt'?-2:0;const by=10+bob,bx=14+lean;
 const leg=(x,s,col)=>{R(g,x+s,by+3,3,H-by-4,col);R(g,x+s,H-2,3,1,'#2a1c14');};
 leg(bx-7,steps[1],shade(D,-.15));leg(bx+5,steps[3],shade(D,-.15));
 ell(g,bx,by,11,5,D);ell(g,bx,by-1,10,5,B);R(g,bx-8,by+3,15,1,L);for(let i=0;i<7;i++)R(g,bx-6+i*2,by-6-(i%2),1,2,D);
 R(g,bx-12,by-2,2,1,D);R(g,bx-13,by-3,1,1,D);
 leg(bx-5,steps[0],D);leg(bx+6,steps[2],D);
 const hx_=bx+10,hy=by-1;ell(g,hx_,hy,4,4,B);R(g,hx_+3,hy,4,3,shade(B,.08));R(g,hx_+6,hy+1,2,2,'#c89a8a');R(g,hx_+6,hy+1,1,1,'#3a2020');
 R(g,hx_+4,hy+3,1,1,'#f4f0ea');R(g,hx_+5,hy+2,1,1,'#f4f0ea');R(g,hx_+2,hy-1,1,1,pose==='hurt'?'#fff':'#1a1420');R(g,hx_-2,hy-5,2,2,D);
 return {W,H,AX};}

// Bear: tall hump, heavy paws; atk rears up. 36x28, anchor (18,28).
function bear(g,p,pose,f){const [B,D,L]=p,W=42,H=28,AX=17,steps=legSteps(pose,f);const bob=pose==='walk'&&(f%2)?-1:0;
 if(pose==='atk'&&f===0){ // rear up
  const bx=16;R(g,bx-3,H-9,4,8,D);R(g,bx+3,H-9,4,8,D);ell(g,bx+2,H-15,7,9,D);ell(g,bx+2,H-16,6,9,B);ell(g,bx+3,H-14,3,6,L);
  R(g,bx+7,H-24,5,3,B);R(g,bx+9,H-22,3,5,B);R(g,bx-4,H-23,4,3,B);ell(g,bx+3,H-26,4,3,B);R(g,bx+6,H-26,3,2,B);R(g,bx+8,H-26,1,1,'#1a1420');R(g,bx+1,H-30,2,2,D);R(g,bx+5,H-30,2,2,D);R(g,bx+4,H-27,1,1,'#1a1420');return {W,H,AX};}
 const lean=pose==='atk'?4:pose==='hurt'?-2:0,by=15+bob,bx=16+lean;
 const leg=(x,s,col)=>{R(g,x+s,by+4,4,H-by-5,col);R(g,x+s-1,H-2,5,1,shade(col,-.25));};
 leg(bx-8,steps[1],shade(D,-.15));leg(bx+5,steps[3],shade(D,-.15));
 ell(g,bx,by,12,7,D);ell(g,bx,by-1,11,7,B);ell(g,bx-3,by-6,6,3,B);R(g,bx-8,by+5,16,1,L);R(g,bx-6,by-8,7,1,shade(B,.18));
 leg(bx-6,steps[0],D);leg(bx+7,steps[2],D);
 const hx_=bx+11,hy=by-3;ell(g,hx_,hy,5,4,B);R(g,hx_+4,hy,4,3,shade(B,.1));R(g,hx_+7,hy,1,1,'#1a1420');R(g,hx_+2,hy-1,1,1,pose==='hurt'?'#fff':'#1a1420');
 R(g,hx_-3,hy-5,2,2,D);R(g,hx_+1,hy-5,2,2,D);if(pose==='atk'){R(g,hx_+5,hy+3,3,1,'#f4f0ea');}
 return {W,H,AX};}

// Rabbit: hop cycle. 16x14, anchor (8,14).
function rabbit(g,p,pose,f){const [B,D,L]=p||['#c8b49a','#9a8468','#e8dcc8'],W=16,H=14;const hop=pose==='walk'?[0,2,3,1][f]:pose==='atk'?[0,3][f]:0;const y=H-1-hop,x=6;
 ell(g,x,y-4,4,3,D);ell(g,x,y-5,4,3,B);R(g,x-3,y-2,7,1,L);R(g,x-5,y-5,2,2,'#f4f0ea');
 R(g,x+3,y-8,4,3,B);R(g,x+4,y-12,1,4,B);R(g,x+6,y-12,1,4,D);R(g,x+4,y-11,1,2,'#e8a0a0');R(g,x+6,y-7,1,1,pose==='hurt'?'#fff':'#1a1420');R(g,x+7,y-6,1,1,'#e8a0a0');
 R(g,x-2,y-1,2,1,D);R(g,x+2,y-1,2,1,D);if(hop>1){R(g,x-3,y,2,1,D);}
 if(p&&p[4]==='horn'){R(g,x+7,y-10,1,2,'#efe6d0');R(g,x+8,y-12,1,2,'#efe6d0');R(g,x+8,y-13,1,1,'#ffffff');}
 if(p&&p[4]==='gold'&&(pose!=='idle'||f===0)){R(g,x-1,y-9,1,1,'#ffffff');R(g,x+9,y-4,1,1,'#fff8c0');}
 return {W,H};}
// Slime: a bouncing blob that squashes as it hops. 22x16
function slime(g,p,pose,f){const [B,D,L]=p,W=22,H=16;const sq=pose==='walk'?[0,2,3,1][f]:pose==='idle'?[0,1][f]:pose==='atk'?[1,3][f]:2;
 const st=pose==='atk'&&f===1?2:0,rx=8+(sq>1?1:0)+st,ry=6-Math.floor(sq/2)+(pose==='atk'&&f===0?1:0),cx=11+st,cy=H-1-ry;
 ell(g,cx,cy,rx,ry,D);ell(g,cx,cy-1,rx-1,ry-1,B);ell(g,cx-3,cy-ry+3,2,1,L);R(g,cx-4,cy-ry+2,1,1,'#ffffff');
 const e=pose==='hurt'?'#ffffff':'#14201a';R(g,cx+2,cy-1,1,2,e);R(g,cx+5,cy-1,1,2,e);R(g,cx-rx+1,H-1,rx*2-1,1,shade(D,-.25));
 return {W,H};}
// Cave bat: flies above its shadow, wings up and down; dives on the attack. 30x30, anchor on the shadow
function bat(g,p,pose,f){const [B,D,L]=p,W=30,H=30,AX=15;const up=pose==='walk'?f%2===0:pose==='idle'?f===0:pose==='atk'?f===0:false,dive=pose==='atk'&&f===1?7:0,bx=15+(pose==='atk'?f*3:0),by=11+dive+(pose==='hurt'?2:0);
 R(g,bx-3,H-1,7,1,'rgba(10,6,14,.35)');
 const wing=s=>{for(let i=0;i<10;i++){const x=bx+s*(3+i),h=Math.max(1,Math.round(5-i*.45)),y=Math.round(up?by-2-i*.8:by-1+i*.45);R(g,x,y,1,h,i%3===2?D:B);if(i%3===2)R(g,x,y+h,1,1,D);}};
 wing(-1);wing(1);ell(g,bx,by+1,3,4,D);ell(g,bx,by,2,3,B);R(g,bx-2,by-5,1,2,B);R(g,bx+2,by-5,1,2,B);R(g,bx-2,by-6,1,1,L);R(g,bx+2,by-6,1,1,L);
 const e=pose==='hurt'?'#ffffff':'#ff3a3a';R(g,bx-1,by-1,1,1,e);R(g,bx+1,by-1,1,1,e);R(g,bx,by+2,1,1,'#f4f0e0');
 return {W,H,AX};}
// Sand scorpion: claws forward, the tail arches over the back and strikes forward on the attack. 36x18
function scorpion(g,p,pose,f){const [B,D,L]=p,W=36,H=18,AX=15,st=legSteps(pose,f);const bob=pose==='walk'&&f%2?-1:0,lean=pose==='atk'?(f===0?-1:2):pose==='hurt'?-2:0,bx=17+lean,by=12+bob;
 const legs=(c,far)=>{for(let i=0;i<4;i++){const s2=st[i]*(far?-1:1),hx=bx-6+i*3,kx=hx+(i<2?-3:3)+s2,ky=by-2,fx=kx+(i<2?-2:2)+s2;dline(g,hx,by,kx,ky,1,c);dline(g,kx,ky,fx,H-1,1,c);}};
 legs(shade(D,-.2),1);for(let i=0;i<4;i++)ell(g,bx-3-i*3,by,3,2,i%2?D:B);ell(g,bx+3,by,4,3,B);R(g,bx+1,by-2,4,1,L);
 const sk=pose==='atk'&&f===1,T=sk?[[-13,-1],[-16,-4],[-16,-8],[-13,-11],[-8,-12],[-2,-11],[4,-8]]:[[-13,-1],[-16,-4],[-17,-8],[-15,-11],[-11,-13],[-7,-12],[-6,-9]];
 T.forEach(([x,y],i)=>ell(g,bx+x,by+y,i<3?2:1,i<3?2:1,i%2?D:B));const [sx,sy]=T[T.length-1];R(g,bx+sx+1,by+sy+1,2,1,'#e8e0c8');R(g,bx+sx+2,by+sy+2,1,1,'#e8e0c8');
 const cl=pose==='atk'&&f===0?2:0;for(const [dy,c] of [[-1,D],[2,B]]){dline(g,bx+6,by+dy,bx+10+cl,by+dy-1,1,c);ell(g,bx+12+cl,by+dy-1,2,1,c);R(g,bx+14+cl,by+dy-2,2,1,L);}
 R(g,bx+5,by-1,1,1,pose==='hurt'?'#fff':'#14101a');legs(D,0);return {W,H,AX};}
// Mimic: a treasure chest that hops, opens a mouth of teeth and bites. 20x18
function mimic(g,p,pose,f){const [B,D,L]=p,W=20,H=18,G='#e8c040',G2='#a8801a';const hop=pose==='walk'?[0,2,3,1][f]:0,open=pose==='atk'?[3,6][f]:pose==='walk'?[1,2,2,1][f]:0,y0=H-1-hop;
 R(g,2,y0-7,16,8,D);R(g,3,y0-6,14,6,B);R(g,3,y0-4,14,1,L);R(g,2,y0-7,16,1,G2);R(g,2,y0,16,1,shade(D,-.3));R(g,9,y0-7,2,8,G2);R(g,2,y0-7,1,8,G2);R(g,17,y0-7,1,8,G2);
 if(open){R(g,3,y0-7-open,14,open,'#3a0a14');for(let x=3;x<17;x+=2){R(g,x,y0-7-open,1,2,'#f4f0e0');R(g,x+1,y0-8,1,1,'#f4f0e0');}R(g,7,y0-8-Math.floor(open/2),6,2,'#d84a6a');}
 const ly=y0-11-open;R(g,2,ly,16,4,D);R(g,3,ly,14,3,B);R(g,2,ly-1,16,1,G2);R(g,3,ly-2,14,1,D);R(g,9,ly-1,2,5,G);R(g,9,ly+3,2,2,G);
 if(open){const e=pose==='hurt'?'#fff':'#ff4a2a';R(g,5,ly+1,1,1,e);R(g,14,ly+1,1,1,e);}
 return {W,H};}

// Elementals (third batch, plan U125-U127): a body of fire, ice or storm cloud floating over its shadow. 30x40, anchor on the shadow
function elemental(k){return function(g,p,pose,f){const [B,D,L]=p,W=30,H=40,AX=15;
 const bob=pose==='walk'?[0,-1,-2,-1][f]:pose==='idle'?[0,-1][f]:pose==='hurt'?1:0,lean=pose==='atk'?(f===0?-2:3):pose==='hurt'?-2:0,cx=15+lean,cy=20+bob,t=f+(pose==='walk'?0:pose==='atk'?5:pose==='hurt'?7:9),ar=pose==='atk'&&f===1?6:0;
 R(g,cx-6,H-1,13,1,'rgba(10,6,14,.35)');
 if(k==='fire'){ // tongues of flame rise off a white-hot core
  for(let i=0;i<5;i++){const x=cx-7+i*3.5,h=9+((i*5+t*3)%7),sw=Math.round(Math.sin(t*1.7+i)*2);dpoly(g,[[x-3,cy-3],[x+3,cy-3],[x+sw,cy-5-h]],i%2?D:B);if(i%2===0)dpoly(g,[[x-1,cy-4],[x+2,cy-4],[x+sw,cy-1-h]],L);}
  ell(g,cx,cy,8,10,D);ell(g,cx,cy-1,7,9,B);ell(g,cx,cy+1,5,6,L);ell(g,cx,cy+2,3,4,'#fff4c0');
  {const sw=Math.round(Math.sin(t*1.3)*2);dpoly(g,[[cx-5,cy+7],[cx+5,cy+7],[cx+sw,cy+19]],D);dpoly(g,[[cx-3,cy+7],[cx+3,cy+7],[cx+sw,cy+16]],B);}
  ell(g,cx-10,cy-1+(t%2),3,2,D);ell(g,cx-10,cy-2+(t%2),2,1,B);ell(g,cx+10+ar,cy-2-ar/3,3,2,D);ell(g,cx+10+ar,cy-3-ar/3,2,1,L);
  if(ar){ell(g,cx+15+ar,cy-4,2,2,L);R(g,cx+15+ar,cy-4,1,1,'#fff4c0');}
  const e=pose==='hurt'?'#ffffff':'#3a0a04';R(g,cx+1,cy-5,2,2,e);R(g,cx+5,cy-5,2,2,e);R(g,cx+2,cy,4,1,shade(D,-.3));}
 else if(k==='ice'){ // a crystal body with shards that circle it
  for(let i=0;i<3;i++){const a=i/3*6.28+t*.7;if(Math.sin(a)>0)continue;const x=cx+Math.round(Math.cos(a)*12),y=cy-2+Math.round(Math.sin(a)*4);dpoly(g,[[x,y-3],[x+2,y],[x,y+3],[x-2,y]],D);}
  dpoly(g,[[cx,cy-14],[cx+7,cy-6],[cx+6,cy+6],[cx,cy+12],[cx-6,cy+6],[cx-7,cy-6]],D);
  dpoly(g,[[cx,cy-12],[cx+5,cy-6],[cx+4,cy+5],[cx,cy+10],[cx-4,cy+5],[cx-5,cy-6]],B);
  dpoly(g,[[cx-1,cy-11],[cx+2,cy-6],[cx,cy+2],[cx-3,cy-5]],L);R(g,cx-2,cy-9,1,3,'#ffffff');
  {const sw=Math.round(Math.sin(t*1.3));dpoly(g,[[cx-2,cy+10],[cx+2,cy+10],[cx+sw,cy+18]],D);R(g,cx+sw,cy+15,1,2,L);}
  dpoly(g,[[cx+1,cy-23],[cx+6,cy-17],[cx+1,cy-12],[cx-4,cy-17]],D);dpoly(g,[[cx+1,cy-21],[cx+4,cy-17],[cx+1,cy-14],[cx-2,cy-17]],B);R(g,cx,cy-20,1,2,L);
  dpoly(g,[[cx-6,cy-9],[cx-13,cy-5],[cx-9,cy+1]],D);dpoly(g,[[cx-7,cy-8],[cx-11,cy-5],[cx-9,cy-1]],B);
  dpoly(g,[[cx+6,cy-9],[cx+13+ar,cy-6],[cx+9+ar,cy+1]],D);dpoly(g,[[cx+7,cy-8],[cx+11+ar,cy-6],[cx+9+ar,cy-1]],B);
  const e=pose==='hurt'?'#ffffff':'#0e2a6a';R(g,cx,cy-18,1,1,e);R(g,cx+2,cy-18,1,1,e);
  for(let i=0;i<3;i++){const a=i/3*6.28+t*.7;if(Math.sin(a)<=0)continue;const x=cx+Math.round(Math.cos(a)*12),y=cy-2+Math.round(Math.sin(a)*4);dpoly(g,[[x,y-3],[x+2,y],[x,y+3],[x-2,y]],L);}}
 else{ // a knot of thundercloud with lightning inside it
  for(const [dx,dy,rx,ry,c] of [[-6,2,6,5,D],[6,1,6,5,D],[0,-5,8,6,D],[-4,-1,5,4,B],[5,-2,5,4,B],[0,-6,6,4,B],[-2,-8,3,2,L],[4,-4,2,1,L]])ell(g,cx+dx+Math.round(Math.sin(t*1.1+dx)*.8),cy+dy,rx,ry,c);
  {const sw=Math.round(Math.sin(t*1.3)*2);dpoly(g,[[cx-6,cy+5],[cx+6,cy+5],[cx+sw,cy+19]],D);dpoly(g,[[cx-3,cy+6],[cx+3,cy+6],[cx+sw,cy+15]],B);}
  const Y='#fff27a',zz=(x,y,s,n)=>{let px=x,py=y;for(let i=0;i<n;i++){const nx=px+(i%2?s:-s),ny=py+3;dline(g,px,py,nx,ny,1,Y);px=nx;py=ny;}};
  if((t%3)!==1||pose==='atk')zz(cx-3+(t%2)*2,cy-3,2,4);
  ell(g,cx-10,cy,3,2,D);ell(g,cx+10+ar,cy-1-ar/3,3,2,D);
  if(ar){zz(cx+13+ar,cy-4,2,3);dline(g,cx+14+ar,cy+4,cx+20+ar,cy+10,1,Y);}
  const e=pose==='hurt'?'#ffffff':'#e8f6ff';R(g,cx+1,cy-5,2,1,e);R(g,cx+5,cy-5,2,1,e);}
 return {W,H,AX};};}
// The Kraken and its tentacles (third batch, patch 4, plan U137). The Kraken: a great domed head and two eyes above the
// water, four arms curling out of the sea round it. 96x70, anchor below the water line. A tentacle: one arm rising from
// the sea, 26x50. The bottom rows are the sea's foam.
function krArm(g,x0,y0,s,h,c,sk,tip,wob){let px=x0,py=y0;for(let i=0;i<=h;i++){const k=i/h,w=Math.max(1,Math.round(5*(1-k)+1)),x=x0+s*Math.round(Math.sin(k*2.6+wob)*6+k*k*tip),y=y0-i;
  R(g,x-w/2,y,w,1,c);if(i%4===2&&k<.8)R(g,x+s*(w/2-1),y,1,1,sk);px=x;py=y;}
 R(g,px+s,py-1,2,2,c);R(g,px+s*3,py,1,2,c);}
function kraken(g,p,pose,f){const [B,D,L]=p,W=96,H=70,AX=48,t=f+(pose==='walk'?0:pose==='atk'?5:pose==='hurt'?7:9);
 const up=pose==='atk'?(f===0?3:-4):pose==='hurt'?2:(pose==='idle'?[0,-1][f]:[0,-1,-2,-1][f]),wl=H-7,cx=48,raise=pose==='atk'&&f===0?10:pose==='atk'?-4:0;
 // arms behind the head
 krArm(g,cx-30,wl,-1,24+raise,D,L,8,t*.4);krArm(g,cx+30,wl,1,24+raise,D,L,8,t*.4+1);
 // the mantle and the head
 ell(g,cx,wl-24+up,21,26,D);ell(g,cx,wl-25+up,19,24,B);ell(g,cx-6,wl-36+up,7,10,shade(B,.18));R(g,cx-8,wl-46+up,3,5,L);
 for(const [dx,dy] of [[-10,-30],[8,-38],[12,-24],[-14,-18],[2,-46]])R(g,cx+dx,wl+dy+up,2,2,D);
 // the eyes: gold with a black slit
 for(const s of [-1,1]){const ex=cx+s*9,ey=wl-14+up;ell(g,ex,ey,5,4,'#1a0a14');ell(g,ex,ey,4,3,pose==='hurt'?'#ffffff':'#e8c040');R(g,ex,ey-3,1,7,'#1a0a14');R(g,ex-s*2,ey-2,1,1,'#fff8d0');}
 R(g,cx-12,wl-9+up,24,2,D);
 // arms in front, slapping the water when it attacks
 krArm(g,cx-18,wl+2,-1,14+(pose==='atk'&&f===1?-6:raise/2),B,L,10,t*.5+2);krArm(g,cx+18,wl+2,1,14+(pose==='atk'&&f===1?-6:raise/2),B,L,10,t*.5+3);
 // the sea round it
 const fo=(t%2);for(let x=-44;x<=44;x+=2){const y=wl+Math.round(Math.sin((x+t*3)*.3)*1);R(g,cx+x,y,2,1,'#e8f8ff');if((x/2+fo)%3===0)R(g,cx+x,y+1,2,1,'#9fd8f0');}
 R(g,cx-40,wl+3,80,1,'#bfe4f2');R(g,cx-30,wl+6,60,1,'#a8d8ec');
 if(pose==='atk'&&f===1)for(const x of [-24,24]){R(g,cx+x-3,wl-4,6,2,'#e8f8ff');R(g,cx+x-1,wl-7,2,3,'#cfefff');}
 return {W,H,AX};}
function ktent(g,p,pose,f){const [B,D,L]=p,W=26,H=50,AX=13,t=f+(pose==='walk'?0:pose==='atk'?5:pose==='hurt'?7:9),wl=H-3;
 const lean=pose==='atk'?(f===0?-6:8):pose==='hurt'?-3:Math.round(Math.sin(t*.8)*2),h=pose==='atk'&&f===1?30:38;
 for(let i=0;i<=h;i++){const k=i/h,w=Math.max(1,Math.round(7*(1-k)+1)),x=AX+Math.round(Math.sin(k*3+t*.5)*3*k+lean*k*k),y=wl-i;R(g,x-w/2,y,w,1,i<2?D:B);R(g,x-w/2,y,1,1,D);
  if(i%4===1&&k<.85&&w>2)R(g,x+Math.floor(w/2)-1,y,1,1,L);}
 const tx=AX+Math.round(Math.sin(3+t*.5)*3+lean),ty=wl-h;R(g,tx+1,ty-1,2,2,B);R(g,tx+3,ty,1,2,B);
 for(let x=-9;x<=9;x+=2){const y=wl+Math.round(Math.sin((x+t*3)*.5)*1);R(g,AX+x,y,2,1,'#e8f8ff');}R(g,AX-7,wl+2,14,1,'#bfe4f2');
 return {W,H,AX};}
// Stone / crystal golem. 32x36, anchor (16,36). k: 'golem' | 'cgolem'
function golem(k){return function(g,p,pose,f){const cr=k==='cgolem',mo=k==='mgolem',ob=k==='ogolem',aw=k==='aweapon',B=cr?'#7ab8d8':mo?'#5a6a4a':ob?'#3e3638':aw?'#8a7a4e':'#7a7068',D=cr?'#4a88b0':mo?'#3e4a32':ob?'#221c1e':aw?'#5a4e2e':'#544c46',L=cr?'#c8f0ff':mo?'#8a9a6a':ob?'#5e5254':aw?'#c8b47a':'#9a908a',E=cr?'#ffffff':mo?'#b8ff6a':ob?'#ff6a2a':aw?'#7af0ff':'#ffb040',W=32,H=36;
 const st=pose==='walk'?[1,0,-1,0][f]:0,bob=pose==='idle'?f:pose==='walk'&&(f%2)?-1:0,arm=pose==='atk'?(f===0?-8:4):0;const x=16,y=H;
 R(g,x-7,y-9+Math.max(0,st),5,9-Math.max(0,st),D);R(g,x+2,y-9+Math.max(0,-st),5,9-Math.max(0,-st),D);R(g,x-8,y-2,7,2,shade(D,-.2));R(g,x+1,y-2,7,2,shade(D,-.2));
 const ty=y-25+bob;R(g,x-9,ty,18,17,B);R(g,x-9,ty,18,2,L);R(g,x+7,ty,2,17,D);R(g,x-9,ty+15,18,2,D);
 // cracks / crystal shards
 if(cr){R(g,x-4,ty+4,2,5,L);R(g,x+2,ty+8,2,4,L);R(g,x-2,ty-4,2,4,L);R(g,x+3,ty-3,2,3,L);}
 // old golem: volcanic rock and black iron with glowing seams; ancient weapon: Braham's runes
 else if(ob||aw){R(g,x-3,ty+5,1,4,E);R(g,x-2,ty+8,2,1,E);R(g,x+3,ty+3,1,3,E);R(g,x+2,ty+10,1,3,E);if(aw){R(g,x-6,ty+2,12,1,E);R(g,x-1,ty+6,2,2,'#ffffff');R(g,x-5,ty-5,10,1,E);}}else{R(g,x-3,ty+5,1,4,D);R(g,x-2,ty+8,2,1,D);R(g,x+3,ty+3,3,2,'#5a8a4a');R(g,x+2,ty+10,1,3,D);}
 // arms
 R(g,x-13,ty+2+arm,4,12,B);R(g,x-13,ty+2+arm,1,12,shade(B,.12));R(g,x-14,ty+12+arm,6,4,D);R(g,x+9,ty+2+arm,4,12,B);R(g,x+8,ty+12+arm,6,4,D);
 // head
 R(g,x-5,ty-6,10,7,B);R(g,x-5,ty-6,10,1,L);R(g,x+4,ty-6,1,7,D);R(g,x-3,ty-3,2,2,pose==='hurt'?'#fff':E);R(g,x+1,ty-3,2,2,pose==='hurt'?'#fff':E);
 return {W,H};};}

// Guardian of the Forest (boss). 64x72, anchor (32,72).
function guardian(g,p,pose,f){const W=64,H=72,B='#5a3b22',Bd='#3e2814',L='#2f6b34',Ll='#4f9a50',x=32,y=H;const st=pose==='walk'?[1,0,-1,0][f]:0,bob=pose==='idle'?f:0,arm=pose==='atk'?(f===0?-12:6):0;
 R(g,x-12,y-14+Math.max(0,st),8,14,Bd);R(g,x+4,y-14+Math.max(0,-st),8,14,Bd);R(g,x-15,y-3,12,3,Bd);R(g,x+3,y-3,12,3,Bd);for(let i=0;i<3;i++){R(g,x-17+i*2,y-1,1,1,Bd);R(g,x+13+i*2,y-1,1,1,Bd);}
 const ty=y-41+bob;R(g,x-13,ty,26,28,B);R(g,x-13,ty,3,28,Bd);for(let i=0;i<4;i++)R(g,x-8+i*5,ty+2,1,24,Bd);R(g,x-11,ty+18,6,3,'#3f8a44');R(g,x+5,ty+10,5,2,'#3f8a44');R(g,x+9,ty+20,3,2,'#3f8a44');
 R(g,x-24,ty+2+arm,11,6,B);R(g,x-26,ty+6+arm,6,20,B);R(g,x-27,ty+24+arm,8,4,Bd);R(g,x+13,ty+2+arm,11,6,B);R(g,x+20,ty+6+arm,6,20,B);R(g,x+19,ty+24+arm,8,4,Bd);
 ell(g,x,ty-10,20,12,'#1c4421');ell(g,x,ty-12,18,10,L);ell(g,x-5,ty-16,10,5,Ll);ell(g,x+8,ty-8,6,3,Ll);R(g,x-10,ty-20,2,2,'#7cc672');R(g,x+6,ty-17,2,2,'#7cc672');R(g,x+12,ty-12,2,2,'#7cc672');
 const ec=pose==='hurt'?'#ffffff':'#b8ff6a';R(g,x-7,ty+7,4,3,ec);R(g,x+3,ty+7,4,3,ec);R(g,x-6,ty+7,1,1,'#ffffff');R(g,x+4,ty+7,1,1,'#ffffff');R(g,x-4,ty+15,8,2,Bd);
 return {W,H};}


// Fire Dragon Trauka (world boss, canon "Red Dragon Trauka", ch 96/156). 156x112, anchor (78,112): a red dragon with
// membrane wings, back-swept horns, a spiked tail and a pale belly; atk = head forward, jaw open, fire in the mouth.
function dpoly(g,pts,c){let y0=1e9,y1=-1e9;pts.forEach(q=>{y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);});g.fillStyle=c;
 for(let y=Math.floor(y0);y<=Math.ceil(y1);y++){const xs=[];for(let i=0;i<pts.length;i++){const [ax,ay]=pts[i],[bx,by]=pts[(i+1)%pts.length];if((ay<=y+.5&&by>y+.5)||(by<=y+.5&&ay>y+.5))xs.push(ax+(y+.5-ay)*(bx-ax)/(by-ay));}
  xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){const a=Math.round(xs[i]),b=Math.round(xs[i+1]);if(b>a)g.fillRect(a,y,b-a,1);}}}
function dline(g,x0,y0,x1,y1,w,c){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))|0;for(let i=0;i<=n;i++){const t=n?i/n:0;R(g,x0+(x1-x0)*t-w/2,y0+(y1-y0)*t-w/2,w,w,c);}}
function trauka(g,p,pose,f){const W=156,H=112,AX=78,B='#b8282a',D='#7a161a',DD='#4e0c12',L='#e04a3a',BL='#e8a050',BD='#c07a34',M1='#8a1a1e',M2='#a8303a',HN='#e8dcc0',CL='#2a1010';
 const flap=pose==='idle'?[0,4][f]:pose==='walk'?[0,3,6,3][f]:pose==='atk'?(f?-4:2):5,bob=pose==='walk'?[0,-1,0,-1][f]:0,lunge=pose==='atk'?(f?6:-3):pose==='hurt'?-4:0,st=pose==='walk'?[2,0,-2,0][f]:0;
 const by=78+bob,bx=72;
 // far wing (behind)

 const sx=bx+10,sy=by-14,wx=bx+2,wy=6+flap;
 dpoly(g,[[sx,sy],[wx,wy],[wx-50,wy+10],[wx-44,wy+22],[wx-40,wy+28],[wx-30,wy+32],[wx-24,wy+40],[wx-14,wy+44],[wx-6,sy-2]],shade(M1,-.25));for(const [tx,ty] of [[-50,10],[-40,28],[-24,40]])dline(g,wx,wy,wx+tx,wy+ty,2,DD);dline(g,sx,sy,wx,wy,3,DD);
 // tail with spikes
 const tail=[[bx-26,by+2,9],[bx-38,by+6,7],[bx-50,by+10,6],[bx-60,by+14,5],[bx-68,by+18,4]];tail.forEach(([x,y,r],i)=>{ell(g,x,y,r+2,r,D);ell(g,x,y-1,r+1,r-1,B);dpoly(g,[[x-3,y-r],[x,y-r-5+i*.5],[x+3,y-r]],D);});
 dpoly(g,[[bx-72,by+18],[bx-84,by+12],[bx-80,by+22]],D);dpoly(g,[[bx-72,by+16],[bx-78,by+14],[bx-76,by+19]],L);
 // far legs
 const leg=(x,s,c,c2)=>{ell(g,x,by+6,11,12,c);R(g,x-5+s,by+14,10,H-by-18,c);R(g,x-5+s,by+14,2,H-by-18,shade(c,-.2));R(g,x-7+s,H-5,15,5,c2);for(let k=0;k<4;k++)R(g,x-7+s+k*4,H-1,2,1,'#e8dcc0');};
 leg(bx-14,-st,shade(D,-.15),DD);leg(bx+20,st,shade(D,-.15),DD);
 // body + belly + scales
 ell(g,bx,by,34,18,D);ell(g,bx,by-1,33,16,B);ell(g,bx+2,by+9,27,7,BD);ell(g,bx+2,by+8,25,6,BL);for(let i=-3;i<=3;i++)R(g,bx+2+i*6,by+3,1,8,BD);
 for(let yy=-10;yy<=2;yy+=4)for(let xx=-22;xx<=22;xx+=6)R(g,bx+xx+(yy%8?3:0),by+yy,2,1,D);R(g,bx-18,by-13,26,2,L);
 for(let i=0;i<6;i++){const x=bx-20+i*8;dpoly(g,[[x-3,by-15],[x,by-22-(i%2)*2],[x+3,by-15]],D);}
 // near legs
 leg(bx-8,st,B,D);leg(bx+26,-st,B,D);R(g,bx-12,by+4,4,6,L);R(g,bx+22,by+4,4,6,L);
 // neck and head
 const nx=bx+26,hx=bx+48+lunge,hy=26+bob+(pose==='atk'?(f?6:2):0);
 for(let i=0;i<=5;i++){const t=i/5,x=nx+(hx-12-nx)*t,y=by-8+(hy+6-(by-8))*t;ell(g,x,y,8-i*.5,8-i*.6,D);ell(g,x,y-1,7-i*.5,7-i*.6,B);ell(g,x+2,y+3,4-i*.4,3,BL);}
 for(let i=1;i<5;i++){const t=i/5,x=nx+(hx-12-nx)*t,y=by-8+(hy+6-(by-8))*t;dpoly(g,[[x-6,y-6],[x-9,y-11],[x-3,y-7]],D);}
 ell(g,hx,hy,13,8,D);ell(g,hx,hy-1,12,7,B);R(g,hx+6,hy-4,16,7,B);R(g,hx+6,hy+2,16,2,D);R(g,hx+6,hy-5,14,1,L);R(g,hx+20,hy-4,2,2,DD);
 const open=pose==='atk'&&f===1;if(open){R(g,hx+4,hy+3,18,3,'#3a0a0a');R(g,hx+4,hy+6,16,4,B);R(g,hx+4,hy+9,16,1,D);for(let k=0;k<4;k++)R(g,hx+8+k*4,hy+3,1,2,'#ffffff');
  R(g,hx+22,hy+2,6,4,'#ffd24a');R(g,hx+26,hy+1,8,6,'#ff7a1e');R(g,hx+32,hy+2,6,4,'#ffb43a');}else{R(g,hx+4,hy+3,18,3,B);R(g,hx+4,hy+5,16,1,D);}
 dpoly(g,[[hx-6,hy-6],[hx-22,hy-16],[hx-10,hy-4]],HN);dpoly(g,[[hx-2,hy-7],[hx-14,hy-20],[hx-4,hy-5]],HN);R(g,hx-21,hy-16,2,1,shade(HN,-.3));
 R(g,hx+2,hy-4,4,3,pose==='hurt'?'#ffffff':'#ffd24a');R(g,hx+4,hy-4,1,3,'#3a0a0a');dpoly(g,[[hx-2,hy-6],[hx+8,hy-8],[hx+6,hy-5]],D);
 // near wing over the body, membrane lighter
 const nsx=bx+4,nsy=by-12,nwx=bx-4,nwy=0+flap,T=[[-64,14],[-54,34],[-38,46],[-20,52]];
 dpoly(g,[[nsx,nsy],[nwx,nwy],[nwx-64,nwy+14],[nwx-56,nwy+26],[nwx-54,nwy+34],[nwx-44,nwy+38],[nwx-38,nwy+46],[nwx-28,nwy+47],[nwx-20,nwy+52],[nwx-10,nwy+50],[nsx-8,nsy+4]],M1);
 dpoly(g,[[nwx-3,nwy+8],[nwx-52,nwy+22],[nwx-48,nwy+32],[nwx-36,nwy+40],[nwx-22,nwy+46],[nsx-10,nsy+1]],M2);
 for(const [tx,ty] of T)dline(g,nwx,nwy,nwx+tx,nwy+ty,2,D);dline(g,nsx,nsy,nwx,nwy,4,D);dline(g,nsx,nsy-1,nwx,nwy-1,1,L);R(g,nwx-2,nwy-4,3,5,HN);
 return {W,H,AX};}

// Saharan Empire monsters (major #2). Gargoyle (Suaz Mountains, canon ch 118): a winged stone demon that hovers and
// turns what its beam touches to stone. 40x40, anchor (20,40); it floats a few pixels over its shadow.
function gargoyle(g,p,pose,f){const [B,D,L]=p,W=40,H=37,AX=20,E='#ff5a3a';
 const flap=pose==='walk'?[0,1,2,1][f]:pose==='idle'?f*2:pose==='atk'?(f===0?0:2):1,bob=pose==='walk'?[0,-1,-2,-1][f]:pose==='idle'?-f:0;
 const cx=20+(pose==='atk'&&f===1?4:pose==='hurt'?-2:0),cy=22+bob,wy=[-14,-8,-1][flap];
 const wing=(o,col)=>{dpoly(g,[[cx-2+o,cy-6],[cx-17+o,cy+wy-2],[cx-15+o,cy+wy+6],[cx-10+o,cy+wy+3],[cx-7+o,cy+wy+9],[cx-3+o,cy+2]],col);dline(g,cx-2+o,cy-6,cx-17+o,cy+wy-2,1,shade(col,-.35));};
 wing(3,shade(D,-.2));wing(0,D);
 R(g,cx-5,cy+6,4,7,D);R(g,cx+2,cy+6,4,7,D);R(g,cx-6,cy+12,5,2,shade(D,-.25));R(g,cx+2,cy+12,5,2,shade(D,-.25));
 dline(g,cx-5,cy+5,cx-12,cy+10,2,D);dpoly(g,[[cx-12,cy+8],[cx-16,cy+11],[cx-11,cy+12]],D);
 ell(g,cx,cy,7,8,D);ell(g,cx,cy-1,6,7,B);R(g,cx-3,cy-4,4,6,L);
 const hx=cx+5,hy=cy-10;ell(g,hx,hy,5,4,B);R(g,hx+3,hy,4,3,B);dpoly(g,[[hx-3,hy-3],[hx-6,hy-9],[hx-1,hy-4]],L);dpoly(g,[[hx+1,hy-3],[hx+1,hy-9],[hx+3,hy-3]],L);
 R(g,hx+2,hy-1,2,1,pose==='hurt'?'#ffffff':E);R(g,hx+5,hy+2,2,1,'#1a1420');
 if(pose==='atk'&&f===0){ell(g,hx+8,hy,2,2,'#ffd27a');R(g,hx+7,hy-1,2,2,'#fff4c0');}
 R(g,cx+3,cy-2,6,2,B);R(g,cx+8,cy-1,2,4,D);R(g,cx+9,cy+2,2,1,L);
 return {W,H,AX};}

// Giant salamander (Dran Valley, canon ch 120): long and low, a flat wide head, a spotted back and a swaying tail. 50x18.
function salamander(g,p,pose,f){const [B,D,L]=p,W=50,H=18,AX=22,steps=legSteps(pose,f);
 const sway=pose==='walk'?[1,0,-1,0][f]:0,lean=pose==='atk'?(f===0?-2:5):pose==='hurt'?-2:0,by=10,bx=22+lean;
 const leg=(x,s,col)=>{R(g,x+s,by+2,3,H-by-3,col);R(g,x+s-1,H-1,5,1,shade(col,-.25));};
 leg(bx-10,steps[1],shade(D,-.15));leg(bx+6,steps[3],shade(D,-.15));
 for(let i=0;i<8;i++){const tx=bx-14-i*2.4,ty=by+Math.round(Math.sin(i*.6+sway)*1.2+i*.2),r=Math.max(1,Math.round(4-i*.45));ell(g,tx,ty,2,r,i%2?D:B);}
 ell(g,bx,by,14,5,D);ell(g,bx,by-1,13,4,B);R(g,bx-11,by+3,22,1,L);
 for(const [sx,sy] of [[-8,-2],[-2,-3],[4,-2],[9,-3],[-5,1],[2,1]])R(g,bx+sx,by+sy,2,1,shade(D,-.3));
 leg(bx-8,steps[0],D);leg(bx+8,steps[2],D);
 const hx=bx+15,hy=by-1,open=pose==='atk'&&f===1?2:0;ell(g,hx,hy,6,3,B);R(g,hx+2,hy+1+open,6,2,D);R(g,hx+3,hy-3,2,2,shade(B,.15));R(g,hx+3,hy-2,1,1,pose==='hurt'?'#fff':'#1a1420');
 if(open)R(g,hx+2,hy+1,6,1,'#7a1a1a');
 return {W,H,AX};}

// The hydra under the Abyss (canon ch 1066, 1095): a great scaled body on four clawed legs with five necks; its venom
// is feared even by gods. 112x92, anchor (56,92); atk = the heads coil back, then strike with venom.
function hydra(g,p,pose,f){const W=112,H=92,AX=56,B='#3e6a4a',D='#264a32',DD='#16301e',L='#6a9a6a',BL='#c8c08a',V='#b85ad8';
 const bob=pose==='idle'?f:pose==='walk'?[0,1,0,1][f]:0,cx=56,by=H-22+bob;
 for(let i=0;i<10;i++){const tx=cx-26-i*3,ty=by+6-Math.round(Math.sin(i*.5)*4);ell(g,tx,ty,4,Math.max(2,Math.round(6-i*.4)),i%2?D:B);}
 for(const lx of [cx-20,cx+12]){R(g,lx,by+8,10,H-by-10,DD);R(g,lx-2,H-3,14,3,D);for(let k=0;k<4;k++)R(g,lx-2+k*4,H-1,2,1,BL);}
 ell(g,cx,by,30,16,DD);ell(g,cx,by-2,28,14,D);ell(g,cx,by-4,25,11,B);ell(g,cx+4,by+6,18,5,BL);
 for(let k=0;k<7;k++)R(g,cx-18+k*6,by-13+Math.abs(k-3),3,2,L);
 const sw=pose==='walk'?[0,1,0,-1][f]:pose==='idle'?f*.6:0,str=pose==='atk'?(f===0?-6:10):pose==='hurt'?-4:0;
 [[-14,-36],[-4,-46],[8,-50],[18,-44],[26,-32]].forEach(([nx,ny],i)=>{const x0=cx+nx*.3,y0=by-10,x1=cx+nx+str*(.4+i*.15)+Math.round(Math.sin(i*1.3+sw)*2),y1=by+ny+(pose==='atk'&&f===1?6:0);
  for(let k=0;k<=10;k++){const t=k/10,x=x0+(x1-x0)*t+Math.sin(t*3.1)*4*(i%2?1:-1),y=y0+(y1-y0)*t,r=Math.round(3.4-t*.6);ell(g,x,y,r,r,k%2?D:B);}
  ell(g,x1,y1,6,4,B);R(g,x1+3,y1,6,3,B);R(g,x1+3,y1+2,6,1,D);dpoly(g,[[x1-4,y1-3],[x1-9,y1-7],[x1-2,y1-4]],L);R(g,x1+2,y1-2,2,1,pose==='hurt'?'#ffffff':'#ffe04a');
  if(pose==='atk'&&f===1){R(g,x1+3,y1+2,6,2,'#5a1a2a');R(g,x1+9,y1+2,3,1,V);R(g,x1+11,y1+3,2,1,V);}});
 return {W,H,AX};}

// Spider (the 1st island's sellobus: "a spider type monster with low defense and stamina, but high attack power and speed"). 34x18, anchor (16,18).
function spider(g,p,pose,f){const [B,D,L]=p,W=34,H=18,AX=16,st=legSteps(pose,f),E='#ff4a3a';const bob=pose==='walk'&&f%2?-1:0,lean=pose==='atk'?(f===0?-2:3):pose==='hurt'?-2:0;
 const bx=16+lean,by=9+bob;
 const legs=(c,far)=>{for(let i=0;i<4;i++){const s=st[i]*(far?-1:1),hx=bx-4+i*3,kx=hx+(i<2?-5:5)+s,ky=by-5-(i%2),fx=kx+(i<2?-3:3)+s*2;dline(g,hx,by,kx,ky,1,c);dline(g,kx,ky,fx,H-1,1,c);}};
 legs(shade(D,-.2),1);
 ell(g,bx-7,by-1,7,5,B);ell(g,bx-8,by-3,5,2,L);R(g,bx-11,by-1,2,1,D);R(g,bx-8,by-3,3,1,'#c83a3a');R(g,bx-7,by-2,1,2,'#c83a3a');
 ell(g,bx+2,by,4,3,B);R(g,bx+1,by-2,3,1,L);R(g,bx+4,by-2,1,1,E);R(g,bx+5,by-1,1,1,E);R(g,bx+3,by-1,1,1,E);
 if(pose==='atk'&&f===1){R(g,bx+6,by+1,3,1,'#e8e0d0');R(g,bx+6,by+3,3,1,'#e8e0d0');}else R(g,bx+6,by+1,1,2,'#e8e0d0');
 legs(D,0);
 return {W,H,AX};}

const KINDS={wolf:[wolf,'wolf'],pwolf:[wolf,'pwolf'],hwolf:[wolf,'hwolf'],boar:[boar,'boar'],rboar:[boar,'rboar'],mgolem:[golem('mgolem'),null],bear:[bear,'bear'],gbear:[bear,'gbear'],rabbit:[rabbit,null],golem:[golem('golem'),null],cgolem:[golem('cgolem'),null],guardian:[guardian,null],trauka:[trauka,null,[230,170]],cwolf:[wolf,'cwolf'],cbear:[bear,'cbear'],cboar:[boar,'cboar'],fboar:[boar,'fboar'],sanju1:[bear,'sanju1'],sanju2:[bear,'sanju2'],sanju3:[bear,'sanju3'],sanju4:[bear,'sanju4'],gargoyle:[gargoyle,'gargoyle'],salamander:[salamander,'salamander'],hydra:[hydra,'hydra',[150,130]],ogolem:[golem('ogolem'),'ogolem'],aweapon:[golem('aweapon'),'aweapon'],sellobu:[spider,'sellobu'],foxmouse:[wolf,'foxmouse'],hrabbit:[rabbit,'hrabbit'],grabbit:[rabbit,'grabbit'],slime:[slime,'slime'],mslime:[slime,'mslime'],cbat:[bat,'cbat'],sscorp:[scorpion,'sscorp'],mimic:[mimic,'mimic'],felem:[elemental('fire'),'felem'],ielem:[elemental('ice'),'ielem'],selem:[elemental('storm'),'selem'],slord:[elemental('storm'),'slord'],vbat:[bat,'vbat'],kraken:[kraken,'kraken',[140,112]],ktent:[ktent,'ktent']};

// Build a sheet: columns = frames of the longest pose, rows = poses. Returns {canvas, W, H, anchor}.
// Frames are drawn with a margin and cropped to the union of their pixels (+1 for the outline),
// so legs, tails, ears and attack lunges that reach past the nominal W x H are never cut off.
function buildSheet(type){const [fn,pk,cs]=KINDS[type],p=pk?PAL[pk]:null,PAD=16;let dims=null;
 const frames=[];POSES.forEach(([pose,n],ri)=>{for(let f=0;f<n;f++){const c=canvas(cs?cs[0]:104,cs?cs[1]:112),g=c.getContext('2d');g.translate(PAD,PAD);const d=fn(g,p,pose,f);dims=d;frames.push({c,ri,f});}});
 let x0=1e9,y0=1e9,x1=-1,y1=-1;frames.forEach(({c})=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}});
 x0-=1;y0-=1;x1+=1;y1+=1;const W=x1-x0+1,H=y1-y0+1,cols=Math.max(...POSES.map(([,n])=>n));const sh=canvas(W*cols,H*POSES.length),sg=sh.getContext('2d');
 frames.forEach(({c,ri,f})=>{const t=canvas(W,H),tg=t.getContext('2d');tg.drawImage(c,x0,y0,W,H,0,0,W,H);polish(tg,W,H);sg.drawImage(t,f*W,ri*H);});
 return {canvas:sh,W,H,anchor:{x:(dims.AX??dims.W/2)+PAD-x0,y:dims.H+PAD-y0},scale:pk?PAL[pk][3]:1};}
function rect(type,W,H,pose,f){const ri=POSES.findIndex(([p])=>p===pose);return {sx:f*W,sy:ri*H,sw:W,sh:H};}

A.monsters={PAL,POSES,TIMING,KINDS:Object.keys(KINDS),buildSheet,rect};
})(typeof window!=='undefined'?window:globalThis);
