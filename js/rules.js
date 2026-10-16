/* 中国象棋规则引擎 — 纯函数，浏览器全局 + Worker(importScripts) 双兼容 */
(function (root) {
  'use strict';

  var DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var HORSE = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
  var ELEPHANT = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
  var ADVISOR = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  var NAMES = {
    r: { K: '帅', A: '仕', B: '相', N: '马', R: '车', C: '炮', P: '兵' },
    b: { K: '将', A: '士', B: '象', N: '马', R: '车', C: '炮', P: '卒' }
  };
  var VAL = { K: 10000, R: 600, C: 300, N: 280, B: 120, A: 120, P: 60 };

  function otherColor(c) { return c === 'r' ? 'b' : 'r'; }

  function initialBoard() {
    var start = [
      ['bR', 'bN', 'bB', 'bA', 'bK', 'bA', 'bB', 'bN', 'bR'],
      [null, null, null, null, null, null, null, null, null],
      [null, 'bC', null, null, null, null, null, 'bC', null],
      ['bP', null, 'bP', null, 'bP', null, 'bP', null, 'bP'],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      ['rP', null, 'rP', null, 'rP', null, 'rP', null, 'rP'],
      [null, 'rC', null, null, null, null, null, 'rC', null],
      [null, null, null, null, null, null, null, null, null],
      ['rR', 'rN', 'rB', 'rA', 'rK', 'rA', 'rB', 'rN', 'rR']
    ];
    return start.map(function (row) {
      return row.map(function (s) { return s ? { color: s[0], type: s[1] } : null; });
    });
  }

  function cloneBoard(bd) {
    return bd.map(function (row) {
      return row.map(function (p) { return p ? { color: p.color, type: p.type } : null; });
    });
  }

  function inPalace(r, c, color) {
    if (r < 0 || r > 9 || c < 3 || c > 5) return false;
    return color === 'r' ? r >= 7 : r <= 2;
  }

  function pieceMoves(bd, r, c) {
    var p = bd[r][c];
    if (!p) return [];
    var out = [];
    var color = p.color;

    function push(rr, cc) {
      if (rr < 0 || rr > 9 || cc < 0 || cc > 8) return;
      var t = bd[rr][cc];
      if (t && t.color === color) return;
      out.push([rr, cc]);
    }

    var i, dr, dc, rr, cc, lr, lc;
    switch (p.type) {
      case 'K':
        for (i = 0; i < 4; i++) {
          dr = DIRS4[i][0]; dc = DIRS4[i][1];
          if (inPalace(r + dr, c + dc, color)) push(r + dr, c + dc);
        }
        break;
      case 'A':
        for (i = 0; i < 4; i++) {
          dr = ADVISOR[i][0]; dc = ADVISOR[i][1];
          if (inPalace(r + dr, c + dc, color)) push(r + dr, c + dc);
        }
        break;
      case 'B':
        for (i = 0; i < 4; i++) {
          dr = ELEPHANT[i][0]; dc = ELEPHANT[i][1];
          rr = r + dr; cc = c + dc;
          if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
          if (color === 'r' ? rr < 5 : rr > 4) continue;
          if (bd[r + dr / 2][c + dc / 2]) continue;
          push(rr, cc);
        }
        break;
      case 'N':
        for (i = 0; i < 8; i++) {
          dr = HORSE[i][0]; dc = HORSE[i][1];
          rr = r + dr; cc = c + dc;
          if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
          lr = Math.abs(dr) === 2 ? r + dr / 2 : r;
          lc = Math.abs(dc) === 2 ? c + dc / 2 : c;
          if (bd[lr][lc]) continue;
          push(rr, cc);
        }
        break;
      case 'R':
        for (i = 0; i < 4; i++) {
          dr = DIRS4[i][0]; dc = DIRS4[i][1];
          rr = r + dr; cc = c + dc;
          while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9) {
            if (bd[rr][cc]) {
              if (bd[rr][cc].color !== color) out.push([rr, cc]);
              break;
            }
            out.push([rr, cc]);
            rr += dr; cc += dc;
          }
        }
        break;
      case 'C':
        for (i = 0; i < 4; i++) {
          dr = DIRS4[i][0]; dc = DIRS4[i][1];
          rr = r + dr; cc = c + dc;
          while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9 && !bd[rr][cc]) {
            out.push([rr, cc]);
            rr += dr; cc += dc;
          }
          if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
          rr += dr; cc += dc;
          while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9 && !bd[rr][cc]) { rr += dr; cc += dc; }
          if (rr >= 0 && rr < 10 && cc >= 0 && cc < 9 && bd[rr][cc].color !== color) {
            out.push([rr, cc]);
          }
        }
        break;
      case 'P':
        var fwd = color === 'r' ? -1 : 1;
        push(r + fwd, c);
        var crossed = color === 'r' ? r <= 4 : r >= 5;
        if (crossed) { push(r, c - 1); push(r, c + 1); }
        break;
    }
    return out;
  }

  function attacked(bd, r, c, by) {
    var i, dr, dc, rr, cc, dist, p, q, rr2, cc2, lr, lc;
    for (i = 0; i < 4; i++) {
      dr = DIRS4[i][0]; dc = DIRS4[i][1];
      rr = r + dr; cc = c + dc; dist = 1;
      while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9 && !bd[rr][cc]) {
        rr += dr; cc += dc; dist++;
      }
      if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
      p = bd[rr][cc];
      if (p.color === by) {
        if (p.type === 'R') return true;
        if (p.type === 'K' && dist === 1) return true;
        if (p.type === 'P') {
          var fwd = p.color === 'r' ? -1 : 1;
          if (rr + fwd === r && cc === c) return true;
        }
      }
      rr2 = rr + dr; cc2 = cc + dc;
      while (rr2 >= 0 && rr2 < 10 && cc2 >= 0 && cc2 < 9 && !bd[rr2][cc2]) { rr2 += dr; cc2 += dc; }
      if (rr2 >= 0 && rr2 < 10 && cc2 >= 0 && cc2 < 9) {
        q = bd[rr2][cc2];
        if (q.color === by && q.type === 'C') return true;
      }
    }
    for (i = 0; i < 8; i++) {
      dr = HORSE[i][0]; dc = HORSE[i][1];
      var hr = r + dr, hc = c + dc;
      if (hr < 0 || hr > 9 || hc < 0 || hc > 8) continue;
      var hp = bd[hr][hc];
      if (!hp || hp.color !== by || hp.type !== 'N') continue;
      lr = Math.abs(dr) === 2 ? (hr + r) / 2 : hr;
      lc = Math.abs(dc) === 2 ? (hc + c) / 2 : hc;
      if (!bd[lr][lc]) return true;
    }
    for (i = 0; i < 2; i++) {
      dc = i === 0 ? -1 : 1;
      var pc = c + dc;
      if (pc < 0 || pc > 8) continue;
      var p2 = bd[r][pc];
      if (p2 && p2.color === by && p2.type === 'P') {
        var crossed = p2.color === 'r' ? r <= 4 : r >= 5;
        if (crossed) return true;
      }
    }
    return false;
  }

  function kingSafe(bd, color) {
    var kr = -1, kc = -1, r, c, p;
    for (r = 0; r < 10; r++) for (c = 0; c < 9; c++) {
      p = bd[r][c];
      if (p && p.type === 'K' && p.color === color) { kr = r; kc = c; }
    }
    if (kr < 0) return false;
    if (attacked(bd, kr, kc, otherColor(color))) return false;
    for (r = 0; r < 10; r++) {
      if (r === kr) continue;
      p = bd[r][kc];
      if (p && p.type === 'K' && p.color !== color) {
        var lo = Math.min(r, kr), hi = Math.max(r, kr), clear = true;
        for (var rr = lo + 1; rr < hi; rr++) if (bd[rr][kc]) { clear = false; break; }
        if (clear) return false;
      }
    }
    return true;
  }

  function legalMoves(bd, color) {
    var out = [];
    for (var r = 0; r < 10; r++) for (var c = 0; c < 9; c++) {
      var p = bd[r][c];
      if (!p || p.color !== color) continue;
      var moves = pieceMoves(bd, r, c);
      for (var i = 0; i < moves.length; i++) {
        var tr = moves[i][0], tc = moves[i][1];
        var cap = bd[tr][tc];
        bd[tr][tc] = p; bd[r][c] = null;
        if (kingSafe(bd, color)) out.push({ fr: r, fc: c, tr: tr, tc: tc });
        bd[r][c] = p; bd[tr][tc] = cap;
      }
    }
    return out;
  }

  root.XQRules = {
    NAMES: NAMES, VAL: VAL,
    otherColor: otherColor,
    initialBoard: initialBoard,
    cloneBoard: cloneBoard,
    pieceMoves: pieceMoves,
    legalMoves: legalMoves,
    kingSafe: kingSafe,
    attacked: attacked
  };
})(typeof self !== 'undefined' ? self : this);
