// UI integration against the current source build. Uses Playwright and Three.js r128.
'use strict';
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const built=path.join(os.tmpdir(),'bridge-design-d01.html');
 execFileSync('python3',[path.resolve(__dirname,'../tools/build_studio.py'),'--output',built]);
 const html=await fs.readFile(built),three=await fs.readFile(process.env.THREE_R128||require.resolve('three/build/three.min.js'));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try {
  const ctx=await browser.newContext({viewport:{width:1280,height:720}});
  let exported;const errors=[];
  await ctx.route('**/*',r=>{
   const u=new URL(r.request().url());
   if(u.pathname.endsWith('/studio.html'))return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
   if(u.pathname.endsWith('/game.html'))return r.fulfill({contentType:'text/html; charset=utf-8',body:exported});
   if(u.pathname.endsWith('/three.min.js'))return r.fulfill({contentType:'text/javascript',body:three});
   return r.fulfill({json:{current:'0.21.0',configured:true,ready:false}});
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1/test/studio.html');await page.waitForFunction(()=>window.__bridgeQA);
  await page.click('#addBlock');
  await page.locator('[data-prop="name"]').fill('D-01 Object');await page.locator('[data-prop="name"]').press('Tab');
  await page.locator('[data-vector="position"][data-i="0"]').fill('2.5');await page.locator('[data-vector="position"][data-i="0"]').press('Tab');
  assert.equal(await page.evaluate(()=>window.__bridgeQA().project.objects.find(o=>o.name==='D-01 Object').position[0]),2.5);
  await page.click('[data-tab="logic"]');
  assert.equal(await page.locator('#logicEmpty').isVisible(),true);
  await page.click('#addLogicGraph');
  assert.equal(await page.locator('#logicEmpty').isVisible(),false);
  assert.equal(await page.locator('#logicTimerSettings').isVisible(),false);
  assert.equal(await page.locator('#logicSignalSettings').isVisible(),false);
  await page.locator('[data-logic-prop="text"]').fill('UI graph works');await page.locator('[data-logic-prop="text"]').press('Tab');
  const getGraph=()=>page.evaluate(()=>window.__bridgeGameplayQA.getGraph());
  let graph=await getGraph();const message=graph.nodes[0].id;
  assert.equal(graph.nodes[0].text,'UI graph works');
  await page.selectOption('#logicNodeType','ifCoins');await page.click('#logicAddNode');
  graph=await getGraph();const condition=graph.nodes.at(-1).id;
  await page.locator('[data-node-id="'+condition+'"][data-logic-out="yes"]').click();
  await page.locator('[data-logic-in="'+message+'"]').click();
  assert.ok((await getGraph()).links.some(l=>l.from===condition&&l.to===message&&l.port==='yes'));
  // Real mouse drag on the title exercises the editor handlers.
  await page.locator('[data-node="'+message+'"] strong').scrollIntoViewIfNeeded();
  const box=await page.locator('[data-node="'+message+'"] strong').boundingBox();
  const old=(await getGraph()).nodes.find(n=>n.id===message);
  await page.mouse.move(box.x+20,box.y+8);await page.mouse.down();await page.mouse.move(box.x+65,box.y+48,{steps:8});await page.mouse.up();
  const moved=(await getGraph()).nodes.find(n=>n.id===message);
  assert.ok(moved.x>old.x+30&&moved.y>old.y+25);
  const wireAligned=await page.evaluate(()=>{
   const wire=document.querySelector('#logicWires path');
   const nums=wire.getAttribute('d').match(/-?[\d.]+/g).map(Number);
   const rect=document.querySelector('#logicGraphSurface').getBoundingClientRect();
   const port=document.querySelector('[data-node-id="start"][data-logic-out]').getBoundingClientRect();
   return Math.abs(nums[0]-(port.right-rect.left))<1&&Math.abs(nums[1]-(port.top+port.height/2-rect.top))<1;
  });
  assert.ok(wireAligned);
  await page.selectOption('#logicEvent','signal');
  assert.equal(await page.locator('#logicSignalSettings').isVisible(),true);
  await page.selectOption('#logicNodeType','emitSignal');await page.click('#logicAddNode');
  assert.equal(await page.locator('.logic-signal').count(),1);
  for(const [width,height] of [[1280,720],[1440,900],[1920,1080]]){
   await page.setViewportSize({width,height});
   const layout=await page.evaluate(()=>{
    const controls=Array.from(document.querySelectorAll('header button,header input,header select,#logicControls button,#logicControls select')).filter(e=>e.getClientRects().length);
    const header=document.querySelector('header').getBoundingClientRect();
    const canvas=document.querySelector('#logicCanvas').getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth>innerWidth,headerBottom:header.bottom,canvasTop:canvas.top,
     outside:controls.some(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight;}),
     panels:['.left','#logicNodeInspector','#logicGraphScroller'].map(s=>getComputedStyle(document.querySelector(s)).overflowY)};
   });
   assert.equal(layout.overflow,false);assert.equal(layout.outside,false);assert.equal(layout.headerBottom,layout.canvasTop);
   assert.ok(layout.panels.every(p=>p==='auto'));
   await page.click('#logicExit');
   const toolbar=await page.locator('#editorToolbar').boundingBox(),viewport=await page.locator('#viewport').boundingBox();
   assert.ok(toolbar.x>=viewport.x&&toolbar.x+toolbar.width<=viewport.x+viewport.width+1);
   await page.click('[data-tab="logic"]');
  }
  await page.locator('#logicExit').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid');
  const scene=await page.evaluate(()=>window.__bridgeQA().project);
  const download=page.waitForEvent('download');await page.click('#saveProject');
  assert.deepEqual(JSON.parse(await fs.readFile(await (await download).path(),'utf8')),scene);
  await page.click('#btnPlay');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'));
  await page.click('#btnStop');assert.deepEqual(await page.evaluate(()=>window.__bridgeQA().project),scene);
  const build=page.waitForEvent('download');await page.click('#btnBuild');
  exported=await fs.readFile(await (await build).path());assert.ok(exported.length<3000000);
  const game=await ctx.newPage();game.on('pageerror',e=>errors.push(e.message));await game.goto('http://127.0.0.1/game.html');
  await game.waitForFunction(()=>window.__bridgeDebugState?.().grounded);
  assert.deepEqual(errors,[]);
  console.log('D-01 PASS selection/properties; graph create/edit/link/drag; ports; signal fields; 3 viewports; focus; .rwscene; Play/Stop; exported WebGL');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
