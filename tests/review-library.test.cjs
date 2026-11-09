const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
const make=require('../joseki-review.js');
const base=require('../data/reviewed-sansan.json');
const library=require('../data/reviewed-library.json');
const manual=require('../data/manual-order-notes.json');
const R=make(E,base,library,manual);
function position(moves,symmetry=0,swap=false){let p=E.createPosition([],swap?'W':'B');for(const coordinate of moves){const point=coordinate==='pass'?{pass:true}:E.transformPoint(E.parseCoordinates(coordinate),symmetry);const result=E.play(p,point);assert.equal(result.ok,true);p=result.position;}return p;}
function choice(p,coordinate,symmetry=0){return R.choice(p,{color:p.toPlay,...(coordinate==='pass'?{pass:true}:E.transformPoint(E.parseCoordinates(coordinate),symmetry))});}
test('verified suggestions cover six opening families and key non-san-san responses',()=>{
 assert.deepEqual(new Set(library.coverage.map(c=>c.opening)),new Set(['Q16','R16','R17','R15','Q15','P15']));
 for(const [moves,first] of [[['Q16','R14'],'O17'],[['Q16','Q14'],'O16'],[['R16','P17'],'Q15'],[['R16','P16'],'P17'],[['R15','Q17'],'P16']]) {
  for(let symmetry=0;symmetry<8;symmetry++)for(const swap of [false,true]) {
   const p=position(moves,symmetry,swap);assert.equal(choice(p,first,symmetry).order,1,moves.join(','));
  }
 }
});
test('big-knight approach keeps the source tie and does not invent a single best response',()=>{
 const p=position(['Q16','R13']);
 const a=choice(p,'O17'),b=choice(p,'pass');
 assert.equal(a.order,1);assert.equal(b.order,1);
 assert.equal(R.continuation([{quality:'good',review:a},{quality:'good',review:b}]),null);
});
test('whole-position teaching conditions survive library merging',()=>{
 const p=position(['R17','Q16']);assert.equal(choice(p,'R16').conditional,true);
 const high=position(['Q15','Q17','O16']);assert.equal(choice(high,'O17').conditional,true);
 assert.equal(choice(high,'pass').primary,true);
 const low=position(['R16','P17']);
 for(const coordinate of ['Q14','Q15','Q17'])assert.equal(choice(low,coordinate).primary,true);
 assert.equal(R.match(position(['Q16','R17','R16','Q17','P16','O18'])).review.done,true);
});
test('every reviewed sequence and all immediate source continuations are legal',()=>{
 for(const review of library.positions) {
  const p=position(review.moves);
  for(const next of review.nextMoves) {
   const move=next.placement==='pass'?{pass:true}:E.parseCoordinates(next.placement);
   assert.equal(E.play(p,move).ok,true,`${review.externalId}: ${next.placement}`);
  }
 }
});
