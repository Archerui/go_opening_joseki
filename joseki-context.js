/* Keep a known local diagram while real moves are played elsewhere.
 * This is a conservative geometric match, not an evaluation of whole-board
 * direction, ladders, or the relative strength of a continuation. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root && root.GoEngine && root.JOSEKI_DB) {
    root.JosekiContext = factory(root.GoEngine, root.JOSEKI_DB.nodes);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E, nodes) {
  'use strict';
  const size = E.BOARD_SIZE;
  const validPoint = point => point && Number.isInteger(point.x) && Number.isInteger(point.y) &&
    point.x >= 0 && point.x < size && point.y >= 0 && point.y < size;
  const isPass = move => move?.pass === true || (move?.x === -1 && move?.y === -1) ||
    (move && move.x == null && move.y == null);
  const isPosition = position => Array.isArray(position?.board) && position.board.length === size * size;

  function immediateEntries(refs) {
    const entries = [];
    function visit(id, actions, seen) {
      const node = nodes[id];
      if (!node || node.invalid || seen.has(id)) return;
      const next = [...actions, node];
      if (node.move) { entries.push(next); return; }
      const visited = new Set(seen); visited.add(id);
      for (const child of node.children || []) visit(child, next, visited);
    }
    for (const ref of refs) for (const child of nodes[ref]?.children || []) visit(child, [], new Set());
    return entries;
  }

  function retain(frame, actualResult, move) {
    const before = frame?.position;
    const local = frame?.localPosition;
    // Accept either the engine result or its position, so callers need not
    // reconstruct a result object when replaying an already checked move.
    const after = actualResult?.position || actualResult;
    if (actualResult?.ok === false || !isPosition(before) || !isPosition(local) || !isPosition(after)) return null;
    const refs = [...new Set(frame.refs || [])].filter(id => nodes[id] && !nodes[id].invalid);
    if (!refs.length || !['B', 'W'].includes(after.toPlay)) return null;
    const stones = [];
    for (let i = 0; i < local.board.length; i++) {
      if (!local.board[i]) continue;
      // A capture or a changed local stone invalidates the source diagram,
      // even when the stone that caused it was outside the protected area.
      if (before.board[i] !== local.board[i] || after.board[i] !== local.board[i]) return null;
      stones.push({x: i % size, y: Math.floor(i / size)});
    }
    if (!stones.length) return null;
    const playedColor = move?.color || before.toPlay;
    if (playedColor !== before.toPlay || after.toPlay !== E.opponent(playedColor)) return null;
    const pass = isPass(move);
    if (!pass && !validPoint(move)) return null;

    const entries = immediateEntries(refs);
    const minX = Math.min(...stones.map(point => point.x)) - 3;
    const maxX = Math.max(...stones.map(point => point.x)) + 3;
    const minY = Math.min(...stones.map(point => point.y)) - 3;
    const maxY = Math.max(...stones.map(point => point.y)) + 3;
    const protectedPoints = [];
    for (const actions of entries) for (const node of actions) {
      if (validPoint(node.move)) protectedPoints.push(node.move);
      for (const point of node.setup || []) if (validPoint(point)) protectedPoints.push(point);
    }
    const protectedAt = point =>
      (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) ||
      protectedPoints.some(other => Math.abs(point.x - other.x) <= 2 && Math.abs(point.y - other.y) <= 2);
    if (!pass && protectedAt(move)) return null;
    // Also protect empty intersections: remote captures must not change the
    // liberties or conditions around a future source move or setup stone.
    for (let i = 0; i < before.board.length; i++) {
      if (before.board[i] !== after.board[i] && protectedAt({x:i % size,y:Math.floor(i / size)})) return null;
    }

    // A real move elsewhere fulfils exactly one explicitly recorded local
    // pass. Keep direct repeated-color branches too; some SGFs omit that pass.
    const nextRefs = new Set(refs);
    for (const actions of entries) {
      let expected = playedColor, safe = true;
      for (const node of actions) {
        if (node.setup?.length) { safe = false; break; }
        if (node.move) {
          if (!isPass(node.move) || node.move.color !== playedColor) { safe = false; break; }
          expected = E.opponent(playedColor);
        }
        if (node.toPlay && node.toPlay !== expected) { safe = false; break; }
      }
      if (safe && actions.at(-1)?.move) nextRefs.add(actions.at(-1).id);
    }
    return {
      refs: [...nextRefs],
      // Full-board captures, numbering and ko remain in `after`. This source
      // diagram is only for matching and must never replace the actual board.
      localPosition: {...local, toPlay:after.toPlay, previousBoard:null}
    };
  }

  return Object.freeze({retain});
});
