/* Names describe verified opening prefixes, never the database that stores them.
 * Coordinates are zero-based SGF coordinates on a 19 x 19 board.
 * This module does not evaluate moves or claim that a named line is best.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JosekiKnowledge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const sources = Object.freeze([
    {id:'knowledge-corner-approaches', title:'弈客围棋：守角、挂角', url:'https://www.sohu.com/a/496990958_533159'},
    {id:'knowledge-go-terms', title:'台湾围棋教育推广协会：围棋术语', url:'https://weqi.wordpress.com/飛揚圍棋教室/我們的宗旨、願景與理念/'},
    {id:'knowledge-kakari', title:'Go Magic：小飞挂', url:'https://gomagic.org/zh/go-term/keima-kakari/'},
    {id:'knowledge-double-approach', title:'山西围棋：双飞燕术语', url:'https://www.sohu.com/a/436986466_120390743'},
    {id:'knowledge-pincer', title:'Go Magic：夹攻', url:'https://gomagic.org/go-term/hasami/'},
    {id:'knowledge-modern-33', title:'OGS：点三三后长的分支', url:'https://online-go.com/joseki/22119'},
    {id:'knowledge-kogo', title:'Kogo 定式辞典', url:'https://waterfire.us/joseki.htm'},
    {id:'knowledge-mi-family', title:'弈道秋声：小飞、二路托进入芈氏飞刀', url:'https://sports.sina.cn/others/qipai/2022-01-21/detail-ikyamrmz6630980.d.html'},
    {id:'knowledge-mi-knife', title:'野狐围棋：芈昱廷对童梦成第 20 手外扳', url:'https://foxwq.com/news/listid/id/9552.html'}
  ].map(source => Object.freeze(source)));
  const CORNER = ['knowledge-corner-approaches'];
  const TERMS = ['knowledge-go-terms'];
  const APPROACH = ['knowledge-corner-approaches', 'knowledge-kakari'];
  const DOUBLE_APPROACH = ['knowledge-double-approach'];
  const PINCER = ['knowledge-pincer', 'knowledge-go-terms'];
  const SAN_SAN = ['knowledge-modern-33', 'knowledge-go-terms'];
  const patterns = [];

  function parse(text) {
    return [...text.matchAll(/([BW])\[([a-s]{2})?\]/g)].map(match => match[2] ? {
      color:match[1], x:match[2].charCodeAt(0)-97, y:match[2].charCodeAt(1)-97
    } : {color:match[1],pass:true});
  }
  function add(moves, title, moveName, sourceIds, options = {}) {
    patterns.push({moves:parse(moves), title, moveName, sourceIds,
      kind:options.kind || 'technique', persist:options.persist !== false});
  }
  function continuation(prefix, family, point, name, sourceIds = TERMS) {
    add(prefix + ' ' + point, family + ' · ' + name, name, sourceIds);
  }

  // A single stone has an opening-point name, not a named joseki.
  for (const [point, name] of [['pd','星位'], ['qd','小目'], ['qc','三三'], ['oc','目外'], ['od','高目'], ['oe','五五']]) {
    add('B[' + point + ']', name, name + '占角', CORNER, {kind:'opening', persist:false});
  }

  // These are direction-sensitive prefixes. A knight's distance by itself does
  // not make a move a kakari: in particular the wrong side of komoku is excluded.
  for (const [root, family, choices] of [
    ['pd', '星位', [['nc','小飞挂'], ['mc','大飞挂'], ['nd','一间高挂'], ['md','二间高挂']]],
    ['qd', '小目', [['oc','小飞挂'], ['nc','大飞挂'], ['od','一间高挂'], ['nd','二间高挂']]]
  ]) {
    for (const [point, name] of choices) {
      add('B[' + root + '] W[' + point + ']', family + name, name, APPROACH);
      const enclosure = name === '小飞挂' ? '小飞守角' : name === '大飞挂' ? '大飞守角' : name === '一间高挂' ? '一间守角' : '二间守角';
      add('B[' + root + '] B[' + point + ']', family + enclosure, enclosure, CORNER);
    }
  }

  const starLow = 'B[pd] W[nc]';
  const starHigh = 'B[pd] W[nd]';
  // Both low approaches must surround the same hoshi. Pachi omits Black's
  // local tenuki, while GNU Go records it as a pass. Match these exact prefixes
  // separately: ignoring arbitrary moves or passes would invent a named line.
  add('B[pd] W[qf] W[nc]', '星位双飞燕', '双飞燕', DOUBLE_APPROACH, {kind:'joseki'});
  add('B[pd] W[qf] B[] W[nc]', '星位双飞燕', '双飞燕', DOUBLE_APPROACH, {kind:'joseki'});
  for (const [prefix, family] of [[starLow,'星位小飞挂'], [starHigh,'星位一间高挂']]) {
    for (const [point, name] of [['qf','小飞应'], ['qg','大飞应'], ['pf','一间跳应']]) {
      continuation(prefix, family, 'B[' + point + ']', name, CORNER);
    }
  }
  continuation(starLow, '星位小飞挂', 'B[oc]', '尖顶');
  continuation(starLow, '星位小飞挂', 'B[nd]', '靠压');
  continuation(starLow + ' B[nd]', '星位小飞挂 · 靠压', 'W[md]', '扳');
  continuation(starLow + ' B[nd] W[md]', '星位小飞挂 · 靠压', 'B[ne]', '长');
  continuation(starLow + ' B[qf]', '星位小飞挂 · 小飞应', 'W[pc]', '托角');
  continuation(starLow + ' B[qf] W[pc]', '星位小飞挂 · 小飞应 · 托角', 'B[qc]', '扳');
  continuation(starLow + ' B[qf] W[pc]', '星位小飞挂 · 小飞应 · 托角', 'B[oc]', '外扳');

  for (const [prefix, family, x] of [
    [starLow,'星位小飞挂',13], [starHigh,'星位一间高挂',13],
    ['B[qd] W[oc]','小目小飞挂',14], ['B[qd] W[od]','小目一间高挂',14]
  ]) {
    for (let gap = 1; gap <= 3; gap++) {
      for (const [y, level] of [[2,'低'], [3,'高']]) {
        const point = String.fromCharCode(97+x-gap-1, 97+y);
        continuation(prefix, family, 'B[' + point + ']', ['','一','二','三'][gap] + '间' + level + '夹', PINCER);
      }
    }
  }

  for (const [prefix, family] of [['B[qd] W[oc]','小目小飞挂'], ['B[qd] W[od]','小目一间高挂']]) {
    for (const [point, name] of [['pf','小飞应'], ['pg','大飞应'], ['qf','一间跳应'], ['pe','尖应']]) {
      continuation(prefix, family, 'B[' + point + ']', name, CORNER);
    }
  }
  continuation('B[qd] W[od]', '小目一间高挂', 'B[oc]', '托');
  continuation('B[qd] W[od] B[oc]', '小目一间高挂 · 托', 'W[nc]', '扳');
  add('B[qd] W[od] B[oc] W[nc] B[pc]', '小目高挂托退', '退', TERMS);
  continuation('B[qd] W[od]', '小目一间高挂', 'B[oe]', '靠压');

  // Distinguish initial occupation of 3-3 from invading an existing hoshi.
  add('B[pd] W[qc]', '星位点三三', '点三三', SAN_SAN);
  continuation('B[pd] W[qc]', '星位点三三', 'B[qd]', '挡', SAN_SAN);
  continuation('B[pd] W[qc] B[qd]', '星位点三三', 'W[pc]', '长', SAN_SAN);
  const sanBase = 'B[pd] W[qc] B[qd] W[pc]';
  continuation(sanBase, '星位点三三', 'B[od]', '长', SAN_SAN);
  continuation(sanBase, '星位点三三', 'B[oc]', '扳', SAN_SAN);
  const sanExtend = sanBase + ' B[od]';
  continuation(sanExtend, '星位点三三 · 长', 'W[nb]', '二路小飞', SAN_SAN);
  continuation(sanExtend, '星位点三三 · 长', 'W[nc]', '一间跳', SAN_SAN);
  continuation(sanExtend, '星位点三三 · 长', 'W[oc]', '推', SAN_SAN);
  // rd is a hane around the touching black qd, NOT a knight's move, even
  // though another white stone happens to be a knight's distance away.
  continuation(sanExtend, '星位点三三 · 长', 'W[rd]', '二路扳', SAN_SAN);
  continuation(sanExtend + ' W[rd]', '星位点三三 · 二路扳', 'B[re]', '挡', SAN_SAN);
  add(sanExtend + ' W[rd] B[re] W[rc]', '星位点三三 · 扳粘', '粘', SAN_SAN);
  continuation(sanExtend + ' W[oc]', '星位点三三 · 推', 'B[nc]', '扳', SAN_SAN);
  continuation(sanBase + ' B[oc]', '星位点三三 · 扳', 'W[ob]', '扳', SAN_SAN);
  continuation(sanBase + ' B[oc] W[ob]', '星位点三三 · 扳', 'B[nc]', '长', SAN_SAN);
  continuation(sanBase + ' B[oc] W[ob] B[nc]', '星位点三三 · 扳', 'W[nb]', '爬', SAN_SAN);

  // Only short, unambiguous entry points are labelled for other corners.
  add('B[oc] W[qd]', '目外挂角', '挂角', CORNER);
  add('B[oc] W[qc]', '目外点三三', '点三三', CORNER);
  add('B[od] W[qd]', '高目小目挂', '小目挂', CORNER);
  add('B[qc] W[pd]', '三三肩冲', '肩冲', TERMS);
  add('B[qc] W[pc]', '三三靠', '靠', TERMS);

  // Proper names require their defining prefix, not a root-library title or
  // loose shape similarity. They survive later moves as family names.
  continuation('B[qd] W[od] B[ld]', '小目一间高挂 · 二间高夹', 'W[qe]', '小飞靠入', ['knowledge-kogo']);
  add('B[qd] W[od] B[ld] W[qe] B[pd]', '村正妖刀', '靠', ['knowledge-kogo'], {kind:'joseki'});
  add('B[qd] W[od] B[oc] W[pd] B[pc] W[qe] B[nc] W[nd] B[md]', '大雪崩', '扳', ['knowledge-kogo'], {kind:'joseki'});
  add('B[oc] W[qd] B[pf]', '大斜', '大斜飞', ['knowledge-kogo'], {kind:'joseki'});
  // The family starts at the small knight + second-line attachment. The
  // historical outside hane below names a later move within that family.
  const miEntry = sanBase + ' B[nc] W[nb]';
  continuation(sanBase, '星位点三三', 'B[nc]', '小飞', ['knowledge-mi-family']);
  add(miEntry, '芈氏飞刀', '二路托', ['knowledge-mi-family'], {kind:'joseki'});
  continuation(miEntry, '芈氏飞刀', 'B[mb]', '扳', TERMS);
  continuation(miEntry + ' B[mb]', '芈氏飞刀', 'W[ob]', '二路长', TERMS);
  const miLocal = 'W[dp] B[cq] W[cp] B[dq] W[fq] B[fr] W[gr] B[eq] W[fp] B[ep] W[eo] B[do] W[bo] B[dn] W[en] B[em] W[fm]';
  add('B[pd] W[dd] B[pp] ' + miLocal.split(' ').slice(0,6).join(' '), '芈氏飞刀', '二路托', ['knowledge-mi-family'], {kind:'joseki'});
  add(miLocal, '芈氏飞刀', '外扳', ['knowledge-mi-knife'], {kind:'joseki'});
  add('B[pd] W[dd] B[pp] ' + miLocal, '芈氏飞刀', '外扳', ['knowledge-mi-knife'], {kind:'joseki'});

  function transform(point, symmetry) {
    if (point.pass) return {pass:true};
    let x = symmetry >= 4 ? 18-point.x : point.x;
    let y = point.y;
    for (let turn = 0; turn < symmetry % 4; turn++) [x,y] = [18-y,x];
    return {x,y};
  }
  const token = move => move.pass ? move.color + ':pass' : move.color + ':' + move.x + ',' + move.y;
  const trie = {next:new Map(), pattern:null};
  for (const pattern of patterns) {
    for (let symmetry = 0; symmetry < 8; symmetry++) {
      for (const swap of [false,true]) {
        let branch = trie;
        for (const move of pattern.moves) {
          const point = transform(move,symmetry);
          const key = token({...point, color:swap ? (move.color === 'B' ? 'W' : 'B') : move.color});
          if (!branch.next.has(key)) branch.next.set(key,{next:new Map(),pattern:null});
          branch = branch.next.get(key);
        }
        branch.pattern = pattern;
      }
    }
  }
  function validMove(move) {
    return move && (move.color === 'B' || move.color === 'W') && (move.pass === true ||
      Number.isInteger(move.x) && Number.isInteger(move.y) && move.x >= 0 && move.x < 19 && move.y >= 0 && move.y < 19);
  }
  function empty() { return {title:'',moveName:'',kind:'technique',sourceIds:[]}; }
  function describe(input = {}) {
    if (!input || typeof input !== 'object') return empty();
    const moves = input.moves === undefined ? [] : input.moves;
    const setup = input.setup === undefined ? [] : input.setup;
    if (!Array.isArray(moves) || !Array.isArray(setup) || !moves.every(validMove)) return empty();
    // An unordered multi-stone setup cannot establish an opening's move order.
    // Do not guess which shape or famous joseki it was intended to represent.
    if (setup.length > 1 || setup.length && (!validMove(setup[0]) || setup[0].pass)) return empty();
    const sequence = setup.length ? [setup[0],...moves] : moves;
    if (!sequence.length) return empty();
    let branch = trie, match = null, family = null, matchedLength = 0;
    for (let index = 0; index < sequence.length; index++) {
      branch = branch.next.get(token(sequence[index]));
      if (!branch) break;
      if (branch.pattern && (branch.pattern.persist || index === sequence.length-1)) {
        match = branch.pattern; matchedLength = index+1;
        if(match.kind==='joseki')family=match;
      }
    }
    if (!match) return empty();
    // A later technique describes the current move without replacing the
    // established joseki's name. Never reuse an earlier move's technique.
    const named=family||match,exact=matchedLength===sequence.length;
    return {title:named.title, moveName:exact ? match.moveName : '',
      kind:named.kind, sourceIds:[...new Set([...named.sourceIds,...(exact?match.sourceIds:[])])]};
  }
  return Object.freeze({describe, sources});
});
