// Run with Playwright, Chromium and a local copy of Three.js r128:
// THREE_R128=/path/to/three.min.js node tests/patch-save-v0182.cjs
// CHROMIUM_BIN and SWIFTSHADER can select a software-rendered Chromium.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function test() {
  const three = await fs.readFile(process.env.THREE_R128);
  const readEditor = version => fs.readFile(path.join(__dirname, '../updates/v' + version, 'studio.html'));
  const original = await readEditor('0.18.1');
  const patched = await readEditor('0.18.2');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_BIN,
    args: process.env.SWIFTSHADER ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] : []
  });
  const url = 'http://127.0.0.1:41437/test/studio.html';
  const context = await browser.newContext({viewport: {width: 1440, height: 900}});
  let current = '0.18.1', available = '0.18.2', applies = 0, exported;
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.route('**/*', async route => {
    const resource = new URL(route.request().url()).pathname.split('/').pop();
    if (resource === 'studio.html') return route.fulfill({contentType:'text/html; charset=utf-8', body:current === '0.18.1' ? original : patched});
    if (resource === 'three.min.js') return route.fulfill({contentType:'text/javascript', body:three});
    if (resource === 'game.html') return route.fulfill({contentType:'text/html; charset=utf-8', body:exported});
    if (resource === 'status') return route.fulfill({json:{current, available, ready:!!available, configured:true}});
    if (resource === 'apply') {
      assert.equal(route.request().method(), 'POST');
      applies++;
      if (current === '0.18.1') current = '0.18.2';
      available = '';
      return route.fulfill({json:{ok:true, version:current}});
    }
    return route.fulfill({json:{}});
  });
  let page = await context.newPage();
  const ready = async () => {
    await page.waitForFunction(() => window.__bridgeQA && window.THREE.REVISION === '128');
    await page.locator('#btnUpdates').waitFor({state:'visible'});
  };
  const install = async () => {
    await page.click('#btnUpdates');
    await page.click('#patchNotesInstall');
  };
  const yes = () => page.click('#patchSaveYes');
  const cancel = () => page.click('#patchSaveNo');
  const msg = text => page.waitForFunction(t => document.querySelector('#patchSaveMessage').textContent.includes(t), text);
  const dirty = () => page.evaluate(() => window.__bridgeQA().dirty);
  const download = async (click) => {
    const event = page.waitForEvent('download');
    await click();
    return fs.readFile(await (await event).path());
  };
  try {
    await page.goto(url);
    await ready();
    page.once('dialog', dialog => dialog.accept());
    await Promise.all([page.waitForNavigation(), install()]);
    await ready();
    assert.equal(applies, 1);
    assert.match(await page.title(), /0\.18\.2/);
    console.log('PASS original 0.18.1 UI applies fixture patch and reloads 0.18.2');
    available = '0.18.3'; // UI fixture only. No public update for this version.
    await page.reload();
    await ready();
    await page.fill('#projectName', 'Тест сохранения');
    await page.click('#addBlock');
    const saved = await download(() => page.click('#saveProject'));
    assert.equal(JSON.parse(saved).name, 'Тест сохранения');
    assert.equal(await dirty(), true);
    await install();
    assert.equal(await page.locator('#patchSaveYes').textContent(), 'Да, сохранить');
    assert.equal(await page.locator('#patchSaveNo').textContent(), 'Нет, отмена');
    if(process.env.MODAL_SCREENSHOT) await page.locator('#patchSaveDialog').screenshot({path:process.env.MODAL_SCREENSHOT});
    await page.keyboard.press('Delete');
    await cancel();
    assert.equal(await dirty(), true);
    assert.equal(applies, 1);
    await page.click('#patchNotesInstall');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#patchSaveDialog').open);
    assert.equal(await page.locator('#patchNotesBackdrop').isVisible(),true);
    console.log('PASS download preserves dirty flag, cancel and Escape preserve the scene');

    await page.click('#patchNotesInstall');
    await page.evaluate(() => {window.showSaveFilePicker = () => Promise.reject(new DOMException('Cancelled','AbortError'));});
    await yes(); await msg('Сохранение отменено');
    assert.equal(applies, 1); assert.equal(await dirty(), true);
    for (const method of ['createWritable','write','close']) {
      await page.evaluate(method => {
        window.showSaveFilePicker = async () => ({createWritable: async () => {
          if (method === 'createWritable') throw Error(method);
          return {write: async () => {if(method === 'write') throw Error(method);},
            close: async () => {if(method === 'close') throw Error(method);}, abort: async () => {}};
        }});
      }, method);
      await yes(); await msg(method);
      assert.equal(await dirty(), true); assert.equal(applies, 1);
    }
    console.log('PASS picker cancellation and create/write/close failures block apply');

    await page.evaluate(() => {window.showSaveFilePicker = undefined;});
    const candidate = await download(yes);
    assert.deepEqual(candidate, saved); assert.equal(await dirty(), true);
    await page.locator('#patchVerifyFile').dispatchEvent('cancel');
    await msg('не выбран');
    const selectFile = body => page.locator('#patchVerifyFile').setInputFiles({name:'scene.rwscene', mimeType:'application/json', buffer:body});
    const different = Buffer.from(candidate);
    different[different.length - 2] ^= 1;
    await selectFile(different); await msg('отличается');
    assert.equal(applies, 1); assert.equal(await dirty(), true);
    await Promise.all([page.waitForNavigation(), selectFile(candidate)]);
    await ready(); assert.equal(applies, 2);
    console.log('PASS fallback rejects same-size mismatch and accepts matching saved file');

    available = '0.18.3';
    await page.close(); page = await context.newPage(); await page.goto(url); await ready();
    await page.locator('#projectInput').setInputFiles({name:'scene.rwscene', mimeType:'application/json', buffer:candidate});
    await page.waitForFunction(() => window.__bridgeQA().project.name === 'Тест сохранения');
    assert.equal(await dirty(), false);
    await page.click('#btnPlay');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('3D-кадр'), null, {timeout:20000});
    await page.click('#btnStop');
    exported = await download(() => page.click('#btnBuild'));
    assert.ok(exported.length < 3 * 1024 * 1024);
    const game = await context.newPage(); await game.goto(url.replace('studio','game'));
    await game.waitForFunction(() => document.querySelector('canvas')?.getContext('webgl2') || document.querySelector('canvas')?.getContext('webgl'));
    assert.equal(await game.locator('#bridge-game-data').evaluate(e => JSON.parse(e.textContent).name), 'Тест сохранения');
    await game.close();
    console.log('PASS reopen saved scene, Play renders a frame, Stop and WARPGAME export launch');

    await page.click('#addBlock');
    await install();
    await page.evaluate(() => {
      window.showSaveFilePicker = async () => {
        const root = await navigator.storage.getDirectory();
        const handle = await root.getFileHandle('native.rwscene',{create:true});
        return {name:handle.name,createWritable:async () => {
          const stream = await handle.createWritable();
          return {write:data=>stream.write(data), abort:()=>stream.abort(), close:async () => {
            await new Promise(resolve => {window.finishClose=resolve;});
            await stream.close();
          }};
        }};
      };
    });
    await yes(); await page.waitForFunction(() => window.finishClose);
    assert.equal(applies, 2); assert.equal(await dirty(), true);
    assert.equal(await page.locator('#patchSaveYes').isDisabled(), true);
    await Promise.all([page.waitForNavigation(), page.evaluate(() => window.finishClose())]);
    await ready(); assert.equal(applies, 3);
    const native = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      return JSON.parse(await (await (await root.getFileHandle('native.rwscene')).getFile()).text());
    });
    assert.equal(native.objects.length, JSON.parse(saved).objects.length + 1);
    assert.equal(native.name, 'Тест сохранения');
    assert.deepEqual(errors, []);
    console.log('PASS actual writable stream closes before apply, file survives reload');

    available = '0.18.3';
    await page.reload(); await ready(); await install();
    assert.equal(await page.locator('#patchSaveYes').textContent(), 'Да, установить');
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {throw Error('quota');};
      IDBDatabase.prototype.transaction = () => {throw Error('quota');};
    });
    await yes(); await msg('Не удалось записать резервную копию');
    assert.equal(applies, 3); await cancel();
    console.log('PASS backup failure on a clean scene blocks installation');
    await page.reload(); await ready();
    await page.click('#addBlock'); await install();
    await page.evaluate(() => {
      window.showSaveFilePicker = async () => ({createWritable:async () => ({
        write:async () => {},close:async () => {document.querySelector('#projectName').value='Изменено во время записи';}
      })});
    });
    await yes(); await msg('Во время записи проект изменился');
    assert.equal(applies, 3); assert.equal(await dirty(), true);
    console.log('PASS concurrent edit prevents apply after write');
    assert.deepEqual(errors, []);
  } finally {await browser.close();}
}
test().catch(error => {console.error(error); process.exitCode = 1;});
