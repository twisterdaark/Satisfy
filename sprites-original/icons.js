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

// Blade shapes (owner 2026-10-24: "every weapon its own picture and the look it shows on the character"): one description
// per sword draws both the held sprite (weapons.js, pointing up) and the bag icon (here, on the diagonal), so the two always
// match. len: blade length (held px), w: blade width (px), p: profile (str straight, taper, leaf, cleaver, wave flamberge,
// saw teeth on the back, kat curved single edge), cv: curve, c: [mid, dark edge, light edge], f: fuller, rn: rune dots,
// g: guard [type bar|cross|wing|disc, colour], gm: gem in the guard, gr: grip colours, pm: pommel, gl: grip length.
const BSPEC={vipdag:{len:6,w:2,p:'kat',cv:.8,c:['#7ac83a','#3a6a1a','#d8ffa8'],g:['bar','#2a3a1a'],gr:['#1a2a10','#3a5a2a'],pm:'#7ac83a',gl:2},shdag:{len:7,w:2,p:'wave',c:['#4a3a6a','#1a1030','#a08ac8'],g:['cross','#2a1a3a'],gm:'#a05aff',gr:['#1a1018','#2a1a28'],pm:'#4a3a6a',gl:2},bldag:{len:7,w:2,p:'saw',c:['#c8282a','#5a0a0e','#ff8a7a'],g:['wing','#3a0a0e'],gm:'#ff2a3a',gr:['#1a0808','#3a1010'],pm:'#c8282a',gl:2},
 rusty:{len:8,w:2,p:'saw',c:['#9b8b78','#6e6052','#c4b4a0'],g:['bar','#8a6a3a'],gr:['#6b4428','#8a5a32'],pm:'#8a6a3a',gl:3},
 isword:{len:10,w:2,p:'str',c:['#c4c8d0','#7a808c','#eef0f4'],g:['bar','#9a9aa6'],gr:['#6b4428','#8a5a32'],pm:'#9a9aa6',gl:3},
 ssword:{len:11,w:3,p:'taper',c:['#dfe6ee','#8a94a4','#ffffff'],f:'#b8c4d4',g:['cross','#d8b04a'],gr:['#3a2a5a','#5a4a7a'],pm:'#d8b04a',gl:3},
 gsword:{len:14,w:3,p:'str',c:['#6ab0ff','#2a5ab0','#d0e8ff'],f:'#9fd0ff',g:['wing','#c8a050'],gm:'#2a5ab0',gr:['#5a3a18','#8a5a32'],pm:'#c8a050',gl:4},
 msword:{len:11,w:3,p:'leaf',c:['#c8e8f4','#7aa0b8','#ffffff'],f:'#e8f8ff',g:['disc','#4a90c0'],gr:['#2a4a6a','#4a6a8a'],pm:'#4a90c0',gl:3},
 failure:{len:14,w:3,p:'saw',c:['#c8dcec','#7a96b0','#f4fbff'],g:['wing','#8aa4bc'],gm:'#e8f4ff',gr:['#4a5a6a','#8aa4bc'],pm:'#c8dcec',gl:4},
 dains:{len:12,w:3,p:'taper',c:['#e8c050','#9a7418','#fff4c0'],rn:'#fff4c0',g:['wing','#6a4a18'],gm:'#c8282a',gr:['#3a2410','#6a4a18'],pm:'#e8c050',gl:3},
 iyarugt:{len:12,w:2,p:'kat',cv:1,c:['#c8282a','#6a0a0e','#ff7a6a'],rn:'#ff3a2a',g:['disc','#2a0a0e'],gr:['#2a0a0e','#5a1a1e'],pm:'#c8282a',gl:4},
 wisdom:{len:11,w:3,p:'str',c:['#e8f4ff','#7a9ab8','#ffffff'],rn:'#4a90ff',g:['wing','#d8b04a'],gm:'#4a90ff',gr:['#e8e4d8','#c8c0a8'],pm:'#d8b04a',gl:3},
 pgwork:{len:13,w:3,p:'str',c:['#d8e0f0','#7a8494','#ffffff'],f:'#a8b8d0',rn:'#bfe6ff',g:['cross','#8a929e'],gm:'#bfe6ff',gr:['#3a2a1e','#5a4230'],pm:'#8a929e',gl:4},   // Pagma's Late Work (v2.95): a plain master's blade, frost in its runes
 yetgs:{len:14,w:4,p:'cleaver',c:['#9aa0ac','#4a4e58','#e8eef8'],f:'#6a0a1a',g:['wing','#5a0a1a'],gm:'#ff2a3a',gr:['#1a1018','#3a1a28'],pm:'#8a0a1a',gl:4},
 dpgs:{len:15,w:3,p:'str',c:['#d0d8e0','#8a96a4','#ffffff'],f:'#eef4fa',g:['wing','#d8b04a'],gm:'#fff0b0',gr:['#5a4020','#d8b04a'],pm:'#d8b04a',gl:4},
 mgsword:{len:10,w:2,p:'str',c:['#e0e4ec','#2a3a6a','#ffffff'],g:['bar','#2a3a6a'],gr:['#2a3a6a','#3a4a7a'],pm:'#2a3a6a',gl:3},
 lantd:{len:6,w:2,p:'taper',c:['#e8eef8','#8a94a4','#ffffff'],g:['cross','#a81a1a'],gr:['#2a1a1a','#4a2a2a'],pm:'#a81a1a',gl:2},
 ideal:{len:6,w:2,p:'leaf',c:['#bfe8ff','#5a8ab0','#ffffff'],g:['bar','#4a90c0'],gr:['#2a4a6a','#4a6a8a'],pm:'#bfe8ff',gl:2},
 ttthorn:{len:6,w:2,p:'saw',c:['#3a5a6a','#1a2a3a','#5ad8c8'],g:['disc','#1a3a3a'],gr:['#1a2a2a','#2a4a4a'],pm:'#5ad8c8',gl:2},
 dagger:{len:5,w:2,p:'taper',c:['#c4c8d0','#7a808c','#eef0f4'],g:['bar','#9a9aa6'],gr:['#6b4428','#8a5a32'],pm:'#9a9aa6',gl:2},
 mdagger:{len:6,w:2,p:'leaf',c:['#c8e8f4','#7aa0b8','#ffffff'],g:['disc','#4a90c0'],gr:['#2a4a6a','#4a6a8a'],pm:'#4a90c0',gl:2},
 mgdagger:{len:6,w:2,p:'str',c:['#e0e4ec','#2a3a6a','#ffffff'],g:['bar','#2a3a6a'],gr:['#2a3a6a','#3a4a7a'],pm:'#2a3a6a',gl:2}};
// the materials a creation is made of give it its colours and its line (owner 2026-10-24, the Legendary Smith's creations)
const MATP={ore:[['#c4c8d0','#7a808c','#eef0f4'],'str'],wood:[['#a8743f','#6b4428','#c8945a'],'str'],leather:[['#8a5a32','#5a3a20','#b07a46'],'str'],
 mstone:[['#4a90ff','#2a5ab0','#bfe8ff'],'taper'],estone:[['#9fe3c8','#3a8a6a','#e8fff4'],'leaf'],pstone:[['#e8d070','#9a8030','#fff4c0'],'str'],bstone:[['#c8a0ff','#6a4ab0','#efe0ff'],'taper'],
 ruby:[['#e83a4a','#8a0a1a','#ff9aa0'],'taper'],topaz:[['#f2c14e','#9a7418','#fff3b0'],'leaf'],emer:[['#3ac87a','#1a6a3a','#a8f0c8'],'leaf'],sapph:[['#3a6ae8','#1a2a8a','#a8c0ff'],'taper'],
 bvial:[['#a81a2a','#5a0a12','#ff6a6a'],'saw'],blue:[['#6ab0ff','#2a5ab0','#d0e8ff'],'str'],vwleath:[['#6a3a2a','#3a1a12','#a86a4a'],'saw'],kpearl:[['#f0e8f8','#a898c0','#ffffff'],'leaf'],
 kink:[['#3a2a5a','#1a1030','#8a6ac8'],'wave'],diam:[['#e8f8ff','#8ab8d0','#ffffff'],'taper'],mith:[['#dfe8f0','#8a9ab0','#ffffff'],'leaf'],tstone:[['#ffe060','#5a6a8a','#fff8c0'],'wave'],
 fess:[['#ff7a3a','#a8281a','#ffd0a0'],'wave'],iess:[['#9fe0ff','#3a7ab0','#e8faff'],'taper'],sess:[['#b08aff','#4a2a9a','#e8d8ff'],'wave'],wegg:[['#d8c8a8','#8a7858','#fff4e0'],'leaf'],fstone:[['#ff6a1a','#8a1a0a','#ffd24a'],'wave'],
 dscale:[['#c83a2a','#6a1a12','#ff9a6a'],'saw'],bljewel:[['#2a1a2e','#120814','#a05aff'],'cleaver'],blhorn:[['#3a1a1a','#1a0808','#ff4a3a'],'cleaver'],brphx:[['#ff8a2a','#b8280a','#fff07a'],'wave'],
 brdrg:[['#5ac8ff','#1a5ab0','#e8f8ff'],'leaf'],brtig:[['#f2f2f8','#8a8aa0','#ffffff'],'saw'],brtor:[['#2a5a6a','#0e2a34','#5ad8c8'],'cleaver'],
 ndiron:[['#5a2a36','#2a0a14','#d83a5a'],'saw'],ndstone:[['#3a2a4e','#1a1024','#9a5ae8'],'cleaver']};
const MATM={fstone:2.8,ndiron:3.2,ndstone:3.2,brphx:4,brdrg:4,brtig:4,brtor:4,bljewel:3.8,blhorn:3.8,dscale:3.4,wegg:3,fess:2.8,iess:2.8,sess:2.8,tstone:2.6,mith:2.4,diam:2.2,kpearl:2.1,kink:2.1,blue:2,vwleath:2};
// "cw|gs.L.W.C.m1[.m2]": a creation's kind, its blueprint (length, width, curve 0-100) and its two leading materials
function cwParse(k){const m=/^cw\|([a-z]{2})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.([a-z]{2,8})(?:\.([a-z]{2,8}))?$/.exec(k||'');if(!m)return null;
 return {ty:m[1],L:Math.min(100,+m[2]),W:Math.min(100,+m[3]),C:Math.min(100,+m[4]),m1:MATP[m[5]]?m[5]:'ore',m2:MATP[m[6]]?m[6]:null};}
function cwSpec(o){const P=MATP[o.m1],A=o.m2?MATP[o.m2][0]:null,top=MATM[o.m1]||1,L=o.L/100,W=o.W/100,C=o.C/100;
 const gt=C>.45?'disc':top>=3?'wing':top>=2?'cross':'bar',gc=top>=3?'#e8c050':top>=2?'#c8ccd6':P[0][1];
 const s={c:P[0],p:C>.45?'kat':P[1],cv:C>.45?C:0,g:[gt,gc],gr:[P[0][1],'#3a2a20'],pm:A?A[2]:gc,gm:A?A[0]:null,rn:A&&top>=2.8?A[2]:null,f:!A&&top<2.8?P[0][2]:null};
 if(o.ty==='gs')Object.assign(s,{len:11+Math.round(L*5),w:3+Math.round(W*2),gl:4});
 else if(o.ty==='dg')Object.assign(s,{len:4+Math.round(L*3),w:2+Math.round(W),gl:2});
 else Object.assign(s,{len:8+Math.round(L*4),w:2+Math.round(W*2),gl:3});
 return s;}
// the blade's points as (t along it, u across it, colour): t 0 is the first blade pixel above the guard
function bladePts(s,ic){const P=[],put=(t,u,c)=>{if(c)P.push([t,u,c]);},len=ic?Math.max(3,Math.min(9,Math.round(s.len*.62)+1)):s.len,W=ic?Math.min(5,s.w+1):s.w,
 lo=-Math.floor((W-1)/2),hi=Math.ceil((W-1)/2),gl=ic?(s.gl>=3?2:1):s.gl;
 for(let t=0;t<len;t++){const q=t/len;let a=lo,b=hi,off=0;
  if(s.p==='taper'&&q>.6)b=Math.max(a,b-1);if(s.p==='leaf'&&q>.3&&q<.75)a--;if(s.p==='cleaver'&&q>.3)b++;
  if(s.p==='wave')off=[0,0,1,1][t%4];if(s.p==='kat')off=Math.round((s.cv||1)*q*q*(ic?2:3));
  const tip=t>=len-1&&s.p!=='cleaver',tip2=t===len-2&&s.p!=='cleaver'&&W>2;
  if(tip){put(t,lo+off+(s.p==='kat'?1:0),s.c[2]);continue;}if(tip2){a=Math.max(a,lo);b=Math.min(b,hi-1);}
  for(let u=a;u<=b;u++){let c=u===a?s.c[2]:u===b?s.c[1]:s.c[0];if(s.f&&u===0&&a<0&&b>0&&t>1&&t<len-2)c=s.f;if(s.rn&&u===Math.round((a+b)/2)&&t%3===1&&t<len-2)c=s.rn;put(t,u+off,c);}
  if(s.p==='saw'&&t%2===0&&t<len-2&&t>0)put(t,b+1+off,s.c[1]);}
 const g=s.g||['bar','#9a9aa6'],gw=ic?3:2,gc=g[1];
 if(g[0]==='bar')for(let u=-gw;u<=gw;u++)put(-1,u,gc);
 if(g[0]==='cross'){for(let u=-gw;u<=gw;u++)put(-1,u,gc);put(0,-gw,gc);put(0,gw,gc);}
 if(g[0]==='wing'){for(let u=-gw-1;u<=gw+1;u++)put(-1,u,gc);put(0,-gw-1,gc);put(0,gw+1,gc);put(1,-gw-1,gc);put(1,gw+1,gc);}
 if(g[0]==='disc')for(const t of [-1,-2])for(let u=-1;u<=1;u++)put(t,u,gc);
 if(s.gm)put(-1,0,s.gm);
 const gr=s.gr||['#6b4428','#8a5a32'],g0=g[0]==='disc'?-3:-2;for(let i=0;i<gl;i++)put(g0-i,0,gr[i%2]);put(g0-gl,0,s.pm||gc);
 return P;}
const bOff=u=>u>0?[Math.ceil(u/2),Math.floor(u/2)]:[-Math.floor(-u/2),-Math.ceil(-u/2)];
// a sword's bag icon from its shape: the blade runs up and to the right, the grip down to the bottom left
function bladeIcon(I,s){for(const [t,u,c] of bladePts(s,true)){const [ox,oy]=bOff(u);I.set(6+t+ox,9-t+oy,c);}}
// the held sprite's pixels, pointing up, with the grip point where the hand holds it
function bladeHeld(s){const P=bladePts(s,false);let t0=1e9,t1=-1e9,u0=1e9,u1=-1e9;for(const [t,u] of P){t0=Math.min(t0,t);t1=Math.max(t1,t);u0=Math.min(u0,u);u1=Math.max(u1,u);}
 const px=[];for(const [t,u,c] of P)px.push([1+u-u0,1+t1-t,c]);const g0=(s.g&&s.g[0]==='disc')?-3:-2;return {w:u1-u0+3,h:t1-t0+3,px,gx:1-u0,gy:2+t1-g0};}
A.blade={BSPEC,MATP,cwParse,cwSpec,bladePts,bladeHeld,bladeIcon};
// PER_CODE: weapon colors and the great sword's blue edge from WSH
const BLADE={yetgs:['#9aa0ac','#4a4e58','#e8eef8'],mgsword:['#e0e4ec','#2a3a6a','#ffffff'],failure:['#5a6a7a','#2e3a48','#a8b8c8'],iyarugt:['#c8282a','#6a0a0e','#ff7a6a'],dpgs:['#5ac8a0','#1e6a50','#d8fff0'],dains:['#e8c050','#9a7418','#fff4c0'],wisdom:['#e8f4ff','#7a9ab8','#ffffff'],rusty:['#9b8b78','#6e6052','#c4b4a0'],isword:['#c4c8d0','#7a808c','#eef0f4'],ssword:['#dfe6ee','#8a94a4','#ffffff'],gsword:['#6ab0ff','#2a5ab0','#d0e8ff'],msword:['#c8e8f4','#7aa0b8','#ffffff']};
function sword(I,k){if(BSPEC[k])return bladeIcon(I,BSPEC[k]);const [b,dk,lt]=BLADE[k]||BLADE.rusty,long=k==='gsword'||k==='yetgs'||k==='failure'||k==='dains'||k==='dpgs';const tx=long?14:13,ty=long?1:2;
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
const HAMC={};
function hammer(I,k){const h=HAMC[k]||(k==='shammer'?['#c8ccd6','#8a909a','#ffffff']:['#9aa0aa','#6a707a','#d0d4dc']);
 I.line(3,14,9,8,'#7a5634');I.line(4,14,10,8,'#5a3a20');I.rect(8,2,6,5,h[0]);I.rect(8,2,6,1,h[2]);I.rect(13,3,1,4,h[1]);I.rect(8,6,6,1,h[1]);I.set(10,4,h[1]);}
const ARMC={flarmor:['#e8e4d8','#ffffff','#a89878'],tirsh:['#1a2034','#8a0a1a','#c8a050'],vpaj:['#f2f0f4','#ffffff','#b8b4c4'],vwarmor:['#3a3036','#5a4a52','#8a0a1a'],rparmor:['#c82a1a','#ff7a3a','#ffd24a'],tgarmor:['#e8e4d8','#ffffff','#2a2a2a'],dgarmor:['#2a6ab8','#5ac8ff','#c8e8ff'],ttshell:['#1a2a3a','#3a5a6a','#5ad8c8']};
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
function underI(I,a,b){I.rect(3,5,10,3,a);I.rect(3,8,4,4,a);I.rect(9,8,4,4,a);I.rect(3,5,10,1,b);I.set(7,8,b);I.set(8,8,b);}   // a pair of shorts
function earI(I,m,g,h){for(const x of [5,11]){I.ell(x,5,1.6,1.6,m);I.set(x,5,[0,0,0],0);I.rect(x,7,1,2,m);I.ell(x,11,2,2.4,g);I.set(x-1,10,h);}}   // a pair of drop earrings
function neckI(I,ch,g){for(let i=0;i<=12;i++){const a=i/12*Math.PI;I.set(Math.round(8-Math.cos(a)*5.5),Math.round(2+Math.sin(a)*6.5),ch);}I.ell(8,11,2.5,3,g[0]);I.ell(8,11,1.6,2,g[1]);I.set(7,10,g[2]);I.set(8,8,ch);}
function braceI(I,b,g){I.ell(8,9,6.5,4.5,b[0]);I.ell(8,9,5.5,3.5,b[1]);for(let y=6;y<=12;y++)for(let x=3;x<=13;x++){const nx=(x-8)/4.2,ny=(y-9.3)/2.3;if(nx*nx+ny*ny<=1)I.d[(y*16+x)*4+3]=0;}I.ell(8,5,2,1.6,g[0]);I.set(8,5,g[1]);I.set(7,4,g[2]);}
function brI(I,c){I.ell(8,8,6,6,c[0]);I.ell(8,8,5,5,c[1]);I.line(5,9,8,6,c[2]);I.line(8,6,11,8,c[2]);I.line(11,8,8,11,c[2]);I.set(8,8,'#ffffff');I.set(6,5,'#ffffff');I.set(5,6,c[2]);I.rect(7,13,3,1,c[0]);}
function hamI(I,c){I.line(3,13,9,7,c[2]);I.line(4,13,10,7,c[2]);I.rect(7,2,7,5,c[0]);I.rect(7,2,7,1,c[1]);I.rect(13,3,1,3,c[1]);I.set(2,14,'#3a2a1a');}
function sptI(I,c){I.line(2,14,8,8,c[2]);I.line(3,14,9,8,c[2]);I.rect(8,3,6,6,c[0]);I.rect(8,3,6,1,c[1]);I.rect(9,5,1,3,'#2a2a30');I.rect(11,5,1,3,'#2a2a30');}
function rodI(I,c){I.line(1,14,11,2,c[0]);I.line(2,14,12,2,c[1]);I.line(1,13,11,1,c[0]);I.line(1,15,4,11,'#3a2a1a');I.line(2,15,5,11,'#5a4a32');I.ell(6,11,2,2,c[2]);I.set(6,11,'#e8e8e8');I.line(12,2,14,9,'#e8f0f8');I.rect(13,10,3,2,'#d83a3a');I.rect(13,9,3,1,'#f8f8f8');}
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
 pstone:I=>{I.rect(4,3,8,10,'#3a4a5a');I.rect(5,4,6,8,'#8aa0b8');I.rect(6,5,4,6,'#cfe0f0');I.rect(7,6,2,4,'#ffffff');I.set(4,3,'#1a2430');I.set(11,12,'#1a2430');I.line(8,1,8,3,'#ffd24a');},
 bstone:I=>{I.ell(8,8,5,5,'#a07a10');I.ell(8,8,4,4,'#ffd24a');I.ell(8,7,2,2,'#fff4c0');I.set(8,2,'#fff4c0');I.set(3,8,'#fff4c0');I.set(13,8,'#fff4c0');},
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
 // insane dragon iron and stone (v2.99): a crimson-veined ingot, a violet-veined stone
 ndiron:I=>{I.rect(3,7,10,5,'#3a1a22');I.rect(4,6,8,5,'#5a2a36');I.rect(5,7,3,1,'#d83a5a');I.rect(9,9,2,1,'#d83a5a');I.set(7,6,'#ff9ab0');I.set(11,8,'#ff9ab0');I.rect(3,11,10,1,'#24101a');},
 ndstone:I=>{I.ell(8,9,6,5,'#241830');I.ell(8,8,5,4,'#3a2a4e');I.line(5,7,9,10,'#9a5ae8');I.line(9,6,11,9,'#9a5ae8');I.set(6,7,'#e0c8ff');I.set(10,7,'#e0c8ff');I.set(4,11,'#1a1024');},
 mith:I=>{I.ell(8,9,6,5,'#3e4650');I.ell(8,8,5,4,'#5a6470');I.rect(5,7,3,2,'#a8d8f0');I.rect(9,9,2,2,'#c8ecff');I.set(6,7,'#ffffff');I.set(10,6,'#bfe8ff');I.set(4,11,'#2e343c');},
 // life skills (SAT-LIFE-001): fish, herbs and cooked dishes
 fish:I=>{fishI(I,['#6a8aa8','#9ab8d4','#3e5e7c']);I.rect(4,6,6,1,'#4e6e8c');},sfish:I=>{fishI(I,['#b8d4e8','#eaf6ff','#7898b0']);I.set(6,9,'#ffffff');I.set(9,8,'#ffffff');},
 // fishing v3.03 (the player Suki): each water's fish its own look, the bait, the rods
 mackerel:I=>{fishI(I,['#4a8ab0','#8ac0e0','#2a4a68']);for(let x=4;x<=10;x+=2)I.line(x,5,x+1,7,'#1a3050');},
 catfish:I=>{fishI(I,['#7a6a4a','#a8987a','#4a3a24']);I.line(3,8,0,10,'#3a2a18');I.line(3,9,1,12,'#3a2a18');I.set(2,7,'#3a2a18');},
 ecarp:I=>{fishI(I,['#a8a890','#dcdcc4','#6e6e58']);I.set(6,8,'#ffffff');I.set(8,9,'#ffffff');I.set(10,8,'#ffffff');I.set(8,3,'#6e6e58');},
 rtrout:I=>{fishI(I,['#8aa87a','#b8d0a8','#4a6a3a']);I.rect(3,8,9,1,'#e86a8a');I.set(6,6,'#2a3a20');I.set(9,10,'#2a3a20');I.set(10,6,'#2a3a20');},
 icepike:I=>{I.ell(7,8,6.5,2,'#7aa0b4');I.ell(7,7,5,1,'#c8e4f0');for(let i=0;i<3;i++)I.rect(13+i,8-i,1,1+i*2,'#4a7088');for(let x=4;x<=10;x+=3)I.rect(x,8,1,2,'#4a7088');I.rect(0,8,2,1,'#7aa0b4');I.set(2,7,'#101010');},
 snapper:I=>{fishI(I,['#c8402e','#f08a6a','#8a2a1a']);I.line(5,4,10,4,'#8a2a1a');I.set(6,3,'#8a2a1a');I.set(8,3,'#8a2a1a');I.set(10,3,'#8a2a1a');},
 bogeel:I=>{for(let x=1;x<=14;x++){const y=8+Math.round(Math.sin(x*.7)*1.6);I.rect(x,y-1,1,3,'#5a6a38');I.set(x,y-1,'#8a9a5a');}I.set(2,7+Math.round(Math.sin(1.4)*1.6),'#101010');},
 jadekoi:I=>{fishI(I,['#2ea070','#7ae0b0','#1a6a48']);I.set(6,7,'#f8f8ee');I.set(7,7,'#f8f8ee');I.set(9,9,'#f8f8ee');I.set(10,7,'#e8743a');I.set(5,10,'#e8743a');},
 bworm:I=>{I.rect(3,9,10,5,'#7a5a3a');I.rect(3,9,10,1,'#9a7a52');I.line(4,8,7,5,'#e88a9a');I.line(7,5,9,7,'#e88a9a');I.line(9,7,11,4,'#e88a9a');I.line(6,8,8,6,'#d06a7a');},
 bshrimp:I=>{for(let i=0;i<7;i++){const a=Math.PI*(.15+i*.12),x=8+Math.cos(a)*5,y=9-Math.sin(a)*4;I.ell(x,y,1.6,1.6,i%2?'#f0905a':'#e87a48');}I.line(3,8,1,5,'#c85a30');I.line(4,7,2,3,'#c85a30');I.set(4,8,'#101010');},
 bglow:I=>{I.ell(8,8,6,6,'#3a5a2a');I.ell(8,8,4.5,4.5,'#9ae05a');I.ell(8,8,3,3,'#e8ff9a');I.set(7,6,'#ffffff');I.line(8,1,8,3,'#5a7a3a');},
 // the crafts' tools v3.04: the portable stove, the forge hammers, the spatulas
 pstove:I=>{I.rect(3,7,10,7,'#3a3a44');I.rect(3,7,10,1,'#5a5a66');I.rect(4,14,2,1,'#2a2a30');I.rect(10,14,2,1,'#2a2a30');I.rect(5,9,6,3,'#1a1a20');I.rect(6,10,4,1,'#ff9a3a');I.set(7,9,'#ffc85a');I.rect(4,3,8,3,'#8a8a96');I.rect(3,3,10,1,'#aaaab6');I.set(8,1,'#d8d8e0');I.set(7,2,'#d8d8e0');},
 ckham1:I=>hamI(I,['#6a6a72','#9a9aa4','#7a5a3a']),ckham2:I=>hamI(I,['#8a96a4','#c8d4e0','#5a4a3a']),ckham3:I=>hamI(I,['#5a90b0','#a8d8f0','#3a3a4a']),
 ckspt1:I=>sptI(I,['#a8844a','#d0aa6a','#6a5030']),ckspt2:I=>sptI(I,['#c07a3a','#e8a86a','#5a4030']),ckspt3:I=>sptI(I,['#5a90b0','#a8d8f0','#3a3a4a']),
 sstew:I=>{I.ell(8,11,6,3,'#6a4a2a');I.ell(8,10,5,1.5,'#c8a040');I.rect(3,10,10,1,'#e0c060');I.set(6,9,'#7a5a1a');I.set(10,10,'#7a5a1a');I.line(5,7,6,4,'#d8e4f0');I.line(9,7,10,3,'#d8e4f0');I.set(12,4,'#8ac8ff');I.set(11,5,'#8ac8ff');I.set(13,5,'#8ac8ff');I.set(12,6,'#8ac8ff');},
 tkrod1:I=>rodI(I,['#8a6a3a','#a8844a','#5a4a3a']),tkrod2:I=>rodI(I,['#7a8490','#b0bac6','#4a5260']),tkrod3:I=>rodI(I,['#5a90b0','#a8d8f0','#3a6a8a']),gfish:I=>{fishI(I,['#d8a830','#f2d060','#a87a18']);I.set(9,5,'#ffffff');I.set(3,11,'#fff3b0');},
 // gems (SAT-GEM-001): cut stones in five colours
 ruby:I=>gemI(I,['#7a1020','#c82a3a','#ff8a9a']),topaz:I=>gemI(I,['#a86a10','#e8a830','#fff0a0']),emer:I=>gemI(I,['#0e5a2a','#28a050','#9af0b0']),sapph:I=>gemI(I,['#102a7a','#2a5ad8','#9ac0ff']),diam:I=>gemI(I,['#7a90a8','#d8e8f8','#ffffff']),thund:I=>{gemI(I,['#5a4a10','#e8c830','#fff8b0']);I.line(9,4,7,8,'#ffffff');I.line(7,8,9,8,'#ffffff');I.line(9,8,7,12,'#ffffff');},
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
 slotU:I=>underI(I,'#bfe0ff','#bfe0ff'),cunder:I=>underI(I,'#f4f2ec','#c8c4bc'),nunder:I=>underI(I,'#a8b0bc','#6a7a8a'),bunder:I=>underI(I,'#8a1f2a','#c8a050'),
 slotE:I=>{for(const x of [5,11]){I.ell(x,6,1.6,1.6,'#bfe0ff');I.rect(x,8,1,2,'#bfe0ff');I.ell(x,11,1.8,2,'#bfe0ff');}},
 iear:I=>earI(I,'#8a8e9a','#d8dce4','#ffffff'),mear:I=>earI(I,'#7aa0c0','#dff0ff','#ffffff'),rbear:I=>earI(I,'#c8a050','#e8304a','#ffb0c0'),saear:I=>earI(I,'#d8dce4','#3a7af0','#cfe0ff'),
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
 elfin:I=>ring(I,'#8a8a96','#c8c8d8','#4ad070'),vring:I=>ring(I,'#3a1a22','#7a3a4a','#d8283a'),wring:I=>ring(I,'#c8a050','#f2d27a','#ff6a9a'),doran:I=>ring(I,'#c8a050','#f2d27a','#8a3ad8'),absurd:I=>ring(I,'#e8e8f0','#ffffff','#ff8a1e'),
 jvring:I=>ring(I,'#4a3a3e','#7a6a70','#e85a6a'),avring:I=>ring(I,'#2a0a12','#6a1a2a','#ff1a3a'),hvring:I=>ring(I,'#c8a050','#f2d27a','#c8102a'),
 tirbelt:I=>braceI(I,['#1a2034','#3a4060'],['#8a0a1a','#e83a4a','#ffffff']),latneck:I=>neckI(I,'#5a3a6a',['#24142e','#a05aff','#e8d0ff']),craybr:I=>braceI(I,['#3a040c','#9a0a1a'],['#c8102a','#ff5a6a','#ffffff']),
 vwhelm:I=>helm(I,['#3a3036','#5a4a52','#8a0a1a'],0),vwgloves:I=>glove(I,['#3a3036','#5a4a52','#1a1418']),vwboots:I=>boot(I,['#3a3036','#5a4a52','#1a1418']),
 // Franz's treasures (v3.11, ch 128): the 5th pope's Holy Light Crown, Armor and Gloves, white and gold with the goddess's cross
 flcrown:I=>{I.rect(3,7,10,5,'#d8b04a');I.rect(3,7,10,1,'#f2d878');I.rect(3,11,10,1,'#8a6a2a');for(const x of [3,6,9,12]){I.rect(x,4,1,3,'#d8b04a');I.set(x,3,'#fff3b0');}I.rect(7,2,2,5,'#f4f0e8');I.rect(6,3,4,1,'#f4f0e8');I.set(8,9,'#5ac8ff');I.set(5,9,'#e85a5a');I.set(11,9,'#e85a5a');},
 flarmor:I=>{armor(I,'flarmor');I.rect(7,5,2,6,'#d8b04a');I.rect(5,7,6,2,'#d8b04a');},
 flgloves:I=>{glove(I,['#f4f0e8','#ffffff','#a89878']);I.set(7,9,'#d8b04a');I.set(8,9,'#d8b04a');I.set(7,8,'#d8b04a');},
 // the Slaughterer's Eye Patch (ch 244: "just a black eye patch made of leather"): a strap and the leather patch, stitched
 speye:I=>{for(let i=0;i<=12;i++){const x=2+i,y=Math.round(3+i*.5);I.set(x,y,'#3a2a1e');I.set(x,y+1,'#5a4230');}I.ell(8,9,4.5,3.5,'#141418');I.ell(7,8,2.5,1.5,'#2e2e36');I.set(6,7,'#5a5a66');for(const [x,y] of [[4,9],[5,11],[8,12],[11,11],[12,9]])I.set(x,y,'#7a6248');},
 // a rainbow potato (the Patrian fields, owner 2026-10-25): a potato in every colour at once
 rpotato:I=>{I.ell(8,9,5.5,4.5,'#a8743f');I.ell(6,8,2,2,'#e85a4a');I.ell(10,8,2,2,'#5ac85a');I.ell(8,11,2,1.5,'#5a8ae8');I.ell(11,11,1.5,1.5,'#e8c84a');I.ell(5,11,1.5,1.2,'#a05ae8');I.set(7,6,'#fff4c0');I.set(4,9,'#6b4428');I.set(12,9,'#6b4428');},
 vwleath:I=>{I.ell(8,9,6,5,'#3a3036');I.ell(8,9,4.5,3.5,'#5a4a52');I.rect(3,5,2,2,'#3a3036');I.rect(11,5,2,2,'#3a3036');I.rect(3,12,2,2,'#3a3036');I.rect(11,12,2,2,'#3a3036');I.set(6,7,'#8a0a1a');I.set(10,11,'#8a0a1a');I.set(7,8,'#7a6a70');},
 bboots:I=>{boot(I,['#3a3e6e','#6a6ea8','#1e2040']);I.rect(4,2,7,2,'#4a4e86');I.set(6,5,'#f0f0ff');I.set(7,6,'#f0f0ff');I.set(8,5,'#f0f0ff');I.set(6,9,'#f0f0ff');I.set(7,10,'#c8a8ff');I.rect(5,11,3,1,'#6a6ea8');},
 ochelm:I=>{for(const [x,y] of [[2,6],[3,4],[4,3],[11,3],[12,4],[13,6],[1,8],[14,8],[2,10],[13,10]])I.rect(x,y,2,3,'#b8bcc8');I.ell(8,8,4.5,5,'#e8dcc0');I.rect(5,11,6,3,'#e8dcc0');I.rect(5,7,2,2,'#2a1a1a');I.rect(9,7,2,2,'#2a1a1a');I.set(6,8,'#ff2a2a');I.set(10,8,'#ff2a2a');I.set(8,10,'#5a4a3a');for(let x=5;x<11;x+=2)I.set(x,13,'#5a4a3a');I.line(9,4,11,1,'#f4ecd8');I.set(10,2,'#c8bca0');I.rect(6,4,2,1,'#fff8e8');},
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
 kcloth:I=>{I.rect(2,9,12,4,'#5a5a66');I.rect(2,9,12,1,'#8a8a98');I.rect(3,6,10,3,'#6a6a78');I.rect(3,6,10,1,'#9a9aa8');I.rect(4,3,8,3,'#7a7a8a');I.rect(4,3,8,1,'#b0b0c0');I.rect(13,10,1,3,'#3a3a44');I.rect(12,7,1,2,'#4a4a54');I.set(6,4,'#c8c0ff');I.set(9,7,'#c8c0ff');I.set(5,11,'#c8c0ff');I.set(11,11,'#c8c0ff');},
 gisp:I=>{I.line(3,14,10,7,'#6a4a2a');I.line(4,14,11,7,'#4a3020');I.line(6,4,13,4,'#8a9aa8');I.line(6,4,5,7,'#8a9aa8');I.line(13,4,14,7,'#8a9aa8');I.set(9,4,'#c8d0dc');I.set(10,5,'#6a7480');},
 povt:I=>{ring(I,'#3a6a3a','#7ab07a','#c8e8a8');I.set(10,8,'#c8a050');},
 wtneck:I=>{for(let i=0;i<=10;i++){const a=i/10*Math.PI;I.set(Math.round(8-Math.cos(a)*5),Math.round(3+Math.sin(a)*6),'#c8a050');}I.ell(8,11,2,2.5,'#3a9a4a');I.set(7,10,'#a8f0a0');I.set(8,13,'#1a6a2a');},
 mnring:I=>{ring(I,'#5a6a8a','#b8c8e8','#e8f0ff');I.set(10,8,'#fff8c8');I.set(9,7,'#8ab0ff');},
 bcoco:I=>{I.ell(8,9,5,5,'#2a5ab0');I.ell(7,8,4,4,'#3a7ad8');I.set(6,6,'#bfe0ff');I.set(7,6,'#bfe0ff');I.rect(7,2,2,3,'#3a6a2a');I.set(10,3,'#5aa83a');I.set(5,3,'#5aa83a');},
 wtleaf:I=>{I.ell(8,8,3.5,6,'#3a9a4a');I.line(8,3,8,14,'#1a6a2a');I.set(6,6,'#9af0a0');I.set(7,5,'#9af0a0');I.line(8,14,9,15,'#6a4a2a');I.set(10,9,'#1a6a2a');I.set(6,10,'#1a6a2a');}};
// potions: round flask, cork, liquid with a highlight
const flask=(liq,lt)=>I=>{I.rect(7,2,2,2,'#8a5a32');I.rect(6,4,4,1,'#c8d0dc');I.rect(7,5,2,2,'#c8d0dc');I.ell(8,10.5,4.5,4,'#c8d0dc');I.ell(8,11,3.5,3,liq);I.rect(5,9,6,1,lt);I.set(6,10,'#ffffff');I.set(6,11,lt);I.set(10,13,'#00000000'==='x'?lt:liq);};
DRAW.respec=I=>{I.rect(3,3,10,10,'#e8d8a8');I.rect(3,3,10,1,'#b89858');I.rect(3,12,10,1,'#b89858');I.rect(2,2,2,12,'#9a7a48');I.rect(12,2,2,12,'#9a7a48');I.rect(5,5,6,1,'#5a4a8a');I.rect(5,7,5,1,'#5a4a8a');I.rect(5,9,6,1,'#5a4a8a');I.rect(7,10,2,2,'#c83a3a');};
DRAW.hpot=flask('#d8283a','#ff7a8a');DRAW.mpot=flask('#2a5ad8','#7ab0ff');DRAW.mightp=flask('#e8801a','#ffc87a');DRAW.regenp=flask('#3aa84a','#9fe39a');DRAW.stonep=flask('#7a7e88','#c8ccd6');DRAW.swiftp=flask('#1ab0c0','#a8f0f8');
// recipe books, one cover for each craft (owner 2026-10-23): cooking, alchemy, sewing, smithing
const rbook=(c,c2,mk)=>I=>{I.rect(3,2,10,12,c);I.rect(4,2,9,1,c2);I.rect(3,2,1,12,'#1a1220');I.rect(12,3,1,10,'#e8dcc0');I.rect(5,4,6,1,'#f2c14e');mk(I);};
DRAW.rbookc=rbook('#8a4a1a','#b8702a',I=>{I.ell(8,10,3,1.6,'#2a2a34');I.rect(5,9,7,1,'#4a4a58');I.set(7,7,'#e8e8f0');I.set(9,6,'#e8e8f0');});
DRAW.rbooka=rbook('#2a6a3a','#3a9a52',I=>{I.rect(7,6,2,2,'#c8d0dc');I.ell(8,10,2.5,2.5,'#c8d0dc');I.ell(8,10.5,1.6,1.6,'#d83a8a');});
DRAW.rbooks=rbook('#6a2a7a','#9a4ab0',I=>{I.line(5,12,10,7,'#e8eef8');I.set(10,6,'#e8eef8');I.line(6,8,9,11,'#f2c14e');});
DRAW.rbookm=rbook('#3a4a6a','#5a6a8a',I=>{I.rect(6,7,5,2,'#c8ccd6');I.line(8,9,8,12,'#8a5a32');I.set(10,7,'#ffffff');});
// the new legends' books: Tzudan's diary (five gold steps) and Mumud's spellbook (a lich's eye)
DRAW.tzbook=rbook('#5a3a22','#7a5232',I=>{for(let i=0;i<5;i++)I.set(5+i,12-i*1.2|0,'#f2c14e');I.rect(5,6,6,1,'#c8a060');});
DRAW.mumbk=rbook('#1a2a5a','#2a3a7a',I=>{I.ell(8,9.5,2.6,2.2,'#d8e0f0');I.set(7,9,'#5ab8ff');I.set(9,9,'#5ab8ff');I.rect(7,11,3,1,'#1a1a2a');});
// Madra's Old Sheath: worn dark leather, an iron chape and a red royal band
// the bag books (owner 2026-10-23: "fix its picture, every item's picture must say what it is"): each book its own cover
DRAW.bk_wm=rbook('#4a5262','#6a7488',I=>{I.line(5,12,10,7,'#e8eef8');I.line(10,12,5,7,'#e8eef8');I.set(5,12,'#c8a050');I.set(10,12,'#c8a050');I.set(10,6,'#ffffff');I.set(5,6,'#ffffff');});
DRAW.bk_mm=rbook('#22306a','#34449a',I=>{I.ell(8,9.5,2.5,2.5,'#7ab8ff');I.ell(8,9.5,1.2,1.2,'#ffffff');I.set(8,6,'#bfe0ff');I.set(8,13,'#bfe0ff');I.set(5,9,'#bfe0ff');I.set(11,9,'#bfe0ff');});
DRAW.bk_sbdash=rbook('#2a6a6a','#3a9a92',I=>{I.rect(5,8,4,1,'#d8f0ff');I.rect(4,10,5,1,'#d8f0ff');I.rect(5,12,4,1,'#d8f0ff');I.line(9,7,11,10,'#ffffff');I.line(11,10,9,13,'#ffffff');});
DRAW.bk_sbrain=rbook('#8a3a14','#c8561e',I=>{for(const [x,y] of [[5,7],[8,8],[10,6],[6,11],[9,11]]){I.set(x,y,'#ffd24a');I.set(x,y+1,'#ff8a1e');I.set(x,y+2,'#c83a1a');}});
DRAW.bk_lsword=rbook('#3a3a2a','#5a5a3a',I=>{I.line(9,5,7,9,'#ffe060');I.line(7,9,10,9,'#ffe060');I.line(10,9,7,13,'#ffe060');I.set(9,5,'#ffffff');});
DRAW.bk_esorc=rbook('#7a1a1a','#a82a22',I=>{I.ell(8,9.5,2.6,2.6,'#ff8a1e');I.ell(8,9.5,1.3,1.3,'#ffe07a');for(const [x,y] of [[5,6],[11,6],[5,13],[11,13],[8,5]])I.set(x,y,'#ffd24a');});
DRAW.bk_mdiary=I=>{I.rect(3,2,10,12,'#241a1e');I.rect(4,2,9,1,'#3e2a30');I.rect(3,2,1,12,'#120a0e');I.rect(12,3,1,10,'#c8b898');I.rect(3,8,10,2,'#5a1a1a');I.rect(10,7,2,4,'#c8a040');I.set(10,8,'#f2c14e');I.ell(7,5,1.6,1.4,'#c8c0b8');I.set(6,5,'#120a0e');I.set(8,5,'#120a0e');I.line(6,11,8,13,'#9aa0aa');I.line(8,11,6,13,'#9aa0aa');};
DRAW.bk_ma1=rbook('#5a1414','#8a2020',I=>{I.line(8,6,8,12,'#e8eef8');I.set(8,5,'#ffffff');I.rect(6,11,5,1,'#c8a050');I.set(8,13,'#6b4428');I.set(5,7,'#ff6a5a');I.set(11,7,'#ff6a5a');});
DRAW.bk_ma2=rbook('#6a1010','#a01818',I=>{I.line(5,12,10,6,'#e8eef8');I.line(11,12,6,6,'#e8eef8');I.set(10,5,'#ffffff');I.set(6,5,'#ffffff');I.set(5,13,'#c8a050');I.set(11,13,'#c8a050');I.rect(5,9,7,1,'#ff6a3a');});
DRAW.mdsheath=I=>{for(let i=0;i<9;i++){I.set(4+i,12-i,'#3a2418');I.set(5+i,12-i,'#5a3a26');I.set(4+i,11-i,'#4a2e1e');}I.set(4,13,'#c8a040');I.set(5,13,'#c8a040');I.set(3,12,'#c8a040');I.rect(7,8,2,2,'#c8a040');I.set(8,8,'#f2c14e');I.rect(10,5,2,2,'#c8a040');I.set(11,5,'#f2c14e');I.set(13,2,'#9aa0aa');I.set(12,3,'#9aa0aa');I.set(13,3,'#c8a040');I.set(14,1,'#c8a040');I.set(6,10,'#a01a1a');};
DRAW.herbtea=I=>{I.ell(8,11,4.5,2.5,'#e8e4dc');I.rect(4,7,9,4,'#e8e4dc');I.rect(5,7,7,1,'#7aa84a');I.rect(12,8,2,2,'#e8e4dc');I.set(7,4,'#d8dce8');I.set(9,3,'#d8dce8');};
DRAW.fishpie=I=>{I.ell(8,11,6.5,3,'#c8ccd6');I.ell(8,10,5.5,2.4,'#c88a3a');I.ell(8,9,4.5,1.8,'#e8b05a');I.rect(5,8,6,1,'#9ab0c8');I.set(11,8,'#9ab0c8');I.set(4,9,'#9ab0c8');};
DRAW.gfeast=I=>{I.ell(8,11,7,3,'#e8c860');I.ell(8,10,6,2,'#fff0a8');I.ell(6,9,3,1.4,'#f2b030');I.ell(10,8,2.5,1.4,'#d83a3a');I.set(8,6,'#fff4c0');I.set(12,9,'#5aa83a');};
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
 fstone:I=>{I.ell(8,9,5,5,'#5a1a0a');I.ell(8,8,4,4,'#c8380a');I.ell(8,8,2.5,3,'#ff7a1a');I.ell(7,7,1.5,1.5,'#ffd24a');I.set(6,6,'#ffffff');I.set(10,11,'#ffb02a');},
 megg:I=>{I.ell(8,9,4.5,5.5,'#0e0a10');I.ell(8,9,3.5,4.5,'#241a2a');I.set(6,6,'#5a4a6a');I.set(7,5,'#5a4a6a');I.line(7,9,9,11,'#c8203e');I.set(9,8,'#ff4a5a');I.set(6,12,'#c8203e');},
 tstone:I=>{I.ell(8,9,5,5,'#5a6a8a');I.ell(8,8,4,4,'#a8c8f0');I.ell(7,7,2,2,'#e8f4ff');I.line(9,4,7,8,'#ffe060');I.line(7,8,10,9,'#ffe060');I.line(10,9,8,13,'#ffe060');I.set(6,6,'#ffffff');},
 hfeed:I=>{I.ell(8,10,5,4,'#b08838');I.ell(8,9,4,3,'#d8b858');for(let x=4;x<13;x+=2)I.line(x,6,x+1,13,'#a07828');I.rect(3,9,10,1,'#7a4e1e');I.line(10,3,12,7,'#e87a2a');I.set(10,2,'#3a9a2a');I.set(11,2,'#5ac84a');},
 vherb:I=>herbI(I,'#f2c14e','#fff3b0'),
 // a return scroll (owner 2026-10-23): a rolled parchment tied with a blue cord, a pale light at its seal
 rscroll:I=>{I.rect(3,4,10,8,'#e8d8a8');I.rect(3,4,10,1,'#fff2c8');I.ell(3,8,1.6,4,'#c8b080');I.ell(13,8,1.6,4,'#c8b080');I.rect(7,4,2,8,'#3a7ad8');I.ell(8,8,2,2,'#bfe8ff');I.set(8,8,'#ffffff');I.line(5,6,6,6,'#a08a60');I.line(10,10,11,10,'#a08a60');},
 blocks:I=>{I.rect(2,9,5,5,'#d83a3a');I.rect(8,9,5,5,'#3a7ad8');I.rect(5,3,5,5,'#e8b030');I.set(3,10,'#ff8a8a');I.set(9,10,'#9ac0ff');I.set(6,4,'#fff0a0');I.rect(3,8,1,1,'#d83a3a');I.rect(9,8,1,1,'#3a7ad8');}});
DRAW.jaffa=DRAW.arrows;
// a blueprint fragment (plan U280): a torn corner of blue drafting paper with white lines
DRAW.bpfrag=I=>{I.rect(3,3,10,10,'#2a5ab0');I.rect(3,3,10,1,'#4a8ae8');for(let y=5;y<12;y+=3)I.line(4,y,11,y,'#bfe0ff');I.line(6,4,6,12,'#bfe0ff');I.line(12,8,8,12,'#101a33');I.set(12,9,'#101a33');I.set(11,10,'#101a33');I.set(10,11,'#101a33');};
const SLOT={slotW:I=>{for(let i=0;i<8;i++)I.set(5+i,10-i,'#bfe0ff');I.line(3,10,5,12,'#bfe0ff');I.set(3,12,'#bfe0ff');},slotA:I=>{I.rect(4,3,8,10,'#bfe0ff');I.rect(2,3,3,4,'#bfe0ff');I.rect(11,3,3,4,'#bfe0ff');},
 slotH:I=>{I.rect(4,4,8,7,'#bfe0ff');I.rect(3,8,10,2,'#bfe0ff');},slotG:I=>{I.rect(4,5,7,8,'#bfe0ff');I.rect(11,7,2,3,'#bfe0ff');},slotB:I=>{I.rect(5,3,4,9,'#bfe0ff');I.rect(5,10,8,3,'#bfe0ff');},slotX:I=>{I.rect(6,3,4,4,'#bfe0ff');I.rect(7,7,2,6,'#bfe0ff');}};

// a creation's icon: its blade drawn from its blueprint, or its kind in the colours of its materials
function cwIcon(I,k){const o=cwParse(k);if(!o)return sword(I,'rusty');const P=MATP[o.m1][0],A=o.m2?MATP[o.m2][0]:P;
 if(o.ty==='gs'||o.ty==='sw'||o.ty==='dg')return bladeIcon(I,cwSpec(o));
 if(o.ty==='bw'){BOWC[k]=[P[0],P[1],A[2]];return bow(I,k);}
 if(o.ty==='st'){STAFFC[k]=[A[1],A[0],A[2]];return staff(I,k);}
 if(o.ty==='hm'){HAMC[k]=P;return hammer(I,k);}
 // armour, helmet, gloves and boots in their materials' colours (owner 2026-10-26: they drew as a spear); the second
 // material trims it, a thick blueprint closes a helmet's visor and studs the plate
 const C=[P[0],P[2],A[1]];if(o.ty==='ar'){ARMC[k]=C;armor(I,k);if(o.L>=60){I.set(5,6,A[2]);I.set(10,6,A[2]);}if(o.W>=60){I.set(2,3,A[2]);I.set(13,3,A[2]);}return;}
 if(o.ty==='hl'){helm(I,C,o.L>=60);if(o.m2)I.set(8,2,A[2]);return;}if(o.ty==='gl')return glove(I,C);if(o.ty==='bt')return boot(I,C);
 const n=2+Math.round(o.L/50);I.line(2,14,11-n,5+n,P[1]);I.line(3,14,12-n,5+n,'#5a3a20');I.set(6,10,A[2]);I.rect(11-n,3+n,2+n,2,P[0]);I.line(12-n,2+n,14,1,P[2]);I.set(12,2,P[0]);I.set(13,3,P[1]);}
// the new weapons' icons (owner 2026-10-24: a weapon for every kind of fighter)
const NWI={oakst:['st',['#3a7a3a','#7ac87a','#d8ffd8']],frstaff:['st',['#2a5ab0','#9fe0ff','#ffffff']],stormst:['st',['#4a2a9a','#b08aff','#fff07a']],abyssst:['st',['#120814','#5a1a8a','#c86aff']],
 hunbow:['bw',['#6a4a2a','#4a3018','#a8743f']],wyvbow:['bw',['#d8d0b8','#8a7a5a','#ffffff']],moonbow:['bw',['#c8d8ff','#5a6ab0','#ffffff']],
 warhm:['hm',['#7a7a86','#4a4a56','#b8b8c4']],thhm:['hm',['#4a6ab0','#2a3a70','#fff07a']],giantm:['hm',['#5a4a3a','#3a2a1a','#9a8a6a']],
 knspear:['sp',['#7a5634','#c4c8d0','#eef0f4']],trident:['sp',['#2a4a6a','#5ac8c8','#e8ffff']],skyspear:['sp',['#e8e4d8','#ffd23a','#fff8c0']],
 // the crafted mithril and mass-produced Grid tiers, the Spiral Quick Fire Bow and the Dragon Hammer
 mstaff:['st',['#4a90c0','#c8e8f4','#ffffff']],mgstaff:['st',['#2a3a6a','#e0e4ec','#ffffff']],mbow:['bw',['#7aa0b8','#4a7890','#c8e8f4']],mgbow:['bw',['#e0e4ec','#2a3a6a','#ffffff']],sqfbow:['bw',['#c87a2a','#7a3a10','#ffd27a']],
 mhammer:['hm',['#c8e8f4','#7aa0b8','#ffffff']],mghammer:['hm',['#e0e4ec','#2a3a6a','#ffffff']],dhammer:['hm',['#8a1a1a','#4a0a0a','#e8c050']],mspear:['sp',['#4a6a8a','#c8e8f4','#ffffff']],mgspear:['sp',['#2a3a6a','#e0e4ec','#ffffff']]};
function nwIcon(I,k){const [t,c]=NWI[k];if(t==='bw'){BOWC[k]=c;return bow(I,k);}if(t==='st'){STAFFC[k]=c;return staff(I,k);}if(t==='hm'){HAMC[k]=c;return hammer(I,k);}
 I.line(2,14,11,5,c[0]);I.line(3,14,12,5,shade0(c[0]));I.set(6,10,c[1]);I.rect(11,3,2,2,c[1]);I.set(13,2,c[2]);I.set(14,1,c[2]);I.set(12,2,c[1]);
 if(k==='trident'){I.line(10,2,12,0,c[1]);I.line(13,5,15,3,c[1]);}if(k==='skyspear'){I.set(10,6,c[2]);I.set(14,2,c[2]);I.set(9,5,c[1]);I.set(14,6,c[1]);}}
// the Insane Dragon Hammer (atlas F055): a blocky dark iron head, a curved pick behind it, a long iron haft with a spike
DRAW.ndhammer=I=>{I.line(2,14,10,6,'#4a4e58');I.line(3,14,11,6,'#2a2c34');I.set(1,15,'#8a909c');I.rect(8,2,5,5,'#5a5e6a');I.rect(8,2,5,1,'#8a909c');I.rect(12,2,1,5,'#3a3c46');I.rect(9,7,3,1,'#3a3c46');I.line(7,4,4,2,'#6a6e7a');I.set(3,1,'#9aa0ac');I.set(10,4,'#c8282a');};
const shade0=c=>'#'+hex(c).map(v=>Math.max(0,v-50).toString(16).padStart(2,'0')).join('');
function iconRGBA(k){const I=Img();if(typeof k==='string'&&k.startsWith('cw|')){cwIcon(I,k);return finish(I,false);}
 if(SLOT[k]){SLOT[k](I);for(let i=3;i<I.d.length;i+=4)if(I.d[i])I.d[i]=64;return finish(I,true);}
 if(NWI[k])nwIcon(I,k);else if(DRAW[k])DRAW[k](I);else if(k==='bow'||k==='sbow')bow(I,k);else if(k==='staff'||k==='sstaff')staff(I,k);else if(k==='hammer'||k==='shammer')hammer(I,k);
 else if(k==='larmor'||k==='parmor'||k==='marmor'||k==='warmor'||k==='ocarmor'||k==='emarmor'||k==='mgarmor'||ARMC[k])armor(I,k);else sword(I,k);
 return finish(I,false);}
function iconCanvas(k){const c=document.createElement('canvas');c.width=c.height=16;c.getContext('2d').putImageData(new ImageData(iconRGBA(k),16,16),0,0);return c;}
// v3.05 (the player Suki): a shiny one is its plain picture with a sparkle; its key is 'shn' + the plain key
const SHNK=['fish','sfish','mackerel','catfish','ecarp','rtrout','icepike','snapper','bogeel','jadekoi','gfish','ore','mith','herb','bherb','wheat','straw','melon','pumpk','fcab','cfish','stew','feast','ppie','sjam','herbtea','fishpie','gfeast','sstew'];
for(const k of SHNK){const f=DRAW[k];if(f)DRAW['shn'+k]=I=>{f(I);I.set(13,1,'#fff6c0');I.set(13,3,'#fff6c0');I.set(12,2,'#fff6c0');I.set(14,2,'#fff6c0');I.set(13,2,'#ffffff');I.set(2,13,'#ffe68a');I.set(1,12,'#fff6c0');};}
// the Mage Tower's tomes (2026-10-26): a closed book, its cover, spine and clasp in its colours
const TOMEC={tome1:['#6a4a2a','#3a2414','#9a7a4a','#c8a050'],tome2:['#a83a1a','#5a1a0a','#e8703a','#ffd27a'],tome3:['#1a5aa8','#0a2a5a','#6aa8ff','#c8e8f4'],tome4:['#5a3aa8','#2a1a5a','#a88aff','#fff07a'],tome5:['#e8c040','#8a6a1a','#fff3b0','#ffffff']};
for(const k in TOMEC){const c=TOMEC[k];DRAW[k]=I=>{I.rect(3,2,10,12,c[0]);I.rect(4,2,9,1,c[2]);I.rect(3,2,1,12,c[1]);I.rect(12,3,1,10,'#e8dcc0');I.rect(6,5,4,4,c[3]);I.rect(7,6,2,2,c[1]);I.set(7,6,c[2]);I.rect(11,7,2,2,c[3]);};}
// the Bounty Book (v3.32): a worn leather ledger with a red wax seal and a gold coin on its cover
DRAW.bbook=I=>{I.rect(3,2,10,12,'#5a3a1e');I.rect(4,2,9,1,'#8a5a2e');I.rect(3,2,1,12,'#3a2410');I.rect(12,3,1,10,'#e8dcc0');I.rect(5,4,6,1,'#c8a050');I.rect(5,11,6,1,'#c8a050');I.ell(8,8,2.5,2.5,'#f2c14e');I.set(8,8,'#a87418');I.set(7,7,'#fff3b0');I.rect(10,12,2,2,'#c8281a');I.set(10,12,'#ff6a5a');};
const KEYS=['rusty','isword','ssword','gsword','bow','sbow','staff','sstaff','hammer','shammer','larmor','parmor','warmor','jaffa','arrows','bread','wood','ore','leather','blue','mstone','book','hpot','mpot','lhelm','ihelm','lgloves','igloves','lboots','iboots','cring','mring','spear','dagger','mith','msword','marmor','mhelm','tHood','tGloves','tBoots','tRobe','dscale','ruby','topaz','emer','sapph','diam','fish','sfish','gfish','herb','bherb','cfish','stew','feast','slotW','slotA','slotH','slotG','slotB','slotX','coin','estone','respec','failure','ideal','gale','iyarugt','dains','tbow','wisdom','elfin','vring','doran','absurd','bboots','ochelm','lantd','alexb','alexg','kcloth','gisp','povt','wtneck','bcoco','wtleaf','mnring','candy','sgl','rsdraw','xpot','hairpin','dskewer','choco','blocks','tstone','ocarmor','ocgloves','ocboots','ocring','emarmor','emhelm','emgloves','emboots','mgsword','mgarmor','mghelm','mggloves','mgboots','brphx','brdrg','brtig','brtor','rpbow','rparmor','rphelm','rpboots','tgarmor','tghelm','tggloves','tgboots','dgspear','dggaunt','dgarmor','dghelm','ttthorn','ttshell','tthelm','ttboots','bljewel','blhorn','blstaff','gdneck','gdbrace','ezneck','ezbrace','bjneck','bjbrace','slotN','slotR','slotE','slotU','cunder','nunder','bunder','iear','mear','rbear','saear','fess','iess','sess','bvial','wegg','flneck','frbrace','stbrace','wheat','straw','melon','pumpk','fcab','compost','ppie','sjam','kink','kpearl','kneck','dpgs','pstone','bstone','thund','hfeed','vherb','rscroll','rbookc','rbooka','rbooks','rbookm','mightp','regenp','herbtea','fishpie','gfeast','tzbook','mumbk','mdsheath','bk_wm','bk_mm','bk_sbdash','bk_sbrain','bk_lsword','bk_esorc','bk_mdiary','bk_ma1','bk_ma2','jvring','avring','hvring','tirbelt','tirsh','latneck','vpaj','craybr','yetgs','vwarmor','vwhelm','vwgloves','vwboots','vwleath','wring','oakst','frstaff','stormst','abyssst','hunbow','wyvbow','moonbow','vipdag','shdag','bldag','knspear','trident','skyspear','warhm','thhm','giantm','mstaff','mbow','mspear','mdagger','mhammer','mgstaff','mgbow','mgspear','mgdagger','mghammer','sqfbow','dhammer','rpotato','speye','pgwork','ndiron','ndstone','ndhammer','mackerel','catfish','ecarp','rtrout','icepike','snapper','bogeel','jadekoi','bworm','bshrimp','bglow','tkrod1','tkrod2','tkrod3','pstove','ckham1','ckham2','ckham3','ckspt1','ckspt2','ckspt3','sstew',...SHNK.map(k=>'shn'+k),'flcrown','flarmor','flgloves','tome1','tome2','tome3','tome4','tome5','bpfrag','fstone','megg','bbook'];
A.icons={KEYS,iconRGBA,iconCanvas};
})(typeof window!=='undefined'?window:globalThis);
