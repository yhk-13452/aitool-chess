/* Service Worker：离线缓存全部静态资源 */
var CACHE = 'xq-pwa-v4';
var ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'app.js',
  'sw-register.js',
  'js/rules.js',
  'js/ai.js',
  'js/ai-worker.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  // 只读本版本缓存：全局 caches.match 会按创建顺序遍历所有缓存，旧版本同名文件会赢过新版
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(e.request).then(function (hit) {
        if (hit) return hit;
        return fetch(e.request).then(function (res) {
          if (res.ok && new URL(e.request.url).origin === location.origin) {
            var copy = res.clone();
            cache.put(e.request, copy);
          }
          return res;
        });
      });
    }).catch(function () {
      return caches.open(CACHE).then(function (cache) { return cache.match('index.html'); });
    })
  );
});
