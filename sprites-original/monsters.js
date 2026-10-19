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
const PAL={gbear:['#7a5030','#553620','#9a7050',1.5],wolf:['#7a7a86','#55555f','#a8a8b4',1],bear:['#6a4a30','#4a321e','#8a6a48',1.5],pwolf:['#a08a5a','#7a6640','#c8b07a',1],boar:['#5a4030','#3e2c20','#7a5a40',1.15],hwolf:['#6e6258','#4e443c','#968878',1.05],rboar:['#7a3a2a','#55261a','#a05a40',1.3],cwolf:['#c8d4e0','#8a9cb0','#eef4fa',1.1],cbear:['#d8dce4','#9aa2b0','#f4f6fa',1.6],cboar:['#4a5a3a','#323e26','#6e7e52',1.35],fboar:['#8a6a5a','#5e4a3e','#b08a78',1.2],sanju1:['#8a8a90','#5e5e66','#b4b4bc',2.4],sanju2:['#7a7a82','#52525a','#a4a4ae',2.5],sanju3:['#6a6a74','#46464e','#94949e',2.6],sanju4:['#5a5660','#3a363e','#86828e',2.8]};
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
function rabbit(g,p,pose,f){const B='#c8b49a',D='#9a8468',L='#e8dcc8',W=16,H=14;const hop=pose==='walk'?[0,2,3,1][f]:pose==='atk'?[0,3][f]:0;const y=H-1-hop,x=6;
 ell(g,x,y-4,4,3,D);ell(g,x,y-5,4,3,B);R(g,x-3,y-2,7,1,L);R(g,x-5,y-5,2,2,'#f4f0ea');
 R(g,x+3,y-8,4,3,B);R(g,x+4,y-12,1,4,B);R(g,x+6,y-12,1,4,D);R(g,x+4,y-11,1,2,'#e8a0a0');R(g,x+6,y-7,1,1,pose==='hurt'?'#fff':'#1a1420');R(g,x+7,y-6,1,1,'#e8a0a0');
 R(g,x-2,y-1,2,1,D);R(g,x+2,y-1,2,1,D);if(hop>1){R(g,x-3,y,2,1,D);}
 return {W,H};}

// Stone / crystal golem. 32x36, anchor (16,36). k: 'golem' | 'cgolem'
function golem(k){return function(g,p,pose,f){const cr=k==='cgolem',mo=k==='mgolem',B=cr?'#7ab8d8':mo?'#5a6a4a':'#7a7068',D=cr?'#4a88b0':mo?'#3e4a32':'#544c46',L=cr?'#c8f0ff':mo?'#8a9a6a':'#9a908a',E=cr?'#ffffff':mo?'#b8ff6a':'#ffb040',W=32,H=36;
 const st=pose==='walk'?[1,0,-1,0][f]:0,bob=pose==='idle'?f:pose==='walk'&&(f%2)?-1:0,arm=pose==='atk'?(f===0?-8:4):0;const x=16,y=H;
 R(g,x-7,y-9+Math.max(0,st),5,9-Math.max(0,st),D);R(g,x+2,y-9+Math.max(0,-st),5,9-Math.max(0,-st),D);R(g,x-8,y-2,7,2,shade(D,-.2));R(g,x+1,y-2,7,2,shade(D,-.2));
 const ty=y-25+bob;R(g,x-9,ty,18,17,B);R(g,x-9,ty,18,2,L);R(g,x+7,ty,2,17,D);R(g,x-9,ty+15,18,2,D);
 // cracks / crystal shards
 if(cr){R(g,x-4,ty+4,2,5,L);R(g,x+2,ty+8,2,4,L);R(g,x-2,ty-4,2,4,L);R(g,x+3,ty-3,2,3,L);}else{R(g,x-3,ty+5,1,4,D);R(g,x-2,ty+8,2,1,D);R(g,x+3,ty+3,3,2,'#5a8a4a');R(g,x+2,ty+10,1,3,D);}
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

const KINDS={wolf:[wolf,'wolf'],pwolf:[wolf,'pwolf'],hwolf:[wolf,'hwolf'],boar:[boar,'boar'],rboar:[boar,'rboar'],mgolem:[golem('mgolem'),null],bear:[bear,'bear'],gbear:[bear,'gbear'],rabbit:[rabbit,null],golem:[golem('golem'),null],cgolem:[golem('cgolem'),null],guardian:[guardian,null],trauka:[trauka,null,[230,170]],cwolf:[wolf,'cwolf'],cbear:[bear,'cbear'],cboar:[boar,'cboar'],fboar:[boar,'fboar'],sanju1:[bear,'sanju1'],sanju2:[bear,'sanju2'],sanju3:[bear,'sanju3'],sanju4:[bear,'sanju4']};

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
