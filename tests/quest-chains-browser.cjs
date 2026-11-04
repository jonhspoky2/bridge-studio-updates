/* Quest Chains Chromium: author, collect, unlock, interact and persist through HTML export. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const output=path.join(os.tmpdir(),'bridge-chained-quest.html');
 execFileSync('python3',[path.resolve(__dirname,'../tools/build_studio.py'),'--output',output]);
 const studio=await fs.readFile(output),three=await fs.readFile(require.resolve('three/build/three.min.js'));
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});let html='';
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith('/studio.html'))return route.fulfill({contentType:'text/html; charset=utf-8',body:studio});
   if(u.pathname==='/chain-game.html'&&html)return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
   if(u.pathname.endsWith('/three.min.js'))return route.fulfill({contentType:'text/javascript',body:three});
   if(u.pathname.includes('/Playding/js/auth.js'))return route.fulfill({contentType:'text/javascript',body:''});
   return route.fulfill({status:404,body:'not found'});
  });
  const page=await context.newPage();await page.goto('http://127.0.0.1:41437/studio.html');
  await page.waitForFunction(()=>window.__bridgeQA);
  const legacy={format:'rwbridge.game',version:2,name:'Quest Chains QA',settings:{sky:'#88c5f1'},
   objects:[
    {id:'floor',name:'Floor',type:'ground',position:[0,-.5,0],rotation:[0,0,0],scale:[16,1,16],color:'#5e7e75',solid:true,action:'none',value:0},
    {id:'spawn',name:'Spawn',type:'spawn',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#5de4b5',solid:false,action:'none',value:0}
   ],ui:[],scripts:[],graphs:[],items:[]};
  await page.locator('#projectInput').setInputFiles({name:'legacy-scene.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await page.waitForFunction(()=>window.__bridgeQA().project.name==='Quest Chains QA');
  await page.click('[data-tab="ui"]');await page.click('#makeQuestChainDemo');
  const scene=await page.evaluate(()=>window.__bridgeQA().project);
  assert.equal(scene.quests.length,2,'two-stage kit authored');
  const q1=scene.quests[0],q2=scene.quests[1];
  assert.equal(q1.event,'collect');
  assert.equal(q2.event,'interact');
  assert.equal(q2.requiresQuestId,q1.id);
  assert.equal(scene.settings.saveProgress,true);
  const saveDl=page.waitForEvent('download');await page.click('#saveProject');
  const saved=JSON.parse(await fs.readFile(await (await saveDl).path(),'utf8'));
  assert.deepEqual(saved.quests,scene.quests,'quest prerequisites survive rwscene');
  await page.click('#btnPlay');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'),{timeout:25000});
  const frame=await (await page.locator('#playFrame').elementHandle()).contentFrame();
  async function press(frame,key){await frame.evaluate(k=>{
   window.dispatchEvent(new KeyboardEvent('keydown',{code:'Key'+k.toUpperCase(),key:k,bubbles:true}));
   window.dispatchEvent(new KeyboardEvent('keyup',{code:'Key'+k.toUpperCase(),key:k,bubbles:true}));
  },key);}
  async function journey(frame,label){
   await frame.waitForFunction(()=>window.__bridgeDebugState&&window.__bridgeDebugState().objects===4,{timeout:30000});
   const tasks=()=>frame.evaluate(()=>window.__bridgeDebugState().quests.quests);
   assert.equal((await tasks()).find(q=>q.id===q2.id).locked,true,label+' successor locked');
   await press(frame,'e');
   assert.equal((await tasks()).find(q=>q.id===q1.id).progress,1,label+' coin collect');
   assert.equal((await tasks()).find(q=>q.id===q2.id).progress,0);
   await press(frame,'e');
   assert.equal((await tasks()).find(q=>q.id===q2.id).progress,0,label+' interact before claim ignored');
   await press(frame,'q');
   const blocked=frame.getByRole('button',{name:'Заблокировано'});assert.equal(await blocked.count(),1,label+' journal locked state');
   await frame.getByRole('button',{name:'Забрать награду'}).click();
   assert.equal((await tasks()).find(q=>q.id===q2.id).locked,false,label+' claim unlock');
   await press(frame,'q');
   await press(frame,'e');await press(frame,'e');
   assert.equal((await tasks()).find(q=>q.id===q2.id).progress,2,label+' successor activated');
   await press(frame,'q');
   await frame.getByRole('button',{name:'Забрать награду'}).click();
   const end=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.equal(end.coins,21,label+' coin plus two rewards');
   assert.equal(end.quests.quests.filter(q=>q.claimed).length,2,label+' both claimed');
  }
  await journey(frame,'Play');
  await page.click('#btnStop');
  await page.selectOption('#exportProfile','warpgame');
  const dl=page.waitForEvent('download');await page.click('#btnBuild');
  html=await fs.readFile(await (await dl).path(),'utf8');
  assert.ok(Buffer.byteLength(html,'utf8')<=3000000,'WARPGAME 3MB limit');
  const game=await context.newPage();await game.goto('http://127.0.0.1:41437/chain-game.html');
  await journey(game,'Standalone HTML');
  await game.reload();await game.waitForFunction(()=>window.__bridgeDebugState&&window.__bridgeDebugState().coins===21,{timeout:30000});
  const restored=await game.evaluate(()=>window.__bridgeDebugState());
  assert.equal(restored.quests.quests.filter(q=>q.claimed).length,2,'chain restored after reload');
  console.log('Quest Chains browser: demo, blocked successor, claim unlock, Play/HTML and save PASS',{bytes:Buffer.byteLength(html)});
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
