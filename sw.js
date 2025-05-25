const CACHE_NAME = 'pdfile-v1.2.0';
const STATIC_CACHE = 'pdfile-static-v1.2.0';
const DYNAMIC_CACHE = 'pdfile-dynamic-v1.2.0';

const CRITICAL_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/css/pdf-viewer.css',
    '/css/page-reorder.css',
    '/css/text-conversion.css',
    '/js/app.js',
    '/js/utils.js',
    '/js/pdf-operations.js',
    '/js/ui-handler.js',
    '/js/file-handler.js',
    '/js/drag-drop-handler.js',
    '/js/pdf-viewer.js',
    '/js/page-reorder-handler.js',
    '/js/pdf-compression.js',
    '/js/format-converters.js',
    '/js/protected-pdf-processor.js',
    '/js/tcpdf-certificate-processor.js',
    '/js/practical-certificate-processor.js',
    '/js/universal-protected-detector.js',
    '/favicon.ico'
];

const CDN_ASSETS = [
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then((cache) => {
                return cache.addAll(CRITICAL_ASSETS);
            }),
            caches.open(DYNAMIC_CACHE).then((cache) => {
                return Promise.allSettled(
                    CDN_ASSETS.map(url => 
                        cache.add(url).catch(err => console.warn(`Failed to cache ${url}`))
                    )
                );
            })
        ]).then(() => {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName.startsWith('pdfile-')) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            self.clients.claim()
        ])
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    if (request.method !== 'GET') {
        return;
    }
    
    if (url.origin === location.origin) {
        if (isStaticAsset(url.pathname)) {
            event.respondWith(handleStaticAsset(request));
        } else if (isDocument(url.pathname)) {
            event.respondWith(handleDocument(request));
        }
    } else if (isCDNAsset(url.href)) {
        event.respondWith(handleCDNAsset(request));
    }
});

async function handleDocument(request) {
    try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, networkResponse.clone());
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        return createOfflinePage();
    }
}

async function handleStaticAsset(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        updateCacheInBackground(request);
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, networkResponse.clone());
        return networkResponse;
    } catch (error) {
        return new Response('Asset not available offline', { status: 404 });
    }
}

async function handleCDNAsset(request) {
    const cachedResponse = await caches.match(request);
    
    const fetchPromise = fetch(request).then((networkResponse) => {
        const cache = caches.open(DYNAMIC_CACHE);
        cache.then(c => c.put(request, networkResponse.clone()));
        return networkResponse;
    }).catch(() => {
        return null;
    });
    
    return cachedResponse || await fetchPromise;
}

async function updateCacheInBackground(request) {
    try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, networkResponse);
    } catch (error) {
        // Silent fail
    }
}

function createOfflinePage() {
    const offlineHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PDFile - Offline</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    margin: 0;
                    padding: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }
                .offline-container {
                    text-align: center;
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    padding: 3rem;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }
                .offline-icon {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                }
                h1 { margin-bottom: 0.5rem; }
                p { opacity: 0.9; margin-bottom: 2rem; }
                .retry-btn {
                    background: rgba(255, 255, 255, 0.2);
                    border: 2px solid white;
                    color: white;
                    padding: 0.75rem 2rem;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: all 0.3s ease;
                }
                .retry-btn:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: translateY(-2px);
                }
            </style>
        </head>
        <body>
            <div class="offline-container">
                <div class="offline-icon">📱</div>
                <h1>PDFile - Offline Mode</h1>
                <p>You're currently offline. PDFile can still work with files you've previously accessed.</p>
                <button class="retry-btn" onclick="window.location.reload()">
                    Retry Connection
                </button>
            </div>
        </body>
        </html>
    `;
    
    return new Response(offlineHTML, {
        headers: { 'Content-Type': 'text/html' }
    });
}

function isStaticAsset(pathname) {
    return pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/);
}

function isDocument(pathname) {
    return pathname === '/' || pathname.endsWith('.html') || !pathname.includes('.');
}

function isCDNAsset(url) {
    return CDN_ASSETS.some(cdnUrl => url.startsWith(cdnUrl.split('?')[0]));
}

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_CACHE_INFO') {
        getCacheInfo().then(info => {
            event.ports[0].postMessage(info);
        });
    }
});

async function getCacheInfo() {
    const cacheNames = await caches.keys();
    const info = {};
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        info[cacheName] = {
            count: keys.length,
            urls: keys.map(req => req.url)
        };
    }
    
    return info;
}

if ('sync' in self.registration) {
    self.addEventListener('sync', (event) => {
        if (event.tag === 'background-sync') {
            event.waitUntil(doBackgroundSync());
        }
    });
}

async function doBackgroundSync() {
    console.log('Background sync triggered');
}