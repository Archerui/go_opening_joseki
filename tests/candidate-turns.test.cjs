/* Run with playwright-core on NODE_PATH and CHROME_PATH pointing to Chromium. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require('playwright-core');

let browser;
const url = process.env.JOSEKI_URL || 'http://127.0.0.1:9310/';
test.before(async () => {
  browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
});
test.after(async () => { await browser?.close(); });
const state = page => page.evaluate(() => JosekiExplorer.getState());
const marker = (page,index) => page.locator(`#main-board [data-candidate="${index}"]`);
const at = (candidate,x,y,color) => candidate.move.x===x && candidate.move.y===y && (!color || candidate.move.color===color);

async function newPage() {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(()=>window.JosekiExplorer);
  return {page,errors};
}
async function smallApproach(page) {
  await page.click('[data-preset="小目"]');
  const before=await state(page);
  const white=before.candidates.findIndex(candidate=>at(candidate,14,2,'W'));
  assert.ok(white>=0,'the P17 approach must exist');
  await marker(page,white).click();
  const result=await state(page);
  assert.equal(result.position.lastMove.color,'W');
  assert.equal(result.position.toPlay,'B');
  return result;
}
async function previewMoves(page,preview) {
  return page.evaluate(ids=>ids.map(id=>JOSEKI_DB.nodes[id].move),preview.nodeIds);
}
async function downloadSGF(page) {
  const pending=page.waitForEvent('download');
  await page.click('#download-sgf');
  const download=await pending;
  return readFile(await download.path(),'utf8');
}

test('empty-board entries omit the isolated lower komoku while normal komoku and source continuations remain playable',async()=>{
  const {page,errors}=await newPage();
  const source=await page.evaluate(()=>{
    const node=JOSEKI_DB.nodes.find(node=>node.sourceId==='pachi'&&node.sourceFile==='joseki_34.sgf'&&node.sourceNode===975);
    return {id:node.id,parent:node.parent,next:node.children[0]};
  });
  for(const scope of ['merged','pachi']) {
    for(let symmetry=0;symmetry<8;symmetry++) {
      await page.selectOption('#orientation',String(symmetry));
      if(scope==='merged')await page.click('[data-preset="empty"]');
      else await page.evaluate(id=>JosekiExplorer.loadNode(id),source.parent);
      const initial=await state(page);
      assert.ok(!initial.candidates.some(candidate=>at(candidate,15,16)),`${scope}, orientation ${symmetry}: Q3 is not an opening recommendation`);
      assert.ok(initial.candidates.some(candidate=>at(candidate,16,3,'B')),'normal upper komoku remains available');
    }
  }
  await page.selectOption('#orientation','0');
  await smallApproach(page);
  assert.ok((await state(page)).candidates.length>0,'normal komoku continues after the approach');

  // Source diagrams still support real alternating turns when explicitly opened.
  await page.evaluate(id=>JosekiExplorer.loadNode(id),source.id);
  await page.locator('#main-board [data-x="3"][data-y="3"]').click();
  const afterTenuki=await state(page);
  assert.equal(afterTenuki.position.board[3*19+3],'W');
  assert.ok(afterTenuki.candidates.some(candidate=>candidate.nodeIds.includes(source.next)),'the source continuation remains after an actual White move elsewhere');
  assert.deepEqual(errors,[]);
  await page.close();
});

test('same-point source variants expose only the current player in merged and Pachi-only trees',async()=>{
  const {page,errors}=await newPage();
  for(const source of ['merged','pachi']){
    if(source==='merged')await smallApproach(page);
    else await page.evaluate(()=>JosekiExplorer.loadNode(1507));
    const before=await state(page);
    for(const y of [4,5]){
      const variants=before.candidates.map((candidate,index)=>({candidate,index})).filter(({candidate})=>at(candidate,15,y));
      assert.deepEqual(new Set(variants.map(({candidate})=>candidate.move.color)),new Set(['B']));
      const black=variants.find(({candidate})=>candidate.move.color==='B');
      assert.equal(await marker(page,black.index).count(),1);
    }
    const black=before.candidates.findIndex(candidate=>at(candidate,15,5,'B'));
    await marker(page,black).click();
    const after=await state(page);
    assert.equal(after.position.board[5*19+15],'B');
    assert.equal(after.position.toPlay,'W');
    assert.equal(after.cursor,before.cursor+1);
    await page.click('#previous');
    assert.deepEqual((await state(page)).position,before.position);
    await page.click('#next');
    assert.deepEqual((await state(page)).position,after.position);
  }
  assert.deepEqual(errors,[]);
  await page.close();
});

test('hover and right click choose the current player and apply the exact preview',async()=>{
  const {page,errors}=await newPage();
  const before=await smallApproach(page);
  const black=before.candidates.findIndex(candidate=>at(candidate,15,5,'B'));
  await marker(page,black).hover();
  const preview=(await state(page)).preview;
  assert.ok(preview);
  assert.equal((await previewMoves(page,preview))[0].color,'B');
  assert.equal(await page.locator('#preview-move').count(),0,'there is no manual player switch');
  const previewLine=await previewMoves(page,preview);
  assert.ok(previewLine.every((move,index)=>move.color===(index%2?'W':'B')));
  await marker(page,black).click({button:'right'});
  assert.deepEqual((await state(page)).position,preview.position);
  assert.equal((await state(page)).position.board[5*19+15],'B');
  assert.deepEqual(errors,[]);
  await page.close();
});

test('all eight board orientations keep the current-player default at a shared coordinate',async()=>{
  const {page,errors}=await newPage();
  for(let symmetry=0;symmetry<8;symmetry++){
    await page.selectOption('#orientation',String(symmetry));
    const before=await smallApproach(page);
    const black=before.candidates.findIndex(candidate=>at(candidate,15,5,'B'));
    await marker(page,black).click();
    const after=await state(page);
    assert.equal(after.position.board[5*19+15],'B',`orientation ${symmetry}`);
    assert.equal(after.position.lastMove.color,'B');
  }
  assert.deepEqual(errors,[]);
  await page.close();
});

test('a point recorded only for the other player is hidden and cannot skip an actual turn',async()=>{
  const {page,errors}=await newPage();
  await page.evaluate(()=>JosekiExplorer.loadNode(2479));
  const before=await state(page);
  assert.equal(before.position.toPlay,'W');
  assert.equal(before.candidates.length,0);
  assert.equal(await page.locator('#next').isDisabled(),true);
  assert.deepEqual((await state(page)).position,before.position);
  await page.locator('#main-board').hover();
  await page.mouse.wheel(0,100);
  await page.waitForTimeout(180);
  assert.deepEqual((await state(page)).position,before.position);
  const point=await page.evaluate(()=>JOSEKI_DB.nodes[2480].move);
  await page.locator(`#main-board [data-x="${point.x}"][data-y="${point.y}"]`).click();
  const after=await state(page);
  assert.equal(after.position.board[point.y*19+point.x],'W');
  assert.equal(after.position.lastMove.color,'W');
  assert.equal(after.nodeId,null,'a current-player move without a source branch is free play');

  // Use an in-progress komoku line: the isolated Q3 opening is no longer offered.
  await page.evaluate(()=>JosekiExplorer.loadNode(1596));
  const root=await state(page),index=root.candidates.findIndex(candidate=>candidate.nodeIds.includes(1597));
  assert.ok(index>=0);
  await marker(page,index).hover();
  const preview=(await state(page)).preview;
  assert.equal(preview.nodeIds.length,1,'automatic preview must stop before an omitted opposite-player turn');
  assert.equal(preview.position.toPlay,'W');
  assert.match(await page.locator('#preview-note').textContent(),/脱先|轮到|当前|选择/);
  assert.deepEqual(errors,[]);
  await page.close();
});

test('a curated setup with white to play keeps its explicit initial turn',async()=>{
  const {page,errors}=await newPage();
  const id=await page.evaluate(()=>JOSEKI_DB.nodes.find(node=>node.item?.id==='ai-star-low-attach').id);
  await page.evaluate(id=>JosekiExplorer.loadNode(id),id);
  const before=await state(page);
  assert.equal(before.position.moveNumber,0);
  assert.equal(before.position.toPlay,'W');
  assert.equal(before.candidates[0].move.color,'W');
  await marker(page,0).hover();
  const preview=(await state(page)).preview;
  assert.equal((await previewMoves(page,preview))[0].color,'W');
  assert.doesNotMatch(await page.locator('#preview-caption').textContent(),/脱先/);
  await marker(page,0).click();
  const after=await state(page);
  assert.equal(after.position.lastMove.color,'W');
  assert.equal(after.position.toPlay,'B');
  assert.notEqual(after.nodeId,null);
  assert.deepEqual(errors,[]);
  await page.close();
});

test('source PL annotations cannot override turns when loading, sharing, previewing or playing a position',async()=>{
  const {page,errors}=await newPage();
  for(const id of [14832,15505]){
    await page.evaluate(id=>JosekiExplorer.loadNode(id),id);
    const loaded=await state(page);
    assert.equal(loaded.position.toPlay,'W','opening a source position keeps the turn after its last black move');
    assert.deepEqual((await downloadSGF(page)).match(/\bPL\[[BW]\]/g),['PL[B]'],'export sets the initial player without mid-game PL overrides');
    await page.evaluate(()=>{navigator.clipboard.writeText=async value=>{window.copiedStudyURL=value;};});
    await page.click('#copy-link');
    const shared=await page.evaluate(()=>window.copiedStudyURL);
    await page.goto(shared);
    await page.waitForFunction(()=>window.JosekiExplorer);
    assert.deepEqual((await state(page)).position,loaded.position,'sharing a source position cannot restore its discarded PL override');
    const parent=await page.evaluate(id=>JOSEKI_DB.nodes[id].parent,id);
    await page.evaluate(id=>JosekiExplorer.loadNode(id),parent);
    const before=await state(page);
    assert.equal(before.position.toPlay,'B');
    const index=before.candidates.findIndex(candidate=>candidate.nodeIds.includes(id));
    assert.ok(index>=0,`source node ${id} is available`);
    await marker(page,index).hover();
    const preview=(await state(page)).preview;
    assert.deepEqual(preview.nodeIds,[id],'the preview stops before another black move');
    assert.equal(preview.position.toPlay,'W');
    await marker(page,index).click();
    const after=await state(page);
    assert.equal(after.position.lastMove.color,'B');
    assert.equal(after.position.toPlay,'W',`PL[B] on node ${id} does not override interactive alternation`);
    assert.ok(after.candidates.every(candidate=>candidate.move.color==='W'));
    assert.deepEqual((await downloadSGF(page)).match(/\bPL\[[BW]\]/g),['PL[B]'],'interactive SGF also omits mid-game PL overrides');
  }
  assert.deepEqual(errors,[]);
  await page.close();
});
