/* Deterministic, dependency-free Go rules shared by the browser and Node. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GoEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BOARD_SIZE = 19;
  const POINT_COUNT = BOARD_SIZE * BOARD_SIZE;
  const COLUMNS = 'ABCDEFGHJKLMNOPQRST';
  const ERROR_MESSAGES = Object.freeze({
    'invalid-position': '棋盘状态无效。',
    'invalid-color': '棋子颜色无效。',
    'out-of-bounds': '落点超出棋盘。',
    occupied: '这个交叉点已经有棋子。',
    suicide: '此处无气，不能落子。',
    ko: '不能立即回提打劫，请先在其他位置落子。'
  });

  function opponent(color) {
    return color === 'B' ? 'W' : color === 'W' ? 'B' : null;
  }

  function validPoint(x, y, size = BOARD_SIZE) {
    return Number.isInteger(x) && Number.isInteger(y) &&
      x >= 0 && x < size && y >= 0 && y < size;
  }

  /** Standard board coordinates, with A19 at the top left and no I column. */
  function coordinates(x, y, size = BOARD_SIZE) {
    if (typeof x === 'object' && x !== null) {
      size = y === undefined ? BOARD_SIZE : y;
      y = x.y;
      x = x.x;
    }
    return validPoint(x, y, size) && size <= COLUMNS.length
      ? COLUMNS[x] + (size - y) : null;
  }

  function parseCoordinates(value, size = BOARD_SIZE) {
    if (typeof value !== 'string') return null;
    const match = /^([A-HJ-T])([1-9]\d?)$/i.exec(value.trim());
    if (!match) return null;
    const x = COLUMNS.indexOf(match[1].toUpperCase());
    const y = size - Number(match[2]);
    return validPoint(x, y, size) ? { x, y } : null;
  }

  function setupPoint(point, color) {
    if (typeof point === 'string') {
      if (/^[a-s]{2}$/.test(point)) {
        return { color, x: point.charCodeAt(0) - 97, y: point.charCodeAt(1) - 97 };
      }
      const parsed = parseCoordinates(point);
      if (parsed) return { color, ...parsed };
    }
    if (Array.isArray(point)) return { color, x: point[0], y: point[1] };
    if (point && typeof point === 'object') return { color, x: point.x, y: point.y };
    throw new TypeError('Invalid setup point');
  }

  /**
   * setup may be [{color:'B'|'W'|null,x,y}], or SGF-style
   * {AB:[{x,y}|[x,y]|'dd'], AW:[...], AE:[...]}. Setup stones have no move number.
   */
  function createPosition(setup = [], toPlay = 'B') {
    if (!opponent(toPlay)) throw new TypeError('Invalid color to play');
    let stones = setup;
    if (!Array.isArray(stones)) {
      if (!setup || typeof setup !== 'object') throw new TypeError('Invalid setup');
      stones = [];
      for (const [property, color] of [['AB', 'B'], ['AW', 'W'], ['AE', null]]) {
        if (setup[property] !== undefined && !Array.isArray(setup[property])) {
          throw new TypeError('Setup properties must be arrays');
        }
        for (const point of setup[property] || []) stones.push(setupPoint(point, color));
      }
    }
    const board = Array(POINT_COUNT).fill(null);
    const numbers = Array(POINT_COUNT).fill(0);
    for (const stone of stones) {
      if (!stone || !validPoint(stone.x, stone.y)) throw new RangeError('Invalid setup point');
      if (stone.color !== null && !opponent(stone.color)) throw new TypeError('Invalid setup color');
      board[stone.y * BOARD_SIZE + stone.x] = stone.color;
    }
    return {
      board, numbers, toPlay, captures: { B: 0, W: 0 },
      moveNumber: 0, lastMove: null, previousBoard: null
    };
  }

  function neighbors(index) {
    const x = index % BOARD_SIZE;
    const y = Math.floor(index / BOARD_SIZE);
    const result = [];
    if (x > 0) result.push(index - 1);
    if (x + 1 < BOARD_SIZE) result.push(index + 1);
    if (y > 0) result.push(index - BOARD_SIZE);
    if (y + 1 < BOARD_SIZE) result.push(index + BOARD_SIZE);
    return result;
  }

  function groupAt(board, start) {
    const color = board[start];
    const stones = new Set([start]);
    const liberties = new Set();
    const pending = [start];
    while (pending.length) {
      for (const neighbor of neighbors(pending.pop())) {
        if (board[neighbor] === null) liberties.add(neighbor);
        else if (board[neighbor] === color && !stones.has(neighbor)) {
          stones.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    return { stones, liberties };
  }

  function sameBoard(first, second) {
    return Array.isArray(second) && first.length === second.length &&
      first.every((color, index) => color === second[index]);
  }

  function failure(position, error) {
    return { ok: false, position, error, message: ERROR_MESSAGES[error] };
  }

  /**
   * Pure move application: the input position and move are never changed.
   * An explicit color supports local joseki records that omit a distant tenuki.
   * Pass with {pass:true}, omitted/null x AND y, or x=y=-1.
   * Captures count prisoners taken by each color. Uses simple ko, not superko.
   */
  function play(position, move = {}) {
    if (!position || !Array.isArray(position.board) || position.board.length !== POINT_COUNT ||
        !Array.isArray(position.numbers) || position.numbers.length !== POINT_COUNT ||
        !position.captures || !Number.isInteger(position.moveNumber)) {
      return failure(position, 'invalid-position');
    }
    if (!move || typeof move !== 'object') return failure(position, 'out-of-bounds');
    const color = move.color === undefined ? position.toPlay : move.color;
    const enemy = opponent(color);
    if (!enemy) return failure(position, 'invalid-color');
    const isPass = move.pass === true ||
      (move.x == null && move.y == null) || (move.x === -1 && move.y === -1);
    if (!isPass && !validPoint(move.x, move.y)) return failure(position, 'out-of-bounds');
    const index = isPass ? -1 : move.y * BOARD_SIZE + move.x;
    if (!isPass && position.board[index] !== null) return failure(position, 'occupied');

    const board = position.board.slice();
    const numbers = position.numbers.slice();
    const captures = { ...position.captures };
    const moveNumber = position.moveNumber + 1;
    const captured = [];
    if (!isPass) {
      board[index] = color;
      numbers[index] = moveNumber;
      const checked = new Set();
      for (const neighbor of neighbors(index)) {
        if (board[neighbor] !== enemy || checked.has(neighbor)) continue;
        const group = groupAt(board, neighbor);
        for (const stone of group.stones) checked.add(stone);
        if (group.liberties.size === 0) {
          for (const stone of group.stones) {
            captured.push({ color: enemy, x: stone % BOARD_SIZE, y: Math.floor(stone / BOARD_SIZE) });
            board[stone] = null;
            numbers[stone] = 0;
          }
        }
      }
      if (groupAt(board, index).liberties.size === 0) return failure(position, 'suicide');
      if (sameBoard(board, position.previousBoard)) return failure(position, 'ko');
      captures[color] += captured.length;
    }
    return {
      ok: true,
      error: null,
      position: {
        board, numbers, captures, toPlay: enemy, moveNumber,
        previousBoard: position.board.slice(),
        lastMove: {
          color, x: isPass ? null : move.x, y: isPass ? null : move.y,
          pass: isPass, number: moveNumber, captured
        }
      }
    };
  }

  /** Eight symmetries: 0..3 clockwise quarter turns; 4..7 reflect x, then turn. */
  function transformPoint(point, symmetry = 0, size = BOARD_SIZE) {
    if (!point || !Number.isInteger(symmetry) || symmetry < 0 || symmetry > 7 ||
        !Number.isInteger(size) || size < 1) throw new TypeError('Invalid point transform');
    if (point.pass === true || (point.x == null && point.y == null) ||
        (point.x === -1 && point.y === -1)) return { ...point };
    if (!validPoint(point.x, point.y, size)) throw new RangeError('Invalid transform point');
    let { x, y } = point;
    if (symmetry >= 4) x = size - 1 - x;
    for (let turn = 0; turn < symmetry % 4; turn += 1) [x, y] = [size - 1 - y, x];
    return { ...point, x, y };
  }

  function inverseTransformPoint(point, symmetry = 0, size = BOARD_SIZE) {
    if (!Number.isInteger(symmetry) || symmetry < 0 || symmetry > 7) {
      throw new TypeError('Invalid point transform');
    }
    return transformPoint(point, symmetry >= 4 ? symmetry : (4 - symmetry) % 4, size);
  }

  return Object.freeze({
    BOARD_SIZE, COLUMNS, ERROR_MESSAGES, createPosition, play, opponent,
    coordinates, parseCoordinates, transformPoint, inverseTransformPoint
  });
});
