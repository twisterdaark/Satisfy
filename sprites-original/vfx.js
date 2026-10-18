// Satisfy VFX presets v1 (SAT-ART-001, Claude-B). Cosmetic only: nothing here feeds damage, loot or state.
// Pixel-snapped particles and shapes for a 480x270 canvas. Usage:
//   const fx=SatArt.vfx.create();  fx.spawn('hit',x,y,{angle});  fx.update(dt);  fx.draw(ctx);
// Draw inside the world transform (after ctx.translate(-camX,-camY)) so effects follow the world.
(function(root){'use strict';
const A=root.SatArt=root.SatArt||{};
// Rarity colors match index.html --r0..--r4 (common, rare, epic, unique, legendary).
const RARITY=['#d8dde6','#4aa8ff','#b46aff','#ffd23a','#ff8a1e'];
const RAMP={
 fire:['#ffffff','#fff2a0','#ffc23a','#ff7a1a','#c8361a','#5a2a2a'],
 ice:['#ffffff','#d8f4ff','#8fd8ff','#4a9ad8','#2a5a9a'],
 spark:['#ffffff','#fff2a0','#ffd24a','#ff9a2a'],
 holy:['#ffffff','#fff8d0','#ffe07a','#f2b83a'],
 heal:['#ffffff','#d8ffd0','#7ae07a','#3aa04a'],
 mana:['#ffffff','#cfe8ff','#7ab0ff','#4a6ad8','#3a2a8a'],
 smoke:['#e8e4dc','#b8b2a8','#8a8478','#5a5650'],
 blood:['#ff8a7a','#e2493a','#a82a2a','#5a1a1a'],
 shadow:['#d8b8ff','#9a6ad8','#5a3a8a','#2a1a3a']};
const TAU=Math.PI*2;
// small seeded RNG so a replay of the same event looks the same (optional seed per spawn)
function rng(seed){let s=(seed>>>0)||((Math.random()*2**32)>>>0);return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return ((s>>>0)%100000)/100000;};}
const lerp=(a,b,k)=>a+(b-a)*k;
const rampAt=(r,k)=>r[Math.min(r.length-1,Math.max(0,Math.floor(k*r.length)))];

function create(){
 const P=[];  // particles: {x,y,vx,vy,ax,ay,drag,t,life,size,size1,ramp|color,shape,blend,rot,vr,len}
 const add=o=>{P.push(Object.assign({vx:0,vy:0,ax:0,ay:0,drag:0,t:0,size:1,shape:'px',blend:'source-over',rot:0,vr:0},o));};
 const burst=(r,n,x,y,o)=>{for(let i=0;i<n;i++){const a=(o.angle!=null?o.angle+(r()-.5)*(o.spread??TAU):r()*TAU),sp=lerp(o.sp0,o.sp1,r());
  add({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,ay:o.g||0,drag:o.drag||0,life:lerp(o.l0,o.l1,r()),size:o.size||1,size1:o.size1,ramp:o.ramp,color:o.color,alpha:o.alpha,shape:o.shape||'px',blend:o.blend||'source-over'});}};
 const glow=(x,y,r0,r1,col,life,a)=>add({x,y,life,shape:'glow',size:r0,size1:r1,color:col,blend:'lighter',alpha:a||.55});
 const PRE={
  // melee swing: a thick white crescent with a rarity-colored edge and a trailing ghost arc
  slash(r,x,y,o){const a=o.angle||0,col=RARITY[o.rarity||0];add({x,y,life:.14,shape:'arc',rot:a,size:13,width:4,color:'#ffffff'});add({x,y,life:.2,shape:'arc',rot:a,size:15,width:2,color:col});add({x,y,life:.26,shape:'arc',rot:a+.25,size:11,width:1,color:col,alpha:.7});
   glow(x+Math.cos(a)*10,y-6+Math.sin(a)*10,6,14,col,.18,.35);burst(r,5,x+Math.cos(a)*14,y-6+Math.sin(a)*14,{angle:a,spread:1.2,sp0:60,sp1:120,drag:3,l0:.12,l1:.22,ramp:RAMP.spark,shape:'streak'});},
  hit(r,x,y,o){glow(x,y,4,14,'#ffffff',.14,.6);add({x,y,life:.12,shape:'star',size:6,color:'#ffffff'});add({x,y,life:.2,shape:'ring',size:3,size1:12,color:'#ffffff',width:2});
   burst(r,8,x,y,{angle:o.angle,spread:2.6,sp0:70,sp1:150,g:260,drag:2,l0:.2,l1:.38,ramp:RAMP.spark,shape:'streak'});},
  crit(r,x,y,o){glow(x,y,8,30,'#ffd24a',.3,.7);add({x,y,life:.16,shape:'star',size:11,color:'#ffffff'});add({x,y,life:.3,shape:'ring',size:5,size1:26,color:'#ffd24a',width:2});add({x,y,life:.4,shape:'ring',size:3,size1:34,color:'#ff9a2a'});
   burst(r,16,x,y,{sp0:100,sp1:220,g:180,drag:2.5,l0:.25,l1:.5,ramp:RAMP.spark,shape:'streak'});burst(r,6,x,y,{sp0:30,sp1:70,drag:1,l0:.35,l1:.6,shape:'glint',ramp:RAMP.holy,size:2});},
  block(r,x,y,o){glow(x,y,4,12,'#9fd8ff',.16,.5);add({x,y,life:.18,shape:'ring',size:5,size1:10,color:'#cfefff',width:2});burst(r,7,x,y,{angle:o.angle,spread:1.6,sp0:70,sp1:130,g:280,l0:.15,l1:.3,ramp:RAMP.ice,shape:'streak'});},
  fire(r,x,y,o){glow(x,y,10,26,'#ff7a1a',.45,.6);for(let i=0;i<22;i++){const a=r()*TAU,d=r()*8;add({x:x+Math.cos(a)*d,y:y+Math.sin(a)*d*.6,vx:Math.cos(a)*lerp(10,50,r()),vy:-lerp(20,70,r()),drag:1.5,life:lerp(.35,.7,r()),size:lerp(2,4,r())|0,size1:1,ramp:RAMP.fire,shape:'flame'});}
   burst(r,7,x,y-6,{angle:-Math.PI/2,spread:1.2,sp0:10,sp1:30,l0:.6,l1:1,ramp:RAMP.smoke,size:2,size1:5,alpha:.8});},
  frost(r,x,y,o){glow(x,y,6,22,'#8fd8ff',.4,.55);add({x,y,life:.32,shape:'ring',size:3,size1:20,color:'#d8f4ff',width:2});burst(r,12,x,y,{sp0:50,sp1:130,drag:3,l0:.35,l1:.6,ramp:RAMP.ice,shape:'shard'});burst(r,10,x,y,{sp0:5,sp1:20,g:20,l0:.6,l1:1.1,ramp:RAMP.ice});},
  bolt(r,x,y,o){const x1=o.x1??x+60,y1=o.y1??y,segs=9,pts=[[x,y]];for(let i=1;i<segs;i++){const k=i/segs;pts.push([lerp(x,x1,k)+(r()-.5)*12,lerp(y,y1,k)+(r()-.5)*12]);}pts.push([x1,y1]);
   add({x,y,life:.22,shape:'bolt',pts,color:'#ffffff',width:2});add({x,y,life:.16,shape:'bolt',pts:pts.map(([a,b])=>[a+(r()-.5)*5,b+(r()-.5)*5]),color:'#8fb8ff',width:1});
   const mid=pts[4];add({x,y,life:.14,shape:'bolt',pts:[mid,[mid[0]+(r()-.5)*24,mid[1]+lerp(8,18,r())],[mid[0]+(r()-.5)*30,mid[1]+lerp(18,28,r())]],color:'#cfe0ff',width:1});
   glow(x1,y1,6,22,'#8fb8ff',.22,.7);add({x:x1,y:y1,life:.16,shape:'star',size:8,color:'#ffffff'});burst(r,10,x1,y1,{sp0:50,sp1:140,l0:.15,l1:.3,ramp:RAMP.mana,shape:'streak'});},
  heal(r,x,y,o){glow(x,y-8,8,18,'#7ae07a',.7,.45);for(let i=0;i<10;i++)add({x:x+(r()-.5)*20,y:y-r()*10,vy:-lerp(16,34,r()),life:lerp(.6,1,r()),t:-r()*.35,shape:'plus',size:1,ramp:RAMP.heal});},
  mana(r,x,y,o){for(let i=0;i<16;i++){const a=r()*TAU,d=lerp(16,24,r());add({x:x+Math.cos(a)*d,y:y+Math.sin(a)*d*.6,vx:-Math.cos(a)*d*2.2,vy:-Math.sin(a)*d*1.3,life:.45,shape:'px',size:2,size1:1,ramp:RAMP.mana});}add({x,y,life:.45,shape:'ring',size:16,size1:2,color:'#7ab0ff',width:2});glow(x,y,2,14,'#7ab0ff',.5,.5);},
  levelup(r,x,y,o){add({x,y,life:1.2,shape:'beam',size:16,height:90,color:'#ffe07a'});glow(x,y,10,30,'#ffe07a',1,.5);add({x,y,life:.6,shape:'ring',size:4,size1:30,color:'#fff2a0',width:2});add({x,y,life:.8,shape:'ring',size:2,size1:40,color:'#ffd23a'});
   for(let i=0;i<26;i++)add({x:x+(r()-.5)*20,y:y-r()*10,vy:-lerp(30,90,r()),life:lerp(.6,1.2,r()),t:-r()*.5,shape:r()<.3?'glint':'px',size:2,ramp:RAMP.holy});},
  loot(r,x,y,o){const k=o.rarity||0;if(k<1)return;const col=RARITY[k];add({x,y,life:o.life||2.5,shape:'beam',size:k>=4?14:k>=3?11:8,height:k>=3?80:55,color:col,pulse:1});glow(x,y,5,k>=4?20:12,col,o.life||2.5,.45);
   for(let i=0;i<(k>=4?18:9);i++)add({x:x+(r()-.5)*10,y,vy:-lerp(12,44,r()),life:lerp(.8,1.6,r()),t:-r()*1.2,shape:k>=4&&r()<.4?'glint':'px',size:2,size1:1,color:col});},
  dust(r,x,y,o){burst(r,o.n||4,x,y,{angle:o.angle!=null?o.angle:-Math.PI/2,spread:2,sp0:8,sp1:24,g:-6,drag:3,l0:.3,l1:.5,ramp:RAMP.smoke,size:1,size1:3,alpha:.7});},
  death(r,x,y,o){burst(r,16,x,y-6,{sp0:10,sp1:50,g:-20,drag:2,l0:.5,l1:.9,ramp:RAMP.smoke,size:3,size1:6,alpha:.85});for(let i=0;i<3;i++)add({x:x+(i-1)*5,y:y-8,vy:-24,vx:(i-1)*4,life:1,t:-i*.12,shape:'wisp',size:2,ramp:RAMP.shadow});glow(x,y-8,6,16,'#9a6ad8',.6,.4);},
  forge(r,x,y,o){glow(x,y,4,16,'#ffb03a',.2,.7);add({x,y,life:.08,shape:'star',size:7,color:'#ffffff'});burst(r,o.n||14,x,y,{angle:-Math.PI/2,spread:2.6,sp0:70,sp1:180,g:400,drag:.5,l0:.3,l1:.7,ramp:RAMP.fire,shape:'streak'});},
  blood(r,x,y,o){burst(r,7,x,y,{angle:o.angle,spread:1.4,sp0:40,sp1:100,g:320,l0:.25,l1:.45,ramp:RAMP.blood,size:2,size1:1});},
  stun(r,x,y,o){for(let i=0;i<3;i++)add({x,y,life:o.life||1.5,shape:'orbit',size:2,phase:i*TAU/3,radius:7,color:'#ffe07a'});},
  rage(r,x,y,o){glow(x,y-8,8,26,'#ff5a3a',.5,.55);add({x,y:y-8,life:.5,shape:'ring',size:4,size1:26,color:'#ff5a3a',width:2});burst(r,20,x,y-8,{sp0:40,sp1:110,g:-40,l0:.4,l1:.8,ramp:RAMP.fire,shape:'streak'});},
  shadow(r,x,y,o){glow(x,y-6,4,20,'#9a6ad8',.45,.6);burst(r,18,x,y-6,{sp0:20,sp1:70,drag:2,l0:.4,l1:.8,ramp:RAMP.shadow,size:3,size1:1});add({x,y:y-6,life:.4,shape:'ring',size:16,size1:3,color:'#c8a0ff',width:2});}
 };
 function spawn(kind,x,y,o={}){const f=PRE[kind];if(!f)return false;f(rng(o.seed),x,y,o);return true;}
 function update(dt){for(let i=P.length-1;i>=0;i--){const p=P[i];p.t+=dt;if(p.t<0)continue;if(p.t>=p.life){P.splice(i,1);continue;}
  if(p.drag){const k=Math.max(0,1-p.drag*dt);p.vx*=k;p.vy*=k;}p.vx+=p.ax*dt;p.vy+=p.ay*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}}
 function draw(g){const R=(x,y,w,h)=>g.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));
  for(const p of P){if(p.t<0)continue;const k=p.t/p.life,col=p.ramp?rampAt(p.ramp,k):p.color,s=p.size1!=null?lerp(p.size,p.size1,k):p.size;
   g.globalCompositeOperation=p.blend;g.globalAlpha=(p.alpha||1)*(p.shape==='beam'||p.shape==='disc'||p.shape==='glow'?(1-k):Math.min(1,(1-k)*1.6));g.fillStyle=col;g.strokeStyle=col;
   switch(p.shape){
    case 'px':R(p.x-s/2,p.y-s/2,s,s);break;
    case 'flame':R(p.x-s/2,p.y-s,s,s*1.6);if(s>2){g.fillStyle=rampAt(p.ramp,Math.max(0,k-.25));R(p.x-s/4,p.y-s*.6,s/2,s*.8);}break;
    case 'glow':{const gr=g.createRadialGradient(p.x,p.y,0,p.x,p.y,s);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(p.x-s,p.y-s,s*2,s*2);break;}
    case 'streak':{const l=Math.min(6,Math.hypot(p.vx,p.vy)*.04);R(p.x-.5,p.y-.5,2,2);const ux=p.vx/(Math.hypot(p.vx,p.vy)||1),uy=p.vy/(Math.hypot(p.vx,p.vy)||1);for(let j=0;j<=l;j++)R(p.x-ux*j,p.y-uy*j,1,1);break;}
    case 'plus':R(p.x-1,p.y,3,1);R(p.x,p.y-1,1,3);break;
    case 'glint':{const a=Math.round(s+1);R(p.x-a,p.y,a*2+1,1);R(p.x,p.y-a,1,a*2+1);break;}
    case 'shard':R(p.x,p.y,2,1);R(p.x+1,p.y-1,1,3);break;
    case 'star':{const a=Math.round(s*(1-k*.5));R(p.x-a,p.y,a*2+1,1);R(p.x,p.y-a,1,a*2+1);R(p.x-1,p.y-1,3,3);break;}
    case 'disc':g.beginPath();g.ellipse(Math.round(p.x),Math.round(p.y),s,s*.6,0,0,TAU);g.fill();break;
    case 'ring':g.lineWidth=p.width||1;g.beginPath();g.ellipse(Math.round(p.x)+.5,Math.round(p.y)+.5,s,s*.6,0,0,TAU);g.stroke();break;
    case 'arc':g.lineWidth=p.width||1;g.beginPath();g.arc(Math.round(p.x),Math.round(p.y)-6,s,p.rot-1.1+k*.5,p.rot+1.1+k*.5);g.stroke();break;
    case 'bolt':g.lineWidth=p.width||1;g.beginPath();p.pts.forEach(([a,b],j)=>j?g.lineTo(Math.round(a)+.5,Math.round(b)+.5):g.moveTo(Math.round(a)+.5,Math.round(b)+.5));g.stroke();break;
    case 'beam':{const w=p.size*(p.pulse?(.75+.25*Math.sin(p.t*8)):(1-k*.4)),h=p.height;const gr=g.createLinearGradient(0,p.y-h,0,p.y);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,col);g.fillStyle=gr;R(p.x-w/2,p.y-h,w,h);g.fillStyle='#ffffff';R(p.x-Math.max(1,w/4)/2,p.y-h*.8,Math.max(1,w/4),h*.8);break;}
    case 'orbit':{const a=p.phase+p.t*8;R(p.x+Math.cos(a)*p.radius,p.y+Math.sin(a)*p.radius*.4,2,2);break;}
    case 'wisp':R(p.x+Math.sin(p.t*9)*2,p.y,s,s+1);break;}}
  g.globalAlpha=1;g.globalCompositeOperation='source-over';}
 return {spawn,update,draw,get count(){return P.length;},clear:()=>{P.length=0;},kinds:Object.keys(PRE)};}

A.vfx={create,RARITY,RAMP};
})(typeof window!=='undefined'?window:globalThis);
