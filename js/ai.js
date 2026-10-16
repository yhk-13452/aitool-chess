/* 象棋 AI：negamax + α-β 剪枝 — 浏览器全局 + Worker(importScripts) 双兼容 */
(function (root) {
  'use strict';

  var R = root.XQRules;

  var LEVELS = {
    1: { depth: 1, noise: 110 },
    2: { depth: 2, noise: 35 },
    3: { depth: 3, noise: 0 },
    4: { depth: 4, noise: 0 }
  };

  function evaluate(bd) {
    var s = 0;
    for (var r = 0; r < 10; r++) for (var c = 0; c < 9; c++) {
      var p = bd[r][c];
      if (!p) continue;
      var v = R.VAL[p.type];
      if (p.type === 'P') {
        var crossed = p.color === 'r' ? r <= 4 : r >= 5;
        if (crossed) v += 30;
      }
      if (p.type === 'N' || p.type === 'C') v += (4 - Math.abs(c - 4)) * 2;
      s += (p.color === 'r' ? v : -v);
    }
    return s;
  }

  function sortByCapture(bd, moves) {
    moves.sort(function (a, b) {
      var ta = bd[a.tr][a.tc], tb = bd[b.tr][b.tc];
      return (tb ? R.VAL[tb.type] : 0) - (ta ? R.VAL[ta.type] : 0);
    });
    return moves;
  }

  function negamax(bd, depth, alpha, beta, color, maxDepth) {
    if (depth === 0) return color === 'r' ? evaluate(bd) : -evaluate(bd);

    var moves = R.legalMoves(bd, color);
    if (moves.length === 0) return -100000 + (maxDepth - depth);
    sortByCapture(bd, moves);

    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var cap = bd[m.tr][m.tc];
      var piece = bd[m.fr][m.fc];
      bd[m.tr][m.tc] = piece; bd[m.fr][m.fc] = null;
      var v = -negamax(bd, depth - 1, -beta, -alpha, R.otherColor(color), maxDepth);
      bd[m.fr][m.fc] = piece; bd[m.tr][m.tc] = cap;

      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  /* bd 会被就地试探（内部自行还原）；传入可变的克隆棋盘即可 */
  function bestMove(bd, color, level) {
    var cfg = LEVELS[level] || LEVELS[2];
    var moves = R.legalMoves(bd, color);
    if (!moves.length) return null;
    sortByCapture(bd, moves);

    var useNoise = cfg.noise > 0;
    var best = moves[0], bestVal = -Infinity, alpha = -Infinity;

    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var cap = bd[m.tr][m.tc];
      var piece = bd[m.fr][m.fc];
      bd[m.tr][m.tc] = piece; bd[m.fr][m.fc] = null;
      var v = -negamax(bd, cfg.depth - 1, -Infinity, useNoise ? Infinity : -alpha,
                      R.otherColor(color), cfg.depth);
      bd[m.fr][m.fc] = piece; bd[m.tr][m.tc] = cap;

      if (useNoise) v += Math.random() * cfg.noise;
      if (v > bestVal) { bestVal = v; best = m; }
      if (!useNoise && v > alpha) alpha = v;
    }
    return best;
  }

  root.XQAI = { LEVELS: LEVELS, evaluate: evaluate, bestMove: bestMove };
})(typeof self !== 'undefined' ? self : this);
