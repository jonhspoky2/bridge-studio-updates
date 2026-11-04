/* v0.25 HUD foundation: accessible objective bar follows collect Quest Core in real Play and export. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const output=path.join(os.tmpdir(),'bridge-objective-hud.html');
 execFileSync('python3',[path.resolve(__dirname,'../tools/build_studio.py'),'--output',output]);
 const studio=await fs.readFile(output),three=await fs.readFile(require.resolve('three/build/three.min.js'));
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});let exported='';
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith('/studio.html'))return route.fulfill({contentType:'text/html; charset=utf-8',body:studio});
   if(u.pathname==='/quest-game.html'&&exported)return route.fulfill({contentType:'text/html; charset=utf-8',body:exported});
   if(u.pathname.endsWith('/three.min.js'))return route.fulfill({contentType:'text/javascript',body:three});
   if(u.pathname.includes('/Playding/js/auth.js'))return route.fulfill({contentType:'text/javascript',body:''});
   return route.fulfill({status:404,body:'not found'});
  });
  const page=await context.newPage();await page.goto('http://127.0.0.1:41437/studio.html');await page.waitForFunction(()=>window.__bridgeQA);
  const doc={format:'rwbridge.game',version:2,name:'HUD Quest QA',projectId:'hud_progress_browser_qa',
   settings:{sky:'#88c5f1',saveProgress:true,moveSpeed:5,jumpPower:7.6},
   objects:[
    {id:'floor',name:'Ground',type:'ground',position:[0,-.5,0],rotation:[0,0,0],scale:[16,1,16],color:'#638075',solid:true,action:'none',value:0},
    {id:'spawn',name:'Spawn',type:'spawn',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#50dfb1',solid:false,action:'none',value:0},
    {id:'coin',name:'Quest coin',type:'coin',position:[.3,1,0],rotation:[0,0,0],scale:[1,1,1],color:'#ffe088',solid:false,action:'collect',value:1}
   ],ui:[],scripts:[],graphs:[],items:[],quests:[
    {id:'q',title:'Collect one',description:'Coin',event:'collect',source:'coin',required:1,rewardCoins:5}
   ]};
  await page.locator('#projectInput').setInputFiles({name:'hud-quest.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await page.waitForFunction(()=>window.__bridgeQA().project.name==='HUD Quest QA');
  const savedDl=page.waitForEvent('download');await page.click('#saveProject');
  const saved=JSON.parse(await fs.readFile(await (await savedDl).path(),'utf8'));
  assert.equal(saved.quests[0].event,'collect','legacy quest definition retained');
  await page.click('#btnPlay');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'),{timeout:25000});
  const frame=await (await page.locator('#playFrame').elementHandle()).contentFrame();
  async function tap(frame,key){await frame.evaluate(k=>{window.dispatchEvent(new KeyboardEvent('keydown',{code:'Key'+k.toUpperCase(),key:k,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'Key'+k.toUpperCase(),key:k,bubbles:true}));},key);}
  async function verify(frame,label){
   await frame.waitForFunction(()=>window.__bridgeDebugState&&document.querySelector('#questProgressTrack')&&!document.querySelector('#questProgressTrack').hidden,{timeout:30000});
   let bar=await frame.locator('#questProgressTrack').evaluate(el=>({current:el.getAttribute('aria-valuenow'),max:el.getAttribute('aria-valuemax'),width:el.querySelector('#questProgressFill').style.width}));
   assert.deepEqual(bar,{current:'0',max:'1',width:'0.0%'},label+' empty quest');
   await tap(frame,'e');
   const state=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.equal(state.quests.quests.find(q=>q.id==='q').progress,1,label+' quest updated');
   bar=await frame.locator('#questProgressTrack').evaluate(el=>({current:el.getAttribute('aria-valuenow'),max:el.getAttribute('aria-valuemax'),width:el.querySelector('#questProgressFill').style.width,completed:el.classList.contains('complete')}));
   assert.deepEqual(bar,{current:'1',max:'1',width:'100.0%',completed:true},label+' full HUD progress');
   assert.match(await frame.locator('#objective').textContent(),/Collect one: 1\/1/,label+' HUD title synced');
   await tap(frame,'q');await frame.getByRole('button',{name:'Забрать награду'}).click();
   assert.equal((await frame.evaluate(()=>window.__bridgeDebugState())).coins,6,label+' one-time quest reward');
  }
  await verify(frame,'Play');
  await page.click('#btnStop');await page.selectOption('#exportProfile','warpgame');
  const dl=page.waitForEvent('download');await page.click('#btnBuild');
  exported=await fs.readFile(await (await dl).path(),'utf8');
  assert.ok(Buffer.byteLength(exported,'utf8')<=3000000,'WARPGAME byte budget');
  assert.ok(exported.includes('id="questProgressTrack"'),'objective HUD bundled into exported HTML');
  const game=await context.newPage();await game.goto('http://127.0.0.1:41437/quest-game.html');
  await verify(game,'Exported HTML');
  await game.reload();await game.waitForFunction(()=>window.__bridgeDebugState&&window.__bridgeDebugState().coins===6,{timeout:30000});
  const restored=await game.locator('#questProgressTrack').evaluate(el=>({current:el.getAttribute('aria-valuenow'),max:el.getAttribute('aria-valuemax'),width:el.querySelector('#questProgressFill').style.width}));
  assert.deepEqual(restored,{current:'1',max:'1',width:'100.0%'},'quest bar restored from localStorage');
  console.log('v0.25 objective HUD: Play, collect Quest Core, accessible bar, claim, standalone HTML and restore PASS',{bytes:Buffer.byteLength(exported)});
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
