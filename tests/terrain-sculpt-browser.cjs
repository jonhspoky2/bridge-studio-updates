/* Terrain v0.19.0 full editor UI + WebGL integration. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
(async()=>{
 const root=path.join(__dirname,'..'),built=path.join(os.tmpdir(),'bridge-v0190-sculpt.html');
 execFileSync(process.env.PYTHON||'python3',[path.join(root,'tools/build_studio.py'),'--output',built]);
 const editor=await fs.readFile(built);
 const engine=await fs.readFile(require.resolve('three/build/three.min.js'));
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const shots=path.join(__dirname,'screenshots');
 await fs.mkdir(shots,{recursive:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  let exported=null,errors=[],forbidden=[];
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/exported.html'&&exported)return route.fulfill({contentType:'text/html;charset=utf-8',body:exported});
   if(u.pathname.endsWith('/studio.html'))return route.fulfill({contentType:'text/html;charset=utf-8',body:editor});
   if(u.pathname.endsWith('/three.min.js'))return route.fulfill({contentType:'text/javascript',body:engine});
   if(u.pathname.endsWith('/r128/three.min.js'))return route.fulfill({contentType:'text/javascript',body:engine});
   if(u.pathname.includes('/Playding/js/auth.js'))return route.fulfill({contentType:'text/javascript',body:''});
   if(u.hostname!=='127.0.0.1'){forbidden.push(u.href);return route.abort('internetdisconnected');}
   return route.fulfill({status:404,body:'not found'});
  });
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:41437/test/studio.html');
  await page.waitForFunction(()=>typeof window.__bridgeQA==='function',{timeout:15000});
  assert.equal(await page.locator('#terrainSculptPanel').count(),1);
  await page.click('[data-tab="terrain"]');await page.click('#terrainFlat');
  await page.waitForFunction(()=>window.__bridgeQA().project.terrain?.chunks?.length===4);
  const flat=await page.evaluate(()=>window.__bridgeQA().project);
  assert.equal(flat.terrain.chunks.length,4);
  assert.ok(flat.terrain.chunks.every(c=>c.heights.every(h=>h===0)));
  await page.click('#terrainTool');
  assert.equal(await page.evaluate(()=>window.__bridgeQA().tool),'terrain');
  const canvas=page.locator('#viewport canvas').first();
  const bounds=await canvas.boundingBox();
  assert.ok(bounds&&bounds.width>300&&bounds.height>300);
  const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
  await page.locator('#terrainStrength').evaluate(el=>{el.value='12';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#terrainRadius').evaluate(el=>{el.value='5';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.screenshot({path:path.join(shots,'terrain-before.png')});
  await page.mouse.move(x,y);await page.mouse.down();
  for(let i=0;i<13;i++){await page.waitForTimeout(36);await page.mouse.move(x+(i+1)*3,y+Math.sin(i*.3)*5);}
  await page.mouse.up();
  const raised=await page.evaluate(()=>window.__bridgeQA().project);
  assert.ok(raised.terrain.chunks.some(c=>c.heights.some(h=>h>0)),'raise mouse drag must change height');
  const afterHeights=raised.terrain.chunks.map(c=>c.heights);
  await page.screenshot({path:path.join(shots,'terrain-raised.png')});
  await page.click('#undoBtn');
  const undo=await page.evaluate(()=>window.__bridgeQA().project);
  assert.deepEqual(undo.terrain,flat.terrain,'single Undo reverts drag');
  await page.click('#redoBtn');
  assert.deepEqual((await page.evaluate(()=>window.__bridgeQA().project)).terrain.chunks.map(c=>c.heights),afterHeights,'Redo restores drag');
  // Interleaved editing: Terrain delta commands and classic JSON snapshots share one history.
  await page.click('#addBlock');
  const withBlock=await page.evaluate(()=>window.__bridgeQA().project);
  assert.equal(withBlock.objects.length,raised.objects.length+1);
  await page.click('#undoBtn');
  assert.deepEqual((await page.evaluate(()=>window.__bridgeQA().project)).objects,raised.objects,'Undo removes ordinary object');
  await page.click('#undoBtn');
  assert.deepEqual((await page.evaluate(()=>window.__bridgeQA().project)).terrain,flat.terrain,'Undo passes through terrain command');
  await page.click('#redoBtn');
  assert.deepEqual((await page.evaluate(()=>window.__bridgeQA().project)).terrain.chunks.map(c=>c.heights),afterHeights,'mixed Redo restores terrain');
  await page.click('#redoBtn');
  assert.deepEqual((await page.evaluate(()=>window.__bridgeQA().project)).objects,withBlock.objects,'mixed Redo restores ordinary object');

  // Cancel pending brush with Escape must revert without altering completed stroke history.
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+25,y+10,{steps:4});
  await page.keyboard.press('Escape');await page.mouse.up();
  assert.deepEqual((await page.evaluate(()=>window.__bridgeQA().project)).terrain.chunks.map(c=>c.heights),afterHeights,'Escape cancels current stroke');
  for(const mode of ['smooth','lower','flatten']){
   await page.click('[data-terrain-brush="'+mode+'"]');
   assert.equal(await page.evaluate(()=>window.__bridgeQA().tool),'terrain');
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+15,y,{steps:5});await page.mouse.up();
   assert.equal(await page.evaluate(()=>window.__bridgeQA().sculpting),false);
  }
  await page.screenshot({path:path.join(shots,'terrain-final.png')});
  const done=await page.evaluate(()=>window.__bridgeQA().project);
  assert.ok(done.terrain);
  const saving=page.waitForEvent('download');
  await page.click('#saveProject');
  const downloaded=await saving;
  const saved=JSON.parse(await fs.readFile(await downloaded.path(),'utf8'));
  assert.deepEqual(saved.terrain,done.terrain);
  await page.locator('#projectInput').setInputFiles({name:'terrain-0190.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
  await page.waitForFunction(()=>window.__bridgeQA().project.terrain?.chunks?.length===4);
  assert.deepEqual((await page.evaluate(()=>window.__bridgeQA().project)).terrain,done.terrain);
  const beforePlay=await page.evaluate(()=>window.__bridgeQA().project);
  await page.click('#btnPlay');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'),{timeout:20000});
  const frame=await (await page.locator('#playFrame').elementHandle()).contentFrame();
  await frame.waitForFunction(()=>window.__bridgeDebugState&&window.__bridgeDebugState().grounded,{timeout:10000});
  assert.equal((await frame.evaluate(()=>window.__bridgeDebugState())).terrainChunks,4);
  await page.click('#btnStop');
  assert.deepEqual(await page.evaluate(()=>window.__bridgeQA().project),beforePlay,'Play and Stop must not mutate scene');
  const dl=page.waitForEvent('download');
  await page.selectOption('#exportProfile','warpgame');
  await page.click('#btnBuild');
  exported=await fs.readFile(await (await dl).path(),'utf8');
  assert.ok(Buffer.byteLength(exported,'utf8')<=3000000,'WARPGAME maximum 3MB');
  assert.ok(exported.includes('"terrain":{"version":1'));
  const game=await context.newPage();game.on('pageerror',e=>errors.push(e.message));
  await game.goto('http://127.0.0.1:41437/exported.html');
  await game.waitForFunction(()=>window.__bridgeDebugState?.().terrainChunks===4,{timeout:20000});
  await game.waitForFunction(()=>window.__bridgeDebugState().grounded,{timeout:10000});
  assert.deepEqual(forbidden,[],'must work without external internet');
  assert.deepEqual(errors,[],'no JS exceptions');
  console.log('Terrain Sculpt browser OK:',{brushes:4,chunks:4,warpgameBytes:Buffer.byteLength(exported,'utf8'),shots});
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
