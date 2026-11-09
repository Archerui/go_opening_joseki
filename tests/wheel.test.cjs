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

async function pageWithHistory() {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(()=>window.JosekiExplorer);
  // Unrelated, legal moves give a known alternating history without automatic continuations.
  await page.evaluate(()=>{
    for(const [x,y] of [[7,7],[9,7],[11,7],[7,9],[9,9],[11,9],[7,11],[9,11],[11,11],[3,15],[5,15],[7,15]]) {
      document.querySelector(`#main-board [data-x="${x}"][data-y="${y}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true}));
    }
  });
  const initial=await state(page);
  assert.equal(initial.cursor,12);
  assert.equal(initial.position.moveNumber,12);
  assert.equal(initial.historyLength,13);
  return {page,errors,initial};
}

async function dispatchWheel(page,deltas,deltaMode=0) {
  await page.evaluate(async ({deltas,deltaMode})=>{
    for(const deltaY of deltas) {
      document.querySelector('#main-board [data-x="9"][data-y="9"]').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY,deltaMode}));
    }
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  },{deltas,deltaMode});
}

test('a long wheel movement traverses several moves and replays the exact history',async()=>{
  const {page,errors,initial}=await pageWithHistory();
  await dispatchWheel(page,[-500]);
  const rewound=await state(page);
  assert.equal(rewound.cursor,7);
  assert.equal(rewound.position.moveNumber,7);
  assert.equal(rewound.position.toPlay,'W');
  assert.equal(rewound.historyLength,initial.historyLength);
  await dispatchWheel(page,[500]);
  const restored=await state(page);
  assert.deepEqual(restored.position,initial.position);
  assert.equal(restored.cursor,initial.cursor);
  assert.equal(restored.historyLength,initial.historyLength);
  await dispatchWheel(page,[-1],2);
  assert.equal((await state(page)).cursor,initial.cursor-5,'page-mode input is normalized to five moves');
  await dispatchWheel(page,[1],2);
  assert.deepEqual((await state(page)).position,initial.position);
  assert.deepEqual(errors,[]);
  await page.close();
});

test('continuous real mouse-wheel events work without moving the pointer again',async()=>{
  const {page,errors,initial}=await pageWithHistory();
  await page.locator('#main-board [data-x="9"][data-y="9"]').hover();
  // Keep the pointer stationary while the board is redrawn under it.
  for(let i=0;i<4;i++)await page.mouse.wheel(0,-100);
  await page.waitForFunction(cursor=>JosekiExplorer.getState().cursor===cursor,initial.cursor-4);
  const rewound=await state(page);
  assert.equal(rewound.historyLength,initial.historyLength);
  for(let i=0;i<4;i++)await page.mouse.wheel(0,100);
  await page.waitForFunction(cursor=>JosekiExplorer.getState().cursor===cursor,initial.cursor);
  assert.deepEqual((await state(page)).position,initial.position);
  assert.deepEqual(errors,[]);
  await page.close();
});

test('small trackpad deltas accumulate and an immediate reversal discards the old remainder',async()=>{
  const {page,errors,initial}=await pageWithHistory();
  await dispatchWheel(page,Array(10).fill(-10));
  assert.equal((await state(page)).cursor,initial.cursor-1);
  const cursors=await page.evaluate(async()=>{
    const send=deltaY=>document.querySelector('#main-board [data-x="9"][data-y="9"]').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY}));
    const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    send(-150);await frame();
    const backward=JosekiExplorer.getState().cursor;
    send(100);await frame();
    return [backward,JosekiExplorer.getState().cursor];
  });
  assert.deepEqual(cursors,[initial.cursor-2,initial.cursor-1]);
  assert.equal((await state(page)).historyLength,initial.historyLength);
  assert.deepEqual(errors,[]);
  await page.close();
});

test('a pause clears unfinished scrolling and line-mode wheel units remain usable',async()=>{
  const {page,errors,initial}=await pageWithHistory();
  await dispatchWheel(page,[-60]);
  assert.equal((await state(page)).cursor,initial.cursor);
  await page.waitForTimeout(260);
  await dispatchWheel(page,[-60]);
  assert.equal((await state(page)).cursor,initial.cursor,'the previous gesture does not contribute its remainder');
  await dispatchWheel(page,[-40]);
  assert.equal((await state(page)).cursor,initial.cursor-1);
  await dispatchWheel(page,[-3],1);
  assert.equal((await state(page)).cursor,initial.cursor-2,'three wheel lines move one step');
  await dispatchWheel(page,[3],1);
  assert.equal((await state(page)).cursor,initial.cursor-1);
  assert.deepEqual(errors,[]);
  await page.close();
});

test('large gestures stop at history boundaries and do not guess at an ambiguous fork',async()=>{
  const {page,errors}=await pageWithHistory();
  await page.evaluate(()=>JosekiExplorer.loadNode(11727));
  const fork=await state(page);
  assert.ok(fork.candidates.length>1);
  await dispatchWheel(page,[-10000]);
  assert.equal((await state(page)).cursor,0);
  await dispatchWheel(page,[100]);
  assert.equal((await state(page)).cursor,1,'reversing at the boundary does not consume an old scroll backlog');
  await dispatchWheel(page,[10000]);
  const restored=await state(page);
  assert.equal(restored.cursor,fork.cursor);
  assert.equal(restored.historyLength,fork.historyLength);
  assert.deepEqual(restored.position,fork.position);
  await dispatchWheel(page,[500]);
  assert.deepEqual((await state(page)).position,fork.position);
  assert.equal((await state(page)).historyLength,fork.historyLength);
  await dispatchWheel(page,[-100]);
  assert.equal((await state(page)).cursor,fork.cursor-1);
  assert.deepEqual(errors,[]);
  await page.close();
});

test('other navigation clears pending wheel input while horizontal scrolling and zoom do not play moves',async()=>{
  const {page,errors,initial}=await pageWithHistory();
  const cursors=await page.evaluate(async()=>{
    const send=options=>document.querySelector('#main-board [data-x="9"][data-y="9"]').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,...options}));
    const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const cursor=()=>JosekiExplorer.getState().cursor;
    send({deltaX:1000,deltaY:-500});send({deltaY:-500,ctrlKey:true});await frame();
    const ignored=cursor();
    send({deltaY:-60});document.getElementById('previous').click();
    send({deltaY:-60});await frame();
    const manual=cursor();
    send({deltaY:-40});await frame();
    const accumulated=cursor();
    send({deltaY:-100});document.getElementById('previous').click();await frame();
    return [ignored,manual,accumulated,cursor()];
  });
  assert.deepEqual(cursors,[initial.cursor,initial.cursor-1,initial.cursor-2,initial.cursor-3]);
  assert.equal((await state(page)).historyLength,initial.historyLength);
  assert.deepEqual(errors,[]);
  await page.close();
});
