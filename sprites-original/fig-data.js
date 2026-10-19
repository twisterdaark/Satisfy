// SNAPSHOT (PER_CODE) of index.html @ 6ef0595bcc38e995e491d7667634e8665040bdd4 + SAT-CONTENT-002. Do not edit here; Claude-A owns the runtime copy.
(function(root){const A=root.SatArt=root.SatArt||{};
const GH={hair:'spiky',ahoge:1,hc:'#1b1f2e',hl:'#3d4a6b',skin:'#f1c7a0',sk2:'#d39f78'};
const FIG={
 ashur:{hair:'short',hc:'#2a1a14',hl:'#4a3024',skin:'#e8b890',sk2:'#c8946a',top:'#5a1a2a',top2:'#3e1020',collar:'#d8b04a',sleeves:true,cape:'#2a2a4a',pants:'#2a2430',boots:'#1a1418'},
 pcap:{hair:'helm',hc:'#9aa4b4',hl:'#d0d8e4',skin:'#e0aa7a',sk2:'#bf8758',top:'#8a909c',top2:'#646a76',sleeves:true,armC:'#c8ccd6',armC2:'#8a909c',pad:'#dfe2ea',pad2:'#a9aebb',chest:'#c8ccd6',belt:'#4a3020',cape:'#7a1a2a',pants:'#3a3a46',boots:'#2a2c34'},
 deserter:{hair:'helm',hc:'#6a6e78',hl:'#9aa0aa',skin:'#d9a070',sk2:'#b47c50',top:'#5a4a3a',top2:'#3e3226',sleeves:true,pad:'#7a7e88',pad2:'#5a5e68',chest:'#7a3a2c',belt:'#2a1a10',pants:'#3a3028',boots:'#22180f'},
 dcapt:{hair:'helm',hc:'#3a3e48',hl:'#6a707a',skin:'#c8906a',sk2:'#a8704a',top:'#3e3226',top2:'#2a2018',sleeves:true,pad:'#9aa0aa',pad2:'#6a707a',chest:'#8a1f2a',belt:'#1a1008',cape:'#4a1018',pants:'#2a2420',boots:'#1a1008'},
 grid:{...GH,top:'#8d919b',top2:'#6a6e78',sleeves:true,belt:'#4a3424',pants:'#33323c',boots:'#4a3424'},
 smith:{hair:'short',hc:'#3a2a1e',hl:'#5a4030',skin:'#d9a070',sk2:'#b47c50',top:'#d9a070',top2:'#b47c50',sleeves:false,beard:'#3a2a1e',beard2:'#22180f',apron:'#5a3a24',apron2:'#3e2616',pants:'#3a3028',boots:'#22180f'},
 goblin:{hair:'bald',hc:'#2e4a1e',hl:'#8ac46a',skin:'#6aa84a',sk2:'#4a8030',top:'#6a5236',top2:'#4e3a24',sleeves:false,shorts:'#5a4028',pants:'#5a4028',boots:'#4a8030'},
 gchief:{hair:'helm',hc:'#cbbf9a',hl:'#efe6c8',skin:'#4f8a36',sk2:'#356a22',top:'#5a3a2a',top2:'#3e261a',sleeves:false,pad:'#8a7a5a',pad2:'#6a5a3a',belt:'#2a1a10',shorts:'#3e261a',pants:'#3e261a',boots:'#356a22'},
 cgob:{hair:'bald',hc:'#1e3a16',hl:'#5a8a3a',skin:'#4a7a3a',sk2:'#33602a',top:'#3a3a44',top2:'#26262e',sleeves:false,shorts:'#2e2a26',pants:'#2e2a26',boots:'#33602a'},
 gshaman:{hair:'long',hc:'#d8d0c0',hl:'#f2ece0',skin:'#5a9a44',sk2:'#3e7a2e',top:'#5a2a7a',top2:'#3e1a58',sleeves:true,belt:'#c8a050',pants:'#3e1a58',boots:'#2a1a10'},
 foreman:{hair:'helm',hc:'#d8a030',hl:'#f2c860',skin:'#d9a070',sk2:'#b47c50',top:'#a85a2a',top2:'#7a3e1a',sleeves:false,beard:'#4a3a2a',beard2:'#2a2018',belt:'#3a2a1a',pants:'#4a4a52',boots:'#22180f'},
 kobold:{hair:'helm',hc:'#8a7a5a',hl:'#b8a880',skin:'#a8784a',sk2:'#86583a',top:'#5a4a3a',top2:'#3e3226',sleeves:false,shorts:'#3e3226',pants:'#3e3226',boots:'#86583a'},
 kking:{hair:'helm',hc:'#f2c14e',hl:'#ffe08a',skin:'#9a6a3e',sk2:'#7a4e2a',top:'#4a2a6a',top2:'#321a4a',sleeves:false,pad:'#c8a050',pad2:'#8a6a30',belt:'#2a1a10',cape:'#6a1a1a',shorts:'#321a4a',pants:'#321a4a',boots:'#7a4e2a'},
 gwar:{hair:'helm',hc:'#d8b860',hl:'#f2dc8a',skin:'#3e7a2a',sk2:'#2a5a1a',top:'#5a1a1a',top2:'#3e1010',sleeves:false,pad:'#9aa0aa',pad2:'#6a707a',belt:'#2a1a10',cape:'#2a1010',shorts:'#3e1010',pants:'#3e1010',boots:'#2a5a1a'},
 tw:{hair:'short',hc:'#6a4a2a',hl:'#8a6a40',skin:'#e0aa7a',sk2:'#bf8758',top:'#8a909c',top2:'#646a76',sleeves:true,armC:'#c8ccd6',armC2:'#8a909c',pad:'#dfe2ea',pad2:'#a9aebb',chest:'#c8ccd6',belt:'#4a3020',beard:'#6a4a2a',beard2:'#4a321a',pants:'#3a3a46',boots:'#3a3e48'},
 ta:{hair:'long',hc:'#c8a050',hl:'#e8c878',skin:'#f1c7a0',sk2:'#d39f78',top:'#3f6a3a',top2:'#2c4e28',sleeves:true,pad:'#7a5a3a',pad2:'#5a3e24',belt:'#4a3020',pants:'#3a3a30',boots:'#4a3020'},
 tm:{hair:'hat',hc:'#d8d4cc',hl:'#f4f0ea',hat:'#3a2a6a',skin:'#eec39a',sk2:'#cf9f76',top:'#3a2a6a',top2:'#271c4a',sleeves:true,robe:1,beard:'#ece8e0',beard2:'#bdb7ad',longBeard:1,collar:'#d8b04a',pants:'#271c4a',boots:'#22180f'},
 merchant:{hair:'cap',hc:'#4a3020',hl:'#6a4a30',cap:'#c8a050',skin:'#e0aa7a',sk2:'#bf8758',top:'#8a3a3a',top2:'#6a2a2a',sleeves:true,apron:'#e8dcc0',apron2:'#c8bca0',pants:'#4a3e32',boots:'#22180f'},
 armorer:{hair:'bald',hc:'#3a2a1e',hl:'#5a4030',skin:'#d9a070',sk2:'#b47c50',top:'#5a6474',top2:'#3e4654',sleeves:true,beard:'#3a2a1e',beard2:'#22180f',apron:'#3a2a1e',apron2:'#22180f',pants:'#3a3028',boots:'#22180f'},
 inn:{hair:'short',hc:'#6a3a20',hl:'#8a5a30',skin:'#f1c193',sk2:'#d3a070',top:'#e8dcc0',top2:'#c8bca0',sleeves:true,apron:'#8a3a3a',apron2:'#6a2a2a',pants:'#4a3e32',boots:'#22180f'},
 oldw:{hair:'long',hc:'#bdb7ad',hl:'#e8e4dc',skin:'#e8b88a',sk2:'#c8946a',top:'#6a4a6a',top2:'#4a324a',sleeves:true,apron:'#8a7a6a',apron2:'#6a5a4a',pants:'#4a324a',boots:'#22180f'},
 khan:{hair:'long',hc:'#cfcac2',hl:'#f2eee8',skin:'#dba57a',sk2:'#b88158',top:'#27375c',top2:'#1a2644',collar:'#e9ddbd',sleeves:true,beard:'#ece8e0',beard2:'#bdb7ad',longBeard:1,pants:'#2e2a26',boots:'#22180f'},
 baker:{hair:'cap',hc:'#7a4a2a',hl:'#9a6a40',cap:'#f4f2ea',skin:'#f1c193',sk2:'#d3a070',top:'#d8cfb8',top2:'#b8ae96',sleeves:true,apron:'#f6f4ee',apron2:'#d8d2c4',pants:'#6a5a4a',boots:'#2a1c12'},
 recruiter:{hair:'short',hc:'#d8b86a',hl:'#f0d890',skin:'#f1c193',sk2:'#d3a070',top:'#8a96a8',top2:'#5e6a7c',sleeves:true,cape:'#2c4a8a',pants:'#4a4f5a',boots:'#2a2c34'},
 hunter:{hair:'short',hc:'#6a3a20',hl:'#8a5a30',skin:'#e8b88a',sk2:'#c8946a',top:'#4a6a3a',top2:'#344a28',sleeves:true,pad:'#7a6a4a',pad2:'#5a4a30',pants:'#3a3a30',boots:'#2a2018'},
 coach:{hair:'hat',hc:'#5a4a3a',hl:'#7a6a50',hat:'#4a3a2a',skin:'#e0aa7a',sk2:'#bf8758',top:'#6a7a4a',top2:'#4a5832',sleeves:true,pants:'#4a3e32',boots:'#22180f'},
 merman:{hair:'bald',hc:'#2a6a6a',hl:'#4a9a9a',skin:'#4aa08a',sk2:'#2f7a68',top:'#4aa08a',top2:'#2f7a68',sleeves:false,shorts:'#2a5a7a',pants:'#2a5a7a',boots:'#2f7a68'},
 outlaw:{hair:'short',hc:'#2a2018',hl:'#4a3a2a',skin:'#e0aa7a',sk2:'#bf8758',top:'#5a4a3a',top2:'#3e3226',sleeves:true,belt:'#2a1a10',pants:'#3a3430',boots:'#22180f'},
 praga:{hair:'spiky',hc:'#7a1a1a',hl:'#a83a2a',skin:'#d9a070',sk2:'#b47c50',top:'#3a2a2a',top2:'#261a1a',sleeves:true,pad:'#6a5a4a',pad2:'#4a3a2a',belt:'#2a1a10',pants:'#2a2626',boots:'#22180f'},
 forc:{hair:'bald',hc:'#cfd8e0',hl:'#ffffff',skin:'#5a86c8',sk2:'#3e66a0',top:'#e8eef4',top2:'#b8c4d0',sleeves:false,shorts:'#6a5a4a',pants:'#6a5a4a',boots:'#5e7884'},
 fochief:{hair:'helm',hc:'#c8d4e0',hl:'#f0f6ff',skin:'#4a76b8',sk2:'#2e5690',top:'#e8eef4',top2:'#b8c4d0',sleeves:false,pad:'#9aa8b8',pad2:'#7a8898',belt:'#3a2a1a',shorts:'#4a3a2a',pants:'#4a3a2a',boots:'#506a76'},
 piaro:{hair:'cap',hc:'#b8b0a0',hl:'#ddd6c8',cap:'#d8b860',skin:'#d9a070',sk2:'#b47c50',top:'#6a7a4a',top2:'#4e5c36',sleeves:true,beard:'#c8c0b0',beard2:'#9a9284',belt:'#5a3a24',pants:'#5a4a36',boots:'#2a1c12'},
 regas:{hair:'spiky',hc:'#e2702a',hl:'#ffa45a',skin:'#f1c193',sk2:'#d3a070',top:'#f1c193',top2:'#d3a070',sleeves:false,belt:'#5a3a24',pants:'#2e2e36',boots:'#22180f'},
 knight:{hair:'helm',hc:'#b8bec9',hl:'#e6e9ee',skin:'#f1c193',sk2:'#d3a070',top:'#b8bec9',top2:'#8a909c',sleeves:true,cape:'#8a1f2a',pants:'#6a707c',boots:'#3a3e48'}};
const OUT='#120f18',EYE='#22181e';
const LOOK={hair:['spiky','short','long','pony','bald'],
 hc:[['#1b1f2e','#3d4a6b'],['#5a3418','#8a5a32'],['#d8b86a','#f0d890'],['#a8322a','#d8584a'],['#e8e8f0','#ffffff'],['#2a6a5a','#4a9a88']],
 skin:[['#f1c7a0','#d39f78'],['#e0aa7a','#bf8758'],['#b8794a','#93592f'],['#7a4a2a','#5a3218']],
 top:[['#8d919b','#6a6e78'],['#3a5a8a','#2a4068'],['#7a3a2c','#5a2a1e'],['#4a6a3a','#344a28'],['#5a3a6a','#3e2650']]};
function lookFig(L,arm){const c={hair:LOOK.hair[L.hair],hc:LOOK.hc[L.hc][0],hl:LOOK.hc[L.hc][1],skin:LOOK.skin[L.skin][0],sk2:LOOK.skin[L.skin][1],top:LOOK.top[L.top][0],top2:LOOK.top[L.top][1],sleeves:true,belt:'#4a3424',pants:'#33323c',boots:'#4a3424'};if(arm)Object.assign(c,{pad:'#a8743f',pad2:'#7a5030',chest:'#8a5a32',belt:'#3a2414',boots:'#5a3a20'});return c;}
A.FIG=FIG;A.LOOK=LOOK;A.lookFig=lookFig;A.OUT=OUT;A.EYE=EYE;
})(typeof window!=='undefined'?window:globalThis);
