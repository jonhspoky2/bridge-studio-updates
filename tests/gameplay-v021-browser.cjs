/* v0.21 browser: create gate by button, save, press E x3, export and repeat. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
(async()=>{
 const built=path.join(os.tmpdir(),'bridge-gameplay-v021.html');
 execFileSync('python3',[path.resolve(__dirname,'../tools/build_studio.py'),'--output',built]);
 const html=await fs.readFile(built);
 const three=await fs.readFile(require.resolve('three/build/three.min.js'));
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
 let exported='';
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/exported.html'&&exported)return route.fulfill({contentType:'text/html; charset=utf-8',body:exported});
  if(url.pathname.endsWith('/studio.html'))return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
  if(url.pathname.endsWith('/three.min.js')||url.pathname.endsWith('/r128/three.min.js'))return route.fulfill({contentType:'text/javascript',body:three});
  if(url.pathname.includes('/Playding/js/auth.js'))return route.fulfill({contentType:'text/javascript',body:''});
  if(url.hostname!=='127.0.0.1')return route.abort('internetdisconnected');
  return route.fulfill({status:404,body:'not found'});
 });
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:41437/test/studio.html');
 await page.waitForFunction(()=>typeof window.__bridgeQA==='function');
 const blank={format:'rwbridge.game',version:2,name:'Visual Signals QA',settings:{sky:'#80bbeb',moveSpeed:5,jumpPower:7.6},objects:[
  {id:'floor',name:'Ground',type:'ground',position:[0,-.5,0],rotation:[0,0,0],scale:[16,1,16],color:'#579287',solid:true,action:'none',value:0},
  {id:'spawn',name:'Spawn',type:'spawn',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#66e8ca',solid:false,action:'none',value:0}
 ],ui:[],scripts:[],graphs:[]};
 await page.locator('#projectInput').setInputFiles({name:'signal-qa.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(blank))});
 await page.waitForFunction(()=>window.__bridgeQA().project.name==='Visual Signals QA');
 await page.click('[data-tab="logic"]');
 await page.click('#makeUnlockGateDemo');
 let doc=await page.evaluate(()=>window.__bridgeQA().project);
 assert.equal(doc.graphs.length,2);
 const signalGraph=doc.graphs.find(g=>g.event==='signal');
 const switchGraph=doc.graphs.find(g=>g.event==='interact');
 assert.equal(signalGraph.signal,'gate_unlocked');
 assert.equal(switchGraph.nodes.find(n=>n.type==='ifCounter').compare,'eq');
 assert.ok(doc.objects.some(o=>o.components&&o.components.some(c=>c.type==='door'&&c.activation==='graph')));
 assert.equal(await page.locator('#logicEvent').inputValue(),'interact');
 await page.locator('#logicGraphList .listbtn').nth(1).click();
 assert.equal(await page.locator('#logicEvent').inputValue(),'signal');
 assert.equal(await page.locator('#logicSignalName').inputValue(),'gate_unlocked');
 assert.equal(await page.locator('#logicSignalSettings').isVisible(),true);
 await page.locator('#logicGraphList .listbtn').first().click();
 const download=page.waitForEvent('download');await page.click('#saveProject');
 const saved=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));
 assert.deepEqual(saved.graphs,doc.graphs,'save keeps graphs, signals and conditions');
 assert.deepEqual(saved.objects,doc.objects,'save keeps switch and graph-only door');
 async function pressE(frame){
  await frame.evaluate(()=>{
   window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',key:'e',bubbles:true}));
   window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',key:'e',bubbles:true}));
  });
 }
 async function exercise(frame,where){
  await frame.waitForFunction(()=>window.__bridgeDebugState);
  for(let i=1;i<=4;i++){
   await pressE(frame);
   const state=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.equal(state.counters.gate_presses,i,where+': E press '+i+' registered');
   if(i<=2)assert.equal(state.coins,0,where+': no early reward');
   else assert.equal(state.coins,10,where+': reward exactly once');
  }
  const final=await frame.evaluate(()=>window.__bridgeDebugState());
  assert.ok(final.graphTrace.some(x=>x.event==='signal'),where+': named signal graph ran');
  assert.ok(final.doorStates.length>=1,where+': door exists');
  await frame.waitForFunction(()=>window.__bridgeDebugState().doorStates.some(d=>d.open),null,{timeout:30000});
 }
 await page.click('#btnPlay');
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'),{timeout:25000});
 const frame=await (await page.locator('#playFrame').elementHandle()).contentFrame();
 await exercise(frame,'Play');
 await page.click('#btnStop');
 await page.selectOption('#exportProfile','warpgame');
 const build=page.waitForEvent('download');await page.click('#btnBuild');
 exported=await fs.readFile(await (await build).path(),'utf8');
 assert.ok(Buffer.byteLength(exported,'utf8')<=3000000,'WARPGAME export size remains under 3MB');
 assert.ok(exported.includes('"event":"signal"'),'named signal survives HTML export');
 const released=await context.newPage();
 await released.goto('http://127.0.0.1:41437/exported.html');
 await exercise(released,'HTML');
 console.log('v0.21 browser: editor + save + Play + 3 E presses + signal + door + HTML passed',{bytes:Buffer.byteLength(exported)});
 await context.close();
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
