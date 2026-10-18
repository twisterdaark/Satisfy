// SNAPSHOT (PER_CODE) of index.html @ ce297728037e368fbfc5a9dce3e5d3eaefd3e17a. Do not edit here; Claude-A owns the runtime copy.
(function(root){const A=root.SatArt=root.SatArt||{};const {OUT,EYE}=A;
const R=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function mk(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');fn(g);return c;}
function figure(c,dir,fr){return mk(16,24,g=>{g.translate(0,2);
 const p=(x,y,w,h,col)=>R(g,x,y,w,h,col),S_=dir==='s',U=dir==='u';
 const lg=c.shorts?c.skin:c.pants;
 // legs
 if(S_){if(fr){p(5,17,2,3,lg);p(9,17,2,3,lg);p(4,20,3,2,c.boots);p(9,20,3,2,c.boots);}else{p(6,17,4,3,lg);p(6,20,4,2,c.boots);p(8,18,1,2,OUT);}}
 else{const a=fr?1:0;p(5,17,2,3-a,lg);p(9,17,2,3,lg);p(5,20-a,2,2,c.boots);p(9,20,2,2,c.boots);}
 if(c.shorts){if(S_)p(5,17,6,1,c.shorts);else p(4,17,8,1,c.shorts);}
 if(c.robe){if(S_){p(5,16,6,4,c.top);p(10,16,1,4,c.top2);}else{p(4,16,8,4,c.top);p(11,16,1,4,c.top2);p(4,19,8,1,c.top2);}}
 // cape behind
 if(c.cape&&!U){if(S_)p(4,11,2,8,c.cape);else{p(3,11,10,1,c.cape);p(3,12,1,6,c.cape);p(12,12,1,6,c.cape);}}
 // torso
 if(S_){p(5,11,6,6,c.top);p(10,11,1,6,c.top2);}else{p(4,11,8,6,c.top);p(11,11,1,6,c.top2);}
 if(c.chest&&!U){if(S_)p(5,11,4,4,c.chest);else{p(5,11,6,4,c.chest);p(10,11,1,4,c.pad2);p(5,13,6,1,c.pad2);}}
 p(S_?5:4,16,S_?6:8,1,c.belt||c.boots);
 if(c.cape&&U)p(4,11,8,8,c.cape);
 // apron
 if(c.apron){if(U){p(5,11,1,5,c.apron2);p(10,11,1,5,c.apron2);p(5,15,6,1,c.apron2);}
  else if(S_){p(8,12,3,7,c.apron);p(10,12,1,7,c.apron2);p(8,11,1,1,c.apron2);}
  else{p(5,12,6,7,c.apron);p(10,12,1,7,c.apron2);p(5,11,1,1,c.apron2);p(10,11,1,1,c.apron2);p(6,15,4,1,c.apron2);}}
 // arms
 const arm=c.armC||(c.sleeves?c.top:c.skin),arm2=c.armC2||(c.sleeves?c.top2:c.sk2);
 if(S_){const o=fr?1:-1;p(7+o,11,2,4,arm);p(7+o,15,2,2,c.skin);p(8+o,11,1,4,arm2);}
 else{const o=fr?1:0;p(3,11+o,1,4,arm);p(3,15+o,1,2,c.skin);p(12,11-o+1,1,4,arm2);p(12,15-o+1,1,2,c.skin);if(!c.sleeves){p(3,12+o,1,1,c.sk2);}}
 // shoulder pads
 if(c.pad){if(S_){p(6,10,4,2,c.pad);p(6,11,4,1,c.pad2);}else{p(2,10,3,2,c.pad);p(11,10,3,2,c.pad);p(2,11,3,1,c.pad2);p(11,11,3,1,c.pad2);}}
 // head + neck
 p(6,10,4,1,c.sk2);
 if(c.collar&&!U){if(S_)p(7,10,3,1,c.collar);else{p(5,10,6,1,c.collar);p(5,11,1,1,c.collar);p(10,11,1,1,c.collar);}}
 if(S_){p(5,2,7,8,c.skin);p(12,7,1,1,c.skin);p(5,9,7,1,c.sk2);}else{p(4,2,8,8,c.skin);p(11,3,1,7,c.sk2);p(5,9,6,1,c.sk2);}
 // face
 if(!U){if(S_){p(10,6,1,2,EYE);p(9,5,2,1,c.hc);p(7,6,1,2,c.sk2);}
  else{p(6,6,1,2,EYE);p(9,6,1,2,EYE);p(5,5,2,1,c.hair==='bald'&&c.beard2?c.beard2:c.hc);p(9,5,2,1,c.hair==='bald'&&c.beard2?c.beard2:c.hc);p(7,8,2,1,c.sk2);}}
 // hair
 const h=c.hc,hl=c.hl;
 if(c.hair==='spiky'){
  if(U){p(4,1,8,9,h);p(5,0,1,1,h);p(7,0,1,1,h);p(10,0,1,1,h);p(3,3,1,3,h);p(12,3,1,3,h);p(5,10,1,1,h);p(8,10,1,1,h);p(10,10,1,1,h);p(6,2,1,2,hl);p(9,3,1,2,hl);}
  else if(S_){p(5,1,7,4,h);p(7,0,1,1,h);p(9,0,2,1,h);p(4,2,1,2,h);p(3,3,1,1,h);p(5,5,3,4,h);p(4,5,1,2,h);p(4,8,1,1,h);p(10,5,2,1,h);p(8,5,1,1,h);p(12,4,1,1,h);p(7,2,2,1,hl);}
  else{p(4,1,8,4,h);p(4,0,1,1,h);p(6,0,1,1,h);p(9,0,1,1,h);p(11,0,1,1,h);p(3,2,1,3,h);p(12,2,1,3,h);p(2,3,1,1,h);p(13,3,1,1,h);p(4,5,2,1,h);p(7,5,2,1,h);p(10,5,2,1,h);p(6,6,1,1,h);p(4,6,1,3,h);p(11,6,1,3,h);p(6,2,1,1,hl);p(7,3,2,1,hl);p(10,2,1,1,hl);}}
 else if(c.hair==='long'){
  if(U){p(3,1,10,12,h);p(4,0,8,1,h);p(2,4,1,7,h);p(13,4,1,7,h);p(5,2,1,3,hl);p(9,3,1,4,hl);p(4,13,2,1,h);p(9,13,3,1,h);p(2,11,1,2,h);}
  else if(S_){p(5,1,7,3,h);p(6,0,5,1,h);p(4,2,1,9,h);p(5,4,3,8,h);p(3,4,1,6,h);p(11,3,1,2,h);p(6,2,3,1,hl);p(4,11,2,1,h);p(2,6,1,3,h);}
  else{p(4,1,8,3,h);p(5,0,6,1,h);p(3,2,1,9,h);p(12,2,1,9,h);p(2,4,1,6,h);p(13,4,1,7,h);p(4,4,2,1,h);p(7,4,1,1,h);p(10,4,2,1,h);p(6,1,2,1,hl);p(9,2,2,1,hl);p(1,6,1,3,h);p(14,7,1,2,h);p(2,10,1,2,h);p(13,11,1,1,h);}}
 else if(c.hair==='bald'){p(6,2,2,1,hl);p(5,3,1,1,hl);
  if(U){p(4,7,8,3,h);p(4,6,1,1,h);p(11,6,1,1,h);}else if(S_){p(5,6,2,3,h);}else{p(4,6,1,3,h);p(11,6,1,3,h);}}
 else if(c.hair==='short'){if(U)p(4,1,8,8,h);else if(S_){p(5,1,7,3,h);p(5,4,3,4,h);p(10,4,2,1,h);}else{p(4,1,8,3,h);p(4,4,1,3,h);p(11,4,1,3,h);p(5,4,3,1,h);p(9,4,2,1,h);}p(7,2,2,1,hl);}
 else if(c.hair==='pony'){if(U){p(4,1,8,8,h);p(7,9,2,5,h);p(7,9,2,1,hl);}else if(S_){p(5,1,7,3,h);p(5,4,3,3,h);p(10,4,2,1,h);p(2,4,3,2,h);p(2,6,2,4,h);}else{p(4,1,8,3,h);p(4,4,1,3,h);p(11,4,1,3,h);p(5,4,3,1,h);p(9,4,2,1,h);p(12,5,1,4,h);p(13,6,1,3,h);}p(7,2,2,1,hl);}
 else if(c.hair==='cap'){p(4,4,1,3,h);p(11,4,1,3,h);p(3,0,10,3,c.cap);p(4,3,8,1,'#d8d2c4');p(5,0,6,1,'#ffffff');if(U)p(4,4,8,4,h);}
 else if(c.hair==='hat'){p(4,4,1,3,h);p(11,4,1,3,h);if(U)p(4,4,8,4,h);p(2,3,12,1,c.hat);p(5,0,6,3,c.hat);p(5,2,6,1,'#7a2a1a');}
 else if(c.hair==='helm'){if(U)p(4,1,8,9,h);else if(S_){p(5,1,7,6,h);p(4,3,1,4,h);p(9,5,3,1,'#22252c');}else{p(4,1,8,5,h);p(3,3,1,5,h);p(12,3,1,5,h);p(5,5,6,1,'#22252c');p(7,1,2,4,hl);}p(7,-1,2,2,'#8a1f2a');}
 if(c.ahoge){p(7,0,1,1,h);p(8,-1,1,1,h);p(9,-2,2,1,h);p(11,-1,1,1,h);}
 // beard
 if(c.beard&&!U){if(c.longBeard){if(S_){p(8,7,4,5,c.beard);p(9,12,3,3,c.beard);p(11,8,1,6,c.beard2);p(10,15,1,1,c.beard2);p(7,7,2,1,c.beard2);}else{p(4,7,8,2,c.beard);p(5,9,6,4,c.beard);p(6,13,4,2,c.beard);p(7,15,2,1,c.beard2);p(10,9,1,4,c.beard2);p(4,8,3,1,c.beard2);p(9,8,3,1,c.beard2);p(7,8,2,1,'#fff');}}
  else if(S_){p(8,7,4,5,c.beard);p(11,8,1,4,c.beard2);p(9,12,2,1,c.beard2);}else{p(4,7,8,2,c.beard);p(5,9,6,3,c.beard);p(6,12,4,1,c.beard);p(10,9,1,3,c.beard2);p(7,13,2,1,c.beard2);p(7,8,2,1,c.beard2);}}
 // auto outline
 g.setTransform(1,0,0,1,0,0);
 const id=g.getImageData(0,0,16,24),d=id.data,a=(x,y)=>x>=0&&y>=0&&x<16&&y<24&&d[(y*16+x)*4+3]>0,o=[];
 for(let y=0;y<24;y++)for(let x=0;x<16;x++)if(!a(x,y)&&(a(x-1,y)||a(x+1,y)||a(x,y-1)||a(x,y+1)))o.push([x,y]);
 o.forEach(([x,y])=>R(g,x,y,1,1,OUT));});}
A.legacyFigure=figure;
})(typeof window!=='undefined'?window:globalThis);
