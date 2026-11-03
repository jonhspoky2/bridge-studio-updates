// THREE_R128=/path/to/three.min.js node tests/play-v0184.cjs
const assert=require('node:assert/strict'), fs=require('node:fs/promises'), path=require('node:path');
const {chromium}=require('playwright');
async function test(){
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN,args:process.env.SWIFTSHADER?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
  try{
    require('node:child_process').execFileSync(process.env.PYTHON || (process.platform==='win32'?'python':'python3'), [
      path.join(__dirname,'../tools/build_studio.py'),'--check',path.join(__dirname,'../updates/v0.18.4/studio.html')
    ]);
    const engine=await fs.readFile(process.env.THREE_R128);
    for(const version of ['0.18.3','0.18.4']){
      const hardened=version==='0.18.4',context=await browser.newContext({viewport:{width:1440,height:900}});
      const html=await fs.readFile(path.join(__dirname,'../updates/v'+version+'/studio.html'));
      const address='http://127.0.0.1:41437/test-secret/studio.html',calls=[],external=[];
      await context.route('**/*',route=>{
        const u=new URL(route.request().url());
        if(u.origin!=='http://127.0.0.1:41437'){external.push(u.href);return route.abort();}
        if(u.pathname.endsWith('/studio.html'))return route.fulfill({contentType:'text/html;charset=utf-8',body:html});
        if(u.pathname.endsWith('/three.min.js'))return route.fulfill({contentType:'text/javascript',body:engine});
        if(u.pathname.endsWith('/__updates/apply'))calls.push(u.href);
        return route.fulfill({json:{}});
      });
      const page=await context.newPage();await page.goto(address);await page.waitForFunction(()=>window.__bridgeQA);
      const doc=await page.evaluate(()=>window.__bridgeQA().project);
      doc.name='Play isolation QA';
      doc.scripts.push({id:'probe',enabled:true,event:'start',name:'probe',code:`
        window.probe={};
        try{parent.document.querySelector('#projectName').value='changed';probe.dom=true;}catch(e){probe.dom=false;}
        try{localStorage.getItem('test');probe.storage=true;}catch(e){probe.storage=false;}
        probe.leaked=[document.referrer,document.baseURI,location.href].some(v=>v.includes('test-secret'));
        fetch('http://127.0.0.1:41437/test-secret/__updates/apply',{method:'POST',mode:'no-cors'}).then(()=>probe.sent=true,()=>probe.sent=false);
      `});
      await page.locator('#projectInput').setInputFiles({name:'qa.rwscene',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
      await page.waitForFunction(()=>window.__bridgeQA().project.name==='Play isolation QA');
      const before=await page.evaluate(()=>window.__bridgeQA().project);
      await page.click('#btnPlay');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'));
      const frame=await (await page.locator('#playFrame').elementHandle()).contentFrame();
      await frame.waitForFunction(()=>window.probe && typeof probe.sent==='boolean');
      const probe=await frame.evaluate(()=>probe);
      assert.equal(probe.dom,!hardened);assert.equal(probe.sent,!hardened);assert.equal(probe.storage,!hardened);
      assert.equal(calls.length,hardened?0:1);
      if(hardened){
        assert.equal(probe.leaked,false);assert.equal(await page.inputValue('#projectName'),doc.name);
        await frame.evaluate(()=>{try{top.location='about:blank';}catch(e){}});
        assert.equal(page.url(),address);
        await frame.waitForFunction(()=>window.__bridgeDebugState().grounded);
        for(const key of ['w','ц']){
          const pos=await frame.evaluate(()=>window.__bridgeDebugState().position);
          await frame.evaluate(key=>dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',key})),key);
          await frame.waitForFunction(p=>{const q=window.__bridgeDebugState().position;return Math.hypot(q[0]-p[0],q[2]-p[2])>.1;},pos);
          await frame.evaluate(key=>dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',key})),key);
        }
        await page.click('#btnStop');
        assert.deepEqual(await page.evaluate(()=>window.__bridgeQA().project),before);
        await page.click('#btnPlay');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('3D-кадр'));
        await page.click('#btnStop');
        assert.deepEqual(external,[]);
      }
      console.log(version,probe,'apply requests',calls.length);await context.close();
    }
  }finally{await browser.close();}
}
test().catch(e=>{console.error(e);process.exitCode=1;});
