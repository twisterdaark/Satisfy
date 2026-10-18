// PER_CODE snapshot of drawBuilding, the world props (anvils, wells, board, tents, grave) and room props from index.html @ 1899cdb.
// Used only by preview.html for the old/new comparison. A test checks drawBuilding has not drifted.
(function(root){'use strict';const A=root.SatArt=root.SatArt||{};
const R=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
A.legacyBuildings=function(env){const {gg,og,TS}=env;
function blob(g,cx,cy,rx,ry,col){g.fillStyle=col;for(let yy=-ry;yy<=ry;yy++){const hw=Math.round(rx*Math.sqrt(Math.max(0,1-(yy*yy)/(ry*ry))));g.fillRect(Math.round(cx-hw),Math.round(cy+yy),hw*2,1);}}
function drawBuilding(b){
 const px=b.x*TS,py=b.y*TS,w=b.w*TS,h=b.h*TS,wy=py+30,forge=b.k==='forge';
 R(gg,px-1,py+h-2,w+2,4,'rgba(0,0,0,.25)');
 if(forge){R(gg,px,wy,w,h-30,'#7c7772');for(let yy=wy;yy<py+h;yy+=5){R(gg,px,yy,w,1,'#625d58');for(let xx=px+((yy/5)%2?0:5);xx<px+w;xx+=10)R(gg,xx,yy,1,5,'#625d58');}
  R(gg,px+10,wy+12,22,18,'#2a1510');R(gg,px+8,wy+10,26,3,'#4a4542');
  R(gg,px+w-26,wy+16,12,h-46,'#4a3020');R(gg,px+w-25,wy+17,10,h-47,'#5e3e28');R(gg,px+w-17,wy+28,2,2,'#c8a050');
  R(gg,px+w/2-6,wy+2,12,9,'#5e3e28');R(gg,px+w/2-5,wy+3,10,7,'#c8a050');R(gg,px+w/2-3,wy+4,6,2,'#3a3a40');R(gg,px+w/2-1,wy+6,2,3,'#6b4428');}
 else{R(gg,px,wy,w,h-30,'#c9a46b');for(let yy=wy+4;yy<py+h;yy+=4)R(gg,px,yy,w,1,'#b08a56');R(gg,px,wy,3,h-30,'#6b4428');R(gg,px+w-3,wy,3,h-30,'#6b4428');R(gg,px,wy,w,2,'#6b4428');R(gg,px+w/2-1,wy,2,h-30,'#6b4428');
  const dx=px+w/2-6;R(gg,dx-1,py+h-17,14,17,'#4e3018');R(gg,dx,py+h-16,12,16,'#7a4e2c');R(gg,dx+9,py+h-8,2,2,'#e0c060');
  [[px+8],[px+w-20]].forEach(([wx])=>{R(gg,wx-1,wy+7,13,11,'#4e3018');R(gg,wx,wy+8,11,9,'#7fb0e0');R(gg,wx,wy+8,11,3,'#a8d0f4');R(gg,wx+5,wy+8,1,9,'#4e3018');R(gg,wx-2,wy+17,15,2,'#8a6a3f');});}
 const rc=forge?['#4a4f5c','#3a3e4a','#5c6272']:({hall:['#3a4a6a','#2a3850','#52648a'],lodge:['#3f6a3a','#2c4e28','#5a8a52'],tower:['#5a3a7a','#3e2658','#7a58a0'],shop:['#b8862a','#8a6418','#d8a848'],armory:['#5a6474','#3e4654','#7a8698'],inn:['#a85a2a','#7e3e18','#c8784a']}[b.k]||['#a8443a','#8c3530','#c05a48']);
 if(!forge&&b.k!=='house'){const sx=px+w/2-6,sy=wy+3;R(gg,sx-1,sy-1,14,12,'#3e2616');R(gg,sx,sy,12,10,'#7a5634');const e='#f2e6c8';if(b.k==='hall'){R(gg,sx+5,sy+1,2,7,e);R(gg,sx+3,sy+6,6,1,e);}else if(b.k==='lodge'){for(let i=0;i<8;i++)R(gg,sx+3+Math.round(Math.sin(i/7*Math.PI)*3),sy+1+i,1,1,e);R(gg,sx+3,sy+1,1,8,e);}else if(b.k==='tower'){R(gg,sx+5,sy+1,2,8,e);R(gg,sx+2,sy+4,8,2,e);R(gg,sx+4,sy+3,4,4,'#bfe8ff');}else if(b.k==='armory'){R(gg,sx+3,sy+1,1,7,e);R(gg,sx+2,sy+6,3,1,e);R(gg,sx+6,sy+2,4,5,'#c8ccd6');R(gg,sx+7,sy+7,2,1,'#c8ccd6');}else if(b.k==='inn'){R(gg,sx+3,sy+3,5,6,'#e8c070');R(gg,sx+3,sy+2,5,2,'#ffffff');R(gg,sx+8,sy+4,2,3,'#e8c070');}else{blob(gg,sx+6,sy+5,3,3,'#f2c14e');R(gg,sx+5,sy+4,2,2,'#fff3b0');}}
 for(let i=0;i<9;i++){const yy=py-4+i*4,inset=Math.max(0,8-i*2);R(og,px-4+inset,yy,w+8-inset*2,4,i%2?rc[0]:rc[1]);for(let xx=px-4+inset+(i%2?3:0);xx<px+w+4-inset;xx+=6)R(og,xx,yy,1,4,rc[1]);R(og,px-4+inset,yy,w+8-inset*2,1,rc[2]);}
 R(og,px-4,py+32,w+8,2,'#2a1d18');
 if(forge){R(og,px+w-22,py-14,12,18,'#5c5652');R(og,px+w-24,py-16,16,4,'#6e6864');for(let yy=py-12;yy<py+4;yy+=4)R(og,px+w-22,yy,12,1,'#4a4542');}
}
function drawWorld(ANVILS,WELLS,BOARD,TENTS,GRAVE,PROPS){
ANVILS.forEach(A=>{const px=A.tx*TS,py=A.ty*TS;R(gg,px+1,py+12,14,3,'rgba(0,0,0,.3)');R(gg,px+5,py+8,6,6,'#2e2e35');R(gg,px+2,py+12,12,3,'#26262c');R(gg,px,py+3,16,5,'#3c3c44');R(gg,px-2,py+3,4,3,'#3c3c44');R(gg,px,py+3,16,1,'#6a6a78');R(gg,px+2,py,4,3,'#7a5634');R(gg,px+3,py-2,6,3,'#8a8f99');});
WELLS.forEach(WELL=>{
const wx=WELL.tx*TS,wy=WELL.ty*TS;R(gg,wx+1,wy+4,14,11,'#7d7d84');R(gg,wx+1,wy+4,14,2,'#9a9aa2');R(gg,wx+3,wy+6,10,6,'#203a60');R(gg,wx+4,wy+7,4,1,'#4a78b0');R(og,wx,wy-8,2,12,'#6b4428');R(og,wx+14,wy-8,2,12,'#6b4428');R(og,wx-1,wy-10,18,3,'#8c3530');R(og,wx-1,wy-10,18,1,'#c05a48');});
(()=>{const bx=BOARD.tx*TS,by=BOARD.ty*TS;R(gg,bx+2,by+13,12,3,'rgba(0,0,0,.3)');R(gg,bx+2,by+6,2,10,'#5e3e28');R(gg,bx+12,by+6,2,10,'#5e3e28');R(og,bx,by-4,16,12,'#7a5634');R(og,bx,by-4,16,1,'#a07a4a');R(og,bx+2,by-2,5,6,'#f2e6c8');R(og,bx+9,by-2,5,4,'#f2e6c8');R(og,bx+9,by+3,4,3,'#e8d8b0');R(og,bx+3,by,3,1,'#8a7a5a');R(og,bx+10,by,3,1,'#8a7a5a');R(og,bx+4,by-3,1,1,'#c0392b');R(og,bx+11,by-3,1,1,'#c0392b');
 TENTS.forEach(([x,y])=>{const px=x*TS,py=y*TS;R(gg,px,py+13,32,3,'rgba(0,0,0,.3)');for(let i=0;i<16;i++){R(og,px+16-i-1,py-6+i,i*2+2,1,i%4===0?'#5a4028':'#7a5a36');}R(og,px+13,py+4,6,6,'#2a1a10');R(og,px+15,py-8,2,4,'#5e3e28');R(og,px+17,py-8,4,2,'#a8322a');});})();
{const px=GRAVE.tx*TS,py=GRAVE.ty*TS;R(gg,px+1,py+12,14,4,'rgba(0,0,0,.25)');R(gg,px+2,py+11,12,3,'#6a5a3a');R(og,px+3,py-4,10,16,'#8a8f99');R(og,px+4,py-6,8,2,'#8a8f99');R(og,px+3,py-4,10,1,'#b8bec9');R(og,px+7,py-2,2,7,'#5a5e68');R(og,px+5,py,6,2,'#5a5e68');R(gg,px+1,py+13,3,2,'#f28bb0');R(gg,px+12,py+13,3,2,'#f2e36b');}
PROPS.forEach(p=>{const px=p.tx*TS,py=p.ty*TS,w=p.w*TS;
 if(p.k==='bed'){R(gg,px+1,py+1,w-2,15,'#6b4428');R(gg,px+2,py+2,w-4,13,'#e8e0d0');R(gg,px+2,py+2,10,6,'#ffffff');R(gg,px+12,py+4,w-14,11,'#4a6aa8');R(gg,px+12,py+4,w-14,2,'#6a8ac8');}
 else if(p.k==='table'){R(gg,px+2,py+12,w-4,4,'rgba(0,0,0,.25)');R(gg,px+3,py+8,2,7,'#5e3e28');R(gg,px+w-5,py+8,2,7,'#5e3e28');R(og,px+1,py+2,w-2,7,'#8a5a34');R(og,px+1,py+2,w-2,2,'#a87a4a');R(og,px+6,py-1,4,3,'#d8d0c0');R(og,px+w-10,py,3,2,'#c8a050');}
 else if(p.k==='chest'){R(gg,px+1,py+12,14,4,'rgba(0,0,0,.25)');R(gg,px+2,py+5,12,10,'#7a4e2c');R(gg,px+2,py+5,12,3,'#9a6a3a');R(gg,px+2,py+8,12,1,'#3e2616');R(gg,px+7,py+8,2,3,'#e0c060');}
 else if(p.k==='shelf'){R(gg,px,py+1,w,15,'#5e3e26');for(let s=0;s<3;s++){R(gg,px+1,py+4+s*4,w-2,1,'#3e2616');for(let b=px+2;b<px+w-2;b+=3)R(gg,b,py+1+s*4,2,3,['#a03a34','#3a6aa8','#4a8a4a','#c8a050','#7a4aa0'][(b+s+p.tx)%5]);}}
 else if(p.k==='counter'){R(gg,px,py+12,w,4,'rgba(0,0,0,.25)');R(og,px,py-2,w,14,'#7a5634');R(og,px,py-2,w,3,'#a07a4a');R(og,px,py+11,w,1,'#4e3018');for(let b=px+6;b<px+w-4;b+=14){R(og,b,py-5,4,3,'#c8c8d0');R(og,b+5,py-4,3,2,'#e8c070');}}
 else if(p.k==='rack'){R(gg,px+1,py+13,14,3,'rgba(0,0,0,.25)');R(og,px+2,py-6,12,2,'#5e3e28');R(og,px+2,py+6,12,2,'#5e3e28');R(og,px+4,py-8,1,14,'#d4d8e0');R(og,px+7,py-8,1,14,'#c8ccd6');R(og,px+10,py-7,1,13,'#9aa0aa');R(og,px+3,py+2,10,1,'#5e3e28');}
 else if(p.k==='barrel'){R(gg,px+2,py+12,12,4,'rgba(0,0,0,.25)');R(og,px+3,py+1,10,13,'#8a5a34');R(og,px+3,py+3,10,1,'#4e3018');R(og,px+3,py+10,10,1,'#4e3018');R(og,px+4,py+1,8,2,'#a87a4a');}});
}
return {drawBuilding,drawWorld};};
})(typeof window!=='undefined'?window:globalThis);
