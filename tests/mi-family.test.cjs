/* Run with playwright-core on NODE_PATH and CHROME_PATH pointing to Chromium. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

let browser;
const url = process.env.JOSEKI_URL || 'http://127.0.0.1:9310/';
const family = '芈氏飞刀';
const prefix = 'B[pd] W[qc] B[qd] W[pc] B[nc]';
const parse = text => [...text.matchAll(/([BW])\[([a-s])([a-s])\]/g)].map(match => ({
  color:match[1], x:match[2].charCodeAt(0)-97, y:match[3].charCodeAt(0)-97
}));
const state = page => page.evaluate(() => JosekiExplorer.getState());
const title = page => page.locator('#position-title').textContent();

test.before(async () => {
  browser = await chromium.launch({executablePath:process.env.CHROME_PATH, headless:true, args:['--no-sandbox']});
});
test.after(async () => { await browser?.close(); });

async function pageAt(t) {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors,[]); });
  await page.goto(url);
  await page.waitForFunction(() => window.JosekiExplorer);
  return page;
}
async function indexFor(page,nodeId) {
  const current = await state(page);
  const index = current.candidates.findIndex(candidate => candidate.nodeIds.includes(nodeId));
  assert.ok(index>=0,`node ${nodeId} is a current recommendation`);
  return index;
}
async function previewNode(page,nodeId) {
  const index = await indexFor(page,nodeId);
  await page.locator(`[data-preview="${index}"]`).click();
  const current = await state(page);
  const choice = current.candidates[index].nodeIds.indexOf(nodeId);
  if(current.candidates[index].nodeIds.length>1)await page.selectOption('#preview-branch',String(choice));
  const preview = (await state(page)).preview;
  assert.equal(preview.nodeIds[0],nodeId);
  return preview;
}
async function playNode(page,nodeId) {
  const index = await indexFor(page,nodeId);
  await page.locator(`#main-board [data-candidate="${index}"]`).click();
}

test('both reported continuations retain the Mi family name across all eight orientations',async t => {
  const page = await pageAt(t);
  for(let symmetry=0;symmetry<8;symmetry++) {
    await page.selectOption('#orientation',String(symmetry));
    for(const nodeId of [10320,10134]) {
      await page.evaluate(() => JosekiExplorer.loadNode(10133));
      const before = await state(page);
      assert.equal(before.position.moveNumber,7);
      assert.equal(await title(page),family);
      await previewNode(page,nodeId);
      assert.equal(await page.locator('#preview-title').textContent(),family,`orientation ${symmetry}, node ${nodeId}`);
      assert.equal((await state(page)).position.moveNumber,7,'hovering does not play the continuation');
      await page.click('#preview-close');
      await playNode(page,nodeId);
      assert.equal((await state(page)).position.moveNumber,8);
      assert.equal(await title(page),family);
    }
  }
});

test('the sixth local move establishes the family while the fifth move keeps its technique name',async t => {
  const page = await pageAt(t);
  const results = await page.evaluate(({before,entry}) => {
    const describe = moves => JosekiKnowledge.describe({moves});
    const variants = moves => Array.from({length:8},(_,symmetry) => [false,true].map(swap => moves.map(move => ({
      ...GoEngine.transformPoint(move,symmetry), color:swap?(move.color==='B'?'W':'B'):move.color
    })))).flat();
    return {before:variants(before).map(describe), entry:variants(entry).map(describe)};
  },{before:parse(prefix),entry:parse(prefix+' W[nb]')});
  for(const result of results.before) {
    assert.notEqual(result.title,family);
    assert.equal(result.moveName,'小飞');
  }
  for(const result of results.entry) {
    assert.equal(result.title,family);
    assert.equal(result.kind,'joseki');
  }
  await page.evaluate(() => JosekiExplorer.loadNode(10131));
  assert.notEqual(await title(page),family);
  await previewNode(page,10132);
  assert.equal(await page.locator('#preview-title').textContent(),family);
  assert.notEqual(await title(page),family,'a preview does not rename the board before the move');
  await page.click('#preview-close');
  await playNode(page,10132);
  assert.equal(await title(page),family);
});

test('the reported six-move position names every black continuation, including tenuki',async t => {
  const page = await pageAt(t);
  await page.evaluate(() => {
    const entry = JOSEKI_DB.nodes.find(node => node.sourceId==='josekle'&&Number(node.externalId)===20832);
    JosekiExplorer.loadNode(entry.id);
  });
  const before = await state(page);
  assert.equal(before.position.moveNumber,6);
  assert.equal(before.position.toPlay,'B');
  assert.equal(await title(page),family);
  assert.equal(before.candidates.length,5);
  assert.ok(before.candidates.some(candidate => candidate.move.pass));
  for(const candidate of before.candidates) {
    assert.equal(candidate.move.color,'B');
    for(const nodeId of candidate.nodeIds) {
      await previewNode(page,nodeId);
      assert.equal(await page.locator('#preview-title').textContent(),family,`six-move continuation ${nodeId}`);
      assert.deepEqual((await state(page)).position,before.position,'preview preserves the actual six-move board');
      await page.click('#preview-close');
    }
  }
});

test('ordinary previews name only the displayed line, never an unchosen future branch',async t => {
  const page = await pageAt(t);
  await page.evaluate(() => JosekiExplorer.loadNode(9542));
  const beforeEntry = await previewNode(page,10131);
  assert.ok(!beforeEntry.nodeIds.includes(10132),'the preferred preview follows the other reply to the small knight');
  assert.notEqual(await page.locator('#preview-title').textContent(),family);
  await page.click('#preview-close');
  await page.evaluate(() => JosekiExplorer.loadNode(10131));
  const alternative = await previewNode(page,10386);
  assert.ok(!alternative.nodeIds.includes(10132));
  assert.notEqual(await page.locator('#preview-title').textContent(),family);
  await page.click('#preview-close');
  const entered = await previewNode(page,10132);
  assert.ok(entered.nodeIds.includes(10132));
  assert.equal(await page.locator('#preview-title').textContent(),family);
});

test('undo and redo restore the name exactly at the family entry',async t => {
  const page = await pageAt(t);
  await page.evaluate(() => JosekiExplorer.loadNode(10133));
  for(const [button,ply,named] of [['previous',6,true],['previous',5,false],['next',6,true],['next',7,true]]) {
    await page.click('#'+button);
    assert.equal((await state(page)).position.moveNumber,ply);
    assert.equal((await title(page))===family,named,`name at local move ${ply}`);
  }
});

test('real moves elsewhere preserve the local family name and resumed continuation',async t => {
  const page = await pageAt(t);
  await page.evaluate(() => JosekiExplorer.loadNode(10133));
  // White and Black each play elsewhere; White can then return to the shown corner.
  for(const point of [{x:3,y:15,color:'W'},{x:3,y:3,color:'B'}]) {
    await page.locator(`#main-board [data-x="${point.x}"][data-y="${point.y}"]`).click();
    assert.equal(await title(page),family);
    assert.equal((await state(page)).position.board[point.y*19+point.x],point.color);
  }
  const returned = await state(page);
  assert.equal(returned.position.toPlay,'W');
  const preview = await previewNode(page,10320);
  assert.equal(await page.locator('#preview-title').textContent(),family);
  assert.equal(preview.position.board[15*19+3],'W');
  assert.equal(preview.position.board[3*19+3],'B');
  await page.click('#preview-close');
  await playNode(page,10320);
  const after = await state(page);
  assert.equal(after.position.moveNumber,10);
  assert.equal(after.position.board[15*19+3],'W');
  assert.equal(after.position.board[3*19+3],'B');
  assert.equal(await title(page),family);
});

test('the ordinary extension, reordered moves and unordered setup do not inherit the Mi family',async t => {
  const page = await pageAt(t);
  const entry = parse(prefix+' W[nb]');
  const reordered = [...entry];
  [reordered[0],reordered[1]] = [reordered[1],reordered[0]];
  const descriptions = await page.evaluate(inputs => inputs.map(input => JosekiKnowledge.describe(input)),[
    {moves:parse('B[pd] W[qc] B[qd] W[pc] B[od] W[nb]')},
    {moves:parse(prefix+' W[oc]')},
    {moves:reordered},
    {setup:entry.slice(0,2),moves:entry.slice(2)}
  ]);
  for(const result of descriptions)assert.notEqual(result.title,family);
});

test('the historical outer hane still carries the family title and its precise move name',async t => {
  const page = await pageAt(t);
  const source = await page.evaluate(() => JOSEKI_DB.nodes.find(node => node.sourceId==='josekle'&&Number(node.externalId)===21180)?.id);
  assert.equal(typeof source,'number');
  await page.evaluate(id => JosekiExplorer.loadNode(id),source);
  assert.equal((await state(page)).position.moveNumber,17);
  assert.equal(await title(page),family);
  const historical = parse('B[pd] W[dd] B[pp] W[dp] B[cq] W[cp] B[dq] W[fq] B[fr] W[gr] B[eq] W[fp] B[ep] W[eo] B[do] W[bo] B[dn] W[en] B[em] W[fm]');
  const description = await page.evaluate(moves => JosekiKnowledge.describe({moves}),historical);
  assert.equal(description.title,family);
  assert.equal(description.moveName,'外扳');
});
