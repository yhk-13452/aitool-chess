/* AI 搜索 Worker：避免 negamax 阻塞 UI 线程 */
importScripts('rules.js', 'ai.js');

self.onmessage = function (e) {
  var d = e.data;
  var bd = self.XQRules.cloneBoard(d.board);
  var move = self.XQAI.bestMove(bd, d.color, d.level);
  self.postMessage({ id: d.id, move: move || null });
};
