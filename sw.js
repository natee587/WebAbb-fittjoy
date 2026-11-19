// FitJoy Service Worker (PWA Offline Support - Single File Bundle Ready)
const CACHE_NAME = 'fitjoy-cache-v4';
const VIDEO_CACHE_NAME = 'fitjoy-video-cache-v4';

const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png'
];

// 1. Install Event: Cache Core Static Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Pre-caching static assets');
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Could not cache asset:', asset, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== VIDEO_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  const isVideo = url.pathname.endsWith('.mp4') || request.destination === 'video';

  if (isVideo) {
    event.respondWith(handleVideoRequest(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
          return caches.match('index.html');
        }
      });
    })
  );
});

// จัดการ Video Fetch และ Range Requests: เล่นได้ทันทีขณะออนไลน์ + เล่นจากแคชได้ 100% ขณะออฟไลน์
async function handleVideoRequest(request) {
  const cache = await caches.open(VIDEO_CACHE_NAME);

  // 1. ตรวจสอบว่าวิดีโอนี้มีในแคชแล้วหรือไม่
  let cachedResponse = await cache.match(request.url);
  if (!cachedResponse) {
    cachedResponse = await cache.match(new Request(request.url));
  }
  if (!cachedResponse) {
    try {
      cachedResponse = await cache.match(decodeURI(request.url));
    } catch(e) {}
  }
  if (!cachedResponse) {
    try {
      cachedResponse = await cache.match(encodeURI(request.url));
    } catch(e) {}
  }

  // ถ้ามีในแคช (ไม่ว่าจะออนไลน์หรือออฟไลน์) ให้เล่นจากแคชเครื่องทันที พร้อมตัด Range 206 Partial Content
  if (cachedResponse) {
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      try {
        const arrayBuffer = await cachedResponse.clone().arrayBuffer();
        const bytes = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(bytes[0], 10);
        const end = bytes[1] ? parseInt(bytes[1], 10) : arrayBuffer.byteLength - 1;
        const chunk = arrayBuffer.slice(start, end + 1);

        return new Response(chunk, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Range': `bytes ${start}-${end}/${arrayBuffer.byteLength}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunk.byteLength,
            'Content-Type': cachedResponse.headers.get('Content-Type') || 'video/mp4'
          }
        });
      } catch (err) {
        console.warn('[SW] Error slicing cached video:', err);
      }
    }
    return cachedResponse;
  }

  // 2. ถ้ายังไม่มีในแคช: ให้ส่งตรงไปยัง Network ทันที (Direct Range Streaming จาก Netlify) 
  // วิดีโอจะเริ่มเล่นทันทีในเสี้ยววินาที ไม่ต้องรอโหลดทั้งไฟล์ 20MB!
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (err) {
    // 3. ถ้าไม่มีสัญญาณอินเทอร์เน็ต และคลิปนี้ยังไม่เคยถูกเปิดดูมาก่อน
    return new Response('Video not available offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
