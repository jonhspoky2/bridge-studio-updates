/* P0: real three-coin collect quest across editor, Play and standalone HTML.
   Reproduces a legacy coin configured with action=collect AND Pickup. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const outfile=path.join(os.tmpdir(),'bridge-collect-quest-qa.html');
 execFileSync('python3',[path.resolve(__dirname,'../tools/build_studio.py'),'--output',outfile]);
 const editor=await fs.readFile(outfile),three=await fs.readFile(require.resolve('three/build/three.min.js'));
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  let exported='';
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/studio.html'))return route.fulfill({contentType:'text/html; charset=utf-8',body:editor});
   if(url.pathname==='/collect.html'&&exported)return route.fulfill({contentType:'text/html; charset=utf-8',body:exported});
   if(url.pathname.endsWith('/three.min.js'))return route.fulfill({contentType:'text/javascript',body:three});
   if(url.pathname.includes('/Playding/js/auth.js'))return route.fulfill({contentType:'text/javascript',body:''});
   return route.fulfill({status:404,body:'not found'});
  });
  const page=await context.newPage();await page.goto('http://127.0.0.1:41437/studio.html');
  await page.waitForFunction(()=>typeof window.__bridgeQA==='function');
  const doc={format:'rwbridge.game',version:2,name:'Collect Three QA',projectId:'quest_collect_browser_qa',
   settings:{sky:'#80bce9',moveSpeed:5,jumpPower:7.6,saveProgress:false},
   objects:[
    {id:'floor',name:'Floor',type:'ground',position:[0,-.5,0],rotation:[0,0,0],scale:[16,1,16],solid:true,action:'none',color:'#608a7e'},
    {id:'spawn',name:'Spawn',type:'spawn',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],solid:false,action:'none',color:'#66dfb7'},
    {id:'dual_coin',name:'Legacy double pickup',type:'coin',position:[.3,1,0],rotation:[0,0,0],scale:[1,1,1],solid:false,
     action:'collect',value:1,color:'#ffe083',components:[{type:'pickup',enabled:true,activation:'interact',amount:10}]}
   ],ui:[],scripts:[],graphs:[],items:[],quests:[
    {id:'not_collect',title:'Only interacting with button',event:'interact',source:'dual_coin',required:1,rewardCoins:0}
   ]};
  await page.locator('#projectInput').setInputFiles({name:'legacy-collect.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await page.waitForFunction(()=>window.__bridgeQA().project.name==='Collect Three QA');
  await page.click('[data-tab="ui"]');
  await page.click('#makeCollectQuestDemo');
  const scene=await page.evaluate(()=>window.__bridgeQA().project);
  assert.equal(scene.objects.filter(o=>o.action==='collect').length,3,'demo reuses legacy coin and adds two');
  assert.equal(scene.settings.saveProgress,true);
  const quest=scene.quests.find(q=>q.event==='collect');
  assert.ok(quest&&quest.required===3&&quest.source==='*','collect quest is correctly configured');
  const save=page.waitForEvent('download');await page.click('#saveProject');
  const rwscene=JSON.parse(await fs.readFile(await (await save).path(),'utf8'));
  assert.deepEqual(rwscene.quests,scene.quests,'quest definitions survive .rwscene');
  assert.equal(rwscene.objects.find(o=>o.id==='dual_coin').components[0].type,'pickup','legacy scene preserved');
  await page.click('#btnPlay');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'),{timeout:25000});
  const play=await (await page.locator('#playFrame').elementHandle()).contentFrame();
  async function press(frame,key){
   await frame.evaluate(k=>{
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'Key'+k.toUpperCase(),key:k,bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'Key'+k.toUpperCase(),key:k,bubbles:true}));
   },key);
  }
  async function complete(frame,label){
   await frame.waitForFunction(()=>window.__bridgeDebugState&&document.getElementById('interactPrompt').style.display==='block',{timeout:30000});
   const before=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.equal(before.coins,0,label+' initial coins');
   assert.equal(before.quests.quests.find(q=>q.id===quest.id).progress,0);
   assert.equal(before.interactionTarget,'dual_coin',label+' mixed legacy coin target');
   for(let i=1;i<=3;i++){
    await press(frame,'e');
    const s=await frame.evaluate(()=>window.__bridgeDebugState());
    assert.equal(s.collected,i,label+' unique collected coin '+i);
    assert.equal(s.coins,i,label+' exactly one coin reward per E (no duplicate Pickup)');
    assert.equal(s.quests.quests.find(q=>q.id===quest.id).progress,i,label+' collect quest '+i);
    assert.equal(s.quests.quests.find(q=>q.id==='not_collect').progress,0,label+' collect must not advance interact quest');
    assert.match(await frame.locator('#objective').textContent(),new RegExp('Собрано '+i+' / 3'),label+' HUD progress');
   }
   await press(frame,'q');
   await frame.getByRole('button',{name:'Забрать награду'}).click();
   const awarded=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.equal(awarded.coins,18,label+' quest claim once');
   assert.equal(awarded.quests.quests.find(q=>q.id===quest.id).claimed,true,label+' claimed');
   assert.equal(await frame.getByRole('button',{name:'Забрать награду'}).count(),0,label+' cannot claim again');
  }
  await complete(play,'Play');
  await page.click('#btnStop');
  assert.deepEqual((await page.evaluate(()=>window.__bridgeQA().project)).quests,scene.quests,'Play does not mutate project definitions');
  await page.selectOption('#exportProfile','warpgame');
  const dl=page.waitForEvent('download');await page.click('#btnBuild');
  exported=await fs.readFile(await (await dl).path(),'utf8');
  assert.ok(Buffer.byteLength(exported,'utf8')<=3000000,'WARPGAME exported HTML < 3MB');
  const game=await context.newPage();await game.goto('http://127.0.0.1:41437/collect.html');
  await complete(game,'Standalone HTML');
  const saved=await game.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),'bridge-game-save:v1:'+scene.projectId);
  assert.equal(saved.collected,3);assert.equal(saved.picked.length,3);
  assert.equal(saved.quests.claimed[quest.id],true);
  await game.reload();
  await game.waitForFunction(()=>window.__bridgeDebugState&&window.__bridgeDebugState().coins===18,{timeout:30000});
  const restored=await game.evaluate(()=>window.__bridgeDebugState());
  assert.equal(restored.collected,3,'three pickups restored');
  assert.equal(restored.quests.quests.find(q=>q.id===quest.id).progress,3,'quest progress restored');
  assert.equal(restored.quests.quests.find(q=>q.id===quest.id).claimed,true,'claimed state restored');
  assert.equal(restored.quests.quests.find(q=>q.id==='not_collect').progress,0,'interact remains separate after restore');
  console.log('P0 browser: legacy .rwscene, collect-only quest, dual pickup dedup, Play, HUD, WARPGAME export, reward, persistence PASS',{bytes:Buffer.byteLength(exported)});
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
