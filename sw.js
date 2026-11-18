// FitJoy Service Worker (PWA Offline Support)
const CACHE_NAME = 'fitjoy-cache-v2';
const VIDEO_CACHE_NAME = 'fitjoy-video-cache-v2';

const STATIC_ASSETS = [
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/app.js',
  'js/audio-cues.js',
  'js/calendar.js',
  'js/content-data.js',
  'js/post-workout-modal.js',
  'js/pulse-timer.js',
  'js/user-store.js',
  'js/video-manager.js',
  'js/pwa-install.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png'
];

// 1. Install Event: Cache Core Static Assets (ใช้ Promise.allSettled เพื่อไม่ให้พังถ้ามีไฟล์ใดติดขัด)
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

  // ตรวจสอบว่าเป็นไฟล์วิดีโอ (.mp4)
  const isVideo = url.pathname.endsWith('.mp4') || request.destination === 'video';

  if (isVideo) {
    event.respondWith(handleVideoRequest(request));
    return;
  }

  // สำหรับไฟล์ทั่วไป: Cache First, fallback to Network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch network in background
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

// จัดการ Video Fetch และ Range Requests
async function handleVideoRequest(request) {
  const cache = await caches.open(VIDEO_CACHE_NAME);
  const rangeHeader = request.headers.get('range');

  const cleanRequest = new Request(request.url);
  let cachedResponse = await cache.match(cleanRequest);

  if (!cachedResponse) {
    try {
      const networkResponse = await fetch(cleanRequest);
      if (networkResponse.status === 200) {
        await cache.put(cleanRequest, networkResponse.clone());
        cachedResponse = networkResponse;
      } else {
        return networkResponse;
      }
    } catch (err) {
      return new Response('Video not available offline', { status: 503, statusText: 'Service Unavailable' });
    }
  }

  if (rangeHeader) {
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
  }

  return cachedResponse;
}
