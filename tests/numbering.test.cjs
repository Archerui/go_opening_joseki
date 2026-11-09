/* Run with playwright-core on NODE_PATH and CHROME_PATH pointing to Chromium. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

let browser;
const url = process.env.JOSEKI_URL || 'http://127.0.0.1:9310/';
test.before(async () => {
  browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
});
test.after(async () => { await browser?.close(); });
const state = page => page.evaluate(() => JosekiExplorer.getState());
const pointKey = candidate => `${candidate.move.color}:${candidate.move.x},${candidate.move.y}`;
const marker = (page,index) => page.locator(`#main-board .candidate-mark[data-candidate="${index}"]`);

async function newPage() {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(()=>window.JosekiExplorer);
  return {page,errors};
}

async function numbering(page,label='') {
  const snapshot=await page.evaluate(()=>({
    state:JosekiExplorer.getState(),
    marks:[...document.querySelectorAll('#main-board .candidate-mark')].map(mark=>({index:+mark.dataset.candidate,number:+mark.querySelector('text').textContent})),
    rows:[...document.querySelectorAll('#candidate-list .candidate-row')].map(row=>({index:+row.dataset.candidate,number:row.querySelector('.candidate-number').textContent.trim()})),
    count:Number(document.getElementById('candidate-count').textContent)
  }));
  const choices=snapshot.state.candidates;
  const ordinary=choices.filter(candidate=>!candidate.move.pass);
  const unique=new Set(ordinary.map(pointKey));
  const expected=Array.from({length:unique.size},(_,index)=>index+1);
  assert.deepEqual(snapshot.marks.map(mark=>mark.number).sort((a,b)=>a-b),expected,`${label}: every visible point has one consecutive number`);
  assert.equal(snapshot.count,unique.size,`${label}: the count describes actual board points`);
  assert.equal(snapshot.rows.length,choices.length,`${label}: distinct source conditions remain accessible`);
  const pointNumbers=new Map(),markedPoints=new Map();
  for(const mark of snapshot.marks) {
    const candidate=choices[mark.index];
    assert.ok(candidate&&!candidate.move.pass,`${label}: each marker targets an ordinary candidate`);
    assert.equal(mark.number,candidate.number,`${label}: marker number matches the selected candidate`);
    markedPoints.set(pointKey(candidate),mark.number);
  }
  for(const row of snapshot.rows) {
    const candidate=choices[row.index];
    assert.ok(candidate,`${label}: row retains its original candidate index`);
    if(candidate.move.pass) {
      assert.equal(candidate.number,null,`${label}: tenuki does not consume a point number`);
      assert.equal(row.number,'↗',`${label}: tenuki has a separate symbol`);
      continue;
    }
    const key=pointKey(candidate);
    if(pointNumbers.has(key))assert.equal(candidate.number,pointNumbers.get(key),`${label}: same-point conditions share one number`);
    pointNumbers.set(key,candidate.number);
    assert.equal(row.number,String(candidate.number),`${label}: row and candidate agree`);
    assert.equal(candidate.number,markedPoints.get(key),`${label}: row and board agree even for a separate setup diagram`);
  }
  const rowNumbers=snapshot.rows.filter(row=>!choices[row.index].move.pass).map(row=>choices[row.index].number);
  assert.deepEqual(rowNumbers,[...rowNumbers].sort((a,b)=>a-b),`${label}: the sidebar keeps same-point conditions together`);
  return snapshot;
}

async function wheel(page,deltaY) {
  await page.evaluate(async deltaY=>{
    document.querySelector('#main-board [data-x="9"][data-y="9"]').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY}));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  },deltaY);
}

test('all five opening families keep consecutive board numbers in eight orientations with errors shown or hidden',async()=>{
  const {page,errors}=await newPage();
  for(const preset of ['星位','小目','三三','目外','高目']) {
    for(let symmetry=0;symmetry<8;symmetry++) {
      await page.selectOption('#orientation',String(symmetry));
      await page.click(`[data-preset="${preset}"]`);
      for(const showBad of [true,false]) {
        await page.locator('#show-bad').setChecked(showBad);
        const snapshot=await numbering(page,`${preset}, orientation ${symmetry}, errors ${showBad}`);
        if(!showBad)assert.ok(snapshot.state.candidates.every(candidate=>candidate.quality!=='bad'));
      }
    }
  }
  assert.deepEqual(errors,[]);
  await page.close();
});

test('merged and individual source trees number coordinates rather than setup variants or tenuki',async()=>{
  const {page,errors}=await newPage();
  await page.click('[data-preset="星位"]');
  const merged=await numbering(page,'merged star opening');
  assert.equal(merged.marks.length,11,'the reported position has eleven actual points');
  const approach=merged.state.candidates.filter(candidate=>candidate.move.x===16&&candidate.move.y===5);
  assert.equal(approach.length,4,'all four distinct R14 setup diagrams are retained');
  assert.deepEqual(new Set(approach.map(candidate=>candidate.number)),new Set([1]));
  assert.ok(merged.state.candidates.some(candidate=>candidate.move.pass));
  for(const id of [1,1506,3559]) {
    await page.evaluate(id=>JosekiExplorer.loadNode(id),id);
    const snapshot=await numbering(page,`source node ${id}`);
    assert.ok(snapshot.state.candidates.some(candidate=>candidate.move.pass)||id===1506);
  }
  assert.deepEqual(errors,[]);
  await page.close();
});

test('same-number R14 conditions preserve independent previews, exact application and default source references',async()=>{
  const {page,errors}=await newPage();
  const K16=3*19+9,Q10=9*19+15;
  for(const fixture of [
    {id:11747,k16:null,q10:null,next:[],excluded:[1043,1053]},
    {id:1042,k16:'B',q10:'B',next:[1043],excluded:[1053]},
    {id:1052,k16:null,q10:'B',next:[1053],excluded:[1043]}
  ]) {
    await page.click('[data-preset="星位"]');
    let before=await state(page),index=before.candidates.findIndex(candidate=>candidate.nodeIds.includes(fixture.id));
    assert.ok(index>=0,`source ${fixture.id} remains selectable`);
    assert.equal(before.candidates[index].number,1);
    // A normal left click takes only this candidate's exact resulting position.
    if(fixture.id===11747)await marker(page,index).click();
    else await page.locator(`.candidate-play[data-play="${index}"]`).click();
    const after=await state(page);
    assert.equal(after.position.moveNumber,2);
    assert.equal(after.position.board[K16],fixture.k16);
    assert.equal(after.position.board[Q10],fixture.q10);
    const nextIds=after.candidates.flatMap(candidate=>candidate.nodeIds);
    for(const id of fixture.next)assert.ok(nextIds.includes(id),`source ${fixture.id} keeps its own next move ${id}`);
    for(const id of fixture.excluded)assert.ok(!nextIds.includes(id),`source ${fixture.id} does not inherit another setup's continuation ${id}`);

    await page.click('[data-preset="星位"]');
    before=await state(page);index=before.candidates.findIndex(candidate=>candidate.nodeIds.includes(fixture.id));
    await page.locator(`.preview-button[data-preview="${index}"]`).click();
    const preview=(await state(page)).preview;
    assert.equal(preview.nodeIds[0],fixture.id,'the selected condition determines the exact source line');
    assert.equal(preview.position.board[K16],fixture.k16);
    assert.equal(preview.position.board[Q10],fixture.q10);
    await page.click('#preview-apply');
    assert.deepEqual((await state(page)).position,preview.position,'applying a same-number variant executes only its displayed line');
    await numbering(page,`after applying source ${fixture.id}`);
  }
  assert.deepEqual(errors,[]);
  await page.close();
});

test('wheel undo and redo rebuild the same point numbers without stale conditional markers',async()=>{
  const {page,errors}=await newPage();
  await page.click('[data-preset="星位"]');
  const before=await numbering(page,'before play');
  const index=before.state.candidates.findIndex(candidate=>candidate.nodeIds.includes(11747));
  await marker(page,index).click();
  const after=await numbering(page,'after play');
  await wheel(page,-100);
  const undone=await numbering(page,'wheel undo');
  assert.deepEqual(undone.state.position,before.state.position);
  assert.deepEqual(undone.state.candidates,before.state.candidates);
  assert.deepEqual(undone.marks,before.marks);
  await wheel(page,100);
  const redone=await numbering(page,'wheel redo');
  assert.deepEqual(redone.state.position,after.state.position);
  assert.deepEqual(redone.state.candidates,after.state.candidates);
  assert.deepEqual(redone.marks,after.marks);
  assert.deepEqual(errors,[]);
  await page.close();
});
