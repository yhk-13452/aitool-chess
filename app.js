/* AI 象棋 PWA — 主逻辑 */
(function () {
  'use strict';

  var R = window.XQRules, AI = window.XQAI;
  var $ = function (s) { return document.querySelector(s); };

  var M = 0.85;                 // 棋盘边距（单位：格）
  var LS_KEY = 'xq-pwa-state-v1';

  var S = {
    board: null, turn: 'r', human: 'r',
    level: 2, pinMark: false,
    sel: null, targets: [], last: null,
    over: false, result: '', win: null, check: false,
    history: [], thinking: false, hint: null, pinned: {}
  };

  var worker = null, workerSeq = 0, pendingCb = {};
  function getWorker() {
    if (!worker) {
      worker = new Worker('js/ai-worker.js');
      worker.onmessage = function (e) {
        var cb = pendingCb[e.data.id];
        delete pendingCb[e.data.id];
        if (cb) cb(e.data.move);
      };
    }
    return worker;
  }
  function aiSearch(board, color, level, cb) {
    var w = getWorker(), id = ++workerSeq;
    pendingCb[id] = cb;
    w.postMessage({ id: id, board: board, color: color, level: level });
  }

  /* ---------- 布局 ---------- */
  var CELL = 40, W = 0, H = 0;
  var boardEl = $('#board'), svg = $('#boardSvg'), piecesEl = $('#pieces');

  function layout() {
    var wrap = $('#boardWrap');
    var availW = Math.max(120, wrap.clientWidth - 4);
    var availH = Math.max(120, wrap.clientHeight - 4);
    var denomW = 8 + 2 * M, denomH = 9 + 2 * M;
    CELL = Math.max(22, Math.floor(Math.min(availW / denomW, availH / denomH)));
    W = Math.round(denomW * CELL);
    H = Math.round(denomH * CELL);
    boardEl.style.width = W + 'px';
    boardEl.style.height = H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    drawGrid();
    render();
  }

  function px(r, c) { return [M * CELL + c * CELL, M * CELL + r * CELL]; }

  function drawGrid() {
    var ns = 'http://www.w3.org/2000/svg';
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    function add(tag, attrs) {
      var el = document.createElementNS(ns, tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      svg.appendChild(el);
      return el;
    }

    add('rect', { x: 0, y: 0, width: W, height: H, fill: '#f3dbb0', rx: Math.max(4, CELL * .1) });

    var g = add('g', { stroke: '#7a4f24', 'stroke-width': Math.max(1, CELL * .02), fill: 'none' });
    var r, c, x, y;
    for (r = 0; r < 10; r++) {
      y = M * CELL + r * CELL;
      add2(g, 'line', M * CELL, y, M * CELL + 8 * CELL, y);
    }
    for (c = 0; c < 9; c++) {
      x = M * CELL + c * CELL;
      if (c === 0 || c === 8) {
        add2(g, 'line', x, M * CELL, x, M * CELL + 9 * CELL);
      } else {
        add2(g, 'line', x, M * CELL, x, M * CELL + 4 * CELL);
        add2(g, 'line', x, M * CELL + 5 * CELL, x, M * CELL + 9 * CELL);
      }
    }
    add2(g, 'line', px(0, 3)[0], px(0, 3)[1], px(2, 5)[0], px(2, 5)[1]);
    add2(g, 'line', px(0, 5)[0], px(0, 5)[1], px(2, 3)[0], px(2, 3)[1]);
    add2(g, 'line', px(7, 3)[0], px(7, 3)[1], px(9, 5)[0], px(9, 5)[1]);
    add2(g, 'line', px(7, 5)[0], px(7, 5)[1], px(9, 3)[0], px(9, 3)[1]);
    add('rect', {
      x: M * CELL, y: M * CELL, width: 8 * CELL, height: 9 * CELL,
      stroke: '#7a4f24', 'stroke-width': Math.max(2, CELL * .045), fill: 'none'
    });

    function posMarks(rows) {
      [[2, 4], [3, 3], [3, 5], [6, 3], [6, 5], [7, 4]].forEach(function (p) {
        var pr = rows === 'up' ? p[0] : 9 - p[0];
        mark(g, pr, p[1]);
      });
    }
    posMarks('up'); posMarks('down');

    var t1 = add('text', {
      x: px(4, 1)[0], y: px(4, 1)[1] + CELL * .18,
      'font-size': Math.round(CELL * .42), fill: 'rgba(122,79,36,.8)',
      'font-family': '"Kaiti SC","STKaiti","KaiTi",serif', 'text-anchor': 'middle'
    });
    t1.textContent = '楚 河';
    var t2 = add('text', {
      x: px(4, 6)[0], y: px(4, 6)[1] + CELL * .18,
      'font-size': Math.round(CELL * .42), fill: 'rgba(122,79,36,.8)',
      'font-family': '"Kaiti SC","STKaiti","KaiTi",serif', 'text-anchor': 'middle'
    });
    t2.textContent = '汉 界';

    function add2(parent, tag, x1, y1, x2, y2) {
      var el = document.createElementNS(ns, tag);
      el.setAttribute('x1', x1); el.setAttribute('y1', y1);
      el.setAttribute('x2', x2); el.setAttribute('y2', y2);
      parent.appendChild(el);
    }
    function mark(parent, rr, cc) {
      var p = px(rr, cc), d = CELL * .1, len = CELL * .18, sgn;
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (sg) {
        if ((cc === 0 && sg[1] === -1) || (cc === 8 && sg[1] === 1)) return;
        add2(parent, 'line',
          p[0] + sg[1] * d, p[1] + sg[0] * d,
          p[0] + sg[1] * d, p[1] + sg[0] * (d + len));
        add2(parent, 'line',
          p[0] + sg[1] * d, p[1] + sg[0] * d,
          p[0] + sg[1] * (d + len), p[1] + sg[0] * d);
      });
    }
  }

  /* ---------- 渲染 ---------- */
  /* 绝对牵制：该子正挡在攻击线与己方老将之间——把它抽掉老将才暴露，才算被钉 */
  function computePinned(color) {
    var out = {};
    if (!R.kingSafe(S.board, color)) return out;   // 已被将军时不存在「钉」
    for (var r = 0; r < 10; r++) for (var c = 0; c < 9; c++) {
      var p = S.board[r][c];
      if (!p || p.color !== color || p.type === 'K') continue;
      S.board[r][c] = null;
      var exposed = !R.kingSafe(S.board, color);
      S.board[r][c] = p;
      if (exposed) out[r + ',' + c] = true;
    }
    return out;
  }

  function render() {
    if (!S.board) { updatePanel(); return; }
    S.pinned = S.pinMark ? Object.assign(computePinned('r'), computePinned('b')) : {};
    var box = piecesEl;
    while (box.firstChild) box.removeChild(box.firstChild);

    function overlay(r, c, cls, frac) {
      var el = document.createElement('div');
      el.className = cls;
      var size = Math.round(CELL * frac);
      var p = px(r, c);
      el.style.width = size + 'px'; el.style.height = size + 'px';
      el.style.left = (p[0] - size / 2) + 'px';
      el.style.top = (p[1] - size / 2) + 'px';
      box.appendChild(el);
    }

    if (S.last) {
      overlay(S.last.fr, S.last.fc, 'last-ring', .96);
      overlay(S.last.tr, S.last.tc, 'last-ring', .96);
    }
    if (S.hint && !S.over) {
      overlay(S.hint.fr, S.hint.fc, 'hint-ring', 1.02);
      overlay(S.hint.tr, S.hint.tc, 'hint-ring', 1.02);
    }

    for (var r = 0; r < 10; r++) for (var c = 0; c < 9; c++) {
      var p = S.board[r][c];
      if (!p) continue;
      var el = document.createElement('div');
      el.className = 'piece ' + p.color;
      var rad = Math.round(CELL * .44);
      var pos = px(r, c);
      el.style.width = el.style.height = rad * 2 + 'px';
      el.style.left = (pos[0] - rad) + 'px';
      el.style.top = (pos[1] - rad) + 'px';
      el.style.fontSize = Math.round(CELL * .46) + 'px';
      el.textContent = R.NAMES[p.color][p.type];
      if (S.sel && S.sel[0] === r && S.sel[1] === c) el.classList.add('sel');
      if (S.pinned[r + ',' + c]) {
        var badge = document.createElement('span');
        badge.className = 'pin-badge';
        badge.textContent = '钉';
        badge.style.fontSize = Math.round(CELL * .26) + 'px';
        el.appendChild(badge);
      }
      box.appendChild(el);
    }

    S.targets.forEach(function (t) {
      overlay(t[0], t[1], S.board[t[0]][t[1]] ? 'cap-ring' : 'dot',
        S.board[t[0]][t[1]] ? .96 : .26);
    });

    updatePanel();
  }

  var LEVEL_NAMES = { 1: '入门', 2: '初级', 3: '中级', 4: '高级' };

  function updatePanel() {
    var st = $('#status');
    if (S.over) {
      st.textContent = S.result;
      st.className = 'status over';
    } else if (S.thinking) {
      st.textContent = '🤖 AI 正在思考…';
      st.className = 'status thinking';
    } else {
      st.textContent = (S.turn === S.human ? '轮到你走棋' : '轮到 AI 走棋') +
        (S.check ? '（被将军！）' : '');
      st.className = 'status';
    }
    $('#coach').innerHTML = coachHtml();
    $('#hdrLevel').textContent = LEVEL_NAMES[S.level];
  }

  function coachHtml() {
    if (!S.board) return '💡 点击棋子会出现<b>绿点</b>（可走位）和<b>红圈</b>（可吃子）。';
    if (S.over) return S.result;
    if (S.turn !== S.human || S.thinking) return '🤖 AI 正在思考，稍等片刻…';
    var tips = [];
    if (S.sel && S.pinned[S.sel[0] + ',' + S.sel[1]]) {
      var sp = S.board[S.sel[0]][S.sel[1]];
      tips.push('📌 这枚<b>' + R.NAMES[sp.color][sp.type] + '</b>正挡在己方老将的攻击线上，挪开就会暴露老将，所以一部分走法被禁。');
    }
    if (!R.kingSafe(S.board, S.human)) {
      tips.push('⚠️ <b>你被将军了！</b>必须应将：移动将/帅、垫将、或吃掉进攻的棋子。');
    }
    var ai = R.otherColor(S.human), threatened = {};
    R.legalMoves(S.board, ai).forEach(function (m) {
      var p = S.board[m.tr][m.tc];
      if (p && p.color === S.human && R.VAL[p.type] >= 280) threatened[p.type] = R.NAMES[p.color][p.type];
    });
    var names = Object.keys(threatened).map(function (k) { return threatened[k]; });
    if (names.length) tips.push('👀 注意：对方正在攻击你的 <b>' + names.join('、') + '</b>。');
    if (!tips.length) {
      tips.push('💡 点击棋子会出现<b>绿点</b>（可走位）和<b>红圈</b>（可吃子）。');
      tips.push('💡 开局要点：先出车马炮，控制中路，别急着过河。');
    }
    return tips.join('<br>');
  }

  /* ---------- 游戏流程 ---------- */
  function coord(r, c) { return String.fromCharCode(97 + c) + (10 - r); }

  function setStatusFromBoard() {
    S.check = !R.kingSafe(S.board, S.turn);
    var moves = R.legalMoves(S.board, S.turn);
    S.over = moves.length === 0;
    if (S.over) {
      var humanLose = S.turn === S.human;
      S.win = humanLose ? 'ai' : 'human';
      S.result = humanLose
        ? (S.check ? '你被将死了，AI 获胜 😢' : '你无棋可走（困毙），AI 获胜 😢')
        : (S.check ? 'AI 被将死了，你赢了！🎉' : 'AI 无棋可走，你赢了！🎉');
    } else {
      S.result = ''; S.win = null;
    }
  }

  function apply(m) {
    var p = S.board[m.fr][m.fc];
    var cap = S.board[m.tr][m.tc];
    S.board[m.tr][m.tc] = p; S.board[m.fr][m.fc] = null;
    S.last = { fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc };
    S.sel = null; S.targets = []; S.hint = null;
    S.turn = R.otherColor(S.turn);
    S.history.push({ m: m, cap: cap, text: (p.color === 'r' ? '红' : '黑') + ' ' +
      R.NAMES[p.color][p.type] + ' ' + coord(m.fr, m.fc) + '→' + coord(m.tr, m.tc) });
    setStatusFromBoard();
    save();
    render();
  }

  function aiTurn() {
    if (S.over || S.thinking || S.turn === S.human) return;
    S.thinking = true;
    updatePanel();
    aiSearch(S.board, S.turn, S.level, function (m) {
      S.thinking = false;
      if (m) apply(m); else render();
      if (S.over) showOver();
    });
  }

  function humanMove(m) {
    apply(m);
    if (!S.over) aiTurn();
  }

  function onBoardTap(e) {
    if (S.over || S.thinking || S.turn !== S.human) return;
    var rect = boardEl.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    var c = Math.round((x - M * CELL) / CELL);
    var r = Math.round((y - M * CELL) / CELL);
    if (r < 0 || r > 9 || c < 0 || c > 8) return;
    var p = px(r, c);
    if (Math.hypot(x - p[0], y - p[1]) > CELL * .62) return;

    S.hint = null;
    var piece = S.board[r][c];
    if (piece && piece.color === S.human) {
      S.sel = [r, c];
      S.targets = R.legalMoves(S.board, S.human)
        .filter(function (m) { return m.fr === r && m.fc === c; })
        .map(function (m) { return [m.tr, m.tc]; });
      render();
      return;
    }
    if (S.sel) {
      var hit = S.targets.some(function (t) { return t[0] === r && t[1] === c; });
      if (hit) { humanMove({ fr: S.sel[0], fc: S.sel[1], tr: r, tc: c }); return; }
      S.sel = null; S.targets = [];
      render();
    }
  }

  function newGame() {
    S.board = R.initialBoard();
    S.turn = 'r';
    S.sel = null; S.targets = []; S.last = null;
    S.over = false; S.result = ''; S.win = null; S.check = false;
    S.thinking = false; S.history = []; S.hint = null;
    save();
    render();
    toast('新的一局开始：' + LEVEL_NAMES[S.level] + ' AI，你执' + (S.human === 'r' ? '红' : '黑'));
    if (S.human !== 'r') aiTurn();
  }

  function undo() {
    if (S.thinking) { toast('AI 正在思考，稍后再试'); return; }
    if (!S.history.length) { toast('没有可以悔的棋了'); return; }
    function undoOne() {
      var h = S.history.pop();
      if (!h) return false;
      S.board[h.m.fr][h.m.fc] = S.board[h.m.tr][h.m.tc];
      S.board[h.m.tr][h.m.tc] = h.cap || null;
      S.turn = R.otherColor(S.turn);
      return true;
    }
    undoOne();
    if (S.turn !== S.human && S.history.length) undoOne();
    S.over = false; S.result = ''; S.win = null; S.check = false;
    S.sel = null; S.targets = []; S.hint = null;
    var lastH = S.history.length ? S.history[S.history.length - 1] : null;
    S.last = lastH ? lastH.m : null;
    setStatusFromBoard();
    save();
    render();
    $('#overMask').classList.add('hidden');
    toast('已悔棋');
  }

  function hint() {
    if (S.over || S.thinking || S.turn !== S.human) return;
    S.thinking = true; updatePanel();
    aiSearch(S.board, S.human, Math.max(S.level, 3), function (m) {
      S.thinking = false;
      if (!m) { toast('没有可走的棋'); render(); return; }
      S.hint = m;
      var p = S.board[m.fr][m.fc];
      toast('💡 建议：' + R.NAMES[p.color][p.type] + ' ' + coord(m.fr, m.fc) + ' → ' + coord(m.tr, m.tc));
      render();
      setTimeout(function () { S.hint = null; render(); }, 4000);
    });
  }

  /* ---------- 设置 / 弹窗 ---------- */
  function showOver() {
    $('#overEmoji').textContent = S.win === 'human' ? '🏆' : '🤖';
    $('#overText').textContent = S.result;
    $('#overMask').classList.remove('hidden');
  }

  function setSeg(segSel, attr, value) {
    document.querySelectorAll(segSel + ' button').forEach(function (b) {
      b.classList.toggle('active', b.dataset[attr] === value);
    });
  }

  /* ---------- 持久化 ---------- */
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        board: S.board, turn: S.turn, human: S.human, level: S.level,
        pinMark: S.pinMark,
        history: S.history, last: S.last, over: S.over, result: S.result, win: S.win
      }));
    } catch (e) { /* 存储满时忽略 */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      var d = JSON.parse(raw);
      if (!Array.isArray(d.board) || d.board.length !== 10 ||
          !d.board.every(function (row) { return Array.isArray(row) && row.length === 9; })) return false;
      if (d.human !== 'r' && d.human !== 'b') return false;
      S.board = d.board;
      S.turn = d.turn; S.human = d.human; S.level = d.level || 2;
      S.pinMark = d.pinMark === true;
      S.history = d.history || []; S.last = d.last || null;
      S.over = !!d.over; S.result = d.result || ''; S.win = d.win || null;
      S.check = !S.over && !R.kingSafe(S.board, S.turn);
      return true;
    } catch (e) { return false; }
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  /* ---------- 初始化 ---------- */
  function initControls() {
    boardEl.addEventListener('pointerup', onBoardTap);

    $('#btnNew').addEventListener('click', newGame);
    $('#btnUndo').addEventListener('click', undo);
    $('#btnHint').addEventListener('click', hint);

    $('#btnSettings').addEventListener('click', function () {
      setSeg('#levelSeg', 'level', String(S.level));
      setSeg('#sideSeg', 'side', S.human === 'r' ? 'red' : 'black');
      setSeg('#pinSeg', 'pin', S.pinMark ? 'on' : 'off');
      $('#settingsMask').classList.remove('hidden');
    });
    $('#btnCloseSheet').addEventListener('click', function () {
      $('#settingsMask').classList.add('hidden');
    });

    $('#levelSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.level = parseInt(b.dataset.level, 10);
      setSeg('#levelSeg', 'level', b.dataset.level);
      newGame();
    });
    $('#sideSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.human = b.dataset.side === 'red' ? 'r' : 'b';
      setSeg('#sideSeg', 'side', b.dataset.side);
      newGame();
    });

    $('#pinSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.pinMark = b.dataset.pin === 'on';
      setSeg('#pinSeg', 'pin', b.dataset.pin);
      save();
      render();
      toast(S.pinMark ? '已标出被钉住的棋子' : '已关闭标记');
    });

    $('#btnOverNew').addEventListener('click', function () {
      $('#overMask').classList.add('hidden');
      newGame();
    });
    $('#btnOverClose').addEventListener('click', function () {
      $('#overMask').classList.add('hidden');
    });

    window.addEventListener('resize', layout);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
  }

  function init() {
    initControls();
    var resumed = load();
    layout();
    if (!resumed) { newGame(); return; }
    render();
    if (S.over) showOver();
    else if (S.turn !== S.human) aiTurn();
    else toast('已恢复上一局');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
