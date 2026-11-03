// THREE_R128=/path/to/three.min.js node tests/build-v0183.cjs
const {chromium} = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

async function test() {
  const html = await fs.readFile(path.join(__dirname,'../updates/v0.18.3/studio.html'));
  const previous = await fs.readFile(path.join(__dirname,'../updates/v0.18.2/studio.html'));
  const three = await fs.readFile(process.env.THREE_R128);
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_BIN,
    args:process.env.SWIFTSHADER ? ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] : []});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:900}});
    let game,active=previous,applies=0;
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/three.min.js')) return route.fulfill({body:three,contentType:'text/javascript'});
      if (url.pathname === '/studio.html') return route.fulfill({body:active,contentType:'text/html; charset=utf-8'});
      if (url.pathname === '/__updates/status') return route.fulfill({json:{current:active===previous?'0.18.2':'0.18.3',ready:active===previous,available:'0.18.3',configured:true}});
      if (url.pathname === '/__updates/apply') {
        assert.equal(route.request().method(),'POST');applies++;active=html;
        return route.fulfill({json:{ok:true,version:'0.18.3'}});
      }
      if (url.pathname === '/game.html') return route.fulfill({body:game,contentType:'text/html; charset=utf-8'});
      return route.fulfill({status:404,body:''});
    });
    const page = await context.newPage(),errors=[];
    context.on('page', p=>p.on('pageerror', e=>errors.push(e.message)));
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost/studio.html');
    await page.waitForFunction(()=>window.__bridgeQA);
    await page.click('#addBlock');
    await page.click('#btnUpdates');await page.click('#patchNotesInstall');await page.click('#patchSaveNo');
    assert.equal(applies,0);assert.ok(await page.evaluate(()=>window.__bridgeQA().dirty));
    await page.click('#patchNotesInstall');
    await page.evaluate(()=>{window.showSaveFilePicker=async ()=>(await navigator.storage.getDirectory()).getFileHandle('upgrade.rwscene',{create:true});});
    await Promise.all([page.waitForNavigation(),page.click('#patchSaveYes')]);
    assert.equal(applies,1);assert.match(await page.title(),/0\.18\.3/);
    console.log('PASS 0.18.2 dialog cancels, then saves and reloads the actual 0.18.3 payload');
    const start=Date.now();
    await page.goto('http://localhost/studio.html');
    await page.waitForFunction(()=>window.__bridgeQA && window.THREE.REVISION==='128');
    const loadMs=Date.now()-start;
    const scene=()=>page.evaluate(()=>window.__bridgeQA().project);
    if(process.env.BRIDGE_EXAMPLES){
      for(const name of ['coin-rush-project','gameplay-lab']){
        const data=JSON.parse(await fs.readFile(path.join(process.env.BRIDGE_EXAMPLES,name+'.rwscene'),'utf8'));
        data.auditCanary={revision:18};data.name='Legacy '+name;
        await page.locator('#projectInput').setInputFiles({name:name+'.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
        await page.waitForFunction(n=>window.__bridgeQA().project.name===n,data.name);
        const download=page.waitForEvent('download');await page.click('#saveProject');
        const bytes=await fs.readFile(await (await download).path());
        const saved=JSON.parse(bytes);assert.deepEqual(saved.auditCanary,data.auditCanary);
        assert.deepEqual(saved.objects.map(o=>o.id),data.objects.map(o=>o.id));
        await page.reload();await page.waitForFunction(()=>window.__bridgeQA);
        await page.locator('#projectInput').setInputFiles({name:name+'.rwscene',mimeType:'application/json',buffer:bytes});
        await page.waitForFunction(n=>window.__bridgeQA().project.name===n,data.name);
        assert.deepEqual(await scene(),saved);
      }
      console.log('PASS two archived projects round-trip including unknown metadata');
      await page.reload();await page.waitForFunction(()=>window.__bridgeQA);
    }
    const initial=await scene();
    await page.click('#addBlock');await page.click('#undoBtn');assert.deepEqual((await scene()).objects,initial.objects);
    await page.click('#redoBtn');assert.equal((await scene()).objects.length,initial.objects.length+1);
    const model = await page.locator('#embedded-demo-data').textContent();
    await page.locator('#fileInput').setInputFiles({name:'audit.glb',mimeType:'model/gltf-binary',buffer:Buffer.from(model,'base64')});
    await page.waitForFunction(n=>window.__bridgeQA().project.objects.length===n,initial.objects.length+2);
    const source=await scene();
    const restore=async doc=>{
      await page.locator('#projectInput').setInputFiles({name:'audit.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
      await page.waitForFunction(n=>window.__bridgeQA().project.auditPadding?.length===n,doc.auditPadding.length);
    };
    source.auditPadding='';await restore(source);
    const exportGame=async (profile='warpgame')=>{
      await page.selectOption('#exportProfile',profile);
      const dl=page.waitForEvent('download');await page.click('#btnBuild');
      return fs.readFile(await (await dl).path());
    };
    const before=await scene();
    await page.click('#btnPlay');
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'));
    await page.click('#btnStop');assert.deepEqual(await scene(),before);
    const started=Date.now();game=await exportGame();
    const baseSize=game.length,buildMs=Date.now()-started;
    const exported=await context.newPage();await exported.goto('http://localhost/game.html');
    await exported.waitForFunction(()=>window.__bridgeDebugState?.().grounded);
    const position=await exported.evaluate(()=>window.__bridgeDebugState().position);
    await exported.keyboard.down('w');
    await exported.waitForFunction(p=>{const q=window.__bridgeDebugState().position;return Math.hypot(q[0]-p[0],q[2]-p[2])>0.15;},position);
    await exported.keyboard.up('w');await exported.close();
    // UTF-8 boundary. The field is inert project metadata retained by format version 2.
    const limit=3000000,extra=limit-baseSize;
    assert.ok(extra>0);
    source.auditPadding='я'.repeat(Math.floor(extra/2))+'a'.repeat(extra%2);await restore(source);
    assert.equal((await exportGame()).length,limit);
    source.auditPadding+='x';await restore(source);
    let downloads=0;const count=()=>downloads++;page.on('download',count);
    await page.click('#btnBuild');
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Превышение на 1 байт'));
    // A subsequent allowed download supplies a positive control for the event listener.
    source.auditPadding+='я'.repeat(200);await restore(source);
    assert.ok((await exportGame('standalone')).length>limit);
    assert.equal(downloads,1);
    assert.ok((await exportGame('offline')).length>limit);
    assert.equal(downloads,2);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({loadMs,buildMs,baseSize,objects:source.objects.length}));
    console.log('PASS undo/redo, GLB import, .rwscene reload, Play/Stop, exported WebGL movement and ground contact, UTF-8 limits, Standalone CDN/offline');
  } finally {await browser.close();}
}
test().catch(e=>{console.error(e);process.exitCode=1;});
