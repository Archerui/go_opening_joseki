#!/usr/bin/env node
'use strict';

// Reproducible metadata/branch audit. This does not evaluate Go strength.
// Source trees remain separate: repeated positions count once per source node.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const makeReview = require('../joseki-review.js');
const base = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(base, file), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(read('data/joseki-db.js'), sandbox);
const db = sandbox.window.JOSEKI_DB;
const nodes = db.nodes;
const qualityOrder = { good: 0, unknown: 1, questionable: 2, bad: 3 };
const coordinate = move => move.pass ? 'pass' : E.coordinates(move);
const signature = position => position.board.map(s => s || '.').join('') + position.toPlay;
const baselineData = JSON.parse(read('data/reviewed-sansan.json'));
const libraryPath = path.join(base, 'data/reviewed-library.json');
const libraryData = fs.existsSync(libraryPath) ? JSON.parse(fs.readFileSync(libraryPath, 'utf8')) : { positions: [] };
const manualPath = path.join(base, 'data/manual-order-notes.json');
const manualData = fs.existsSync(manualPath) ? JSON.parse(fs.readFileSync(manualPath, 'utf8')) : { positions: [] };
// Match the explorer's fact/teaching-note merge order.
const merged = new Map();
for (const data of [baselineData, libraryData, manualData]) for (const review of data.positions) {
  const key = review.moves.join(','), previous = merged.get(key) || { nextMoves: [] };
  merged.set(key, { ...previous, ...review, candidateNotes: { ...previous.candidateNotes, ...review.candidateNotes } });
}
const mergedReviews = [...merged.values()];

function reviewIndex(records) {
  const index = new Map();
  for (const review of records) {
    for (let symmetry = 0; symmetry < 8; symmetry++) for (const swapped of [false, true]) {
      let position = E.createPosition([], swapped ? 'W' : 'B');
      for (const value of review.moves) {
        const point = value === 'pass' ? { pass: true } : E.transformPoint(E.parseCoordinates(value), symmetry);
        const result = E.play(position, point);
        if (!result.ok) throw new Error(`Invalid reviewed sequence ${review.externalId}: ${result.error}`);
        position = result.position;
      }
      const key = signature(position);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({ review, symmetry });
    }
  }
  return index;
}
const currentReview = makeReview(E, baselineData, libraryData, manualData);
const previousReviews = reviewIndex(baselineData.positions);
function lookup(index, position, move) {
  if (move.color !== position.toPlay) return null;
  for (const match of index.get(signature(position)) || []) {
    const canonical = move.pass ? 'pass' : E.coordinates(E.inverseTransformPoint(move, match.symmetry));
    const child = match.review.nextMoves.find(next => next.placement === canonical);
    const note = match.review.candidateNotes?.[canonical];
    if (child || note) return { ...child, note, reviewExternalId: match.review.externalId };
  }
  return null;
}

function applyNode(position, node) {
  if (node.setup?.length) {
    position = { ...position, board: [...position.board], numbers: [...position.numbers], previousBoard: null };
    for (const point of node.setup) {
      position.board[point.y * 19 + point.x] = ['B', 'W'].includes(point.color) ? point.color : null;
      position.numbers[point.y * 19 + point.x] = 0;
    }
  }
  if (node.move) {
    const result = E.play(position, node.move);
    if (!result.ok) throw new Error(`Invalid source node ${node.id}: ${result.error}`);
    position = result.position;
  }
  return node.toPlay ? { ...position, toPlay: node.toPlay } : position;
}

function playableEdges(node) {
  const result = [];
  function visit(id, actions) {
    const next = nodes[id];
    if (next.invalid) return;
    actions = [...actions, id];
    if (next.move) result.push({ node: next, actions });
    else for (const child of next.children) visit(child, actions);
  }
  for (const id of node.children) visit(id, []);
  return result;
}

function choicesFor(node, position) {
  const grouped = new Map();
  for (const entry of playableEdges(node)) {
    let result = position;
    for (const id of entry.actions) result = applyNode(result, nodes[id]);
    // Same grouping as the explorer, including setup/number/capture context.
    const key = entry.node.move.color + ':' + coordinate(entry.node.move) + ':' + signature(result) + ':' + JSON.stringify([result.previousBoard, result.numbers, result.captures]);
    if (!grouped.has(key)) grouped.set(key, { move: entry.node.move, entries: [], conditional: false });
    const group = grouped.get(key);
    group.entries.push(entry.node);
    group.conditional ||= entry.actions.some(id => nodes[id].setup?.length);
  }
  return [...grouped.values()].map(group => {
    group.entries.sort((a, b) => qualityOrder[a.quality] - qualityOrder[b.quality] || a.id - b.id);
    const qualities = new Set(group.entries.map(entry => entry.quality));
    let quality = qualities.has('good') && qualities.has('bad') ? 'questionable' : group.entries[0].quality;
    let baselineQuality = quality;
    const previous = lookup(previousReviews, position, group.move);
    if (previous?.category === 'MISTAKE') baselineQuality = 'bad';
    if (baselineQuality === 'good' && (group.conditional || (previous?.reviewExternalId === 22119 && previous.placement === 'O17'))) baselineQuality = 'questionable';
    const currentChoice = currentReview.choice(position, group.move);
    const reviewed = currentChoice ? { ...currentChoice.next, note: currentChoice.note } : null;
    quality = { IDEAL: 'good', GOOD: 'questionable', MISTAKE: 'bad', TRICK: 'questionable', QUESTION: 'questionable' }[reviewed?.category] || quality;
    const conditional = group.conditional || !!reviewed?.note?.conditional;
    if (quality === 'good' && conditional) quality = 'questionable';
    return { nodeId: group.entries[0].id, placement: coordinate(group.move), color: group.move.color,
      quality, baselineQuality, conditional, teachingPreferred: !!reviewed?.note?.preferred, sourceOrder: reviewed?.sourceOrder ?? null,
      reviewedCategory: reviewed?.category ?? null, reviewedExternalId: reviewed?.externalId ?? null };
  });
}

function openingFamily(firstMove, collection) {
  if (collection.sourceId !== 'josekle') return collection.title.split(' · ')[0].replace(/^星位.*/, '星位');
  if (!firstMove || firstMove.pass) return '起手';
  const distances = [Math.min(firstMove.x + 1, 19 - firstMove.x), Math.min(firstMove.y + 1, 19 - firstMove.y)].sort((a, b) => a - b).join('-');
  return { '4-4': '星位', '3-4': '小目', '3-3': '三三', '4-5': '高目', '3-5': '目外', '5-5': '五五' }[distances] || '其他';
}
const blankTotals = () => ({ nodes: 0, rawForks: 0, effectiveForks: 0, reviewedForks: 0, allChoicesHaveSourceOrder: 0,
  someChoicesHaveSourceOrder: 0, noSourceOrder: 0, noOrderMixedQuality: 0, noOrderSameQuality: 0,
  uniqueSourceFirstChoice: 0, uniqueTeachingPreferred: 0, mixedQualityLabels: 0, bestQualityTies: 0,
  multipleNonBadChoices: 0, baselineReviewedForks: 0 });
const total = blankTotals(), byFamily = {}, bySource = {}, byCollection = {}, forks = [];
const positionKeys = new Set(), reviewedPositionKeys = new Set();
let reviewedNodes = 0, baselineReviewedNodes = 0;

function visit(id, before, collection, prefix = [], firstMove = null, setupHistory = []) {
  const node = nodes[id], position = applyNode(before, node);
  if (node.setup?.length) setupHistory = [...setupHistory, { nodeId: id, stones: node.setup.map(stone => ({ color: stone.color, placement: E.coordinates(stone) })) }];
  firstMove ||= node.move;
  if (node.move) prefix = [...prefix, `${node.move.color}:${coordinate(node.move)}`];
  const family = openingFamily(firstMove, collection);
  byFamily[family] ||= blankTotals();
  bySource[node.sourceId] ||= blankTotals();
  byCollection[collection.id] ||= { title: collection.title, ...blankTotals() };
  const groups = [total, byFamily[family], bySource[node.sourceId], byCollection[collection.id]];
  for (const group of groups) { group.nodes++; group.rawForks += Number(node.children.length > 1); }
  const key = signature(position), matched = currentReview.match(position), baselineMatched = previousReviews.get(key);
  reviewedNodes += Number(!!matched); baselineReviewedNodes += Number(!!baselineMatched);
  const choices = choicesFor(node, position);
  if (choices.length > 1) {
    const ordered = choices.filter(choice => Number.isFinite(choice.sourceOrder)).length;
    const eligible = choices.filter(choice => choice.quality !== 'bad');
    const bestQuality = Math.min(...eligible.map(choice => qualityOrder[choice.quality]));
    const tiedBest = eligible.filter(choice => qualityOrder[choice.quality] === bestQuality).length;
    const mixed = new Set(choices.map(choice => choice.quality)).size > 1;
    const baselineEligible = choices.filter(choice => choice.baselineQuality !== 'bad');
    const baselineBest = Math.min(...baselineEligible.map(choice => qualityOrder[choice.baselineQuality]));
    positionKeys.add(key);
    if (matched) reviewedPositionKeys.add(key);
    for (const group of groups) {
      group.effectiveForks++;
      group.reviewedForks += Number(!!matched);
      group.baselineReviewedForks += Number(!!baselineMatched);
      group.allChoicesHaveSourceOrder += Number(ordered === choices.length);
      group.someChoicesHaveSourceOrder += Number(ordered > 0 && ordered < choices.length);
      group.noSourceOrder += Number(ordered === 0);
      group.noOrderMixedQuality += Number(ordered === 0 && mixed);
      group.noOrderSameQuality += Number(ordered === 0 && !mixed);
      group.uniqueSourceFirstChoice += Number(eligible.filter(choice => choice.sourceOrder === 1 && choice.quality === 'good' && !choice.conditional).length === 1);
      group.uniqueTeachingPreferred += Number(eligible.filter(choice => choice.teachingPreferred && choice.quality === 'good' && !choice.conditional).length === 1);
      group.mixedQualityLabels += Number(mixed);
      group.bestQualityTies += Number(tiedBest > 1);
      group.multipleNonBadChoices += Number(eligible.length > 1);
    }
    forks.push({ nodeId: id, sourceId: node.sourceId, sourceFile: node.sourceFile, sourceExternalId: node.externalId ?? null, family, prefix, setupHistory,
      rawChildren: node.children.length, reviewedExternalId: matched?.review.externalId ?? null,
      baselineReviewed: !!baselineMatched, done: !!matched?.review.done,
      sourceOrderCoverage: ordered === choices.length ? 'all' : ordered ? 'partial' : 'none',
      mixedQualityLabels: mixed, bestQualityTies: tiedBest, nonBadChoices: eligible.length,
      baselineNonBadChoices: baselineEligible.length,
      baselineBestQualityTies: baselineEligible.filter(choice => qualityOrder[choice.baselineQuality] === baselineBest).length, choices });
  }
  for (const child of node.children) visit(child, position, collection, prefix, firstMove, setupHistory);
}
for (const collection of db.collections) visit(collection.root, E.createPosition(), collection);
assert.equal(total.nodes, db.nodes.length, 'Every source node must be visited');
assert.equal(total.rawForks, nodes.filter(node => node.children.length > 1).length);
assert.equal(total.effectiveForks, forks.length);
assert.equal(total.effectiveForks, total.allChoicesHaveSourceOrder + total.someChoicesHaveSourceOrder + total.noSourceOrder);
assert.equal(total.noSourceOrder, total.noOrderMixedQuality + total.noOrderSameQuality);
for (const dimension of [byFamily, bySource, byCollection]) for (const metric of Object.keys(total)) {
  assert.equal(Object.values(dimension).reduce((sum, group) => sum + group[metric], 0), total[metric], `Inconsistent ${metric}`);
}

for (const file of ['more-joseki.js', 'ai-other-joseki.js', 'famous-joseki.js', 'curated-joseki.js']) vm.runInContext(read(file), sandbox);
const curated = sandbox.window.CURATED_JOSEKI || [];
const example = family => forks.filter(fork => fork.family === family && fork.prefix.length >= 2 && !fork.baselineReviewed && fork.bestQualityTies > 1).sort((a, b) => a.prefix.length - b.prefix.length)[0];
const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  scope: {
    counting: 'Each source-tree node is audited separately; repeated physical positions and transpositions are not independent joseki. Effective forks skip non-move SGF nodes and preserve different setup diagrams.',
    sourceOrder: 'Numeric OGS variation_label is an initial preference guide under equal outside conditions, often reflecting what is commonly played. It is not a win rate, margin, or unconditional ranking; ties remain ties.',
    sourceOrderPolicyURL: 'https://github.com/online-go/online-go.com/wiki/Adding-and-Editing-OGS-Joseki',
    quality: 'Source quality labels can distinguish good/mistake/conditional, but equal labels do not rank alternatives. One surviving non-bad move is only the sole recorded continuation, not a proof of optimality.',
    reviewedPosition: 'A review matches the full board and side to play under symmetry/color reversal, as in the explorer; it does not prove whole-board applicability or resolve ladders.',
    behavior: 'This is a data audit; browser tests separately verify that automatic continuation stops at unselected branches.',
    sourceSha256: crypto.createHash('sha256').update(read('data/joseki-db.js')).digest('hex')
  },
  reviewedData: { baselineRecords: baselineData.positions.length, additionalRecords: libraryData.positions.length, teachingNoteRecords: manualData.positions.length,
    mergedRecords: mergedReviews.length, baselineReviewedNodeInstances: baselineReviewedNodes,
    reviewedNodeInstances: reviewedNodes, files: ['reviewed-sansan.json', ...(libraryData.positions.length ? ['reviewed-library.json'] : []), ...(manualData.positions.length ? ['manual-order-notes.json'] : [])] },
  totals: { ...total, distinctForkBoardAndTurnStates: positionKeys.size, reviewedDistinctForkBoardAndTurnStates: reviewedPositionKeys.size },
  byFamily, bySource, byCollection,
  curated: { entries: curated.length, format: 'Single explicit study lines', relativeRankingEvidence: false,
    note: '47 curated lines do not contain sibling comparisons; they cannot establish which choice is best in other trees.' },
  legacyRisk: {
    explanation: 'The previous buildPreview and advance chose next[0]. Without a reviewed preference, quality ties fell back to nodeId/source storage order. These counts identify source-tree forks where multiple eligible continuations existed.',
    forksWithMultipleNonBadChoices: forks.filter(f => f.baselineNonBadChoices > 1).length,
    forksWithSameBestQuality: forks.filter(f => f.baselineBestQualityTies > 1).length,
    multipleChoiceForksOutsideBaselineReview: forks.filter(f => f.baselineNonBadChoices > 1 && !f.baselineReviewed).length,
    examples: ['星位', '小目', '三三', '高目', '目外', '五五'].map(example).filter(Boolean)
  },
  remainingUnreviewedExamples: ['星位', '小目', '三三', '高目', '目外', '五五'].map(family =>
    forks.filter(f => f.family === family && !f.setupHistory.length && f.prefix.length >= 2 && f.reviewedExternalId === null && f.bestQualityTies > 1)
      .sort((a, b) => a.prefix.length - b.prefix.length)[0]).filter(Boolean),
  forks
};
const destination = path.join(base, 'data/order-audit.json');
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ destination, reviewedData: report.reviewedData, totals: report.totals, byFamily, curated: report.curated, legacyRisk: { ...report.legacyRisk, examples: report.legacyRisk.examples.map(f => ({ nodeId: f.nodeId, family: f.family, prefix: f.prefix, choices: f.choices.map(c => c.placement) })) } }, null, 2));
