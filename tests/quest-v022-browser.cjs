/* Bridge Studio v0.22 integration: author quest, run Play, claim and save standalone progress. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
(async()=>{
 const output=path.join(os.tmpdir(),'bridge-v022-studio.html');
 execFileSync('python3',[path.resolve(__dirname,'../tools/build_studio.py'),'--output',output]);
 const html=await fs.readFile(output);
 const three=await fs.readFile(require.resolve('three/build/three.min.js'));
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  let game='';
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/studio.html'))return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
   if(url.pathname==='/game.html'&&game)return route.fulfill({contentType:'text/html; charset=utf-8',body:game});
   if(url.pathname.endsWith('/three.min.js'))return route.fulfill({contentType:'text/javascript',body:three});
   if(url.pathname.includes('/Playding/js/auth.js'))return route.fulfill({contentType:'text/javascript',body:''});
   return route.fulfill({status:404,body:'not found'});
  });
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:41437/studio.html');
  await page.waitForFunction(()=>typeof window.__bridgeQA==='function');
  const blank={format:'rwbridge.game',version:2,name:'Quest QA',settings:{sky:'#88c5f1',moveSpeed:5,jumpPower:7.6},
   objects:[
    {id:'floor',name:'Ground',type:'ground',position:[0,-.5,0],rotation:[0,0,0],scale:[16,1,16],color:'#57827d',solid:true,action:'none',value:0},
    {id:'spawn',name:'Spawn',type:'spawn',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#66e8ca',solid:false,action:'none',value:0}
   ],ui:[],scripts:[],graphs:[],items:[]};
  await page.locator('#projectInput').setInputFiles({name:'quest-qa.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(blank))});
  await page.waitForFunction(()=>window.__bridgeQA().project.name==='Quest QA');
  await page.click('[data-tab="ui"]');
  await page.click('#makeQuestDemo');
  let scene=await page.evaluate(()=>window.__bridgeQA().project);
  assert.equal(scene.quests.length,1);
  assert.equal(scene.settings.saveProgress,true);
  assert.ok(scene.projectId&&scene.quests[0].source);
  assert.ok(scene.ui.some(u=>u.action==='quests'));
  assert.equal(await page.locator('#gameSaveProgress').isChecked(),true);
  const save=page.waitForEvent('download');await page.click('#saveProject');
  const saved=JSON.parse(await fs.readFile(await (await save).path(),'utf8'));
  assert.deepEqual(saved.quests,scene.quests,'quest definitions saved in .rwscene');
  assert.equal(saved.projectId,scene.projectId,'persistent ID assigned');
  await page.click('#btnPlay');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'),{timeout:25000});
  const frame=await (await page.locator('#playFrame').elementHandle()).contentFrame();
  async function press(frame,key){
   await frame.evaluate(k=>{
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'Key'+k.toUpperCase(),key:k,bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'Key'+k.toUpperCase(),key:k,bubbles:true}));
   },key);
  }
  async function claim(frame,label){
   for(let i=1;i<=3;i++){
    await press(frame,'e');
    const d=await frame.evaluate(()=>window.__bridgeDebugState());
    assert.equal(d.quests.quests[0].progress,i,label+' interaction '+i);
    assert.equal(d.coins,0,label+' no automatic reward');
   }
   await press(frame,'q');
   await frame.getByRole('button',{name:'Забрать награду'}).click();
   const state=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.equal(state.coins,20,label+' claim coins');
   assert.equal(state.quests.quests[0].claimed,true,label+' claim status');
   assert.equal(await frame.getByRole('button',{name:'Забрать награду'}).count(),0,'cannot claim twice');
  }
  await claim(frame,'Play');
  await page.click('#btnStop');
  assert.deepEqual((await page.evaluate(()=>window.__bridgeQA().project)).quests,scene.quests,'Play did not modify quest definitions');
  await page.selectOption('#exportProfile','warpgame');
  const download=page.waitForEvent('download');await page.click('#btnBuild');
  game=await fs.readFile(await (await download).path(),'utf8');
  assert.ok(Buffer.byteLength(game,'utf8')<=3000000,'WARPGAME 3MB limit');
  assert.ok(game.includes('BridgeQuests'),'standalone has quest core');
  const release=await context.newPage();await release.goto('http://127.0.0.1:41437/game.html');
  await release.waitForFunction(()=>window.__bridgeDebugState);
  await claim(release,'HTML');
  const key='bridge-game-save:v1:'+scene.projectId;
  const persisted=await release.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);
  assert.equal(persisted.version,1);
  assert.equal(persisted.coins,20);
  assert.equal(persisted.quests.claimed[scene.quests[0].id],true);
  await release.reload();
  await release.waitForFunction(()=>window.__bridgeDebugState&&window.__bridgeDebugState().coins===20,{timeout:30000});
  const restored=await release.evaluate(()=>window.__bridgeDebugState());
  assert.equal(restored.quests.quests[0].claimed,true,'claim restored on reload');
  assert.equal(restored.saveAvailable,true);
  console.log('v0.22 browser: Quest editor, .rwscene, Play [E/Q], one-time reward, HTML export, localStorage restore passed',{bytes:Buffer.byteLength(game,'utf8')});
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
