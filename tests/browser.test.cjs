/* Run with playwright-core on NODE_PATH and CHROME_PATH pointing to Chromium. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
let browser;
const url = process.env.JOSEKI_URL || 'http://127.0.0.1:8000/';
test.before(async () => { browser = await chromium.launch({executablePath:process.env.CHROME_PATH, headless:true, args:['--no-sandbox']}); });
test.after(async () => { await browser?.close(); });
const state = page => page.evaluate(() => JosekiExplorer.getState());
async function pageAt(width=1440) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.waitForFunction(()=>window.JosekiExplorer);
  return {page,errors};
}
test('wrong move preview, exact application, undo/redo and replacement branch',async()=>{
  const {page,errors}=await pageAt();
  await page.evaluate(()=>JosekiExplorer.loadNode(5));
  const before=await state(page),index=before.candidates.findIndex(c=>c.nodeIds.includes(13));
  assert.ok(index>=0);assert.equal(before.candidates[index].quality,'bad');
  const mark=page.locator(`#main-board [data-candidate="${index}"]`);
  await mark.hover();await page.waitForTimeout(350);
  const preview=(await state(page)).preview;assert.ok(preview.nodeIds.length>1);
  await mark.click({button:'right'});
  assert.deepEqual((await state(page)).position,preview.position);
  await page.locator('#main-board').hover();await page.mouse.wheel(0,-100);await page.waitForTimeout(180);
  assert.equal((await state(page)).position.moveNumber,preview.position.moveNumber-1);
  await page.mouse.wheel(0,100);await page.waitForTimeout(180);
  assert.deepEqual((await state(page)).position,preview.position);
  await page.click('#first');await page.click('#next');
  const start=await state(page);assert.equal(start.cursor,1);
  const replacement=start.candidates.findIndex(c=>c.move.x===16&&c.move.y===2);assert.ok(replacement>=0);
  await page.locator(`#main-board [data-candidate="${replacement}"]`).click();assert.equal((await state(page)).historyLength,3);
  await page.evaluate(()=>JosekiExplorer.loadNode(5));await page.uncheck('#show-bad');
  assert.ok((await state(page)).candidates.every(c=>c.quality!=='bad'));
  assert.deepEqual(errors,[]);await page.close();
});
test('all symmetries, free research, conditional metadata and explicit player',async()=>{
  const {page,errors}=await pageAt();
  for(let symmetry=0;symmetry<8;symmetry++){
    await page.click('#reset');await page.selectOption('#orientation',String(symmetry));
    const before=await state(page),index=before.candidates.findIndex(c=>c.move.x===15&&c.move.y===3&&c.move.color==='B');
    await page.locator(`#main-board [data-candidate="${index}"]`).click();
    const after=await state(page);assert.equal(after.position.board[3*19+15],'B');assert.equal(after.position.moveNumber,1);
  }
  await page.click('#reset');await page.selectOption('#orientation','0');await page.locator('#main-board [data-x="9"][data-y="9"]').click();
  assert.equal((await state(page)).candidates.length,0);assert.match(await page.locator('#position-badge').textContent(),/未收录/);
  await page.evaluate(()=>JosekiExplorer.loadNode(14832));assert.equal((await state(page)).position.toPlay,'W');
  await page.evaluate(()=>JosekiExplorer.loadNode(14740));assert.equal(await page.locator('#condition-note').isVisible(),true);
  assert.deepEqual(errors,[]);await page.close();
});
test('narrow mouse preview does not block click; pinned preview fits mobile viewport',async()=>{
  const {page,errors}=await pageAt(375);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.click('#library-toggle');await page.click('[data-library-filter="curated"]');await page.locator('.library-entry').first().click();
  const button=page.locator('.preview-button').first();await button.scrollIntoViewIfNeeded();await button.hover();await page.waitForTimeout(350);
  await button.click({timeout:5000});
  const bounds=await page.locator('#variation-preview').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=376&&bounds.y+bounds.height<=1001);
  const preview=(await state(page)).preview;await page.click('#preview-apply');assert.deepEqual((await state(page)).position,preview.position);
  assert.deepEqual(errors,[]);await page.close();
});
test('shared position restores exact history and source selection',async()=>{
  const {page,errors}=await pageAt();
  await page.evaluate(()=>{navigator.clipboard.writeText=async value=>{window.copiedStudyURL=value;};JosekiExplorer.loadNode(113);});
  const start=await state(page),index=start.candidates.findIndex(c=>c.nodeIds.includes(341));
  await page.locator(`#main-board [data-candidate="${index}"]`).click({button:'right'});await page.click('#previous');
  const expected=await state(page);await page.click('#copy-link');const shared=await page.evaluate(()=>window.copiedStudyURL);assert.ok(shared.includes('#study='));
  await page.goto(shared);await page.waitForFunction(()=>window.JosekiExplorer);
  const restored=await state(page);assert.deepEqual(restored.position,expected.position);assert.equal(restored.cursor,expected.cursor);assert.equal(restored.historyLength,expected.historyLength);
  assert.deepEqual(errors,[]);await page.close();
});

test('metadata setup survives shared history and file-mode assets work',async()=>{
  const {page,errors}=await pageAt();
  await page.evaluate(()=>{navigator.clipboard.writeText=async value=>{window.copiedStudyURL=value;};JosekiExplorer.loadNode(1051);});
  const expected=await state(page);await page.click('#copy-link');const shared=await page.evaluate(()=>window.copiedStudyURL);
  await page.goto(shared);await page.waitForFunction(()=>window.JosekiExplorer);assert.deepEqual((await state(page)).position,expected.position);
  const {pathToFileURL}=require('node:url');const {resolve}=require('node:path');
  await page.goto(pathToFileURL(resolve(__dirname,'../index.html')).href);await page.waitForFunction(()=>window.JosekiExplorer);
  assert.ok((await state(page)).candidates.length>0);assert.deepEqual(errors,[]);await page.close();
});

test('real opening names replace source titles and unknown moves remain unnamed',async()=>{
  const {page,errors}=await pageAt();await page.click('[data-preset="星位"]');
  for(const [x,y,name] of [[16,2,'点三三'],[16,5,'小飞挂'],[16,6,'大飞挂']]){
    const before=await state(page),index=before.candidates.findIndex(c=>c.move.x===x&&c.move.y===y&&c.move.color==='W');assert.ok(index>=0);
    await page.locator(`#main-board [data-candidate="${index}"]`).hover();
    const title=await page.locator('#preview-title').textContent();assert.ok(title.includes(name),title);assert.doesNotMatch(title,/Pachi|OGS|总库/);
  }
  const unnamed=await page.evaluate(()=>{
    const nodes=JOSEKI_DB.nodes;
    for(const node of nodes){if(!node.move||node.curated)continue;let path=[],n=node;while(n){path.push(n);n=n.parent==null?null:nodes[n.parent];}path.reverse();if(path.filter(n=>n.move).length<2)continue;
      if(!JosekiKnowledge.describe({moves:path.filter(n=>n.move).map(n=>n.move),setup:path.flatMap(n=>n.setup||[])}).title)return node.id;
    }
  });
  assert.equal(typeof unnamed,'number');await page.evaluate(id=>JosekiExplorer.loadNode(id),unnamed);assert.equal(await page.locator('#position-title').isVisible(),false);
  assert.deepEqual(errors,[]);await page.close();
});

test('the reported san-san previews use the verified simple main line and finish at O18',async()=>{
  const {page,errors}=await pageAt();await page.click('[data-preset="星位"]');
  const before=await state(page),san=before.candidates.findIndex(c=>c.move.x===16&&c.move.y===2&&c.move.color==='W');
  await page.locator(`#main-board [data-candidate="${san}"]`).hover();
  const preview=(await state(page)).preview;assert.equal(preview.nodeIds.length,5);
  assert.equal(preview.position.moveNumber,6);assert.equal(preview.position.lastMove.x,13);assert.equal(preview.position.lastMove.y,1);
  await page.locator(`#main-board [data-candidate="${san}"]`).click({button:'right'});assert.deepEqual((await state(page)).position,preview.position);
  await page.click('#previous');const choices=(await state(page)).candidates;
  assert.deepEqual(choices.slice(0,4).map(c=>[c.move.x,c.move.y]),[[13,1],[14,2],[13,2],[17,3]]);
  assert.match(choices[0].label,/小飞.*首选/);assert.match(choices[1].label,/推/);assert.match(choices[2].label,/跳.*征子/);assert.match(choices[3].label,/扳.*旧库/);
  assert.equal(choices[2].quality,'questionable');assert.notEqual(choices[3].quality,'bad');
  await page.locator('#main-board [data-candidate="0"]').hover();const final=(await state(page)).preview;assert.equal(final.nodeIds.length,1);
  await page.locator('#main-board [data-candidate="0"]').click({button:'right'});assert.deepEqual((await state(page)).position,final.position);
  assert.match(await page.locator('#candidate-order-note').textContent(),/定式已完成|定式终点/);
  assert.deepEqual(errors,[]);await page.close();
});

test('other opening families use source suggestions and preserve tied or unreviewed forks',async()=>{
  const {page,errors}=await pageAt();
  await page.evaluate(()=>JosekiExplorer.loadNode(11747));
  let choices=(await state(page)).candidates;
  assert.deepEqual(choices.slice(0,3).map(c=>[c.move.x,c.move.y]),[[13,2],[16,7],[16,4]]);
  assert.match(choices[0].label,/小飞/);
  await page.evaluate(()=>JosekiExplorer.loadNode(5299));
  choices=(await state(page)).candidates;assert.deepEqual([choices[0].move.x,choices[0].move.y],[14,2]);assert.match(choices[0].label,/托/);
  await page.locator('#main-board [data-candidate="0"]').hover();
  const preview=(await state(page)).preview;assert.ok(preview.nodeIds.length>1);
  await page.locator('#main-board [data-candidate="0"]').click({button:'right'});assert.deepEqual((await state(page)).position,preview.position);
  await page.evaluate(()=>JosekiExplorer.loadNode(11727));
  const tied=await state(page);await page.click('#next');assert.deepEqual((await state(page)).position,tied.position);assert.match(await page.locator('#toast').textContent(),/选择/);
  await page.evaluate(()=>JosekiExplorer.loadNode(22));
  choices=(await state(page)).candidates;const index=choices.findIndex(c=>c.nodeIds.includes(23));assert.ok(index>=0);
  await page.locator(`#main-board [data-candidate="${index}"]`).hover();
  const stopped=(await state(page)).preview;assert.equal(stopped.needsChoice,true);assert.equal(stopped.nodeIds.at(-1),23);
  assert.match(await page.locator('#preview-note').textContent(),/需要选择的分叉/);
  await page.locator(`#main-board [data-candidate="${index}"]`).click({button:'right'});assert.deepEqual((await state(page)).position,stopped.position);
  const fork=await state(page);await page.click('#next');assert.deepEqual((await state(page)).position,fork.position);
  assert.deepEqual(errors,[]);await page.close();
});

test('new source assessment does not preserve an outdated red error label',async()=>{
  const {page,errors}=await pageAt();await page.evaluate(()=>JosekiExplorer.loadNode(113));
  const choices=(await state(page)).candidates,index=choices.findIndex(c=>c.nodeIds.includes(341));
  assert.ok(index>=0);assert.equal(choices[index].quality,'questionable');assert.match(choices[index].label,/分歧/);
  await page.locator(`#main-board [data-candidate="${index}"]`).click();assert.match(await page.locator('#note-quality').textContent(),/有条件/);
  assert.deepEqual(errors,[]);await page.close();
});
