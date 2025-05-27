const APP_VERSION = '1.2.1';
const CACHE_NAME = `pdfile-cache-v${APP_VERSION}`;
const BASE_PATH = self.location.hostname.includes('github.io') ? '/PDFile' : '';

const CRITICAL_ASSETS = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/manifest.json`,
    `${BASE_PATH}/css/styles.css`,
    `${BASE_PATH}/css/pdf-viewer.css`,
    `${BASE_PATH}/css/page-reorder.css`,
    `${BASE_PATH}/css/text-conversion.css`,
    `${BASE_PATH}/js/app.js`,
    `${BASE_PATH}/js/utils.js`,
    `${BASE_PATH}/js/pdf-operations.js`,
    `${BASE_PATH}/js/ui-handler.js`,
    `${BASE_PATH}/js/file-handler.js`,
    `${BASE_PATH}/js/drag-drop-handler.js`,
    `${BASE_PATH}/js/pdf-viewer.js`,
    `${BASE_PATH}/js/page-reorder-handler.js`,
    `${BASE_PATH}/js/pdf-compression.js`,
    `${BASE_PATH}/js/format-converters.js`,
    `${BASE_PATH}/js/protected-pdf-processor.js`,
    `${BASE_PATH}/js/tcpdf-certificate-processor.js`,
    `${BASE_PATH}/js/practical-certificate-processor.js`,
    `${BASE_PATH}/js/universal-protected-detector.js`,
    `${BASE_PATH}/favicon.ico`
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
    console.log(`Service Worker installing version ${APP_VERSION}`);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching critical assets');
                return cache.addAll(CRITICAL_ASSETS)
                    .then(() => {
                        console.log('All critical assets cached');
                        return Promise.allSettled(
                            CDN_ASSETS.map(url => fetch(url)
                                .then(response => {
                                    if (response.ok) {
                                        return cache.put(url, response);
                                    }
                                })
                                .catch(err => console.warn('Failed to cache CDN asset:', url, err))
                            )
                        );
                    });
            })
            .then(() => {
                console.log('Skip waiting to activate immediately');
                return self.skipWaiting();
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log(`Service Worker activating version ${APP_VERSION}`);
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('pdfile-cache-')) {
                        console.log(`Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Claiming clients');
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    if (request.method !== 'GET') return;
    
    event.respondWith(
        fetch(request)
            .then(networkResponse => {
                if (networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(request, responseClone))
                        .catch(err => console.warn('Failed to update cache:', err));
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            console.log(`Serving from cache: ${request.url}`);
                            return cachedResponse;
                        }
                        
                        if (request.headers.get('accept').includes('text/html')) {
                            return caches.match(`${BASE_PATH}/index.html`);
                        }
                        
                        return new Response('Resource not available offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        console.log('Received skip waiting command');
        self.skipWaiting();
    }
    
    if (event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: APP_VERSION });
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME)
            .then(() => event.ports[0].postMessage({ success: true }))
            .catch(err => event.ports[0].postMessage({ success: false, error: err.message }));
    }
});


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
                .container {
                    text-align: center;
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    padding: 3rem;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    max-width: 500px;
                    margin: 0 20px;
                }
                .icon { font-size: 4rem; margin-bottom: 1rem; }
                h1 { margin-bottom: 0.5rem; font-size: 2rem; }
                p { opacity: 0.9; margin-bottom: 2rem; line-height: 1.6; }
                .btn {
                    background: rgba(255, 255, 255, 0.2);
                    border: 2px solid white;
                    color: white;
                    padding: 0.75rem 2rem;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: all 0.3s ease;
                    text-decoration: none;
                    display: inline-block;
                    margin: 0.5rem;
                }
                .btn:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: translateY(-2px);
                    color: white;
                    text-decoration: none;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">📱</div>
                <h1>PDFile - Offline</h1>
                <p>You're currently offline, but PDFile can still work with previously cached files.</p>
                <a href="${BASE_PATH}/" class="btn">Go to PDFile</a>
                <button class="btn" onclick="window.location.reload()">Retry Connection</button>
            </div>
        </body>
        </html>
    `;
    
    return new Response(offlineHTML, {
        status: 200,
        headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache'
        }
    });
}