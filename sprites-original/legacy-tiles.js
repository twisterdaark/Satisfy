// PER_CODE snapshot of the terrain painter in index.html @ 1899cdb (drawTile, grassTile, treeTrunk, treeCanopy).
// Used only by preview.html for the old/new comparison. A test checks the tile ids still match index.html.
(function(root){'use strict';const A=root.SatArt=root.SatArt||{};
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const R=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const GR=0,FL=1,PA=2,TR=3,WA=4,CF=5,CW=6,BL=7,WL=8,SN=9,DR=10,RK=11,FW=12,IW=13,PL=14;
A.legacyTiles=function(env){const {gg,og,at,snowAt,WMH,TS}=env;
function blob(g,cx,cy,rx,ry,col){g.fillStyle=col;for(let yy=-ry;yy<=ry;yy++){const hw=Math.round(rx*Math.sqrt(Math.max(0,1-(yy*yy)/(ry*ry))));g.fillRect(Math.round(cx-hw),Math.round(cy+yy),hw*2,1);}}
function grassTile(g,px,py,r,flower){R(g,px,py,16,16,'#4b8b3f');for(let i=0;i<12;i++)R(g,px+(r()*16|0),py+(r()*16|0),1,1,r()<.5?'#5a9d4a':'#3f7a36');if(r()<.3){const a=r()*13|0,b=r()*12|0;R(g,px+a,py+b,1,2,'#64ab53');R(g,px+a+2,py+b+1,1,2,'#64ab53');R(g,px+a+1,py+b-1,1,3,'#6fb85d');}
 if(flower){const cols=['#f2e36b','#f28bb0','#ffffff','#9ec8ff'];for(let i=0;i<2;i++){const a=2+(r()*11|0),b=2+(r()*11|0),c=cols[r()*4|0];R(g,px+a-1,py+b,3,1,c);R(g,px+a,py+b-1,1,3,c);R(g,px+a,py+b,1,1,'#e0a020');}}}
function treeTrunk(gg,px,py){R(gg,px+1,py+11,14,4,'rgba(0,0,0,.25)');R(gg,px+6,py+5,4,10,'#6b4428');R(gg,px+6,py+5,1,10,'#835634');R(gg,px+9,py+5,1,10,'#4e3018');R(gg,px+4,py+14,2,1,'#4e3018');R(gg,px+10,py+14,2,1,'#4e3018');
  }
function treeCanopy(og,px,py,r){const cx=px+8,cy=py-1,s=r()<.5?0:1;blob(og,cx,cy+1,11+s,10,'#1c4421');blob(og,cx,cy,10+s,9,'#2f6b34');blob(og,cx-2,cy-2,7,6,'#3f8a44');blob(og,cx-3,cy-4,4,3,'#58a65a');for(let i=0;i<8;i++)R(og,cx-8+(r()*16|0),cy-6+(r()*13|0),1,1,'#24562a');for(let i=0;i<4;i++)R(og,cx-6+(r()*10|0),cy-6+(r()*7|0),1,1,'#7cc672');}
function drawTile(x,y){
 const px=x*TS,py=y*TS,r=mulberry32(x*73856093^y*19349663);
 let v=at(x,y);
 const isG=k=>{const q=at(x+k[0],y+k[1]);return q===GR||q===FL||q===TR||q===SN;};
 const snowy=snowAt(x,y);
 if(v===GR||v===FL||((v===TR||v===BL)&&!snowy&&y<WMH))grassTile(gg,px,py,r,v===FL);
 if(v===SN||((v===TR||v===BL)&&snowy)){R(gg,px,py,16,16,'#e6eef7');for(let i=0;i<10;i++)R(gg,px+(r()*16|0),py+(r()*16|0),1,1,r()<.5?'#cfdbe8':'#ffffff');if(r()<.25)R(gg,px+(r()*13|0),py+(r()*14|0),3,1,'#c2d0e0');}
 if(v===DR){R(gg,px,py,16,16,'#b98d5e');for(let i=0;i<12;i++)R(gg,px+(r()*16|0),py+(r()*16|0),1,1,r()<.5?'#a67a4c':'#c99f70');if(r()<.2)R(gg,px+(r()*12|0),py+(r()*13|0),2,2,'#8f6a44');}
 if(v===RK){R(gg,px,py,16,16,'#7a5a40');for(let i=0;i<8;i++)R(gg,px+(r()*14|0),py+(r()*14|0),3,2,r()<.5?'#6a4c34':'#8c6a4c');if(at(x,y-1)!==RK)R(gg,px,py,16,3,'#9c7a58');if(at(x,y+1)!==RK){R(gg,px,py+12,16,4,'#4e3826');R(og,px,py-6,16,6,'#8c6a4c');R(og,px,py-6,16,2,'#a8865f');}}
 if(v===BL&&y>=WMH)v=FW;
 if(v===FW){R(gg,px,py,16,16,'#a0703e');for(let yy=0;yy<16;yy+=4){R(gg,px,py+yy,16,1,'#7e5530');R(gg,px+((x*7+yy*3)%16),py+yy,1,4,'#7e5530');}if(r()<.3)R(gg,px+(r()*13|0),py+(r()*13|0),2,1,'#b8864e');}
 if(v===IW){R(gg,px,py,16,16,'#5e3e26');const top=at(x,y+1)!==IW&&at(x,y+1)!==CW;if(top){R(gg,px,py,16,16,'#c9a46b');for(let yy=2;yy<16;yy+=4)R(gg,px,py+yy,16,1,'#b08a56');R(gg,px,py+13,16,3,'#6b4428');}else{R(gg,px,py,16,2,'#7a5634');}}
 if(v===PL){R(gg,px,py,16,16,'#6a8a3a');const vert=at(x,y-1)===PL||at(x,y+1)===PL,hor=at(x-1,y)===PL||at(x+1,y)===PL;
  if(hor||!vert){for(let xx=0;xx<16;xx+=4){R(og,px+xx,py-6,3,18,'#7a5230');R(og,px+xx,py-6,1,18,'#9a6e44');R(og,px+xx+1,py-8,1,2,'#7a5230');}R(og,px,py+1,16,2,'#5a3a20');R(og,px,py+7,16,2,'#5a3a20');}
  else{R(gg,px+5,py,6,16,'#5a3a20');R(og,px+5,py-6,6,22,'#7a5230');R(og,px+5,py-6,2,22,'#9a6e44');R(og,px+7,py-8,2,2,'#7a5230');}}
 if(v===WL){R(gg,px,py,16,16,'#8a8580');for(let yy=0;yy<16;yy+=4){R(gg,px,py+yy,16,1,'#6a6560');for(let xx=(yy/4)%2?0:4;xx<16;xx+=8)R(gg,px+xx,py+yy,1,4,'#6a6560');}R(gg,px,py,16,2,'#aaa59e');if(at(x,y+1)!==WL)R(gg,px,py+14,16,2,'#4a4642');if(at(x,y-1)!==WL){R(og,px,py-5,16,5,'#9a958e');for(let xx=0;xx<16;xx+=6)R(og,px+xx+1,py-8,4,3,'#9a958e');R(og,px,py-5,16,1,'#bdb8b0');}}
 if(v===PA){R(gg,px,py,16,16,'#b38c5a');for(let i=0;i<14;i++)R(gg,px+(r()*16|0),py+(r()*16|0),1,1,r()<.5?'#9e7848':'#c49d6a');if(r()<.3)R(gg,px+(r()*13|0),py+(r()*13|0),3,2,'#8f8478');
  [[0,-1],[0,1],[-1,0],[1,0]].forEach(k=>{if(isG(k)){for(let i=0;i<16;i++){const d=r()<.55?1:(r()<.5?2:0);if(!d)continue;const c=snowAt(x+k[0],y+k[1])?(r()<.5?'#e6eef7':'#cfdbe8'):r()<.5?'#4b8b3f':'#5a9d4a';if(k[1]===-1)R(gg,px+i,py,1,d,c);if(k[1]===1)R(gg,px+i,py+16-d,1,d,c);if(k[0]===-1)R(gg,px,py+i,d,1,c);if(k[0]===1)R(gg,px+16-d,py+i,d,1,c);}}});}
 if(v===WA){R(gg,px,py,16,16,'#3b74b4');for(let i=0;i<3;i++){const a=r()*11|0,b=r()*15|0;R(gg,px+a,py+b,4,1,'#6aa4e0');}
  [[0,-1],[0,1],[-1,0],[1,0]].forEach(k=>{if(at(x+k[0],y+k[1])!==WA){const c1='#d8c088',c2='#2d5f98';if(k[1]===-1){R(gg,px,py,16,2,c1);R(gg,px,py+2,16,1,c2);}if(k[1]===1){R(gg,px,py+14,16,2,c1);}if(k[0]===-1){R(gg,px,py,2,16,c1);R(gg,px+2,py,1,16,c2);}if(k[0]===1){R(gg,px+14,py,2,16,c1);}}});}
 if(v===CF){R(gg,px,py,16,16,'#3b3542');for(let i=0;i<14;i++)R(gg,px+(r()*16|0),py+(r()*16|0),1,1,r()<.5?'#2f2a36':'#4a4352');if(r()<.2)R(gg,px+(r()*12|0),py+(r()*12|0),3,2,'#504858');}
 if(v===CW){R(gg,px,py,16,16,'#17141d');for(let i=0;i<6;i++)R(gg,px+(r()*16|0),py+(r()*16|0),2,1,'#211d29');
  if(at(x,y+1)===CF){R(gg,px,py+6,16,10,'#463f50');R(gg,px,py+6,16,2,'#5e566a');for(let i=0;i<4;i++)R(gg,px+(r()*14|0),py+9+(r()*5|0),2,1,'#332d3b');R(gg,px+(r()*12|0),py+8,1,6,'#2a2531');}}
 if(v===TR&&env.tree)env.tree(x,y,r);
}
return {drawTile,treeTrunk,treeCanopy,blob};};
A.legacyTiles.IDS={GR,FL,PA,TR,WA,CF,CW,BL,WL,SN,DR,RK,FW,IW,PL};A.legacyTiles.mulberry32=mulberry32;
})(typeof window!=='undefined'?window:globalThis);
