// Satisfy character renderer v2 (SAT-ART-001, Claude-B).
// Reads the same style configs as index.html's figure() (FIG / lookFig) and draws 16x24 frames
// with more animation (idle+blink, 4-frame walk, 3-frame attack, hurt), soft top light and a
// selective outline. Output keeps today's frame size and anchor so hitboxes stay the same.
// Classic script: works from file://, GitHub Pages and a Node vm with a canvas shim.
(function(root){'use strict';
const A=root.SatArt=root.SatArt||{};
const FW=16,FH=24;
// built-up hairstyles for the character creator (owner 2026-10-23): len 0 ear .. 4 waist, a fringe, a tail or bun
const HAIRP={longS:{len:4,bang:'part'},hime:{len:4,bang:'full'},bob:{len:2,bang:'full'},bobS:{len:2,bang:'side'},braid:{len:1,bang:'part',tail:'braid'},twinB:{len:1,bang:'full',tail:'twinb'},
 hbun:{len:1,bang:'side',tail:'hbun'},sidep:{len:1,bang:'side',tail:'sidep'},wavy:{len:3,bang:'part',wave:1},shoulder:{len:2,bang:'part'},ponyH:{len:0,bang:'side',tail:'ponyL'},lowTw:{len:1,bang:'part',tail:'low2'},
 odango:{len:1,bang:'full',tail:'buns2'},emo:{len:1,bang:'emo'},undercut:{len:0,bang:'side',top:'tall',shave:1},slick:{len:0,bang:'none',back:1},topknot:{len:0,bang:'none',tail:'knot',shave:1},afro:{top:'afro'},
 wolf:{len:1,bang:'side',back:2},spikyL:{len:3,bang:'spiky'},princess:{len:4,bang:'side',tail:'bunS'}};
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
 // a skirt over the legs (owner 2026-10-23 customization), in the trousers' colour
 if(c.skirt){const K=c.skirt,K2=shade(K,-.22),sw=pose==='walk'?(f%2):0;if(S_){p(5,16,6,2,K);p(4-sw,18,8,2,K);p(4-sw,19,8,1,K2);p(10,16,1,3,K2);}else{p(4,16,8,2,K);p(3,18,10,2,K);p(3,19,10,1,K2);p(11,16,1,3,K2);}}
 if(c.robeL){const T=c.top,T2=c.top2,hm=c.trim||T2,sw=pose==='walk'?(f%2):0;if(S_){p(5,16,6,5,T);p(4-sw,19,8,2,T);p(10,16,1,5,T2);p(4-sw,21,8,1,hm);}
  else{p(4,16,8,5,T);p(3,19,10,2,T);p(11,16,1,5,T2);p(3,21,10,1,hm);if(!U)p(7,16,2,5,hm);}}
 if(c.robe){if(S_){p(5,16,6,4,c.top);p(10,16,1,4,c.top2);}else{p(4,16,8,4,c.top);p(11,16,1,4,c.top2);p(4,19,8,1,c.top2);}}
 // cape behind
 if(c.cape&&!U){const sw=pose==='walk'?(f%2):0;if(S_){q(4-sw,11,2,8,c.cape);q(3-sw,13,1,6,shade(c.cape,-.2));}else{q(3,11,10,1,c.cape);q(3,12,1,6+sw,c.cape);q(12,12,1,6+sw,c.cape);}}
 // owner 2026-10-22 (no two monsters alike): bat wings behind the body, folded a little on every other walk frame
 if(c.wings){const W=c.wings,WB=shade(W,.28),WD=shade(W,-.25),fl=pose==='walk'?(f%2):0;
  if(U){q(0,6+fl,5,7,W);q(11,6+fl,5,7,W);q(1,13+fl,3,1,WD);q(12,13+fl,3,1,WD);q(4,5,1,8,WB);q(11,5,1,8,WB);q(1,7+fl,3,1,WB);q(12,7+fl,3,1,WB);}
  else if(S_){q(0,7+fl,5,4,W);q(1,6+fl,4,1,W);q(1,11+fl,3,2,WD);q(4,5,1,7,WB);q(1,9+fl,3,1,WB);}
  else{q(0,8+fl,4,5,W);q(1,7+fl,3,1,W);q(1,13+fl,2,1,WD);q(12,8+fl,4,5,W);q(12,7+fl,3,1,W);q(13,13+fl,2,1,WD);q(3,6,1,7,WB);q(12,6,1,7,WB);}}
 // a reptile tail behind the body (lizardmen)
 if(c.tail){const sw=pose==='walk'?(f%2):0,T=c.skin,T2=c.sk2;if(S_){p(2,15+sw,3,2,T);p(1,17+sw,2,2,T2);p(0,19,2,1,T2);p(3,15,2,1,T2);}else if(U){p(7,16,2,3,T);p(8,19,2,2,T2);p(9,21-sw,2,1,T2);}else{p(12,16,2,2,T);p(13,18,2,2,T2);p(14,19+sw,1,2,T2);}}
 // back arm on the side view (behind torso)
 const arm=c.armC||(c.sleeves?c.top:c.skin),arm2=c.armC2||(c.sleeves?c.top2:c.sk2);const hnd=c.glove||c.skin;   // gloves recolour the hands
 if(S_&&o.atk<0){const ob=-o.armS;q(6+ob,11,2,4,shade(arm2,-.12));q(6+ob,15,2,1,c.sk2);}
 // torso with soft vertical shading
 if(c.fem){if(S_){q(5,11,6,3,c.top);q(6,14,5,3,c.top);q(10,11,1,6,c.top2);q(5,11,1,3,shade(c.top,.1));if(!c.chest)q(10,12,1,1,shade(c.top,.14));}   // a narrower waist
  else{q(4,11,8,3,c.top);q(5,14,6,3,c.top);q(11,11,1,3,c.top2);q(10,14,1,3,c.top2);q(5,16,6,1,shade(c.top,-.12));if(!U){q(5,11,1,3,shade(c.top,.12));if(!c.chest){q(6,12,1,1,shade(c.top,.16));q(9,12,1,1,shade(c.top,.16));}}}}
 else if(S_){q(5,11,6,6,c.top);q(10,11,1,6,c.top2);q(5,11,1,5,shade(c.top,.1));}
 else{q(4,11,8,6,c.top);q(11,11,1,6,c.top2);q(4,16,8,1,shade(c.top,-.12));if(!U)q(5,11,1,4,shade(c.top,.12));}
 if(c.chest&&!U){if(S_)q(5,11,4,4,c.chest);else{q(5,11,6,4,c.chest);q(10,11,1,4,c.pad2);q(5,13,6,1,c.pad2);q(6,11,2,1,shade(c.chest,.2));}}
 if(c.sash&&!U){if(S_){q(6,12,4,1,c.sash);q(7,13,3,1,c.sash);}else for(let i=0;i<5;i++)q(5+i,11+i,2,1,c.sash);}
 if(c.fem)q(S_?6:5,16,S_?5:6,1,c.belt||c.boots);else q(S_?5:4,16,S_?6:8,1,c.belt||c.boots);if(!U&&c.belt)q(S_?8:7,16,2,1,shade(c.belt,.35));
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
 if(c.spike){const K=c.spike;if(S_){q(7,8,1,2,K);q(9,9,1,1,K);}else{q(2,9,1,1,K);q(3,8,1,2,K);q(12,8,1,2,K);q(13,9,1,1,K);}}
 // head + neck
 q(6,10,4,1,c.sk2);
 if(c.collar&&!U){if(S_)q(7,10,3,1,c.collar);else{q(5,10,6,1,c.collar);q(5,11,1,1,c.collar);q(10,11,1,1,c.collar);}}
 if(c.fem){if(S_){q(5,2,7,7,c.skin);q(6,9,5,1,c.skin);q(12,7,1,1,c.skin);q(11,3,1,5,c.sk2);}   // a rounder chin and no jaw shadow (owner 2026-10-23: girls had a beard-like line)
  else{q(4,2,8,7,c.skin);q(5,9,6,1,c.skin);q(11,3,1,6,c.sk2);if(!U)q(5,3,1,4,shade(c.skin,.12));}}
 else if(S_){q(5,2,7,8,c.skin);q(12,7,1,1,c.skin);q(5,9,7,1,c.sk2);q(11,3,1,6,c.sk2);}
 else{q(4,2,8,8,c.skin);q(11,3,1,7,c.sk2);q(5,9,6,1,c.sk2);if(!U)q(5,3,1,4,shade(c.skin,.12));}
 // face: 2px eyes with a catchlight, blink and hurt squint
 if(!U){const EYE=c.eye||A.EYE||'#22181e',lid=c.sk2,CL=c.eye?shade(c.eye,.45):'#4a3c48';
  const LIP=c.lip||mixC(c.skin,'#c8506a',.35);
  if(S_){if(o.blink||o.hurt)q(10,7,1,1,EYE);else{q(10,6,1,2,EYE);q(10,6,1,1,CL);if(c.fem)q(11,6,1,1,EYE);}if(c.fem)q(10,5,1,1,c.hc);else q(9,5,2,1,c.hc);q(7,6,1,2,c.sk2);if(!o.hurt&&!o.blink)q(11,8,1,1,c.fem?LIP:mixC(c.skin,'#e86a6a',.25));}
  else{const bc=c.hair==='bald'&&c.beard2?c.beard2:c.hc;
   if(o.blink){q(6,7,1,1,lid);q(9,7,1,1,lid);q(6,7,1,1,EYE);q(9,7,1,1,EYE);}
   else if(o.hurt){q(5,6,2,1,EYE);q(9,6,2,1,EYE);}
   else{q(6,6,1,2,EYE);q(9,6,1,2,EYE);q(6,6,1,1,CL);q(9,6,1,1,CL);q(5,8,1,1,mixC(c.skin,'#e86a6a',c.fem?.32:.22));q(10,8,1,1,mixC(c.skin,'#e86a6a',c.fem?.32:.22));if(c.fem){q(5,6,1,1,EYE);q(10,6,1,1,EYE);}}   // lashes
   if(c.fem){q(6,5,1,1,bc);q(9,5,1,1,bc);q(7,8,2,1,o.hurt?shade(LIP,-.2):LIP);}else{q(5,5,2,1,bc);q(9,5,2,1,bc);q(7,8,2,1,o.hurt?shade(c.sk2,-.2):c.lip||c.sk2);}}
  // freckles and a scar
  if(c.frk){const F=shade(c.skin,-.28);if(S_){q(9,8,1,1,F);q(11,7,1,1,F);}else{q(5,7,1,1,F);q(10,7,1,1,F);q(4,8,1,1,F);q(11,8,1,1,F);}}
  if(c.scar){const SC=mixC(c.skin,'#8a2a2a',.5);if(S_){q(10,4,1,1,SC);q(11,5,1,1,SC);q(11,7,1,1,SC);}else{q(10,4,1,1,SC);q(10,5,1,1,SC);q(11,7,1,1,SC);}}}
 // hair (same shapes as the legacy renderer, on the upper-body layer)
 const h=c.hc,hl=c.hl;
 // the creator's built-up styles (owner 2026-10-23): a length, a fringe and a tail or bun, drawn in three views
 function hairP(H){const L=H.len||0,end=[6,9,12,15,19][L],bk=[9,10,13,16,19][H.back!=null?H.back:L],sw=pose==='walk'?(f%2):0,TIE=H.tie||'#c84a5a';
  if(H.top==='afro'){if(U){q(2,-1,12,11,h);q(4,0,1,1,hl);q(9,1,1,1,hl);}else if(S_){q(3,-1,10,6,h);q(2,1,4,8,h);q(6,0,1,1,hl);q(9,1,1,1,hl);}else{q(2,-1,12,5,h);q(1,1,2,7,h);q(13,1,2,7,h);q(3,4,1,4,h);q(12,4,1,4,h);q(5,0,1,1,hl);q(9,0,1,1,hl);q(11,2,1,1,hl);}return;}
  const sd=H.shave?mixC(h,c.skin,.55):h;
  if(H.top==='tall'){if(S_)q(6,-1,5,2,h);else q(5,-1,6,2,h);}
  if(U){q(4,1,8,8,h);q(5,0,6,1,h);if(L>=1){q(3,2,1,end-2,h);q(12,2,1,end-2,h);}if(bk>9){const w=L>=3?10:8;q(L>=3?3:4,9,w,bk-9,h);if(H.wave)for(let y=10;y<bk;y+=2){q(2,y,1,1,h);q(13,y+1,1,1,h);}}q(6,2,1,2,hl);q(9,3,1,2,hl);
   if(H.shave){q(4,6,8,3,sd);q(5,1,6,5,h);}}
  else if(S_){q(5,1,7,3,h);q(6,0,5,1,h);q(4,2,2,5,sd);if(L>=1)q(4,4,3,end-4,h);else q(5,4,2,3,sd);if(L>=3)q(3,8,2,end-8,h);if(H.wave&&L>=2)for(let y=9;y<end;y+=2)q(2,y,1,1,h);
   const B=H.bang;if(B==='full')q(9,4,3,2,h);else if(B==='side')q(10,4,2,1,h);else if(B==='part')q(10,4,1,1,h);else if(B==='emo'){q(9,4,3,3,h);}else if(B==='spiky'){q(11,3,2,1,h);q(12,4,1,1,h);q(10,4,1,1,h);}
   q(6,2,3,1,hl);}
  else{q(4,1,8,3,h);q(5,0,6,1,h);
   if(L===0){q(4,4,1,2,sd);q(11,4,1,2,sd);}else{q(3,2,1,end-2,h);q(12,2,1,end-2,h);q(4,4,1,3,h);q(11,4,1,3,h);if(L>=2){q(2,8,1,end-8,h);q(13,8,1,end-8,h);}if(H.wave&&L>=2)for(let y=8;y<end;y+=2){q(1,y,1,1,h);q(14,y+1,1,1,h);}}
   const B=H.bang;if(B==='full'){q(4,4,8,2,h);q(5,6,1,1,h);q(10,6,1,1,h);}else if(B==='side'){q(4,4,5,1,h);q(4,5,3,1,h);q(10,4,2,1,h);}else if(B==='part'){q(4,4,3,1,h);q(9,4,3,1,h);q(4,5,1,1,h);q(11,5,1,1,h);}
   else if(B==='emo'){q(4,4,6,1,h);q(4,5,5,1,h);q(5,6,3,2,h);q(10,4,2,1,h);}else if(B==='spiky'){q(4,4,2,1,h);q(7,4,2,1,h);q(10,4,2,1,h);q(4,5,1,1,h);q(11,5,1,1,h);q(3,1,1,2,h);q(12,1,1,2,h);q(2,2,1,1,h);q(13,2,1,1,h);}
   q(6,1,2,1,hl);q(9,2,2,1,hl);}
  const T=H.tail;if(!T)return;
  if(T==='braid'){if(U){for(let i=0;i<5;i++)q(7,9+i*2,2,2,i&1?hl:h);q(7,19,2,1,TIE);}else if(S_){for(let i=0;i<5;i++)q(3,6+i*2,2,2,i&1?hl:h);q(3,16,2,1,TIE);}}
  else if(T==='twinb'){const B2=(x,y0)=>{for(let i=0;i<5;i++)q(x,y0+i*2,2,2,i&1?hl:h);q(x,y0+10,2,1,TIE);};if(U){B2(2,5);B2(12,5);}else if(S_)B2(3,5);else{B2(1,5);B2(13,5);}}
  else if(T==='hbun'){if(S_){q(4,-2,4,3,h);q(5,-2,1,1,hl);}else{q(5,-2,6,3,h);q(6,-2,2,1,hl);}}
  else if(T==='buns2'){if(S_){q(3,0,3,3,h);q(4,0,1,1,hl);}else{q(2,0,3,3,h);q(11,0,3,3,h);q(3,0,1,1,hl);q(12,0,1,1,hl);}}
  else if(T==='knot'){if(S_){q(4,-2,3,2,h);q(5,-3,1,1,h);q(5,0,2,1,TIE);}else{q(6,-2,4,2,h);q(7,-3,2,1,h);q(6,0,4,1,TIE);}}
  else if(T==='sidep'){if(U){q(2,4,2,2,h);q(1,6+sw,2,7,h);q(2,4,2,1,TIE);}else if(S_)q(3,5+sw,2,7,h);else{q(12,4,2,2,h);q(13,6+sw,2,7,h);q(12,4,2,1,TIE);}}
  else if(T==='ponyL'){if(U){q(7,1,2,1,TIE);q(7,2,2,16,h);q(7,4,1,10,hl);}else if(S_){q(3,1,2,2,h);q(2,3+sw,3,3,h);q(1,6+sw,3,9,h);q(3,2,1,1,TIE);}else{q(12,5,2,5,h);q(13,10,1,4,h);}}
  else if(T==='low2'){if(U){q(3,9,2,8,h);q(11,9,2,8,h);q(3,9,2,1,TIE);q(11,9,2,1,TIE);}else if(S_){q(3,8+sw,2,8,h);q(3,8,2,1,TIE);}else{q(2,8+sw,2,8,h);q(12,8+sw,2,8,h);q(2,8,2,1,TIE);q(12,8,2,1,TIE);}}
  else if(T==='bunS'){if(U){q(6,3,4,3,h);q(7,3,1,1,hl);}else if(S_){q(3,2,2,3,h);}}}
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
 else if(c.hair==='mitre'){const T=c.trim||'#c8a050';q(4,4,1,3,h);q(11,4,1,3,h);if(U)q(4,4,8,4,h);q(5,-2,6,5,c.hat);q(6,-3,4,1,c.hat);q(7,-4,2,1,c.hat);q(5,2,6,1,T);q(7,-3,2,5,T);q(6,-1,1,2,shade(c.hat,.2));if(!U)q(7,0,2,1,'#d83a3a');}   // a high priest's mitre
 else if(c.hair==='crown'){q(4,2,8,2,h);q(3,3,1,5,h);q(12,3,1,5,h);if(U)q(4,4,8,5,h);q(4,0,8,2,c.hat);q(4,-1,1,1,c.hat);q(7,-1,2,1,c.hat);q(11,-1,1,1,c.hat);q(5,0,6,1,shade(c.hat,.25));q(7,1,2,1,'#d83a3a');}   // a king's crown over long hair
 else if(c.hair==='helm'){if(U)q(4,1,8,9,h);else if(S_){q(5,1,7,6,h);q(4,3,1,4,h);q(9,5,3,1,'#22252c');}else{q(4,1,8,5,h);q(3,3,1,5,h);q(12,3,1,5,h);q(5,5,6,1,'#22252c');q(7,1,2,4,hl);}if(c.plume!==0){const PL=c.plume||'#8a1f2a';q(7,-1,2,2,PL);if(c.plumeL){if(S_){q(4,-1,3,1,PL);q(3,0,2,2,PL);}else q(6,-2,4,1,PL);}}}
 else if(HAIRP[c.hair])hairP(HAIRP[c.hair]);
 // owner 2026-10-22: more headgear so a kind can come in several designs
 if(c.hood){const Hd=c.hood,H2=shade(Hd,-.38),HL=shade(Hd,.15);
  if(U){q(3,0,10,11,Hd);q(4,0,8,1,HL);q(7,11,2,2,Hd);q(5,2,1,6,HL);}
  else if(S_){q(4,0,8,3,Hd);q(5,-1,6,1,Hd);q(3,2,3,9,Hd);q(4,10,6,1,Hd);q(9,3,3,2,H2);q(5,0,4,1,HL);}
  else{q(3,0,10,3,Hd);q(4,-1,8,1,Hd);q(3,3,2,8,Hd);q(11,3,2,8,Hd);q(3,10,10,1,Hd);q(5,3,6,2,H2);q(5,0,3,1,HL);}}
 if(c.band){const B=c.band;if(U){q(4,3,8,2,B);q(7,5,2,3,B);}else if(S_){q(5,3,7,2,B);q(3,4,2,1,B);q(2,5,2,2,B);}else{q(4,3,8,2,B);q(12,4,2,1,B);q(13,5,1,2,B);}}
 if(c.turban){const T=c.turban,T2=shade(T,-.2);if(U)q(3,0,10,5,T);else if(S_){q(4,0,8,4,T);q(5,-1,6,1,T);q(5,2,7,1,T2);}else{q(3,0,10,4,T);q(4,-1,8,1,T);q(4,2,8,1,T2);q(7,0,2,2,'#d83a3a');}}
 if(c.feath){const F=c.feath,F2=c.feath2||'#e8e0d0';if(U){q(4,1,8,2,F);q(5,-3,1,4,F2);q(10,-3,1,4,F2);}else if(S_){q(5,1,7,2,F);q(4,-2,1,4,F2);q(6,-3,1,4,F);q(8,-2,1,3,F2);}else{q(4,1,8,2,F);q(3,-2,1,3,F2);q(6,-3,1,4,F);q(9,-3,1,4,F2);q(12,-2,1,3,F);}}
 if(c.ears&&!U){const E=c.skin,E2=c.sk2;if(c.ears==='gob'){if(S_){q(5,4,2,2,E);q(3,3,2,1,E);q(2,2,1,1,E2);}else{q(2,5,2,1,E);q(1,4,2,1,E);q(0,3,1,1,E2);q(12,5,2,1,E);q(13,4,2,1,E);q(15,3,1,1,E2);}}
  else if(S_){q(5,4,1,2,E);q(4,3,1,1,E2);}else{q(3,5,1,2,E);q(2,4,1,1,E2);q(12,5,1,2,E);q(13,4,1,1,E2);}}
 if(c.ahoge){q(7,0,1,1,h);q(8,-1,1,1,h);q(9,-2,2,1,h);q(11,-1,1,1,h);}
 // the Good-looking Sunglasses from the Reputation Store (v0.96): "the large frame is the highlight of the square sunglasses"
 if(c.sg&&!U){const G='#141418',W='#6a7a9a';if(S_){q(9,6,3,2,G);q(6,6,3,1,G);q(10,6,1,1,W);}else{q(4,6,3,2,G);q(9,6,3,2,G);q(7,6,2,1,G);q(4,6,1,1,W);q(9,6,1,1,W);}}
 // more beards for the creator (owner 2026-10-23): goatee, stubble, moustache, chinstrap
 if(c.beard&&!U&&c.bst){const BD=c.beard,BS=mixC(c.skin,BD,.45),B=c.bst;
  if(B==='goatee'){if(S_){q(10,9,2,2,BD);q(10,8,2,1,BD);}else{q(6,8,1,1,BD);q(9,8,1,1,BD);q(7,9,2,2,BD);}}
  else if(B==='stubble'){if(S_)q(8,8,4,2,BS);else{q(5,8,2,2,BS);q(9,8,2,2,BS);q(7,9,2,1,BS);}}
  else if(B==='must'){if(S_)q(10,8,2,1,BD);else{q(6,8,4,1,BD);q(5,9,1,1,BD);q(10,9,1,1,BD);}}
  else if(B==='chin'){if(S_){q(8,6,1,4,BD);q(9,9,3,1,BD);}else{q(4,6,1,3,BD);q(11,6,1,3,BD);q(5,9,6,1,BD);}}}
 else if(c.beard&&!U){if(c.longBeard){if(S_){q(8,7,4,5,c.beard);q(9,12,3,3,c.beard);q(11,8,1,6,c.beard2);q(10,15,1,1,c.beard2);q(7,7,2,1,c.beard2);}else{q(4,7,8,2,c.beard);q(5,9,6,4,c.beard);q(6,13,4,2,c.beard);q(7,15,2,1,c.beard2);q(10,9,1,4,c.beard2);q(4,8,3,1,c.beard2);q(9,8,3,1,c.beard2);q(7,8,2,1,'#fff');}}
  else if(S_){q(8,7,4,5,c.beard);q(11,8,1,4,c.beard2);q(9,12,2,1,c.beard2);}else{q(4,7,8,2,c.beard);q(5,9,6,3,c.beard);q(6,12,4,1,c.beard);q(10,9,1,3,c.beard2);q(7,13,2,1,c.beard2);q(7,8,2,1,c.beard2);}}
 // reptile head: a snout, yellow eyes and a crest of scales
 if(c.rept){const sn=shade(c.skin,.12),E='#f2d23a';if(U){q(7,0,2,1,c.hl);q(7,3,2,1,c.hl);q(7,6,2,1,c.hl);}
  else if(S_){q(12,6,2,3,c.skin);q(13,8,1,1,c.sk2);q(12,9,2,1,c.sk2);if(!o.blink&&!o.hurt)q(10,6,1,1,E);q(7,0,2,1,c.hl);q(5,1,2,1,c.hl);}
  else{q(6,7,4,3,sn);q(7,8,1,1,c.sk2);q(8,8,1,1,c.sk2);q(6,10,4,1,c.sk2);if(!o.blink&&!o.hurt){q(6,6,1,1,E);q(9,6,1,1,E);}q(7,0,2,2,c.hl);q(5,1,1,1,c.hl);q(10,1,1,1,c.hl);}}
 // owner 2026-10-22: monsters whose look had nothing to do with their name
 // kobold: a dog's muzzle with a black nose, pointed ears and a short tail
 if(c.kob){const mz=shade(c.skin,.18),N='#1a1012',E='#ffcf4a';if(U){q(3,1,2,3,c.sk2);q(11,1,2,3,c.sk2);}
  else if(S_){q(11,6,4,3,mz);q(14,6,1,1,N);q(11,9,4,1,c.sk2);q(6,0,2,3,c.sk2);q(7,-1,1,1,c.sk2);if(!o.blink&&!o.hurt)q(10,6,1,1,E);}
  else{q(6,7,4,3,mz);q(7,7,2,1,N);q(6,10,4,1,c.sk2);q(3,0,2,4,c.sk2);q(11,0,2,4,c.sk2);q(3,-1,1,1,c.sk2);q(12,-1,1,1,c.sk2);if(!o.blink&&!o.hurt){q(6,6,1,1,E);q(9,6,1,1,E);}}}
 // skeleton: a skull with dark sockets and teeth, ribs and a spine over the torso, bony limbs
 if(c.bone){const K='#141018',BN=c.skin;if(!U){if(S_){q(9,5,3,3,K);q(10,6,1,1,'#ff4a3a');q(10,9,2,1,K);q(11,8,1,1,BN);q(7,12,4,1,BN);q(7,14,4,1,BN);q(6,11,1,5,BN);}
  else{q(5,5,2,3,K);q(9,5,2,3,K);q(6,6,1,1,'#ff4a3a');q(9,6,1,1,'#ff4a3a');q(7,8,2,1,K);q(5,9,6,1,K);q(6,9,1,1,BN);q(8,9,1,1,BN);q(10,9,1,1,BN);
   q(7,11,2,5,BN);q(5,12,6,1,BN);q(5,14,6,1,BN);q(6,13,1,1,K);q(9,13,1,1,K);}}else{q(7,11,2,5,BN);q(5,12,6,1,BN);q(5,14,6,1,BN);}}
 // half-draconian: horns, scaled cheeks and brow, slit yellow eyes (the tail comes from c.tail)
 if(c.drac){const HN='#e8dcc0',HD='#a89a80',SC=shade(c.skin,-.25),E='#ffd24a';
  if(U){q(4,0,1,2,HN);q(3,-1,1,1,HD);q(11,0,1,2,HN);q(12,-1,1,1,HD);q(6,3,1,1,SC);q(9,5,1,1,SC);}
  else if(S_){q(6,0,2,2,HN);q(5,-1,1,1,HD);q(4,-2,1,1,HD);q(8,4,1,1,SC);q(7,8,1,1,SC);q(9,8,1,1,SC);if(!o.blink&&!o.hurt){q(10,6,1,2,E);q(10,7,1,1,'#1a0a0a');}}
  else{q(4,0,1,2,HN);q(3,-1,1,1,HD);q(2,-2,1,1,HD);q(11,0,1,2,HN);q(12,-1,1,1,HD);q(13,-2,1,1,HD);q(4,7,1,1,SC);q(11,7,1,1,SC);q(5,9,1,1,SC);q(10,9,1,1,SC);q(7,4,2,1,SC);
   if(!o.blink&&!o.hurt){q(6,6,1,2,E);q(9,6,1,2,E);q(6,7,1,1,'#1a0a0a');q(9,7,1,1,'#1a0a0a');}}}
 // ogre and troll: tusks; a troll's big hooked nose
 if(c.nose&&!U){if(S_){q(12,6,2,2,c.skin);q(13,8,1,1,c.sk2);}else{q(7,6,2,3,shade(c.skin,.1));q(7,9,2,1,c.sk2);}}
 if(c.tusk&&!U){const T='#f0e8d0';if(S_)q(11,9,1,2,T);else{q(5,9,1,2,T);q(10,9,1,2,T);}}
 // masks and visors over the face
 if(c.mask&&!U){const K='#141018',GL=c.eye||'#ff3a2a';
  if(c.mask==='veil'){const M=c.maskC||'#1a1418';if(S_)q(8,7,4,3,M);else{q(4,7,8,3,M);q(4,7,8,1,shade(M,.18));}}
  else if(c.mask==='skull'){const BN=c.maskC||'#e4dccb';if(S_){q(8,4,4,6,BN);q(10,5,2,2,K);q(11,6,1,1,GL);q(9,8,3,1,K);q(10,8,1,1,BN);}
   else{q(5,4,6,6,BN);q(5,5,2,2,K);q(9,5,2,2,K);q(6,6,1,1,GL);q(9,6,1,1,GL);q(7,7,2,1,K);q(6,9,4,1,K);q(7,9,1,1,BN);q(5,4,6,1,shade(BN,.2));}}
  else if(c.mask==='iron'){const M=c.maskC||c.hc;if(S_){q(8,3,4,7,M);q(9,6,3,1,K);q(10,6,1,1,GL);q(11,8,1,1,shade(M,-.3));}
   else{q(4,3,8,7,M);q(5,6,6,1,K);q(6,6,1,1,GL);q(9,6,1,1,GL);q(7,8,2,1,shade(M,-.3));q(7,3,2,3,shade(M,.2));q(4,9,8,1,shade(M,-.2));}}}
 // horns over everything (demons, horned helms)
 if(c.horns){const Hn=c.horns,H2=shade(Hn,-.3);
  if(U){q(3,0,1,2,Hn);q(2,-1,1,2,Hn);q(12,0,1,2,Hn);q(13,-1,1,2,Hn);}
  else if(S_){q(6,0,2,2,Hn);q(5,-1,2,1,Hn);q(4,-2,2,1,H2);q(3,-2,1,1,H2);}
  else{q(3,1,2,1,Hn);q(2,0,1,1,Hn);q(1,-1,1,1,H2);q(1,-2,1,1,H2);q(11,1,2,1,Hn);q(13,0,1,1,Hn);q(14,-1,1,1,H2);q(14,-2,1,1,H2);}}
 // accessories (owner 2026-10-23 vanity): glasses, earrings, a flower, cat ears, a halo, a tiara, a scarf
 if(c.gls&&!U){const G=c.gls;if(S_){q(9,6,1,2,G);q(11,6,1,2,G);q(9,5,3,1,G);q(7,6,2,1,G);}else{q(5,5,3,1,G);q(8,5,3,1,G);q(5,6,1,2,G);q(7,6,2,1,G);q(10,6,1,2,G);}}
 if(c.ear&&!U){if(S_)q(7,8,1,1,c.ear);else{q(3,8,1,1,c.ear);q(12,8,1,1,c.ear);}}
 if(c.flw){const F=c.flw,F2=shade(F,.35);if(S_){q(5,1,2,2,F);q(5,1,1,1,F2);}else if(U){q(10,2,2,2,F);q(10,2,1,1,F2);}else{q(10,1,2,2,F);q(11,1,1,1,F2);q(12,2,1,1,'#5aa04a');}}
 if(c.catE){const K=c.catE,P='#e88aa0';if(S_){q(6,-1,2,2,K);q(8,0,1,1,K);q(7,0,1,1,P);}else{q(4,-1,2,2,K);q(10,-1,2,2,K);q(3,0,1,1,K);q(12,0,1,1,K);if(!U){q(4,0,1,1,P);q(11,0,1,1,P);}}}
 if(c.tiara&&!U){const T=c.tiara;if(S_){q(7,1,4,1,T);q(9,0,1,1,T);}else{q(5,1,6,1,T);q(7,0,2,1,T);q(7,0,1,1,'#ff6a8a');}}
 if(c.halo){const HA=c.halo;if(S_)q(6,-2,5,1,HA);else{q(5,-2,6,1,HA);q(4,-1,1,1,shade(HA,-.2));q(11,-1,1,1,shade(HA,-.2));}}
 if(c.scarf){const SF=c.scarf,S2=shade(SF,-.25);if(S_){q(6,10,5,2,SF);q(5,11,2,3,S2);}else if(U){q(4,10,8,2,SF);q(9,12,2,3,S2);}else{q(4,10,8,2,SF);q(10,12,2,3,S2);q(4,11,8,1,S2);}}
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

A.chars={FW,FH,POSES,COLS,ROWS,TIMING,frame,buildSheet,rect,poseOf,shade,mixC,HAIRP};
})(typeof window!=='undefined'?window:globalThis);
