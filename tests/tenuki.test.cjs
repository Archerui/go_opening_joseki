/* Run with playwright-core on NODE_PATH and CHROME_PATH pointing to Chromium. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require('playwright-core');

let browser;
const url = process.env.JOSEKI_URL || 'http://127.0.0.1:8000/';
test.before(async () => {
  browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
});
test.after(async () => { await browser?.close(); });

const state = page => page.evaluate(() => JosekiExplorer.getState());
const point = coordinate => ({x:'ABCDEFGHJKLMNOPQRST'.indexOf(coordinate[0]),y:19-Number(coordinate.slice(1))});
const marker = (page,index) => page.locator(`#main-board [data-candidate="${index}"]`);
const samePoint = (move,coordinate) => {const p=point(coordinate);return !move.pass&&move.x===p.x&&move.y===p.y;};
const indexAt = (position,coordinate,color=position.position.toPlay) => position.candidates.findIndex(candidate=>samePoint(candidate.move,coordinate)&&candidate.move.color===color);
const stoneAt = (position,coordinate) => {const p=point(coordinate);return position.board[p.y*19+p.x];};

async function pageAt() {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(()=>window.JosekiExplorer);
  return {page,errors};
}
async function clickPoint(page,coordinate) {
  const before=await state(page),index=indexAt(before,coordinate);
  if(index>=0)await marker(page,index).click();
  else {
    const displayed=await page.evaluate(p=>GoEngine.transformPoint(p,Number(document.getElementById('orientation').value)),point(coordinate));
    await page.locator(`#main-board [data-x="${displayed.x}"][data-y="${displayed.y}"]`).click();
  }
  const after=await state(page);
  assert.equal(after.position.moveNumber,before.position.moveNumber+1,`${coordinate} is exactly one actual move`);
  assert.equal(after.position.lastMove.color,before.position.toPlay,`${coordinate} obeys the current turn`);
  assert.equal(after.position.toPlay,before.position.toPlay==='B'?'W':'B');
  assert.ok(after.candidates.every(candidate=>candidate.move.color===after.position.toPlay),'only the current player has selectable recommendations');
  return after;
}
async function approach(page,family='星位') {
  await page.click(`[data-preset="${family}"]`);
  return clickPoint(page,family==='星位'?'R14':'P17');
}
function candidateSignatures(position) {
  return position.candidates.map(candidate=>({move:candidate.move,nodeIds:candidate.nodeIds}));
}

test('the board always alternates colors and offers no manual black/white variation switch',async()=>{
  const {page,errors}=await pageAt();
  const before=await approach(page,'小目');
  assert.equal(before.position.toPlay,'B');
  assert.equal(indexAt(before,'Q14','W'),-1,'white Q14 waits for a real black move elsewhere');
  const black=indexAt(before,'Q14','B');
  assert.ok(black>=0);
  await marker(page,black).hover();
  assert.equal(await page.locator('#preview-move').count(),0);
  const after=await clickPoint(page,'Q14');
  assert.equal(stoneAt(after.position,'Q14'),'B');
  assert.deepEqual(errors,[]);
  await page.close();
});

test('a real move elsewhere enables the recorded double approach without removing the distant stone',async()=>{
  const {page,errors}=await pageAt();
  const before=await approach(page);
  assert.equal(indexAt(before,'O17','W'),-1);
  const after=await clickPoint(page,'D4');
  assert.equal(stoneAt(after.position,'D4'),'B');
  const double=indexAt(after,'O17','W');
  assert.ok(double>=0,'white O17 returns after B Q16, W R14, B D4');
  assert.ok(after.candidates[double].nodeIds.includes(753),'the recommendation retains the sourced double-approach branch');
  const returned=await clickPoint(page,'O17');
  assert.equal(stoneAt(returned.position,'D4'),'B');
  assert.equal(stoneAt(returned.position,'O17'),'W');
  assert.equal(returned.position.moveNumber,4);
  assert.deepEqual(errors,[]);
  await page.close();
});

test('the reported small-knight position resumes white Q14 only after black actually plays elsewhere',async()=>{
  const {page,errors}=await pageAt();
  await approach(page,'小目');
  const after=await clickPoint(page,'D4');
  const white=indexAt(after,'Q14','W');
  assert.ok(white>=0,'white Q14 is available after B R16, W P17, B D4');
  assert.ok(after.candidates[white].nodeIds.includes(1508));
  await marker(page,white).hover();
  const preview=(await state(page)).preview;
  assert.ok(preview?.nodeIds.length);
  assert.equal(stoneAt(preview.position,'D4'),'B');
  const moves=await page.evaluate(ids=>ids.map(id=>JOSEKI_DB.nodes[id].move),preview.nodeIds);
  assert.ok(moves.every((move,i)=>move.color===(i%2?'B':'W')),'preview never substitutes a missing opposite-player turn');
  await marker(page,white).click({button:'right'});
  const applied=await state(page);
  assert.deepEqual(applied.position,preview.position);
  for(let i=0;i<preview.nodeIds.length;i++)await page.click('#previous');
  assert.deepEqual((await state(page)).position,after.position);
  for(let i=0;i<preview.nodeIds.length;i++)await page.click('#next');
  assert.deepEqual((await state(page)).position,preview.position);
  assert.deepEqual(errors,[]);
  await page.close();
});

test('an actual distant move consumes a recorded tenuki pass without adding a phantom move',async()=>{
  const {page,errors}=await pageAt();
  await page.evaluate(()=>JosekiExplorer.loadNode(14543));
  const before=await state(page);
  assert.equal(before.position.toPlay,'B');
  const after=await clickPoint(page,'D4');
  assert.equal(after.cursor,before.cursor+1);
  assert.equal(after.historyLength,before.historyLength+1);
  const white=indexAt(after,'O17','W');
  assert.ok(white>=0);
  assert.ok(after.candidates[white].nodeIds.includes(15375),'GNU Go B pass is represented by the actual B D4 move');
  await clickPoint(page,'O17');
  const returned=await state(page);
  assert.equal(returned.cursor,after.cursor+1);
  assert.equal(returned.historyLength,after.historyLength+1);
  assert.equal(returned.position.moveNumber,before.position.moveNumber+2);
  assert.equal(stoneAt(returned.position,'D4'),'B');
  assert.equal(stoneAt(returned.position,'O17'),'W');
  assert.deepEqual(errors,[]);
  await page.close();
});

test('several actual moves elsewhere preserve the corner until either player returns',async()=>{
  const {page,errors}=await pageAt();
  const before=await approach(page);
  await clickPoint(page,'D4');
  await clickPoint(page,'D16');
  const second=await state(page);
  assert.equal(second.position.toPlay,'B');
  assert.ok(indexAt(second,'Q14','B')>=0,'black can still answer the original approach after both players moved elsewhere');
  assert.ok(second.candidates.some(candidate=>candidate.nodeIds.some(id=>before.candidates.flatMap(c=>c.nodeIds).includes(id))));
  await clickPoint(page,'Q4');
  const white=await state(page);
  assert.ok(indexAt(white,'O17','W')>=0,'the double approach remains available after another black move elsewhere');
  await clickPoint(page,'O17');
  const returned=await state(page);
  assert.equal(stoneAt(returned.position,'D4'),'B');
  assert.equal(stoneAt(returned.position,'D16'),'W');
  assert.equal(stoneAt(returned.position,'Q4'),'B');
  assert.equal(stoneAt(returned.position,'O17'),'W');
  assert.deepEqual(errors,[]);
  await page.close();
});

test('an unrecorded nearby deviation is not mistaken for a move elsewhere',async()=>{
  const {page,errors}=await pageAt();
  await approach(page);
  const after=await clickPoint(page,'R17');
  assert.equal(stoneAt(after.position,'R17'),'B');
  assert.ok(!after.candidates.some(candidate=>candidate.nodeIds.includes(753)),'do not replay the empty-corner double-approach branch over an extra nearby black stone');
  assert.deepEqual(errors,[]);
  await page.close();
});

test('all eight display orientations preserve actual turns and the resumed local branch',async()=>{
  const {page,errors}=await pageAt();
  for(let symmetry=0;symmetry<8;symmetry++){
    await page.selectOption('#orientation',String(symmetry));
    await approach(page);
    const after=await clickPoint(page,'D4');
    const white=indexAt(after,'O17','W');
    assert.ok(white>=0,`orientation ${symmetry}`);
    await marker(page,white).click();
    const returned=await state(page);
    assert.equal(stoneAt(returned.position,'D4'),'B');
    assert.equal(stoneAt(returned.position,'O17'),'W');
    assert.equal(returned.position.toPlay,'B');
  }
  assert.deepEqual(errors,[]);
  await page.close();
});

test('shared history restores the actual distant move, resumed candidates and redo',async()=>{
  const {page,errors}=await pageAt();
  await page.evaluate(()=>{navigator.clipboard.writeText=async value=>{window.copiedStudyURL=value;};});
  await approach(page);
  const before=await clickPoint(page,'D4');
  const after=await clickPoint(page,'O17');
  await page.click('#previous');
  assert.deepEqual((await state(page)).position,before.position);
  await page.click('#copy-link');
  const shared=await page.evaluate(()=>window.copiedStudyURL);
  assert.ok(shared?.includes('#study='));
  await page.goto(shared);
  await page.waitForFunction(()=>window.JosekiExplorer);
  const restored=await state(page);
  assert.deepEqual(restored.position,before.position);
  assert.deepEqual(candidateSignatures(restored),candidateSignatures(before));
  await page.click('#next');
  assert.deepEqual((await state(page)).position,after.position);
  assert.deepEqual(errors,[]);
  await page.close();
});

test('source setup conditions cannot replace actual distant stones or erase their move numbers',async()=>{
  const {page,errors}=await pageAt();
  const f17=point('F17'),offset=f17.y*19+f17.x;
  for(const color of ['B','W']){
    await page.evaluate(()=>JosekiExplorer.loadNode(1874));
    await clickPoint(page,color==='B'?'F17':'D4');
    await clickPoint(page,color==='B'?'D4':'F17');
    for(const nodeId of [1875,1876,1877,1878]){
      const before=await state(page),index=before.candidates.findIndex(candidate=>candidate.nodeIds.includes(nodeId));
      assert.ok(index>=0,`node ${nodeId} remains available with a distant ${color} F17 stone`);
      await marker(page,index).click();
    }
    const before=await state(page),number=color==='B'?3:4;
    assert.equal(stoneAt(before.position,'F17'),color);
    assert.equal(before.position.numbers[offset],number);
    const conditional=before.candidates.findIndex(candidate=>candidate.nodeIds.includes(1908));
    let index;
    if(color==='B'){
      assert.equal(conditional,-1,'the AW[F17] setup condition conflicts with an actual black F17 stone');
      index=before.candidates.findIndex(candidate=>candidate.nodeIds.includes(1879));
      assert.ok(index>=0,'the ordinary B R14 branch remains available');
      await marker(page,index).hover();
    }else{
      assert.ok(conditional>=0,'an actual white F17 stone already satisfies AW[F17]');
      index=conditional;
      await marker(page,index).hover();
      const branch=before.candidates[index].nodeIds.indexOf(1908);
      if(branch>0||before.candidates[index].nodeIds.length>1)await page.selectOption('#preview-branch',String(branch));
      assert.equal((await state(page)).preview.nodeIds[0],1908);
    }
    const preview=(await state(page)).preview;
    assert.equal(stoneAt(preview.position,'F17'),color);
    assert.equal(preview.position.numbers[offset],number,'a source setup annotation preserves the actual move number');
    await page.click('#preview-apply');
    const applied=await state(page);
    assert.deepEqual(applied.position,preview.position);
    assert.equal(stoneAt(applied.position,'F17'),color);
    assert.equal(applied.position.numbers[offset],number);
    if(color==='W'){
      const pending=page.waitForEvent('download');
      await page.click('#download-sgf');
      const download=await pending,sgf=await readFile(await download.path(),'utf8');
      assert.equal([...sgf.matchAll(/;W\[fc\]/g)].length,1,'F17 is exported once as the actual white move');
      const setupProperties=[...sgf.matchAll(/\bAW((?:\[[^\]]*\])+)/g)].map(match=>match[1]);
      assert.ok(setupProperties.every(property=>!property.includes('[fc]')),'SGF does not repeat the same F17 stone as unnumbered setup');
    }
  }
  assert.deepEqual(errors,[]);
  await page.close();
});
