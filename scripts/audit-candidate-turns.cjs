#!/usr/bin/env node
'use strict';

// Audit source color/turn facts; this does not evaluate move strength.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');
const base = path.resolve(__dirname, '..');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(base, 'data/joseki-db.js'), 'utf8'), context);
const db = context.window.JOSEKI_DB, nodes = db.nodes;
for (const file of ['more-joseki.js','ai-other-joseki.js','famous-joseki.js','curated-joseki.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(base,file),'utf8'),context);
}
const curated=context.window.CURATED_JOSEKI;
const curatedTurnFacts=curated.map(item=>{
  const moves=[...(item.moves||'').matchAll(/([BW])\[([a-s])([a-s])\]/g)];
  const nonAlternating=[];
  for(let i=1;i<moves.length;i++)if(moves[i][1]===moves[i-1][1])nonAlternating.push(i+1);
  return {id:item.id,hasSetup:!!item.setup,firstPlayer:moves[0]?.[1]||null,nonAlternating};
});
const states = new Map(), instances = [];
const coordinate = move => move.pass ? 'pass' : E.coordinates(move);
const stateKey = p => JSON.stringify([p.board,p.toPlay,p.previousBoard,p.numbers,p.captures]);
function apply(position, node) {
  if (node.setup?.length) {
    position = {...position,board:[...position.board],numbers:[...position.numbers],previousBoard:null};
    for (const point of node.setup) {
      position.board[point.y*19+point.x] = ['B','W'].includes(point.color) ? point.color : null;
      position.numbers[point.y*19+point.x] = 0;
    }
  }
  if (node.move) {
    const result = E.play(position,node.move);
    if (!result.ok) throw new Error(`Illegal source node ${node.id}: ${result.error}`);
    position = result.position;
  }
  return node.toPlay ? {...position,toPlay:node.toPlay} : position;
}
function visit(id,before,prefix=[]) {
  const node = nodes[id];
  if (node.invalid) return;
  const position = apply(before,node);
  if (node.move) prefix = [...prefix,`${node.move.color}:${coordinate(node.move)}`];
  const instance = {nodeId:id,position,prefix};
  instances.push(instance);
  const key = stateKey(position);
  if (!states.has(key)) states.set(key,{position,refs:[],prefix});
  states.get(key).refs.push(id);
  for (const child of node.children) visit(child,position,prefix);
}
for (const root of db.roots) visit(root,E.createPosition());
function edges(refs) {
  const found=[];
  function scan(id,actions) {
    const node=nodes[id];
    if (!node || node.invalid) return;
    actions=[...actions,id];
    if (node.move) found.push({node,actions});
    else for (const child of node.children) scan(child,actions);
  }
  for (const ref of refs) for (const child of nodes[ref].children) scan(child,[]);
  return found;
}
function inspect(position,refs,prefix) {
  const points=new Map(), offTurn=[];
  for (const {node,actions} of edges(refs)) {
    let after=position;
    for (const id of actions) after=apply(after,nodes[id]);
    const point=coordinate(node.move);
    const item={nodeId:node.id,color:node.move.color,quality:node.quality,sourceId:node.sourceId};
    if (node.move.color!==position.toPlay) offTurn.push({...item,placement:point});
    if (node.move.pass) continue;
    if (!points.has(point)) points.set(point,[]);
    points.get(point).push(item);
  }
  const collisions=[...points].filter(([,choices])=>new Set(choices.map(c=>c.color)).size>1)
    .map(([placement,choices])=>({placement,choices}));
  return {nodeIds:refs,toPlay:position.toPlay,prefix,collisions,offTurn};
}
const sourceInstances=instances.map(i=>inspect(i.position,[i.nodeId],i.prefix));
const combinedStates=[...states.values()].map(s=>inspect(s.position,s.refs,s.prefix));
const sourceCollisions=sourceInstances.filter(i=>i.collisions.length);
const combinedCollisions=combinedStates.filter(i=>i.collisions.length);
const sourceOffTurn=sourceInstances.filter(i=>i.offTurn.length);
const bySource={};
for(const item of sourceOffTurn){
  const id=nodes[item.nodeIds[0]].sourceId;
  bySource[id] ||= {positionsWithOffTurnCandidates:0,offTurnEdges:0,positionsWithBothColorsAtSamePoint:0};
  bySource[id].positionsWithOffTurnCandidates++;
  bySource[id].offTurnEdges+=item.offTurn.length;
  bySource[id].positionsWithBothColorsAtSamePoint+=Number(item.collisions.length>0);
}
const report={
  version:1,
  scope:'Raw source trees only. Source-node instances and merged identical full states are separate counts. Full state includes board, player, previous board, stone numbers, captures. Merged counts are potential same-history source merges, not guaranteed UI navigation paths. Pass edges are excluded from coordinate collisions.',
  totals:{sourceNodes:instances.length,sourcePositionsWithOffTurnCandidates:sourceOffTurn.length,
    sourceOffTurnEdges:sourceOffTurn.reduce((n,i)=>n+i.offTurn.length,0),
    sourcePositionsWithBothColorsAtSamePoint:sourceCollisions.length,
    sourceSamePointColorCollisions:sourceCollisions.reduce((n,i)=>n+i.collisions.length,0),
    distinctFullStates:combinedStates.length,
    mergedStatesWithBothColorsAtSamePoint:combinedCollisions.length,
    mergedSamePointColorCollisions:combinedCollisions.reduce((n,i)=>n+i.collisions.length,0)},
  bySource,
  curated:{lines:curated.length,
    setupStartingWithWhite:curatedTurnFacts.filter(i=>i.hasSetup&&i.firstPlayer==='W'),
    nonAlternatingLines:curatedTurnFacts.filter(i=>i.nonAlternating.length)},
  sourceCollisions,
  mergedCollisions:combinedCollisions,
};
const output=process.argv[2];
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,bySource,curated:report.curated,
  examples:sourceCollisions.sort((a,b)=>a.prefix.length-b.prefix.length).slice(0,8)},null,2));
