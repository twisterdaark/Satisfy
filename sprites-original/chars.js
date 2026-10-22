// Satisfy character renderer v2 (SAT-ART-001, Claude-B).
// Reads the same style configs as index.html's figure() (FIG / lookFig) and draws 16x24 frames
// with more animation (idle+blink, 4-frame walk, 3-frame attack, hurt), soft top light and a
// selective outline. Output keeps today's frame size and anchor so hitboxes stay the same.
// Classic script: works from file://, GitHub Pages and a Node vm with a canvas shim.
(function(root){'use strict';
const A=root.SatArt=root.SatArt||{};
const FW=16,FH=24;
// Sheet layout: one row per direction (d=down/front, u=up/back, s=side facing right; left = mirrored s).
const POSES=[['idle',2],['walk',4],['atk',3],['hurt',1]];
const COLS=[];POSES.forEach(([p,n])=>{for(let f=0;f<n;f++)COLS.push([p,f]);});
const ROWS=['d','u','s'];
// Suggested timings in seconds; idle frame 1 is a blink, shown briefly every few seconds.
const TIMING={idle:[2.6,0.12],walk:[0.11,0.11,0.11,0.11],atk:[0.07,0.06,0.09],hurt:[0.2]};

const R=(g,x,y,w,h,c)=>{if(!c||w<=0||h<=0)return;g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const canvas=(w,h)=>{const c=(root.document?root.document.createElement('canvas'):A.makeCanvas(w,h));c.width=w;c.height=h;return c;};

// color helpers (hex <-> rgb, lighten/darken, mix)
const hx=c=>{c=c.replace('#','');if(c.length===3)c=c.split('').map(k=>k+k).join('');const n=parseInt(c,16);return [n>>16&255,n>>8&255,n&255];};
const toHex=([r,g,b])=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const mixC=(a,b,k)=>{const A_=hx(a),B=hx(b);return toHex(A_.map((v,i)=>v+(B[i]-v)*k));};
const shade=(c,k)=>k>0?mixC(c,'#fff4dc',k):mixC(c,'#140c1c',-k);

// Pose parameters for a frame. bob moves the upper body (not legs); lean shifts it on the side view.
function poseOf(dir,pose,f){
 const S_=dir==='s',o={bob:0,lean:0,legL:0,legR:0,stride:1,swap:false,armL:0,armR:0,armS:0,atk:-1,blink:false,hurt:false};
 if(pose==='idle'){o.stride=0;if(f===1)o.blink=true;}
 if(pose==='walk'){if(f===1||f===3)o.bob=-1;
  if(S_){o.stride=f%2===0?1:0;o.swap=f===2;o.armS=f===0?1:f===2?-1:0;}
  else{o.legL=f===0?1:0;o.legR=f===2?1:0;o.armL=f===0?1:f===2?-1:0;o.armR=f===2?1:f===0?-1:0;}}
 if(pose==='atk'){o.atk=f;o.stride=f===1?1:0;if(S_)o.lean=f===0?-1:f===1?1:0;else o.bob=f===0?-1:0;}
 if(pose==='hurt'){o.hurt=true;o.stride=0;if(S_)o.lean=-1;else o.bob=-1;}
 return o;}

// Draws one frame. Returns {c: canvas, hand:{x,y}} where hand is the weapon-holding pixel in frame coords.
function frame(c,dir,pose,f){
 const cv=canvas(FW,FH),g=cv.getContext('2d');const S_=dir==='s',U=dir==='u',o=poseOf(dir,pose,f);
 const OY=2,lx=S_?o.lean:0,by=o.bob,late=[];let hand={x:S_?9:12,y:17};
 const p=(x,y,w,h,col)=>R(g,x,y+OY,w,h,col);            // legs / ground layer
 const q=(x,y,w,h,col)=>R(g,x+lx,y+by+OY,w,h,col);      // upper body layer
 const lg=c.shorts?c.skin:c.pants,lgD=shade(lg,-.22),btD=shade(c.boots,-.25);
 if(by<0){if(S_)p(6,16,4,1,lg);else{p(5,16,2,1,lg);p(9,16,2,1,lg);}}
 // legs
 if(S_){
  if(o.stride){const fl=o.swap?lgD:lg,bl=o.swap?lg:lgD,fb=o.swap?btD:c.boots,bb=o.swap?c.boots:btD;
   p(9,17,2,3,bl);p(9,20,3,2,bb);p(5,17,2,3,fl);p(4,20,3,2,fb);
   if(pose==='atk'){p(10,17,2,3,bl);p(10,20,3,2,bb);}}
  else{p(6,17,4,3,lg);p(6,20,4,2,c.boots);p(8,18,1,2,lgD);p(8,20,1,2,btD);}}
 else{p(5,17,2,3-o.legL,lg);p(9,17,2,3-o.legR,lg);p(5,20-o.legL,2,2,c.boots);p(9,20-o.legR,2,2,c.boots);
  p(6,17,1,3-o.legL,lgD);p(10,17,1,3-o.legR,lgD);
  if(pose==='atk'&&f===1){p(4,20,1,2,c.boots);p(11,20,1,2,c.boots);}}
 if(c.shorts){if(S_)p(5,17,6,1,c.shorts);else p(4,17,8,1,c.shorts);}
 if(c.robe){if(S_){p(5,16,6,4,c.top);p(10,16,1,4,c.top2);}else{p(4,16,8,4,c.top);p(11,16,1,4,c.top2);p(4,19,8,1,c.top2);}}
 // cape behind
 if(c.cape&&!U){const sw=pose==='walk'?(f%2):0;if(S_){q(4-sw,11,2,8,c.cape);q(3-sw,13,1,6,shade(c.cape,-.2));}else{q(3,11,10,1,c.cape);q(3,12,1,6+sw,c.cape);q(12,12,1,6+sw,c.cape);}}
 // a reptile tail behind the body (lizardmen)
 if(c.tail){const sw=pose==='walk'?(f%2):0,T=c.skin,T2=c.sk2;if(S_){p(2,15+sw,3,2,T);p(1,17+sw,2,2,T2);p(0,19,2,1,T2);p(3,15,2,1,T2);}else if(U){p(7,16,2,3,T);p(8,19,2,2,T2);p(9,21-sw,2,1,T2);}else{p(12,16,2,2,T);p(13,18,2,2,T2);p(14,19+sw,1,2,T2);}}
 // back arm on the side view (behind torso)
 const arm=c.armC||(c.sleeves?c.top:c.skin),arm2=c.armC2||(c.sleeves?c.top2:c.sk2);const hnd=c.glove||c.skin;   // gloves recolour the hands
 if(S_&&o.atk<0){const ob=-o.armS;q(6+ob,11,2,4,shade(arm2,-.12));q(6+ob,15,2,1,c.sk2);}
 // torso with soft vertical shading
 if(S_){q(5,11,6,6,c.top);q(10,11,1,6,c.top2);q(5,11,1,5,shade(c.top,.1));}
 else{q(4,11,8,6,c.top);q(11,11,1,6,c.top2);q(4,16,8,1,shade(c.top,-.12));if(!U)q(5,11,1,4,shade(c.top,.12));}
 if(c.chest&&!U){if(S_)q(5,11,4,4,c.chest);else{q(5,11,6,4,c.chest);q(10,11,1,4,c.pad2);q(5,13,6,1,c.pad2);q(6,11,2,1,shade(c.chest,.2));}}
 q(S_?5:4,16,S_?6:8,1,c.belt||c.boots);if(!U&&c.belt)q(S_?8:7,16,2,1,shade(c.belt,.35));
 if(c.cape&&U)q(4,11,8,8,c.cape),q(4,11,8,1,shade(c.cape,.15));
 if(c.apron){if(U){q(5,11,1,5,c.apron2);q(10,11,1,5,c.apron2);q(5,15,6,1,c.apron2);}
  else if(S_){q(8,12,3,7,c.apron);q(10,12,1,7,c.apron2);q(8,11,1,1,c.apron2);}
  else{q(5,12,6,7,c.apron);q(10,12,1,7,c.apron2);q(5,11,1,1,c.apron2);q(10,11,1,1,c.apron2);q(6,15,4,1,c.apron2);}}
 // arms
 if(S_){
  if(o.atk===0){late.push(()=>{q(4,8,2,3,arm);q(5,10,2,2,arm2);q(3,7,2,2,hnd);});hand={x:3+lx,y:7+by+OY};}
  else if(o.atk===1){q(8,12,4,2,arm);q(8,13,4,1,arm2);q(12,12,2,2,hnd);hand={x:13+lx,y:12+by+OY};}
  else if(o.atk===2){q(8,12,2,3,arm);q(9,12,1,3,arm2);q(9,15,2,2,hnd);hand={x:10+lx,y:16+by+OY};}
  else{const a=o.armS+(o.hurt?-1:0);q(7+a,11,2,4,arm);q(8+a,11,1,4,arm2);q(7+a,15,2,2,hnd);hand={x:8+a+lx,y:16+by+OY};}}
 else{
  const hl=o.hurt?-1:0;q(3,11+Math.max(0,o.armL)+hl,1,4,arm);q(3,15+Math.max(0,o.armL)+hl,1,2,hnd);if(!c.sleeves)q(3,12+Math.max(0,o.armL),1,1,c.sk2);
  if(o.atk===0){late.push(()=>{q(12,7,1,4,arm2);q(13,7,1,3,arm);q(12,5,2,2,hnd);});hand={x:12,y:5+by+OY};}
  else if(o.atk===1){q(12,11,1,2,arm2);q(11,13,1,2,arm2);q(10,15,2,2,hnd);hand={x:10,y:16+by+OY};}
  else if(o.atk===2){q(12,12,1,4,arm2);q(12,16,1,2,hnd);hand={x:12,y:17+by+OY};}
  else{const r=Math.max(0,o.armR)+hl;q(12,11+r,1,4,arm2);q(12,15+r,1,2,hnd);hand={x:12,y:16+r+by+OY};}}
 if(c.pad){if(S_){q(6,10,4,2,c.pad);q(6,11,4,1,c.pad2);q(6,10,2,1,shade(c.pad,.2));}else{q(2,10,3,2,c.pad);q(11,10,3,2,c.pad);q(2,11,3,1,c.pad2);q(11,11,3,1,c.pad2);q(2,10,1,1,shade(c.pad,.25));q(11,10,1,1,shade(c.pad,.25));}}
 // head + neck
 q(6,10,4,1,c.sk2);
 if(c.collar&&!U){if(S_)q(7,10,3,1,c.collar);else{q(5,10,6,1,c.collar);q(5,11,1,1,c.collar);q(10,11,1,1,c.collar);}}
 if(S_){q(5,2,7,8,c.skin);q(12,7,1,1,c.skin);q(5,9,7,1,c.sk2);q(11,3,1,6,c.sk2);}
 else{q(4,2,8,8,c.skin);q(11,3,1,7,c.sk2);q(5,9,6,1,c.sk2);if(!U)q(5,3,1,4,shade(c.skin,.12));}
 // face: 2px eyes with a catchlight, blink and hurt squint
 if(!U){const EYE=A.EYE||'#22181e',lid=c.sk2;
  if(S_){if(o.blink||o.hurt)q(10,7,1,1,EYE);else{q(10,6,1,2,EYE);q(10,6,1,1,'#4a3c48');}q(9,5,2,1,c.hc);q(7,6,1,2,c.sk2);if(!o.hurt&&!o.blink)q(11,8,1,1,mixC(c.skin,'#e86a6a',.25));}
  else{const bc=c.hair==='bald'&&c.beard2?c.beard2:c.hc;
   if(o.blink){q(6,7,1,1,lid);q(9,7,1,1,lid);q(6,7,1,1,EYE);q(9,7,1,1,EYE);}
   else if(o.hurt){q(5,6,2,1,EYE);q(9,6,2,1,EYE);}
   else{q(6,6,1,2,EYE);q(9,6,1,2,EYE);q(6,6,1,1,'#4a3c48');q(9,6,1,1,'#4a3c48');q(5,8,1,1,mixC(c.skin,'#e86a6a',.22));q(10,8,1,1,mixC(c.skin,'#e86a6a',.22));}
   q(5,5,2,1,bc);q(9,5,2,1,bc);q(7,8,2,1,o.hurt?shade(c.sk2,-.2):c.sk2);}}
 // hair (same shapes as the legacy renderer, on the upper-body layer)
 const h=c.hc,hl=c.hl;
 if(c.hair==='spiky'){
  if(U){q(4,1,8,9,h);q(5,0,1,1,h);q(7,0,1,1,h);q(10,0,1,1,h);q(3,3,1,3,h);q(12,3,1,3,h);q(5,10,1,1,h);q(8,10,1,1,h);q(10,10,1,1,h);q(6,2,1,2,hl);q(9,3,1,2,hl);}
  else if(S_){q(5,1,7,4,h);q(7,0,1,1,h);q(9,0,2,1,h);q(4,2,1,2,h);q(3,3,1,1,h);q(5,5,3,4,h);q(4,5,1,2,h);q(4,8,1,1,h);q(10,5,2,1,h);q(8,5,1,1,h);q(12,4,1,1,h);q(7,2,2,1,hl);}
  else{q(4,1,8,4,h);q(4,0,1,1,h);q(6,0,1,1,h);q(9,0,1,1,h);q(11,0,1,1,h);q(3,2,1,3,h);q(12,2,1,3,h);q(2,3,1,1,h);q(13,3,1,1,h);q(4,5,2,1,h);q(7,5,2,1,h);q(10,5,2,1,h);q(6,6,1,1,h);q(4,6,1,3,h);q(11,6,1,3,h);q(6,2,1,1,hl);q(7,3,2,1,hl);q(10,2,1,1,hl);}}
 else if(c.hair==='long'){
  if(U){q(3,1,10,12,h);q(4,0,8,1,h);q(2,4,1,7,h);q(13,4,1,7,h);q(5,2,1,3,hl);q(9,3,1,4,hl);q(4,13,2,1,h);q(9,13,3,1,h);q(2,11,1,2,h);}
  else if(S_){q(5,1,7,3,h);q(6,0,5,1,h);q(4,2,1,9,h);q(5,4,3,8,h);q(3,4,1,6,h);q(11,3,1,2,h);q(6,2,3,1,hl);q(4,11,2,1,h);q(2,6,1,3,h);}
  else{q(4,1,8,3,h);q(5,0,6,1,h);q(3,2,1,9,h);q(12,2,1,9,h);q(2,4,1,6,h);q(13,4,1,7,h);q(4,4,2,1,h);q(7,4,1,1,h);q(10,4,2,1,h);q(6,1,2,1,hl);q(9,2,2,1,hl);q(1,6,1,3,h);q(14,7,1,2,h);q(2,10,1,2,h);q(13,11,1,1,h);}}
 else if(c.hair==='bald'){q(6,2,2,1,hl);q(5,3,1,1,hl);
  if(U){q(4,7,8,3,h);q(4,6,1,1,h);q(11,6,1,1,h);}else if(S_){q(5,6,2,3,h);}else{q(4,6,1,3,h);q(11,6,1,3,h);}}
 else if(c.hair==='short'){if(U)q(4,1,8,8,h);else if(S_){q(5,1,7,3,h);q(5,4,3,4,h);q(10,4,2,1,h);}else{q(4,1,8,3,h);q(4,4,1,3,h);q(11,4,1,3,h);q(5,4,3,1,h);q(9,4,2,1,h);}q(7,2,2,1,hl);}
 else if(c.hair==='pony'){const sw=pose==='walk'?(f%2):0;if(U){q(4,1,8,8,h);q(7,9,2,5,h);q(7,9,2,1,hl);}else if(S_){q(5,1,7,3,h);q(5,4,3,3,h);q(10,4,2,1,h);q(2,4+sw,3,2,h);q(2,6+sw,2,4,h);}else{q(4,1,8,3,h);q(4,4,1,3,h);q(11,4,1,3,h);q(5,4,3,1,h);q(9,4,2,1,h);q(12,5,1,4,h);q(13,6,1,3,h);}q(7,2,2,1,hl);}
 // v2 styles for the player's creator: messy (Grid-like), mohawk, bun, twin tails, side-swept, curly
 else if(c.hair==='messy'){
  if(U){q(3,1,10,9,h);q(4,0,2,1,h);q(8,0,3,1,h);q(2,3,1,5,h);q(13,3,1,5,h);q(4,10,2,1,h);q(7,10,1,1,h);q(10,10,2,1,h);q(5,2,1,3,hl);q(9,2,2,1,hl);}
  else if(S_){q(5,1,7,4,h);q(6,0,2,1,h);q(9,0,2,1,h);q(4,1,1,7,h);q(3,3,1,4,h);q(5,5,3,4,h);q(11,5,2,2,h);q(12,4,1,1,h);q(8,5,2,1,h);q(6,2,3,1,hl);}
  else{q(3,1,10,3,h);q(4,0,2,1,h);q(8,0,3,1,h);q(2,2,1,6,h);q(13,2,1,6,h);q(3,4,1,5,h);q(12,4,1,5,h);q(4,4,3,1,h);q(5,5,1,1,h);q(8,4,1,2,h);q(10,4,2,1,h);q(11,5,1,1,h);q(5,1,2,1,hl);q(9,2,2,1,hl);}}
 else if(c.hair==='mohawk'){
  if(U){q(6,-1,4,10,h);q(4,3,1,4,shade(c.skin,-.1));q(11,3,1,4,shade(c.skin,-.1));q(7,0,1,8,hl);}
  else if(S_){q(5,-1,6,3,h);q(4,0,1,1,h);q(5,2,2,5,shade(h,-.25));q(7,0,2,1,hl);}
  else{q(6,-1,4,4,h);q(5,0,1,2,h);q(10,0,1,2,h);q(4,3,1,4,shade(h,-.3));q(11,3,1,4,shade(h,-.3));q(7,-1,1,3,hl);}}
 else if(c.hair==='bun'){
  if(U){q(4,1,8,8,h);q(6,-1,4,3,h);q(7,-1,2,1,hl);q(6,2,1,1,hl);}
  else if(S_){q(5,1,7,3,h);q(5,4,3,4,h);q(10,4,2,1,h);q(3,0,3,3,h);q(4,0,1,1,hl);q(7,2,2,1,hl);}
  else{q(4,1,8,3,h);q(4,4,1,4,h);q(11,4,1,4,h);q(5,4,6,1,h);q(6,-1,4,2,h);q(7,-1,2,1,hl);q(7,2,2,1,hl);}}
 else if(c.hair==='twin'){const sw=pose==='walk'?(f%2):0;
  if(U){q(4,1,8,8,h);q(2,4+sw,2,7,h);q(12,4+sw,2,7,h);q(2,4,2,1,'#c84a5a');q(12,4,2,1,'#c84a5a');q(6,2,1,2,hl);}
  else if(S_){q(5,1,7,3,h);q(5,4,3,3,h);q(10,4,2,1,h);q(3,4+sw,2,7,h);q(3,4,2,1,'#c84a5a');q(7,2,2,1,hl);}
  else{q(4,1,8,3,h);q(4,4,1,3,h);q(11,4,1,3,h);q(5,4,6,1,h);q(1,4+sw,2,7,h);q(13,4+sw,2,7,h);q(2,3,1,2,'#c84a5a');q(13,3,1,2,'#c84a5a');q(6,2,1,1,hl);q(9,2,2,1,hl);}}
 else if(c.hair==='side'){
  if(U){q(4,1,8,9,h);q(3,2,1,6,h);q(5,2,4,1,hl);}
  else if(S_){q(5,1,7,3,h);q(5,4,3,4,h);q(10,4,3,2,h);q(11,6,1,1,h);q(7,2,3,1,hl);}
  else{q(4,1,8,3,h);q(3,2,1,6,h);q(4,4,4,1,h);q(4,5,3,1,h);q(4,6,1,2,h);q(11,4,1,3,h);q(9,4,2,1,h);q(5,1,4,1,hl);q(5,2,2,1,hl);}}
 else if(c.hair==='curly'){
  if(U){q(3,0,10,10,h);q(2,2,1,6,h);q(13,2,1,6,h);for(let i=0;i<5;i++)q(3+i*2,(i&1),1,1,hl);q(4,4,1,1,hl);q(9,6,1,1,hl);}
  else if(S_){q(4,0,8,5,h);q(3,1,1,7,h);q(4,5,4,4,h);q(11,4,2,2,h);q(5,1,1,1,hl);q(8,0,1,1,hl);q(10,2,1,1,hl);q(4,6,1,1,hl);}
  else{q(3,0,10,4,h);q(2,1,1,7,h);q(13,1,1,7,h);q(3,4,1,4,h);q(12,4,1,4,h);q(4,4,2,1,h);q(7,4,2,1,h);q(10,4,2,1,h);q(4,1,1,1,hl);q(7,0,1,1,hl);q(10,1,1,1,hl);q(12,3,1,1,hl);}}
 else if(c.hair==='cap'){q(4,4,1,3,h);q(11,4,1,3,h);q(3,0,10,3,c.cap);q(4,3,8,1,'#d8d2c4');q(5,0,6,1,'#ffffff');if(U)q(4,4,8,4,h);}
 else if(c.hair==='hat'){q(4,4,1,3,h);q(11,4,1,3,h);if(U)q(4,4,8,4,h);q(2,3,12,1,c.hat);q(5,0,6,3,c.hat);q(5,2,6,1,'#7a2a1a');q(5,0,6,1,shade(c.hat,.18));}
 else if(c.hair==='crown'){q(4,2,8,2,h);q(3,3,1,5,h);q(12,3,1,5,h);if(U)q(4,4,8,5,h);q(4,0,8,2,c.hat);q(4,-1,1,1,c.hat);q(7,-1,2,1,c.hat);q(11,-1,1,1,c.hat);q(5,0,6,1,shade(c.hat,.25));q(7,1,2,1,'#d83a3a');}   // a king's crown over long hair
 else if(c.hair==='helm'){if(U)q(4,1,8,9,h);else if(S_){q(5,1,7,6,h);q(4,3,1,4,h);q(9,5,3,1,'#22252c');}else{q(4,1,8,5,h);q(3,3,1,5,h);q(12,3,1,5,h);q(5,5,6,1,'#22252c');q(7,1,2,4,hl);}q(7,-1,2,2,'#8a1f2a');}
 if(c.ahoge){q(7,0,1,1,h);q(8,-1,1,1,h);q(9,-2,2,1,h);q(11,-1,1,1,h);}
 // the Good-looking Sunglasses from the Reputation Store (v0.96): "the large frame is the highlight of the square sunglasses"
 if(c.sg&&!U){const G='#141418',W='#6a7a9a';if(S_){q(9,6,3,2,G);q(6,6,3,1,G);q(10,6,1,1,W);}else{q(4,6,3,2,G);q(9,6,3,2,G);q(7,6,2,1,G);q(4,6,1,1,W);q(9,6,1,1,W);}}
 if(c.beard&&!U){if(c.longBeard){if(S_){q(8,7,4,5,c.beard);q(9,12,3,3,c.beard);q(11,8,1,6,c.beard2);q(10,15,1,1,c.beard2);q(7,7,2,1,c.beard2);}else{q(4,7,8,2,c.beard);q(5,9,6,4,c.beard);q(6,13,4,2,c.beard);q(7,15,2,1,c.beard2);q(10,9,1,4,c.beard2);q(4,8,3,1,c.beard2);q(9,8,3,1,c.beard2);q(7,8,2,1,'#fff');}}
  else if(S_){q(8,7,4,5,c.beard);q(11,8,1,4,c.beard2);q(9,12,2,1,c.beard2);}else{q(4,7,8,2,c.beard);q(5,9,6,3,c.beard);q(6,12,4,1,c.beard);q(10,9,1,3,c.beard2);q(7,13,2,1,c.beard2);q(7,8,2,1,c.beard2);}}
 // reptile head: a snout, yellow eyes and a crest of scales
 if(c.rept){const sn=shade(c.skin,.12),E='#f2d23a';if(U){q(7,0,2,1,c.hl);q(7,3,2,1,c.hl);q(7,6,2,1,c.hl);}
  else if(S_){q(12,6,2,3,c.skin);q(13,8,1,1,c.sk2);q(12,9,2,1,c.sk2);if(!o.blink&&!o.hurt)q(10,6,1,1,E);q(7,0,2,1,c.hl);q(5,1,2,1,c.hl);}
  else{q(6,7,4,3,sn);q(7,8,1,1,c.sk2);q(8,8,1,1,c.sk2);q(6,10,4,1,c.sk2);if(!o.blink&&!o.hurt){q(6,6,1,1,E);q(9,6,1,1,E);}q(7,0,2,2,c.hl);q(5,1,1,1,c.hl);q(10,1,1,1,c.hl);}}
 late.forEach(fn=>fn());
 polish(g);
 return {c:cv,hand};}

// Post-pass: rim light on the top edge, then a selective outline (dark tint of the neighbour on
// top/side edges, near-black on the bottom) so silhouettes read on grass and snow alike.
function polish(g){
 const id=g.getImageData(0,0,FW,FH),d=id.data,OUT=A.OUT||'#120f18';
 const at=(x,y)=>x>=0&&y>=0&&x<FW&&y<FH&&d[(y*FW+x)*4+3]>0;
 const get=(x,y)=>{const i=(y*FW+x)*4;return toHex([d[i],d[i+1],d[i+2]]);};
 const rim=[];for(let y=0;y<FH;y++)for(let x=0;x<FW;x++)if(at(x,y)&&!at(x,y-1)&&y<13)rim.push([x,y,get(x,y)]);
 const out=[];for(let y=0;y<FH;y++)for(let x=0;x<FW;x++){if(at(x,y))continue;
  const below=at(x,y+1),above=at(x,y-1),side=at(x-1,y)||at(x+1,y);if(!(below||above||side))continue;
  let col=OUT;if(below&&!above&&y<14)col=mixC(shade(get(x,y+1),-.62),OUT,.35);else if(side&&!above&&!below&&y<16){const n=at(x-1,y)?get(x-1,y):get(x+1,y);col=mixC(shade(n,-.6),OUT,.5);}
  out.push([x,y,col]);}
 rim.forEach(([x,y,c])=>R(g,x,y,1,1,shade(c,.16)));out.forEach(([x,y,c])=>R(g,x,y,1,1,c));}

// Builds a full sheet (FW*10 x FH*3) for one style config. Returns {canvas, frames, hands}.
function buildSheet(c){const sh=canvas(FW*COLS.length,FH*ROWS.length),g=sh.getContext('2d');const hands={};
 ROWS.forEach((dir,ri)=>{hands[dir]={};COLS.forEach(([pose,f],ci)=>{const fr=frame(c,dir,pose,f);g.drawImage(fr.c,ci*FW,ri*FH);(hands[dir][pose]=hands[dir][pose]||[])[f]=fr.hand;});});
 return {canvas:sh,hands};}
// Frame lookup inside a sheet: returns the source rect for drawImage.
function rect(dir,pose,f){const d=dir==='l'?'s':dir;const ci=COLS.findIndex(([p,k])=>p===pose&&k===f);return {sx:ci*FW,sy:ROWS.indexOf(d)*FH,sw:FW,sh:FH,flip:dir==='l'};}

A.chars={FW,FH,POSES,COLS,ROWS,TIMING,frame,buildSheet,rect,poseOf,shade,mixC};
})(typeof window!=='undefined'?window:globalThis);
