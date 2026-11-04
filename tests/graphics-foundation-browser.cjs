/* Graphics Foundation browser: actual lighting presets, legacy scene, Play and HTML. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const output=path.join(os.tmpdir(),'bridge-graphics-foundation.html');
 execFileSync('python3',[path.resolve(__dirname,'../tools/build_studio.py'),'--output',output]);
 const editor=await fs.readFile(output),three=await fs.readFile(require.resolve('three/build/three.min.js'));
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  let exported='';
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/studio.html'))return route.fulfill({contentType:'text/html; charset=utf-8',body:editor});
   if(url.pathname==='/graphics.html'&&exported)return route.fulfill({contentType:'text/html; charset=utf-8',body:exported});
   if(url.pathname.endsWith('/three.min.js'))return route.fulfill({contentType:'text/javascript',body:three});
   if(url.pathname.includes('/Playding/js/auth.js'))return route.fulfill({contentType:'text/javascript',body:''});
   return route.fulfill({status:404,body:'not found'});
  });
  const page=await context.newPage();await page.goto('http://127.0.0.1:41437/studio.html');
  await page.waitForFunction(()=>typeof window.__bridgeQA==='function');
  const legacy={format:'rwbridge.game',version:2,name:'Legacy Graphics QA',settings:{sky:'#95cae5',lighting:{sunIntensity:1.9,sunColor:'#ffeedd'}},
   objects:[{id:'floor',name:'Floor',type:'ground',position:[0,-.5,0],rotation:[0,0,0],scale:[14,1,14],color:'#6a8371',solid:true,action:'none',value:0},
    {id:'spawn',name:'Spawn',type:'spawn',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#4ed6a4',solid:false,action:'none',value:0}],
   ui:[],scripts:[],graphs:[],items:[]};
  await page.locator('#projectInput').setInputFiles({name:'old-graphics.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await page.waitForFunction(()=>window.__bridgeQA().project.name==='Legacy Graphics QA');
  assert.equal(await page.locator('#graphicsPreset').inputValue(),'custom','legacy scene not forced to new look');
  let scene=await page.evaluate(()=>window.__bridgeQA().project);
  assert.equal(scene.settings.sky,'#95cae5','legacy sky preserved');
  assert.equal(scene.settings.lighting.sunIntensity,1.9,'legacy lighting preserved');
  assert.equal(scene.settings.lighting.exposure,undefined,'legacy lighting not rewritten');
  for(const name of ['classic','golden','midnight','vibrant']){
   await page.selectOption('#graphicsPreset',name);
   scene=await page.evaluate(()=>window.__bridgeQA().project);
   assert.equal(scene.settings.graphicsPreset,name,'preset selected');
   assert.ok(scene.settings.lighting.exposure>=.45,'preset exposure persisted');
   assert.equal(scene.settings.lighting.sunY>0,true,'sun height stored');
  }
  assert.equal(scene.settings.sky,'#60baff');
  assert.equal(scene.settings.lighting.exposure,1.15);
  assert.equal(scene.settings.lighting.sunX,-14);
  await page.locator('[data-light="exposure"]').fill('1.6');
  await page.locator('[data-light="exposure"]').dispatchEvent('change');
  assert.equal(await page.locator('#graphicsPreset').inputValue(),'custom','manual edits become custom');
  assert.equal((await page.evaluate(()=>window.__bridgeQA().project)).settings.lighting.exposure,1.6);
  await page.selectOption('#graphicsPreset','vibrant');
  await page.selectOption('[data-light="shadowQuality"]','high');
  await page.locator('[data-light="shadowDistance"]').fill('42');
  await page.locator('[data-light="shadowDistance"]').dispatchEvent('change');
  await page.locator('[data-light="shadowBias"]').fill('-0.001');
  await page.locator('[data-light="shadowBias"]').dispatchEvent('change');
  const buildShadow=await page.evaluate(()=>window.__bridgeQA().shadowRender);
  assert.equal(buildShadow.mapSize,2048,'Build shadow map uses selected high quality');
  assert.equal(buildShadow.distance,42,'Build sunlight shadow frustum follows Inspector');
  assert.equal(buildShadow.bias,-.001,'Build uses configured shadow bias');
  assert.equal(await page.locator('#graphicsPreset').inputValue(),'custom','manual shadow tuning switches to custom');
  await fs.mkdir(path.resolve(__dirname,'screenshots'),{recursive:true});
  await page.locator('#viewport').screenshot({path:path.resolve(__dirname,'screenshots/graphics-shadow-build.png')});
  const download=page.waitForEvent('download');await page.click('#saveProject');
  const saved=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));
  assert.equal(saved.settings.graphicsPreset,'custom','custom shadow look stored in .rwscene');
  assert.equal(saved.settings.lighting.shadowQuality,'high');
  assert.equal(saved.settings.lighting.shadowDistance,42);
  assert.equal(saved.settings.lighting.shadowBias,-0.001);
  assert.equal(saved.settings.lighting.exposure,1.15);
  await page.click('#btnPlay');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'),{timeout:25000});
  const frame=await (await page.locator('#playFrame').elementHandle()).contentFrame();
  const play=await frame.evaluate(()=>window.__bridgeDebugState());
  assert.equal(play.environment.sunColor,'#fff4c9');
  assert.equal(play.shadowRender.mapSize,2048,'Play shadow resolution matches Build');
  assert.equal(play.shadowRender.distance,42,'Play shadow distance matches Build');
  assert.equal(play.shadowRender.bias,-.001,'Play shadow bias matches Build');
  assert.equal(play.environment.fog,true);
  assert.equal(play.renderExposure,1.15,'Play exposure matches selected look');
  assert.deepEqual(play.sunPosition,[-14,24,9],'Play sunlight matches scene data');
  await page.click('#btnStop');
  await page.selectOption('#exportProfile','warpgame');
  const dl=page.waitForEvent('download');await page.click('#btnBuild');
  exported=await fs.readFile(await (await dl).path(),'utf8');
  assert.ok(Buffer.byteLength(exported,'utf8')<=3000000,'3MB WARPGAME budget');
  const game=await context.newPage();await game.goto('http://127.0.0.1:41437/graphics.html');
  await game.waitForFunction(()=>window.__bridgeDebugState,{timeout:25000});
  await game.screenshot({path:path.resolve(__dirname,'screenshots/graphics-shadow-play.png')});
  const runtime=await game.evaluate(()=>window.__bridgeDebugState());
  assert.equal(runtime.renderExposure,1.15,'standalone exposure matches Play');
  assert.deepEqual(runtime.shadowRender,play.shadowRender,'standalone shadows match Play');
  assert.deepEqual(runtime.sunPosition,play.sunPosition,'standalone sun matches Play');
  assert.equal(runtime.environment.fogColor,play.environment.fogColor);
  await page.locator('#projectInput').setInputFiles({name:'saved-graphics.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
  await page.waitForFunction(()=>window.__bridgeQA().project.settings.graphicsPreset==='custom');
  assert.equal(await page.locator('#graphicsPreset').inputValue(),'custom','custom shadow look restored from saved project');
  assert.equal(await page.locator('[data-light="shadowQuality"]').inputValue(),'high');
  assert.equal(await page.locator('[data-light="shadowDistance"]').inputValue(),'42');
  console.log('Graphics Foundation browser: legacy .rwscene, four presets, custom controls, Play, HTML and reload PASS',{bytes:Buffer.byteLength(exported)});
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
