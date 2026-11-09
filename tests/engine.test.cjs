'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Go = require('../engine.js');
const index = (x, y) => y * 19 + x;
const stone = (color, x, y) => ({ color, x, y });
const at = (position, x, y) => position.board[index(x, y)];
const apply = (position, move) => {
  const result = Go.play(position, move);
  assert.equal(result.ok, true, result.error);
  return result.position;
};
function deepFreeze(object) {
  if (object && typeof object === 'object') {
    Object.freeze(object);
    Object.values(object).forEach(deepFreeze);
  }
  return object;
}

test('same file exposes a browser global without CommonJS', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../engine.js'), 'utf8'), context);
  assert.equal(typeof context.GoEngine.play, 'function');
  assert.equal(context.GoEngine.createPosition().board.length, 361);
});

test('setup supports AB, AW, AE and leaves move counters empty', () => {
  const setup = deepFreeze({ AB: ['dd', [3, 4], { x: 5, y: 5 }], AW: ['Q16'], AE: ['dd'] });
  const position = Go.createPosition(setup, 'W');
  assert.equal(at(position, 3, 3), null);
  assert.equal(at(position, 3, 4), 'B');
  assert.equal(at(position, 5, 5), 'B');
  assert.equal(at(position, 15, 3), 'W');
  assert.equal(position.toPlay, 'W');
  assert.equal(position.moveNumber, 0);
  assert.ok(position.numbers.every(number => number === 0));
  assert.deepEqual(position.captures, { B: 0, W: 0 });
  const flat = Go.createPosition([stone('B', 2, 2), stone('W', 3, 3), stone(null, 2, 2)]);
  assert.equal(at(flat, 2, 2), null);
  assert.equal(at(flat, 3, 3), 'W');
});

test('moves alternate by default, while explicit color supports a local tenuki', () => {
  let position = Go.createPosition();
  position = apply(position, { x: 3, y: 3 });
  assert.equal(at(position, 3, 3), 'B');
  assert.equal(position.toPlay, 'W');
  position = apply(position, { color: 'B', x: 15, y: 3 });
  assert.equal(at(position, 15, 3), 'B');
  assert.equal(position.toPlay, 'W');
  assert.equal(position.numbers[index(15, 3)], 2);
  position = apply(position, { x: 15, y: 15 });
  assert.equal(at(position, 15, 15), 'W');
  assert.equal(position.toPlay, 'B');
});

test('captures a connected group and removes its move numbers', () => {
  let position = Go.createPosition([
    stone('W', 1, 1), stone('W', 2, 1),
    stone('B', 0, 1), stone('B', 1, 0), stone('B', 2, 0),
    stone('B', 3, 1), stone('B', 1, 2)
  ]);
  position.numbers[index(1, 1)] = 1;
  position.numbers[index(2, 1)] = 2;
  position = apply(position, { x: 2, y: 2 });
  assert.equal(at(position, 1, 1), null);
  assert.equal(at(position, 2, 1), null);
  assert.equal(position.numbers[index(1, 1)], 0);
  assert.equal(position.numbers[index(2, 1)], 0);
  assert.equal(position.captures.B, 2);
  assert.equal(position.lastMove.captured.length, 2);
});

test('captures independent groups around one point exactly once', () => {
  const position = Go.createPosition([
    stone('W', 0, 1), stone('W', 1, 0),
    stone('B', 0, 2), stone('B', 1, 1), stone('B', 2, 0)
  ]);
  const next = apply(position, { x: 0, y: 0 });
  assert.equal(next.captures.B, 2);
  assert.equal(at(next, 0, 0), 'B');
});

test('corner captures, edge liberties, and row boundaries are handled correctly', () => {
  const corner = Go.createPosition([stone('W', 0, 0), stone('B', 1, 0)]);
  const captured = apply(corner, { x: 0, y: 1 });
  assert.equal(at(captured, 0, 0), null);
  assert.equal(captured.captures.B, 1);
  const edge = Go.createPosition([stone('W', 18, 0), stone('B', 17, 0), stone('W', 0, 1)]);
  const boundary = apply(edge, { x: 18, y: 1 });
  assert.equal(at(boundary, 18, 0), null);
  assert.equal(at(boundary, 0, 1), 'W');
  assert.equal(boundary.captures.B, 1);
});

test('rejects single-stone and connected-group suicide without changing state', () => {
  const single = deepFreeze(Go.createPosition([stone('W', 1, 0), stone('W', 0, 1)]));
  const rejected = Go.play(single, { x: 0, y: 0 });
  assert.equal(rejected.error, 'suicide');
  assert.equal(rejected.position, single);
  const group = deepFreeze(Go.createPosition([
    stone('B', 0, 0), stone('W', 1, 0), stone('W', 1, 1), stone('W', 0, 2)
  ]));
  assert.equal(Go.play(group, { x: 0, y: 1 }).error, 'suicide');
});

function koPosition() {
  return Go.createPosition([
    stone('B', 0, 1), stone('B', 1, 0), stone('B', 1, 2),
    stone('W', 1, 1), stone('W', 2, 0), stone('W', 2, 2), stone('W', 3, 1)
  ]);
}

test('simple ko prohibits immediate recapture and allows it after intervening moves', () => {
  const start = deepFreeze(koPosition());
  const captured = apply(start, { x: 2, y: 1 });
  const rejected = Go.play(captured, { x: 1, y: 1 });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error, 'ko');
  assert.equal(rejected.position, captured);
  let next = apply(captured, { x: 10, y: 10 });
  next = apply(next, { x: 10, y: 11 });
  next = apply(next, { x: 1, y: 1 });
  assert.equal(at(next, 2, 1), null);
  assert.equal(at(next, 1, 1), 'W');
  assert.deepEqual(next.captures, { B: 1, W: 1 });
});

test('snapback is legal when the recapture produces a different board', () => {
  const start = Go.createPosition([
    stone('B', 0, 1), stone('B', 1, 1), stone('B', 2, 0),
    stone('W', 1, 0), stone('W', 0, 2), stone('W', 1, 2), stone('W', 2, 1)
  ]);
  // Black captures one stone; its newly connected group has only that liberty.
  const next = apply(start, { x: 0, y: 0 });
  assert.equal(next.captures.B, 1);
  // White immediately returns and captures three stones, so this is not a ko.
  const reply = apply(next, { x: 1, y: 0 });
  assert.equal(at(reply, 1, 0), 'W');
  assert.equal(reply.captures.W, 3);
  assert.equal(at(reply, 0, 0), null);
  assert.equal(at(reply, 0, 1), null);
  assert.equal(at(reply, 1, 1), null);
});

test('passes switch player, preserve stones, increment move number and release simple ko', () => {
  const captured = apply(koPosition(), { x: 2, y: 1 });
  const passed = apply(captured, { pass: true });
  assert.deepEqual(passed.board, captured.board);
  assert.equal(passed.toPlay, 'B');
  assert.equal(passed.lastMove.pass, true);
  assert.equal(passed.moveNumber, 2);
  const passedAgain = apply(passed, { x: -1, y: -1 });
  const recapture = apply(passedAgain, { x: 1, y: 1 });
  assert.equal(at(recapture, 2, 1), null);
  const omitted = apply(Go.createPosition(), {});
  assert.equal(omitted.lastMove.pass, true);
  assert.equal(Go.play(Go.createPosition(), { x: -1, y: 1 }).error, 'out-of-bounds');
});

test('snapshots stay independent for undo, redo and branching, including capture history', () => {
  const first = deepFreeze(koPosition());
  const second = deepFreeze(apply(first, deepFreeze({ x: 2, y: 1 })));
  const third = apply(second, { x: 8, y: 8 });
  const branch = apply(first, { x: 10, y: 10 });
  assert.equal(at(first, 1, 1), 'W');
  assert.equal(at(first, 2, 1), null);
  assert.equal(at(second, 8, 8), null);
  assert.equal(at(branch, 1, 1), 'W');
  assert.equal(at(third, 8, 8), 'W');
  assert.notEqual(second.board, third.previousBoard);
  third.board[0] = 'B';
  third.numbers[0] = 999;
  third.previousBoard[0] = 'W';
  third.captures.B = 999;
  assert.equal(first.board[0], null);
  assert.equal(second.board[0], null);
  assert.equal(second.numbers[0], 0);
  assert.equal(second.captures.B, 1);
});

test('invalid and occupied points fail without consuming a turn', () => {
  const position = deepFreeze(Go.createPosition([stone('B', 3, 3)]));
  for (const move of [{ x: -1, y: 0 }, { x: 19, y: 0 }, { x: 1.5, y: 1 }, { x: 0 }, null]) {
    const result = Go.play(position, move);
    assert.equal(result.error, 'out-of-bounds');
    assert.equal(result.position, position);
  }
  assert.equal(Go.play(position, { x: 3, y: 3 }).error, 'occupied');
  assert.equal(Go.play(position, { color: 'X', x: 0, y: 0 }).error, 'invalid-color');
  assert.equal(Go.play(null, {}).error, 'invalid-position');
  assert.throws(() => Go.createPosition([stone('B', 19, 0)]), RangeError);
});

test('all eight transforms are distinct, reversible and preserve colors and pass moves', () => {
  const point = deepFreeze({ color: 'W', x: 2, y: 5, number: 4 });
  const transformed = Array.from({ length: 8 }, (_, symmetry) => {
    const next = Go.transformPoint(point, symmetry);
    assert.deepEqual(Go.inverseTransformPoint(next, symmetry), point);
    assert.equal(next.color, 'W');
    assert.equal(next.number, 4);
    return `${next.x},${next.y}`;
  });
  assert.equal(new Set(transformed).size, 8);
  assert.deepEqual(Go.transformPoint({ x: 0, y: 0 }, 1), { x: 18, y: 0 });
  assert.deepEqual(Go.transformPoint({ x: 0, y: 0 }, 4), { x: 18, y: 0 });
  assert.deepEqual(Go.transformPoint({ color: 'B', x: -1, y: -1 }, 7), { color: 'B', x: -1, y: -1 });
  assert.deepEqual(Go.inverseTransformPoint(Go.transformPoint({ x: 1, y: 2 }, 5, 9), 5, 9), { x: 1, y: 2 });
  assert.throws(() => Go.transformPoint(point, 8), TypeError);
});

test('board coordinate conversion omits I and round-trips every intersection', () => {
  assert.equal(Go.coordinates(0, 0), 'A19');
  assert.equal(Go.coordinates(8, 18), 'J1');
  assert.equal(Go.coordinates({ x: 18, y: 18 }), 'T1');
  assert.equal(Go.coordinates(19, 0), null);
  assert.equal(Go.parseCoordinates('I4'), null);
  assert.equal(Go.parseCoordinates('A20'), null);
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) assert.deepEqual(Go.parseCoordinates(Go.coordinates(x, y)), { x, y });
  }
});
