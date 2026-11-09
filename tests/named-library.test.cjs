/* Run with playwright-core on NODE_PATH and CHROME_PATH pointing to Chromium. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

let browser;
const url = process.env.JOSEKI_URL || 'http://127.0.0.1:9310/';
const trees = [
  {name:'芈氏飞刀', source:'josekle', externalId:20832, ply:6, leaves:61},
  {name:'村正妖刀', source:'josekle', externalId:28977, ply:5, leaves:1},
  {name:'大雪崩', source:'josekle', externalId:27135, ply:9, leaves:10},
  {name:'大雪崩', source:'gnugo', ply:9, leaves:2},
  {name:'大斜', source:'josekle', externalId:31748, ply:3, leaves:34}
];
const studies = [
  {id:'mi-flying-knife', name:'芈氏飞刀', ply:20},
  {id:'muramasa-sword', name:'村正妖刀', ply:18},
  {id:'large-avalanche', name:'大雪崩', ply:28},
  {id:'taisha-slant', name:'大斜', ply:20}
];

test.before(async () => {
  browser = await chromium.launch({executablePath:process.env.CHROME_PATH, headless:true, args:['--no-sandbox']});
});
test.after(async () => { await browser?.close(); });

async function pageAt(t) {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors,[]); });
  await page.goto(url);
  await page.waitForFunction(() => window.JosekiExplorer);
  return page;
}
async function namedLibrary(page) {
  await page.click('#library-toggle');
  await page.click('[data-library-filter="named"]');
  await page.fill('#library-search','');
}
const state = page => page.evaluate(() => JosekiExplorer.getState());
const entries = page => page.locator('#library-results .library-entry').evaluateAll(rows => rows.map(row => ({
  id:Number(row.dataset.node), title:row.querySelector('strong').textContent,
  subtitle:row.querySelector('small').textContent
})));

test('named library distinguishes five source trees from four representative studies', async t => {
  const page = await pageAt(t);
  await namedLibrary(page);
  const rows = await entries(page);
  assert.equal(rows.length,9);
  assert.equal(rows.filter(row => row.title.endsWith(' · 原库分支')).length,5);
  assert.equal(rows.filter(row => row.subtitle.startsWith('代表手顺 · ')).length,4);
  for (const study of studies) {
    const row = rows.find(row => row.title.startsWith(study.name+' · ') && row.subtitle.startsWith('代表手顺'));
    assert.ok(row,study.name);
    assert.ok(row.subtitle.startsWith(`代表手顺 · ${study.ply} 手 · `),row.subtitle);
  }
  for (const row of rows.filter(row => row.title.endsWith(' · 原库分支'))) {
    assert.match(row.subtitle,/尚未收录错着惩罚/);
    assert.doesNotMatch(row.subtitle,/全部变化|完整收录/);
  }
});

test('Chinese aliases find both source branches and representative studies', async t => {
  const page = await pageAt(t);
  await namedLibrary(page);
  for (const [alias,name] of [['芈式飞刀','芈氏飞刀'],['妖刀','村正妖刀'],['Muramasa','村正妖刀']]) {
    await page.fill('#library-search',alias);
    const rows = await entries(page);
    assert.equal(rows.length,2,alias);
    assert.ok(rows.every(row => row.title.startsWith(name+' · ')),alias);
    assert.equal(rows.filter(row => row.title.endsWith(' · 原库分支')).length,1,alias);
    assert.equal(rows.filter(row => row.subtitle.startsWith('代表手顺')).length,1,alias);
  }
});

test('each source entry reports its actual leaf count and opens playable named continuations', async t => {
  const page = await pageAt(t);
  for (const expected of trees) {
    await namedLibrary(page);
    const rows = (await entries(page)).filter(row => row.title===expected.name+' · 原库分支');
    const info = await page.evaluate(({rows,expected}) => {
      const nodes = window.JOSEKI_DB.nodes;
      const row = rows.find(row => {
        const node=nodes[row.id];
        return node.sourceId===expected.source && (expected.externalId==null || Number(node.externalId)===expected.externalId);
      });
      if (!row) return null;
      const stack=[row.id], leaves=[];
      while (stack.length) {
        const node=nodes[stack.pop()];
        if (!node.children.length) leaves.push(node.id);
        else stack.push(...node.children);
      }
      return {row,leaves};
    },{rows,expected});
    assert.ok(info,`${expected.name} / ${expected.source}`);
    assert.equal(info.leaves.length,expected.leaves);
    assert.ok(info.row.subtitle.includes(`${info.leaves.length} 条原谱叶变化`),info.row.subtitle);
    await page.locator(`#library-results [data-node="${info.row.id}"]`).click();
    assert.equal(await page.locator('#library-dialog').isVisible(),false);
    const before = await state(page);
    assert.equal(before.nodeId,info.row.id);
    assert.equal(before.position.moveNumber,expected.ply);
    assert.equal(await page.locator('#position-title').textContent(),expected.name);
    assert.ok(before.candidates.length>0,expected.name);
    await page.locator('[data-play="0"]').click();
    const after = await state(page);
    assert.equal(after.position.moveNumber,expected.ply+1);
    assert.notEqual(after.position.toPlay,before.position.toPlay);
    assert.equal(await page.locator('#position-title').textContent(),expected.name);
  }
});

test('all four representative studies retain their complete playable sequences', async t => {
  const page = await pageAt(t);
  for (const expected of studies) {
    await namedLibrary(page);
    const id = await page.evaluate(id => window.JOSEKI_DB.nodes.find(node => node.item?.id===id)?.id,expected.id);
    assert.equal(typeof id,'number',expected.id);
    await page.locator(`#library-results [data-node="${id}"]`).click();
    assert.equal((await state(page)).position.moveNumber,0);
    for (let ply=0;ply<expected.ply;ply++) {
      const before = await state(page);
      assert.equal(before.candidates.length,1,`${expected.name} before move ${ply+1}`);
      assert.equal(before.candidates[0].move.color,before.position.toPlay);
      await page.locator('[data-play="0"]').click();
      assert.equal((await state(page)).position.moveNumber,ply+1);
    }
    const end = await state(page);
    assert.equal(end.candidates.length,0,expected.name);
    assert.equal(end.historyLength,expected.ply+1);
    assert.equal(await page.locator('#position-title').textContent(),expected.name);
  }
});
