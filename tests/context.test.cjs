const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');
const createContext = require('../joseki-context.js');
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/joseki-db.js'),'utf8'),sandbox);
const nodes = sandbox.window.JOSEKI_DB.nodes;
const C = createContext(E,nodes);
const point = coordinate => E.parseCoordinates(coordinate);
function position(moves) {
  return moves.reduce((p,coordinate) => E.play(p,point(coordinate)).position,E.createPosition());
}
function remote(frame,coordinate) {
  const move = coordinate === 'pass' ? {pass:true} : point(coordinate);
  const result = E.play(frame.position,move);
  assert.equal(result.ok,true);
  return {result,retained:C.retain(frame,result,move)};
}

test('a real distant black move preserves the small-knight approach and enables white continuation',()=>{
  const p=position(['R16','P17']), frame={position:p,localPosition:p,refs:[1507]};
  for (const coordinate of ['D4','D16','Q4','K10']) {
    const {result,retained}=remote(frame,coordinate);
    assert.ok(retained,coordinate);
    assert.deepEqual(retained.refs,[1507]);
    assert.equal(retained.localPosition.toPlay,'W');
    assert.equal(retained.localPosition.board[point(coordinate).y*19+point(coordinate).x],null);
    assert.equal(result.position.board[point(coordinate).y*19+point(coordinate).x],'B');
    assert.ok(nodes[1507].children.some(id=>nodes[id].move?.color==='W'&&E.coordinates(nodes[id].move)==='Q14'));
    assert.deepEqual(frame.position,p);
  }
});

test('one distant move fulfils an explicit source pass and retains omitted-pass double approaches',()=>{
  const p=position(['Q16','R14']), frame={position:p,localPosition:p,refs:[2,14543]};
  const {result,retained}=remote(frame,'D4');
  assert.ok(retained);
  assert.deepEqual(retained.refs,[2,14543,15374]);
  assert.equal(result.position.moveNumber,3,'no synthetic pass is added to the real game');
  assert.equal(retained.localPosition.moveNumber,2,'the source diagram has no remote stone or synthetic move');
  assert.equal(nodes[753].move.color,'W');
  assert.equal(E.coordinates(nodes[753].move),'O17');
  assert.ok(nodes[15374].children.includes(15375));
});

test('multiple real tenuki alternate the actual and local turn without losing the corner',()=>{
  const p=position(['Q16','R14']);
  let frame={position:p,localPosition:p,refs:[2,14543]};
  for (const coordinate of ['D4','D16','Q4','K10']) {
    const {result,retained}=remote(frame,coordinate);
    assert.ok(retained,coordinate);
    assert.equal(retained.localPosition.toPlay,result.position.toPlay);
    assert.deepEqual(retained.localPosition.board,p.board);
    assert.equal(retained.localPosition.previousBoard,null);
    assert.ok(retained.refs.includes(2));
    frame={position:result.position,...retained};
  }
  assert.equal(frame.position.moveNumber,6);
  assert.equal(frame.position.toPlay,'B');
  assert.equal(new Set(frame.refs).size,frame.refs.length);
});

test('unknown nearby moves and moves near the next source branches invalidate the local match',()=>{
  for (const [moves,refs] of [[['Q16','R14'],[2]],[['R16','P17'],[1507]]]) {
    const p=position(moves),frame={position:p,localPosition:p,refs};
    assert.equal(remote(frame,'R17').retained,null);
  }
  const p=position(['Q16','R14']);
  // Q10 lies beyond the existing stones plus three lines, but is a recorded
  // immediate response. L17 is near N17, another immediate response.
  for (const coordinate of ['Q10','L17']) assert.equal(remote({position:p,localPosition:p,refs:[2]},coordinate).retained,null);
});

test('a true pass preserves context, while an empty source board cannot seed a false match',()=>{
  const p=position(['R16','P17']);
  assert.ok(remote({position:p,localPosition:p,refs:[1507]},'pass').retained);
  const empty=E.createPosition();
  assert.equal(remote({position:empty,localPosition:empty,refs:[1505]},'D4').retained,null);
});

test('source setup and abnormal player overrides cannot be consumed as tenuki',()=>{
  const custom=[
    {id:0,children:[1,3,5,7,9]},
    {id:1,setup:[{color:'B',...point('C3')}],children:[2]},
    {id:2,move:{color:'B',pass:true},children:[]},
    {id:3,toPlay:'W',children:[4]},
    {id:4,move:{color:'B',pass:true},children:[]},
    {id:5,move:{color:'B',pass:true},toPlay:'B',children:[]},
    {id:6,children:[]},
    {id:7,toPlay:'B',children:[8]},
    {id:8,move:{color:'B',pass:true},toPlay:'W',children:[]},
    {id:9,move:{color:'W',pass:true},children:[]}
  ];
  const context=createContext(E,custom),p=position(['Q16','R14']);
  const move=point('D16'),result=E.play(p,move);
  const retained=context.retain({position:p,localPosition:p,refs:[0]},result,move);
  assert.deepEqual(retained.refs,[0,8]);
  // C3 is supplied by a possible immediate metadata setup. A nearby new stone
  // cannot be dismissed as remote from the source's required conditions.
  const near=point('C4');
  assert.equal(context.retain({position:p,localPosition:p,refs:[0]},E.play(p,near),near),null);
});

test('a change to a source stone or an illegal move never retains context',()=>{
  const p=position(['Q16','R14']),move=point('D4'),result=E.play(p,move);
  const changed={...result.position,board:[...result.position.board]};
  changed.board[point('Q16').y*19+point('Q16').x]=null;
  assert.equal(C.retain({position:p,localPosition:p,refs:[2]},changed,move),null);
  assert.equal(C.retain({position:p,localPosition:p,refs:[2]},{ok:false,position:p},move),null);
  assert.equal(C.retain({position:p,localPosition:p,refs:[2]},result,{...move,color:'W'}),null);
});
