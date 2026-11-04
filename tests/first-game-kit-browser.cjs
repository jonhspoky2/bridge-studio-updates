/* First Game Kit: author real scene, GLB/PBR, chain, gate graph, HUD, Play and HTML. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const output=path.join(os.tmpdir(),'bridge-first-game-kit.html');
 execFileSync('python3',[path.resolve(__dirname,'../tools/build_studio.py'),'--output',output]);
 const editor=await fs.readFile(output),three=await fs.readFile(require.resolve('three/build/three.min.js'));
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  let exported='';
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/studio.html'))return route.fulfill({contentType:'text/html; charset=utf-8',body:editor});
   if(url.pathname==='/kit.html'&&exported)return route.fulfill({contentType:'text/html; charset=utf-8',body:exported});
   if(url.pathname.endsWith('/three.min.js'))return route.fulfill({contentType:'text/javascript',body:three});
   if(url.pathname.includes('/Playding/js/auth.js'))return route.fulfill({contentType:'text/javascript',body:''});
   return route.fulfill({status:404,body:'not found'});
  });
  const page=await context.newPage();await page.goto('http://127.0.0.1:41437/studio.html');await page.waitForFunction(()=>window.__bridgeQA);
  page.on('dialog',dialog=>dialog.accept());
  await page.click('#makeFirstGameKit');
  await page.waitForFunction(()=>window.__bridgeQA().project.name.includes('Quest Island'));
  const project=await page.evaluate(()=>window.__bridgeQA().project);
  assert.equal(project.quests.length,2,'two quests');
  assert.equal(project.quests[1].requiresQuestId,project.quests[0].id,'quest chain');
  assert.equal(project.settings.graphicsPreset,'vibrant','graphics foundation selected');
  assert.equal(project.settings.saveProgress,true);
  assert.ok(project.objects.filter(x=>x.action==='collect').length===3,'three coins');
  assert.equal(project.items.length,2,'two shop/reward items');
  assert.ok(project.graphs.some(g=>g.nodes.some(n=>n.type==='ifFlag')),'graph gate progression');
  assert.ok(project.materials.length>=1,'PBR Material Bank included');
  assert.ok(project.objects.some(o=>o.type==='glb'),'real embedded GLB model included');
  assert.ok(project.assets.length>=1,'GLB linked through asset browser');
  const saveDl=page.waitForEvent('download');await page.click('#saveProject');
  const rwscene=JSON.parse(await fs.readFile(await (await saveDl).path(),'utf8'));
  assert.deepEqual(rwscene.quests,project.quests,'quest definitions saved');
  assert.equal(rwscene.objects.find(o=>o.id==='kit_rover').assetId,'kit_rover_glb');
  await page.click('#btnPlay');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'),{timeout:30000});
  const frame=await (await page.locator('#playFrame').elementHandle()).contentFrame();
  async function press(frame,key){await frame.evaluate(k=>{
   window.dispatchEvent(new KeyboardEvent('keydown',{code:'Key'+k.toUpperCase(),key:k,bubbles:true}));
   window.dispatchEvent(new KeyboardEvent('keyup',{code:'Key'+k.toUpperCase(),key:k,bubbles:true}));
  },key);}
  async function journey(frame,label){
   await frame.waitForFunction(()=>window.__bridgeDebugState&&window.__bridgeDebugState().objects>=16,{timeout:30000});
   let state=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.ok(state.glbInstances>=1,label+' GLB instance');
   assert.equal(state.environment.fog,true,label+' Vibrant environment');
   assert.equal(state.quests.quests.find(q=>q.id==='kit_q_gate').locked,true,label+' gate quest locked');
   for(let i=1;i<=3;i++){
    await press(frame,'e');
    state=await frame.evaluate(()=>window.__bridgeDebugState());
    assert.equal(state.collected,i,label+' coin collect '+i);
    assert.equal(state.quests.quests.find(q=>q.id==='kit_q_coins').progress,i,label+' quest progress');
   }
   await press(frame,'q');
   await frame.getByRole('button',{name:'Забрать награду'}).click();
   state=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.equal(state.coins,9,label+' coin collection and first reward');
   assert.equal(state.quests.quests.find(q=>q.id==='kit_q_gate').locked,false,label+' gate quest unlocked');
   await press(frame,'q');await press(frame,'e');
   state=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.equal(state.quests.quests.find(q=>q.id==='kit_q_gate').progress,1,label+' console quest progress');
   assert.equal(state.flags.gate_open,true,label+' graph flag set');
   // The graph sets the door target instantly, but the door opens with a WebGL
   // animation. Observe the physical gate after enough rendered frames.
   await frame.waitForFunction(()=>window.__bridgeDebugState().doorStates.some(d=>d.id==='kit_door'&&d.open),{timeout:6000});
   assert.equal((await frame.evaluate(()=>window.__bridgeDebugState())).doorStates.find(d=>d.id==='kit_door').open,true,label+' graph-controlled door opens');
   await press(frame,'q');
   await frame.getByRole('button',{name:'Забрать награду'}).click();
   state=await frame.evaluate(()=>window.__bridgeDebugState());
   assert.equal(state.coins,13,label+' second reward');
   assert.ok(state.inventory.inventory.kit_pass===1,label+' inventory receives quest reward');
   assert.equal(state.quests.quests.filter(q=>q.claimed).length,2,label+' both quests complete');
  }
  await journey(frame,'Play');
  await page.click('#btnStop');await page.selectOption('#exportProfile','warpgame');
  const dl=page.waitForEvent('download');await page.click('#btnBuild');
  exported=await fs.readFile(await (await dl).path(),'utf8');
  assert.ok(Buffer.byteLength(exported,'utf8')<=3000000,'WARPGAME 3MB');
  const game=await context.newPage();await game.goto('http://127.0.0.1:41437/kit.html');
  await journey(game,'Standalone HTML');
  await game.reload();
  await game.waitForFunction(()=>window.__bridgeDebugState&&window.__bridgeDebugState().coins===13,{timeout:30000});
  const restored=await game.evaluate(()=>window.__bridgeDebugState());
  assert.equal(restored.collected,3,'coin pickups persisted');
  assert.equal(restored.quests.quests.filter(q=>q.claimed).length,2,'quest chain persisted');
  assert.equal(restored.inventory.inventory.kit_pass,1,'item reward persisted');
  assert.equal(restored.flags.gate_open,true,'graph flag survives save reload');
  await game.waitForFunction(()=>window.__bridgeDebugState().doorStates.some(d=>d.id==='kit_door'&&d.open),{timeout:6000});
  assert.equal((await game.evaluate(()=>window.__bridgeDebugState())).doorStates.find(d=>d.id==='kit_door').open,true,'opened gate survives save reload');

  // Corrupted or stale saves must not duplicate collection or hide non-pickup
  // scene objects. This also guards against future edits reusing object IDs.
  await game.evaluate(()=>{
   const key=Object.keys(localStorage).find(k=>k.startsWith('bridge-game-save:v1:'));
   if(!key)throw Error('missing game save');
   const save=JSON.parse(localStorage.getItem(key));
   save.collected=999;
   save.picked=['kit_coin1','kit_coin1','kit_coin2','kit_coin3','unknown_coin'];
   save.componentPicked=['kit_door','kit_rover','kit_button'];
   save.doorTargets=['kit_door','kit_coin1','unknown_door'];
   save.flags={gate_open:true,invalid:'not a boolean','__proto__':true};
   save.checkpoint=[Infinity,0,0];
   localStorage.setItem(key,JSON.stringify(save));
  });
  await game.reload();
  await game.waitForFunction(()=>window.__bridgeDebugState&&window.__bridgeDebugState().objects>=16);
  const recovered=await game.evaluate(()=>window.__bridgeDebugState());
  assert.equal(recovered.collected,3,'collected derived from unique existing pickups');
  assert.deepEqual(recovered.pickedComponentIds,[],'non-pickup component IDs ignored');
  assert.equal(recovered.flags.gate_open,true,'valid flag survives malformed save');
  await game.waitForFunction(()=>window.__bridgeDebugState().doorStates.some(d=>d.id==='kit_door'&&d.open),{timeout:6000});
  assert.equal(recovered.quests.quests.filter(q=>q.claimed).length,2,'quest progress retained after recovery');

  await page.locator('#projectInput').setInputFiles({name:'kit.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(rwscene))});
  await page.waitForFunction(()=>window.__bridgeQA().project.name.includes('Quest Island'));
  const reread=await page.evaluate(()=>window.__bridgeQA().project);
  assert.equal(reread.assets.length,project.assets.length,'GLB preserved in rwscene');
  assert.deepEqual(reread.graphs,project.graphs,'gate graphs preserved');
  assert.equal(reread.settings.graphicsPreset,'vibrant','graphics profile preserved');
  console.log('First Game Kit: authoring, real GLB, Play, 3 coins, quest unlock, gate, rewards, WARPGAME HTML and save PASS',{bytes:Buffer.byteLength(exported)});
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});