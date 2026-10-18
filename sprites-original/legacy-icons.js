// PER_CODE snapshot of iconC (item icons) from index.html @ 1899cdb, with WSH. Used only by preview.html.
(function(root){'use strict';const A=root.SatArt=root.SatArt||{};
const R=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function blob(g,cx,cy,rx,ry,col){g.fillStyle=col;for(let yy=-ry;yy<=ry;yy++){const hw=Math.round(rx*Math.sqrt(Math.max(0,1-(yy*yy)/(ry*ry))));g.fillRect(Math.round(cx-hw),Math.round(cy+yy),hw*2,1);}}
const WSH={rusty:{l:6,c:'#9b8b78',k:'sword'},isword:{l:8,c:'#d4d8e0',k:'sword'},gsword:{l:11,c:'#6ab0ff',w:1,k:'sword'},bow:{l:10,c:'#8a5a32',k:'bow'},staff:{l:12,c:'#7a5634',k:'staff'},hammer:{l:7,c:'#9aa0aa',k:'hammer'},ssword:{l:10,c:'#e8eef6',k:'sword'},sbow:{l:10,c:'#5a3a22',k:'bow'},sstaff:{l:12,c:'#3e2a5a',k:'staff'},shammer:{l:7,c:'#c8ccd6',k:'hammer'}};
const mk=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');f(g);return c;};
const ICC={};
function iconC(k){if(ICC[k])return ICC[k];const c=mk(16,16,g=>{const p=(x,y,w,h,c)=>R(g,x,y,w,h,c);
 if(k==='bread'){blob(g,8,9,6,4,'#8a4a1a');blob(g,8,8,6,3,'#c8803a');p(4,7,2,1,'#e8b070');p(7,6,2,1,'#e8b070');p(10,7,2,1,'#e8b070');}
 else if(k==='wood'){p(2,5,11,7,'#7a4e2c');p(2,5,11,1,'#a06a3a');p(2,11,11,1,'#5a3418');blob(g,13,8,2,3,'#c49a62');p(13,8,1,1,'#8a5a32');p(5,8,4,1,'#5a3418');}
 else if(k==='ore'){blob(g,8,9,6,5,'#55504c');blob(g,8,8,5,4,'#7f7a76');p(5,7,2,2,'#c8743a');p(9,9,2,2,'#d9894a');p(8,5,2,1,'#9a958f');}
 else if(k==='leather'){p(3,3,10,10,'#8a5a3a');p(2,5,1,6,'#8a5a3a');p(13,5,1,6,'#8a5a3a');p(5,1,6,2,'#8a5a3a');p(6,13,4,2,'#8a5a3a');p(4,4,8,1,'#a8744a');p(5,8,6,1,'#6a4228');}
 else if(k==='blue'){p(7,1,2,14,'#3a7ad8');p(5,4,6,8,'#4a90ff');p(6,3,4,10,'#5aa2ff');p(7,4,1,6,'#bfe0ff');p(4,6,1,4,'#2a5ab0');p(11,6,1,4,'#2a5ab0');}
 else if(k==='arrows'||k==='jaffa'){for(let i=0;i<3;i++){const o=i*2-2;for(let j=0;j<10;j++)p(3+j+o,12-j+o,1,1,'#a0703a');p(12+o,2+o,2,2,'#c8c8d0');p(2+o,12+o,2,2,'#e8e8e8');}}
 else if(k==='book'){p(3,2,10,12,'#7a2a26');p(4,2,9,1,'#a03a34');p(3,2,1,12,'#4a1a18');p(12,3,1,10,'#e8dcc0');p(6,6,4,1,'#f2c14e');p(6,8,4,1,'#f2c14e');}
 else if(k==='larmor'||k==='warmor'||k==='parmor'){const a=k==='larmor'?['#8a5a32','#a8743f','#5a3a20']:k==='parmor'?['#9aa4b4','#c8d0dc','#5a6474']:['#dfe2ea','#f2f4f8','#7a3a2c'];p(4,3,8,10,a[0]);p(2,3,3,4,a[1]);p(11,3,3,4,a[1]);p(6,3,4,2,'#2a1a10');p(4,9,8,1,a[2]);p(7,5,1,7,a[2]);}
 else if(k==='slotW'||k==='slotA'||k==='slotH'||k==='slotG'||k==='slotB'||k==='slotX'){g.globalAlpha=.25;const c='#bfe0ff';if(k==='slotW'){for(let i=0;i<8;i++)p(5+i,10-i,1,1,c);p(3,10,1,1,c);p(4,11,1,1,c);p(5,12,1,1,c);p(3,12,1,1,c);}else if(k==='slotA'){p(4,3,8,10,c);p(2,3,3,4,c);p(11,3,3,4,c);}else if(k==='slotH'){p(4,4,8,7,c);p(3,8,10,2,c);}else if(k==='slotG'){p(4,5,7,8,c);p(11,7,2,3,c);}else if(k==='slotB'){p(5,3,4,9,c);p(5,10,8,3,c);}else{p(6,3,4,4,c);p(7,7,2,6,c);}}
 else if(k==='bow'||k==='sbow'){for(let i=0;i<10;i++){const a=i/9*Math.PI;p(Math.round(9-Math.sin(a)*5),3+i,1,1,'#8a5a32');}p(9,3,1,11,'#e8e0d0');p(3,8,8,1,'#c8c8d0');p(2,7,2,3,'#e8e8e8');}
 else if(k==='staff'||k==='sstaff'){for(let i=0;i<10;i++)p(4+i,13-i,1,1,'#7a5634');blob(g,12,4,3,3,'#3a7ad8');p(11,3,2,2,'#bfe8ff');}
 else if(k==='hammer'||k==='shammer'){for(let i=0;i<8;i++)p(3+i,13-i,1,1,'#7a5634');p(8,2,6,5,'#9aa0aa');p(8,2,6,1,'#d0d4dc');p(13,3,1,4,'#6a707a');}
 else if(k==='mstone'){blob(g,8,8,4,6,'#2a5ab0');blob(g,8,7,3,5,'#4a90ff');p(7,4,1,4,'#bfe8ff');}
 else{const s=WSH[k]||WSH.rusty;for(let i=0;i<9;i++){p(5+i,10-i,1,1,s.c);if(s.w)p(6+i,10-i,1,1,'#3a7ad8');}p(13,2,1,1,'#fff');p(3,10,1,1,'#7a5634');p(4,11,1,1,'#7a5634');p(5,12,1,1,'#7a5634');p(6,11,1,1,'#7a5634');p(3,12,1,1,'#4a3020');p(2,13,1,1,'#4a3020');p(1,14,1,1,'#c8a050');}
 });ICC[k]=c;return c;}
A.legacyIcon=iconC;A.legacyIcon.WSH=WSH;
})(typeof window!=='undefined'?window:globalThis);
