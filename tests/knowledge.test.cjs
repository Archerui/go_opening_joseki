'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const K = require('../joseki-knowledge.js');
const parse = text => [...text.matchAll(/([BW])\[([a-s]{2})?\]/g)].map(m => m[2] ? {color:m[1],x:m[2].charCodeAt(0)-97,y:m[2].charCodeAt(1)-97} : {color:m[1],pass:true});
const describe = text => K.describe({moves:parse(text)});
function variants(moves) {
  const result = [];
  for (let symmetry = 0; symmetry < 8; symmetry++) {
    for (const swap of [false,true]) {
      result.push(moves.map(move => {
        const color=swap ? (move.color === 'B' ? 'W' : 'B') : move.color;
        if (move.pass) return {color,pass:true};
        let x = symmetry >= 4 ? 18-move.x : move.x, y = move.y;
        for (let rotation = 0; rotation < symmetry % 4; rotation++) [x,y] = [18-y,x];
        return {x,y,color};
      }));
    }
  }
  return result;
}

test('exposes the same API as a plain browser script', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../joseki-knowledge.js'),'utf8'),context);
  assert.equal(typeof context.JosekiKnowledge.describe,'function');
  assert.equal(context.JosekiKnowledge.describe({moves:parse('B[pd] W[qc]')}).title,'星位点三三');
});

test('corner occupation has its real name, without claiming a joseki', () => {
  for (const [point,name] of [['pd','星位'],['qd','小目'],['qc','三三'],['oc','目外'],['od','高目'],['oe','五五']]) {
    for (const moves of variants(parse('B['+point+']'))) {
      const result = K.describe({moves});
      assert.equal(result.title,name);
      assert.equal(result.kind,'opening');
    }
  }
  assert.notEqual(describe('B[qc]').title,describe('B[pd] W[qc]').title);
});

test('star and komoku approaches distinguish all four common approach names', () => {
  for (const [sgf,title] of [
    ['B[pd] W[nc]','星位小飞挂'], ['B[pd] W[mc]','星位大飞挂'],
    ['B[pd] W[nd]','星位一间高挂'], ['B[pd] W[md]','星位二间高挂'],
    ['B[qd] W[oc]','小目小飞挂'], ['B[qd] W[nc]','小目大飞挂'],
    ['B[qd] W[od]','小目一间高挂'], ['B[qd] W[nd]','小目二间高挂']
  ]) {
    for (const moves of variants(parse(sgf))) assert.equal(K.describe({moves}).title,title,sgf);
  }
  // Same-distance points on the wrong side / wrong line are not called kakari.
  for (const sgf of ['B[qd] W[qf]','B[qd] W[of]','B[qd] W[rd]','B[pd] W[rb]']) {
    assert.equal(describe(sgf).title,'',sgf);
  }
});

test('enclosures and approaches are different even when the coordinate is the same', () => {
  assert.equal(describe('B[pd] B[nc]').moveName,'小飞守角');
  assert.equal(describe('B[pd] W[nc]').moveName,'小飞挂');
  assert.equal(describe('B[qd] B[od]').moveName,'一间守角');
});

test('star double approaches recognize omitted or explicit tenuki under every symmetry and color', () => {
  for (const sgf of ['B[pd] W[qf] W[nc]','B[pd] W[qf] B[] W[nc]']) {
    for (const moves of variants(parse(sgf))) {
      const result=K.describe({moves});
      assert.equal(result.title,'星位双飞燕');
      assert.equal(result.moveName,'双飞燕');
      assert.equal(result.kind,'joseki');
      assert.ok(result.sourceIds.includes('knowledge-double-approach'));
      assert.notEqual(K.describe({moves:moves.slice(0,-1)}).title,'星位双飞燕');
    }
  }
  const continued=describe('B[pd] W[qf] B[] W[nc] B[qc]');
  assert.equal(continued.title,'星位双飞燕');
  assert.equal(continued.moveName,'');
});

test('double-approach names require the star point and correct two-sided attack', () => {
  for (const sgf of [
    'B[qd] W[oc] W[pf]', // The screenshot komoku continuation is not this name.
    'B[pd] W[qf] B[nc]', // The opposite side was defended by the corner owner.
    'B[pd] W[qf] W[nd]', // High/low variations need their own verified label.
    'B[pd] W[qf] W[] W[nc]', // Wrong player passed.
    'B[pd] W[qf] B[qc] W[nc]' // An actual local response intervened.
  ]) assert.notEqual(describe(sgf).title,'星位双飞燕',sgf);
});

test('real Pachi and GNU Go double-approach records have the same verified name', () => {
  const sandbox={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/joseki-db.js'),'utf8'),sandbox);
  const nodes=sandbox.window.JOSEKI_DB.nodes;
  for (const id of [753,15375]) {
    const moves=[];
    for (let node=nodes[id];node;node=node.parent==null?null:nodes[node.parent]) if(node.move)moves.unshift(node.move);
    assert.equal(K.describe({moves}).title,'星位双飞燕',String(id));
  }
});

test('response names use the actual root and approach direction', () => {
  for (const [sgf,name] of [
    ['B[pd] W[qf] B[nc]','小飞应'], ['B[pd] W[qf] B[mc]','大飞应'],
    ['B[pd] W[qf] B[nd]','一间跳应'], ['B[pd] W[qf] B[qe]','尖顶'],
    ['B[pd] W[qf] B[pf]','靠压'], ['B[qd] W[oc] B[pf]','小飞应'],
    ['B[qd] W[oc] B[pe]','尖应'], ['B[qd] W[od] B[oc]','托'],
    ['B[qd] W[od] B[oc] W[nc]','扳'], ['B[qd] W[od] B[oc] W[nc] B[pc]','退']
  ]) assert.equal(describe(sgf).moveName,name,sgf);
});

test('pincer distance is measured from the approached stone and high/low from the edge', () => {
  for (const [sgf,name] of [
    ['B[pd] W[qf] B[qh]','一间低夹'], ['B[pd] W[qf] B[ph]','一间高夹'],
    ['B[pd] W[qf] B[qi]','二间低夹'], ['B[pd] W[qf] B[pi]','二间高夹'],
    ['B[pd] W[qf] B[qj]','三间低夹'], ['B[pd] W[qf] B[pj]','三间高夹'],
    ['B[qd] W[oc] B[mc]','一间低夹'], ['B[qd] W[od] B[ld]','二间高夹']
  ]) {
    for (const moves of variants(parse(sgf))) assert.equal(K.describe({moves}).moveName,name,sgf);
  }
});

test('the screenshot continuation names distinguish hane, knight, jump and push', () => {
  const prefix = 'B[pd] W[qc] B[qd] W[pc] B[od]';
  for (const [point,name] of [['rd','二路扳'],['nb','二路小飞'],['nc','一间跳'],['oc','推']]) {
    for (const moves of variants(parse(prefix+' W['+point+']'))) {
      const result = K.describe({moves});
      assert.equal(result.moveName,name);
      assert.equal(result.kind,'technique');
      assert.ok(result.title.startsWith('星位点三三'));
    }
  }
  assert.equal(describe(prefix+' W[rd] B[re] W[rc]').title,'星位点三三 · 扳粘');
  assert.equal(describe(prefix+' W[rd] B[re]').moveName,'挡');
  assert.equal(describe(prefix+' W[ob]').moveName,'');
  assert.equal(describe('B[pd] W[qc] B[qd] W[pc] B[oc] W[ob] B[nc] W[nb]').moveName,'爬');
});

test('a known line keeps its family, but never reuses an earlier move name for a new move', () => {
  const result = describe('B[pd] W[qc] B[qd] W[pc] B[od] W[jj]');
  assert.ok(result.title.startsWith('星位点三三'));
  assert.equal(result.moveName,'');
  assert.equal(describe('B[pd] W[jj]').title,'');
});

test('proper joseki names require the defining move and a complete contextual prefix', () => {
  const named = [
    ['B[qd] W[od] B[ld] W[qe] B[pd]','村正妖刀'],
    ['B[qd] W[od] B[oc] W[pd] B[pc] W[qe] B[nc] W[nd] B[md]','大雪崩'],
    ['B[oc] W[qd] B[pf]','大斜'],
    ['B[pd] W[qc] B[qd] W[pc] B[nc] W[nb]','芈氏飞刀']
  ];
  for (const [sgf,title] of named) {
    const original = parse(sgf);
    for (const moves of variants(original)) {
      assert.equal(K.describe({moves}).title,title);
      assert.equal(K.describe({moves}).kind,'joseki');
      assert.notEqual(K.describe({moves:moves.slice(0,-1)}).title,title);
    }
    const outOfOrder = [...original];
    [outOfOrder[0],outOfOrder[1]] = [outOfOrder[1],outOfOrder[0]];
    assert.notEqual(K.describe({moves:outOfOrder}).title,title);
  }
  assert.notEqual(describe('B[pd] W[qc] B[qd] W[pc] B[od] W[nb]').title,'芈氏飞刀');
});

test('Mi Yuting family name takes priority over later techniques in both screenshot branches', () => {
  const prefix='B[pd] W[qc] B[qd] W[pc] B[nc] W[nb]';
  for(const [suffix,moveName] of [['','二路托'],[' B[mb]','扳'],[' B[mb] W[ob]','二路长'],[' B[mb] W[oc]','']]){
    for(const moves of variants(parse(prefix+suffix))){
      const result=K.describe({moves});
      assert.equal(result.title,'芈氏飞刀');assert.equal(result.kind,'joseki');
      assert.equal(result.moveName,moveName);
      assert.ok(result.sourceIds.includes('knowledge-mi-family'));
      if(moveName==='扳'||moveName==='二路长')assert.ok(result.sourceIds.includes('knowledge-go-terms'));
    }
  }
  assert.notEqual(describe('B[pd] W[qc] B[qd] W[pc] B[nc]').title,'芈氏飞刀');
  assert.equal(describe('B[pd] W[qc] B[qd] W[pc] B[nc]').moveName,'小飞');
  for(const alternate of ['W[oc]','W[nd]','W[] B[nb]']){
    assert.notEqual(describe('B[pd] W[qc] B[qd] W[pc] B[nc] '+alternate).title,'芈氏飞刀');
  }
});

test('the historical outside hane is a move within the already named Mi Yuting family', () => {
  const moves = parse('B[pd] W[dd] B[pp] W[dp] B[cq] W[cp] B[dq] W[fq] B[fr] W[gr] B[eq] W[fp] B[ep] W[eo] B[do] W[bo] B[dn] W[en] B[em] W[fm]');
  for(const sequence of variants(moves)){
    assert.notEqual(K.describe({moves:sequence.slice(0,8)}).title,'芈氏飞刀');
    assert.equal(K.describe({moves:sequence.slice(0,9)}).title,'芈氏飞刀');
    assert.equal(K.describe({moves:sequence.slice(0,9)}).moveName,'二路托');
    assert.equal(K.describe({moves:sequence.slice(0,19)}).title,'芈氏飞刀');
    assert.equal(K.describe({moves:sequence.slice(0,19)}).moveName,'');
    assert.equal(K.describe({moves:sequence}).title,'芈氏飞刀');
    assert.equal(K.describe({moves:sequence}).moveName,'外扳');
    assert.equal(K.describe({moves:sequence.slice(3)}).moveName,'外扳');
  }
});

test('setup is accepted only when a single root stone establishes the prefix', () => {
  assert.equal(K.describe({setup:parse('B[pd]'),moves:parse('W[qc]')}).title,'星位点三三');
  assert.equal(K.describe({setup:parse('B[pd] W[qc]'),moves:parse('B[qd]')}).title,'');
  assert.equal(K.describe({setup:parse('B[jj]'),moves:parse('W[qc]')}).title,'');
});

test('unknown, incomplete and malformed input remains unnamed without source-title fallbacks', () => {
  for (const input of [undefined,null,{}, {moves:[]}, {moves:null}, {setup:{}},
    {moves:[{color:'X',x:15,y:3}]}, {moves:[{color:'B',x:19,y:3}]},
    {moves:parse('B[jj]')}, {moves:parse('B[pd] W[jj]')},
    {title:'OGS 定式总库',name:'星位 · Pachi',moves:[]}]) {
    assert.deepEqual(K.describe(input),{title:'',moveName:'',kind:'technique',sourceIds:[]});
  }
});

test('does not mutate input, and every reported source resolves to a reference URL', () => {
  const moves = Object.freeze(parse('B[pd] W[qc] B[qd] W[pc] B[od] W[nb]').map(Object.freeze));
  const first = K.describe(Object.freeze({moves,setup:Object.freeze([])}));
  const sourceIds = new Set(K.sources.map(source => source.id));
  assert.ok(first.sourceIds.length);
  assert.ok(first.sourceIds.every(id => sourceIds.has(id)));
  assert.ok(K.sources.every(source => /^https:\/\//.test(source.url)));
  first.sourceIds.length = 0;
  assert.ok(K.describe({moves}).sourceIds.length);
});
