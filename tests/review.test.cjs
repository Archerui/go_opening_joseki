const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
const make=require('../joseki-review.js');
const data=require('../data/reviewed-sansan.json');
const R=make(E,data);
function position(moves,symmetry=0,swap=false){let p=E.createPosition([],swap?'W':'B');for(const coordinate of moves){const point=coordinate==='pass'?{pass:true}:E.transformPoint(E.parseCoordinates(coordinate),symmetry);const result=E.play(p,point);assert.equal(result.ok,true);p=result.position;}return p;}
const prefix=['Q16','R17','R16','Q17','P16'];
test('reviewed O18, P17, O17 order is preserved independently of source storage order',()=>{
 const p=position(prefix);
 assert.equal(R.match(p).review.externalId,22119);
 for(const [coordinate,order] of [['O18',1],['P17',2],['O17',3]])assert.equal(R.choice(p,{color:'W',...E.parseCoordinates(coordinate)}).order,order);
 assert.equal(R.choice(p,{color:'W',...E.parseCoordinates('O18')}).primary,true);
 assert.equal(R.choice(p,{color:'W',...E.parseCoordinates('O17')}).conditional,true);
 assert.equal(R.choice(p,{color:'W',...E.parseCoordinates('S16')}).legacy,true);
 assert.equal(R.choice(p,{color:'W',...E.parseCoordinates('S16')}).next,undefined);
});
test('review matches all symmetries and both colors but not a changed full-board context',()=>{
 for(let symmetry=0;symmetry<8;symmetry++)for(const swap of [false,true]){
  const p=position(prefix,symmetry,swap),move={color:swap?'B':'W',...E.transformPoint(E.parseCoordinates('O18'),symmetry)};
  assert.equal(R.choice(p,move).primary,true);
 }
 const p=position(prefix);p.board[9*19+9]='B';assert.equal(R.match(p),null);
});
test('joseki completion is a reviewed node even if it has further children',()=>{
 const reviewed=R.match(position([...prefix,'O18'])).review;
 assert.equal(reviewed.done,true);assert.ok(reviewed.nextMoves.length>0);
 assert.equal(R.match(position(prefix)).review.done,false);
});
test('same coordinate at a different stage is not assigned the wrong evaluation',()=>{
 const early=R.choice(position(prefix.slice(0,3)),{color:'W',...E.parseCoordinates('S16')});
 const later=R.choice(position(prefix),{color:'W',...E.parseCoordinates('S16')});
 assert.equal(early.next.category,'MISTAKE');assert.equal(later.legacy,true);assert.equal(later.next,undefined);
});

test('continuations require a sole response, explicit preference or unique verified first suggestion',()=>{
 const a={key:'a',quality:'good',entries:[{nodeId:1}]},b={key:'b',quality:'good',entries:[{nodeId:2}]};
 assert.equal(R.continuation([a,b]),null);
 assert.equal(R.continuation([b,a]),null);
 assert.equal(R.continuation([a]),a);
 const first={...b,review:{next:{category:'IDEAL'},order:1}};
 assert.equal(R.continuation([a,first]),first);
 assert.equal(R.continuation([first,{...a,review:{next:{category:'IDEAL'},order:1}}]),null);
 assert.equal(R.continuation([a,{...b,review:{next:{},order:2}}]),null);
 assert.equal(R.continuation([a,{...first,review:{...first.review,conditional:true}}]),null);
 assert.equal(R.continuation([{...first,quality:'bad'}]),null);
 assert.equal(R.continuation([{...first,quality:'questionable'}]),null);
 assert.equal(R.continuation([{...first,conditional:true}]),null);
 const preferred={...b,review:{primary:true}};
 assert.equal(R.continuation([a,preferred]),preferred);
 assert.equal(R.continuation([{...a,review:{primary:true}},preferred]),null);
});

test('automatic continuation never chooses an omitted turn for the other player',()=>{
 const black={quality:'good',move:{color:'B'},offTurn:false};
 const white={quality:'good',move:{color:'W'},offTurn:true,review:{primary:true,next:{},order:1}};
 assert.equal(R.continuation([white,black],'B'),black);
 assert.equal(R.continuation([white],'B'),null);
 assert.equal(R.continuation([white]),null);
 assert.equal(R.continuation([{...white,offTurn:false}],'B'),null);
 assert.equal(R.continuation([{...white,offTurn:false}],'W').move.color,'W');
});
