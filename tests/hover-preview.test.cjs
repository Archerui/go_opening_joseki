/* Run with playwright-core on NODE_PATH and CHROME_PATH pointing to Chromium. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

let browser;
const url = process.env.JOSEKI_URL || 'http://127.0.0.1:8000/';
const state = page => page.evaluate(() => JosekiExplorer.getState());
test.before(async () => {
  browser = await chromium.launch({executablePath:process.env.CHROME_PATH, headless:true, args:['--no-sandbox']});
});
test.after(async () => { await browser?.close(); });

async function pageAt(t, width=1440, touch=false) {
  const page = await browser.newPage({viewport:{width,height:1000},hasTouch:touch,isMobile:touch});
  const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors,[]); });
  await page.goto(url);
  await page.waitForFunction(() => window.JosekiExplorer);
  return page;
}

async function markerCenter(page,index) {
  const marker=page.locator(`#main-board [data-candidate="${index}"]`);
  await marker.scrollIntoViewIfNeeded();
  const bounds=await marker.boundingBox();
  return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,width:bounds.width};
}

for (const width of [1440,375]) {
  test(`${width}px mouse hover is translucent, passes through, switches immediately and closes on departure`, async t => {
    const page=await pageAt(t,width);
    await page.evaluate(() => JosekiExplorer.loadNode(10132));
    const before=await state(page);
    const first=await markerCenter(page,0),second=await markerCenter(page,1);
    await page.mouse.move(first.x,first.y);
    let shown=await state(page);
    assert.ok(shown.preview);
    assert.ok(before.candidates[0].nodeIds.includes(shown.preview.nodeIds[0]));
    const presentation=await page.locator('#variation-preview').evaluate(box => {
      const style=getComputedStyle(box),rect=box.getBoundingClientRect();
      const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+Math.min(rect.height/2,80));
      return {pointerEvents:style.pointerEvents,opacity:Number(style.opacity),background:style.backgroundColor,
        inert:box.inert,hitPreview:!!hit?.closest('#variation-preview')};
    });
    assert.equal(presentation.pointerEvents,'none');
    assert.equal(presentation.inert,true);
    assert.equal(presentation.hitPreview,false);
    const alpha=/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(presentation.background);
    assert.ok(presentation.opacity<1 || (alpha && Number(alpha[1])<1),JSON.stringify(presentation));

    // Moving inside a marker must keep the existing preview board, without flashing or rebuilding it.
    await page.evaluate(() => { window.hoverBoard=document.querySelector('#preview-board').firstElementChild; });
    await page.mouse.move(first.x+first.width*.15,first.y);
    assert.equal(await page.evaluate(() => window.hoverBoard===document.querySelector('#preview-board').firstElementChild),true);
    assert.ok((await state(page)).preview);

    await page.mouse.move(second.x,second.y);
    shown=await state(page);
    assert.ok(before.candidates[1].nodeIds.includes(shown.preview.nodeIds[0]));
    const popup=await page.locator('#variation-preview').boundingBox();
    await page.mouse.move(popup.x+popup.width/2,popup.y+20);
    // No timer wait: leaving the candidate immediately removes the floating preview.
    assert.equal((await state(page)).preview,null);
    assert.equal(await page.locator('#variation-preview').isVisible(),false);

    await page.mouse.move(first.x,first.y);
    const exact=(await state(page)).preview;
    assert.ok(exact);
    await page.mouse.click(first.x,first.y,{button:'right'});
    assert.deepEqual((await state(page)).position,exact.position);
    assert.equal(await page.locator('#variation-preview').isVisible(),false);
  });
}

test('an explicitly opened preview remains interactive for source selection, close and application', async t => {
  const page=await pageAt(t);
  const before=await state(page),index=before.candidates.findIndex(candidate => candidate.nodeIds.length>1);
  assert.ok(index>=0);
  const button=page.locator(`[data-preview="${index}"]`);
  await button.click();
  const box=page.locator('#variation-preview');
  assert.equal(await box.evaluate(element => element.classList.contains('pinned-preview')),true);
  assert.equal(await box.evaluate(element => element.inert),false);
  assert.equal(await box.evaluate(element => getComputedStyle(element).pointerEvents),'auto');
  await page.mouse.move(5,5);
  assert.equal(await box.isVisible(),true);
  await page.selectOption('#preview-branch','1');
  assert.equal((await state(page)).preview.nodeIds[0],before.candidates[index].nodeIds[1]);
  await page.click('#preview-close');
  assert.equal(await box.isVisible(),false);
  assert.deepEqual((await state(page)).position,before.position);
  await button.click();
  const exact=(await state(page)).preview;
  await page.click('#preview-apply');
  assert.deepEqual((await state(page)).position,exact.position);
  assert.equal(await box.isVisible(),false);
});

test('375px touch uses an explicit preview with working close and apply controls', async t => {
  const page=await pageAt(t,375,true);
  const before=await state(page),button=page.locator('[data-preview="0"]');
  await button.tap();
  const box=page.locator('#variation-preview');
  assert.equal(await box.evaluate(element => element.classList.contains('pinned-preview')),true);
  assert.equal(await box.evaluate(element => element.inert),false);
  const bounds=await box.boundingBox();
  assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=376&&bounds.y+bounds.height<=1001);
  await page.locator('#preview-close').tap();
  assert.equal(await box.isVisible(),false);
  assert.deepEqual((await state(page)).position,before.position);
  await button.tap();
  const exact=(await state(page)).preview;
  await page.locator('#preview-apply').tap();
  assert.deepEqual((await state(page)).position,exact.position);
  assert.equal(await box.isVisible(),false);
});
