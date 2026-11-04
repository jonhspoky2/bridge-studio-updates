/* Asset Studio Material Bank: legacy .rwscene, PBR application, .rwlib and Play/export. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const output=path.join(os.tmpdir(),'bridge-material-bank.html');
 execFileSync('python3',[path.resolve(__dirname,'../tools/build_studio.py'),'--output',output]);
 const editor=await fs.readFile(output),three=await fs.readFile(require.resolve('three/build/three.min.js'));
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  let exportHtml='';
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith('/studio.html'))return route.fulfill({contentType:'text/html; charset=utf-8',body:editor});
   if(u.pathname==='/game.html'&&exportHtml)return route.fulfill({contentType:'text/html; charset=utf-8',body:exportHtml});
   if(u.pathname.endsWith('/three.min.js'))return route.fulfill({contentType:'text/javascript',body:three});
   if(u.pathname.includes('/Playding/js/auth.js'))return route.fulfill({contentType:'text/javascript',body:''});
   return route.fulfill({status:404,body:'not found'});
  });
  const page=await context.newPage();await page.goto('http://127.0.0.1:41437/studio.html');
  await page.waitForFunction(()=>typeof window.__bridgeQA==='function');
  const doc={format:'rwbridge.game',version:2,name:'Legacy Material QA',settings:{sky:'#88c5f1'},
   objects:[
    {id:'floor',name:'Floor',type:'ground',position:[0,-.5,0],rotation:[0,0,0],scale:[16,1,16],color:'#568781',solid:true,action:'none',value:0},
    {id:'spawn',name:'Spawn',type:'spawn',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#5de3b4',solid:false,action:'none',value:0},
    {id:'source',name:'PBR Source',type:'block',position:[-2,1,-1],rotation:[0,0,0],scale:[1,2,1],color:'#336699',solid:true,action:'none',value:0,material:{roughness:.2,metalness:.75,opacity:1,emissive:'#112233',emissiveIntensity:.4}},
    {id:'target',name:'PBR Target',type:'block',position:[2,1,-1],rotation:[0,0,0],scale:[1,2,1],color:'#dd8844',solid:true,action:'none',value:0}
   ],ui:[],scripts:[],graphs:[],items:[]};
  const load=async(name,data)=>{await page.locator('#projectInput').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});};
  await load('legacy.rwscene',doc);
  await page.waitForFunction(()=>window.__bridgeQA().project.name==='Legacy Material QA');
  let scene=await page.evaluate(()=>window.__bridgeQA().project);
  assert.deepEqual(scene.materials,[],'old rwscene receives optional empty bank');
  await page.locator('#objectList .listbtn').filter({hasText:'PBR Source'}).click();
  await page.click('#saveSelectionMaterial');
  scene=await page.evaluate(()=>window.__bridgeQA().project);
  assert.equal(scene.materials.length,1,'saved material');
  assert.equal(scene.materials[0].roughness,.2);
  assert.equal(scene.materials[0].metalness,.75);
  assert.equal(scene.materials[0].color,'#336699');
  await page.locator('#objectList .listbtn').filter({hasText:'PBR Target'}).click();
  await page.locator('#materialLibrary button').filter({hasText:'Применить к выделенным'}).click();
  scene=await page.evaluate(()=>window.__bridgeQA().project);
  const target=scene.objects.find(o=>o.id==='target');
  assert.equal(target.color,'#336699','PBR color applied');
  assert.equal(target.material.metalness,.75,'metalness applied');
  assert.equal(target.material.roughness,.2,'roughness applied');
  assert.equal(target.material.emissive,'#112233','emissive applied');
  const sceneDl=page.waitForEvent('download');await page.click('#saveProject');
  const saved=JSON.parse(await fs.readFile(await (await sceneDl).path(),'utf8'));
  assert.deepEqual(saved.materials,scene.materials,'materials stored in rwscene');
  const libraryDl=page.waitForEvent('download');await page.click('#exportLibrary');
  const library=JSON.parse(await fs.readFile(await (await libraryDl).path(),'utf8'));
  assert.equal(library.version,1,'original library format retained');
  assert.equal(library.materials.length,1,'material exported in rwlib');
  await page.click('#btnPlay');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'),{timeout:25000});
  const frame=await (await page.locator('#playFrame').elementHandle()).contentFrame();
  await frame.waitForFunction(()=>window.__bridgeDebugState&&window.__bridgeDebugState().objects===4,{timeout:25000});
  await page.click('#btnStop');
  await page.selectOption('#exportProfile','warpgame');
  const htmlDl=page.waitForEvent('download');await page.click('#btnBuild');
  exportHtml=await fs.readFile(await (await htmlDl).path(),'utf8');
  assert.ok(Buffer.byteLength(exportHtml,'utf8')<=3000000,'export <= 3 MB');
  const match=exportHtml.match(/<script id="bridge-game-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match,'embedded game document found');
  const exportedDoc=JSON.parse(match[1]);
  assert.equal(exportedDoc.objects.find(x=>x.id==='target').material.metalness,.75);
  assert.equal(exportedDoc.materials,undefined,'bank metadata excluded from export');
  const game=await context.newPage();await game.goto('http://127.0.0.1:41437/game.html');
  await game.waitForFunction(()=>window.__bridgeDebugState&&window.__bridgeDebugState().objects===4,{timeout:25000});
  await load('saved.rwscene',saved);
  await page.waitForFunction(()=>window.__bridgeQA().project.materials.length===1);
  assert.equal(await page.locator('#materialLibrary .asset-card').count(),1,'bank restored after scene reopen');
  const second={...doc,name:'Material import QA'};
  await load('second.rwscene',second);
  await page.waitForFunction(()=>window.__bridgeQA().project.name==='Material import QA');
  await page.locator('#libraryInput').setInputFiles({name:'material.rwlib',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(library))});
  await page.waitForFunction(()=>window.__bridgeQA().project.materials.length===1);
  assert.equal((await page.evaluate(()=>window.__bridgeQA().project)).materials[0].metalness,.75,'material imported from rwlib');
  // Backwards-compatible import: previous libraries have no materials field.
  await page.locator('#libraryInput').setInputFiles({name:'old.rwlib',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'rwbridge.library',version:1,assets:[],textures:[],prefabs:[]}))});
  assert.equal((await page.evaluate(()=>window.__bridgeQA().project)).materials.length,1,'legacy rwlib supported');
  console.log('Material Bank: save/apply PBR, legacy rwscene/rwlib, Play, WARPGAME export, restore PASS',{bytes:Buffer.byteLength(exportHtml)});
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
