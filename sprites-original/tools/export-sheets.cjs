// Exports PNG sprite sheets + manifest from chars.js using headless Chromium (Playwright).
// Run: node sprites-original/tools/export-sheets.cjs   (needs playwright; no repo dependency added)
'use strict';
const path=require('path'),fs=require('fs');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..'),out=path.join(root,'sheets');
(async()=>{fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch();const p=await b.newPage();
 await p.goto('file://'+path.join(root,'preview.html'));await p.waitForFunction(()=>window.SatArt&&SatArt.chars);
 const res=await p.evaluate(()=>{const A=SatArt,C=A.chars,o={};
  const looks={...A.FIG};
  // player looks: every hair style with the default colors, unarmored and armored
  A.LOOK.hair.forEach((h,i)=>{looks['me_'+h]=A.lookFig({hair:i,hc:0,skin:0,top:0},0);looks['me_'+h+'_armor']=A.lookFig({hair:i,hc:0,skin:0,top:0},1);});
  for(const n in looks){const s=C.buildSheet(looks[n]);o[n]={png:s.canvas.toDataURL('image/png'),hands:s.hands};}
  return {sheets:o,cols:C.COLS,rows:C.ROWS,timing:C.TIMING,fw:C.FW,fh:C.FH};});
 const manifest={schema:1,sourceVersion:'ce297728037e368fbfc5a9dce3e5d3eaefd3e17a',generator:'sprites-original/chars.js',
  frame:{w:res.fw,h:res.fh,anchor:{x:8,y:24}},rows:res.rows,mirrorLeftFrom:'s',
  columns:res.cols.map(([pose,f])=>({pose,f})),timing:res.timing,sheets:{}};
 for(const n of Object.keys(res.sheets).sort()){const f=n+'.png';fs.writeFileSync(path.join(out,f),Buffer.from(res.sheets[n].png.split(',')[1],'base64'));manifest.sheets[n]={file:'sheets/'+f,hands:res.sheets[n].hands};}
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,1)+'\n');
 console.log('sheets:',Object.keys(manifest.sheets).length);await b.close();})();
