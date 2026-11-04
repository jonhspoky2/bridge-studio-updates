/* Browser regression for user's v0.22.0 screenshot: a coin next to spawn must not intercept E from an active quest. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const out=path.join(os.tmpdir(),'bridge-interaction-v0221.html');
 execFileSync('python3',[path.resolve(__dirname,'../tools/build_studio.py'),'--output',out]);
 const studio=await fs.readFile(out),three=await fs.readFile(require.resolve('three/build/three.min.js'));
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  let released='';
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/studio.html'))return route.fulfill({contentType:'text/html; charset=utf-8',body:studio});
   if(url.pathname==='/released.html'&&released)return route.fulfill({contentType:'text/html; charset=utf-8',body:released});
   if(url.pathname.endsWith('/three.min.js'))return route.fulfill({contentType:'text/javascript',body:three});
   if(url.pathname.includes('/Playding/js/auth.js'))return route.fulfill({contentType:'text/javascript',body:''});
   return route.fulfill({status:404,body:'not found'});
  });
  const page=await context.newPage();await page.goto('http://127.0.0.1:41437/studio.html');
  await page.waitForFunction(()=>typeof window.__bridgeQA==='function');
  const doc={format:'rwbridge.game',version:2,name:'E Interaction Regression',settings:{sky:'#81c5e7',moveSpeed:5,jumpPower:7.6},
   objects:[
    {id:'floor',name:'Ground',type:'ground',position:[0,-.5,0],rotation:[0,0,0],scale:[16,1,16],color:'#57827d',solid:true,action:'none',value:0},
    {id:'spawn',name:'Spawn',type:'spawn',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#66e8ca',solid:false,action:'none',value:0},
    {id:'near_coin',name:'Legacy coin',type:'coin',position:[0,1,0],rotation:[0,0,0],scale:[1,1,1],color:'#ffe083',solid:false,action:'collect',value:1}
   ],ui:[],scripts:[],graphs:[{id:'coin-once',name:'Coin E callback once',event:'interact',source:'near_coin',enabled:true,
    nodes:[{id:'bonus',type:'coins',amount:3,x:300,y:100}],links:[{from:'start',to:'bonus',port:'next'}]}],items:[]};
  await page.locator('#projectInput').setInputFiles({name:'interaction.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await page.waitForFunction(()=>window.__bridgeQA().project.name==='E Interaction Regression');
  await page.click('[data-tab="world"]');
  await page.locator('#objectList .listbtn').filter({hasText:'Legacy coin'}).click();
  assert.equal(await page.locator('select[data-prop="actionActivation"]').inputValue(),'interact','old coin defaults to E');
  await page.click('[data-tab="ui"]');await page.click('#makeQuestDemo');
  const original=await page.evaluate(()=>window.__bridgeQA().project);
  const savedDownload=page.waitForEvent('download');await page.click('#saveProject');
  const saved=JSON.parse(await fs.readFile(await (await savedDownload).path(),'utf8'));
  assert.equal(saved.objects.find(o=>o.id==='near_coin').actionActivation,undefined,'old .rwscene schema preserved');
  assert.deepEqual(saved.quests,original.quests);
  await page.click('#btnPlay');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'),{timeout:25000});
  const play=await (await page.locator('#playFrame').elementHandle()).contentFrame();
  async function press(frame,key){
   await frame.evaluate(k=>{
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'Key'+k.toUpperCase(),key:k,bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'Key'+k.toUpperCase(),key:k,bubbles:true}));
   },key);
  }
  async function check(frame,label){
   await frame.waitForFunction(()=>window.__bridgeDebugState&&document.getElementById('interactPrompt').style.display==='block',{timeout:30000});
   const initial=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.equal(initial.coins,0,label+': adjacent coin must not collect automatically');
   assert.equal(initial.quests.quests[0].progress,0);
   assert.match(await frame.locator('#interactPrompt').textContent(),/Квестовая кнопка/,label+': active quest gets E focus');
   for(let i=1;i<=3;i++){
    await press(frame,'e');
    const d=await frame.evaluate(()=>window.__bridgeDebugState());
    assert.equal(d.quests.quests[0].progress,i,label+': quest press '+i);
    assert.equal(d.coins,0,label+': coin cannot steal quest interaction');
   }
   await press(frame,'e');
   const after=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.equal(after.collected,1,label+': coin collected only on fourth E');
   assert.equal(after.coins,4,label+': collect=1 and graph bonus=3 exactly once');
   await press(frame,'q');
   await frame.getByRole('button',{name:'Забрать награду'}).click();
   const earned=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.equal(earned.coins,24,label+': quest reward added once');
   assert.equal(earned.quests.quests[0].claimed,true);
  }
  await check(play,'Play');
  await page.click('#btnStop');
  await page.selectOption('#exportProfile','warpgame');
  const dl=page.waitForEvent('download');await page.click('#btnBuild');
  released=await fs.readFile(await (await dl).path(),'utf8');
  assert.ok(Buffer.byteLength(released,'utf8')<=3000000,'WARPGAME 3MB cap');
  assert.ok(released.includes('interactPrompt'),'E prompt bundled into exported runtime');
  const game=await context.newPage();await game.goto('http://127.0.0.1:41437/released.html');
  await check(game,'HTML');
  await game.reload();
  await game.waitForFunction(()=>window.__bridgeDebugState&&window.__bridgeDebugState().coins===24,{timeout:30000});
  const reopened=await game.evaluate(()=>window.__bridgeDebugState());
  assert.equal(reopened.quests.quests[0].claimed,true,'quest restored after reload');
  assert.equal(reopened.collected,1,'legacy coin pickup persisted');
  console.log('v0.22.1 browser: real Coin+Quest collision, E priority, prompt, single graph, save, Play and standalone HTML PASS',{bytes:Buffer.byteLength(released)});
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
