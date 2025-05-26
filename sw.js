const CACHE_VERSION = Date.now().toString();
const STATIC_CACHE = `pdfile-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `pdfile-dynamic-v${CACHE_VERSION}`;

const BASE_PATH = self.location.hostname.includes('github.io') ? '/PDFile' : '';

const IS_DEVELOPMENT = self.location.hostname === 'localhost' || 
                      self.location.hostname === '127.0.0.1' ||
                      self.location.port === '5500';

const CRITICAL_ASSETS = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
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
    console.log('SW: Installing new version...');
    
    if (IS_DEVELOPMENT) {
        console.log('SW: Development mode - minimal caching');
        self.skipWaiting();
        return;
    }
    
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then((cache) => {
                return Promise.allSettled(
                    CRITICAL_ASSETS.map(asset => 
                        cache.add(asset).catch(err => {
                            console.warn(`SW: Failed to cache ${asset}:`, err);
                            return null;
                        })
                    )
                );
            }),
            caches.open(DYNAMIC_CACHE).then((cache) => {
                return Promise.allSettled(
                    CDN_ASSETS.map(url => 
                        cache.add(url).catch(err => {
                            console.warn(`SW: Failed to cache CDN asset ${url}:`, err);
                            return null;
                        })
                    )
                );
            })
        ]).then(() => {
            console.log('SW: Installation complete, forcing activation...');
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', (event) => {
    console.log('SW: Activating new version...');
    
    event.waitUntil(
        Promise.all([
            // Limpiar caches antiguos
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName.startsWith('pdfile-')) {
                            console.log(`SW: Deleting old cache: ${cacheName}`);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            self.clients.claim()
        ]).then(() => {
            console.log('SW: Activation complete');
            return self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_UPDATED',
                        message: 'Service Worker updated successfully'
                    });
                });
            });
        })
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    if (request.method !== 'GET') {
        return;
    }
    
    if (IS_DEVELOPMENT) {
        event.respondWith(handleDevelopmentRequest(request));
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

async function handleDevelopmentRequest(request) {
    const url = new URL(request.url);
    
    try {
        const networkResponse = await fetch(request, {
            cache: 'no-store'
        });
        
        if (networkResponse.ok) {
            console.log(`SW Dev: Fresh from network: ${url.pathname}`);
            return networkResponse;
        }
    } catch (error) {
        console.log(`SW Dev: Network failed for ${url.pathname}, trying cache...`);
    }
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        console.log(`SW Dev: Served from cache: ${url.pathname}`);
        return cachedResponse;
    }
    
    return new Response('Not available in development', { 
        status: 404,
        statusText: 'Not Found'
    });
}

async function handleDocument(request) {
    try {
        const networkResponse = await fetch(request, {
            cache: IS_DEVELOPMENT ? 'no-store' : 'default'
        });
        
        if (networkResponse.ok) {
            if (!IS_DEVELOPMENT) {
                const cache = await caches.open(STATIC_CACHE);
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        }
    } catch (error) {
        console.log(`SW: Network failed for document: ${request.url}`);
    }
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    return createOfflinePage();
}

async function handleStaticAsset(request) {
    const url = new URL(request.url);
    
    if (IS_DEVELOPMENT) {
        try {
            const networkResponse = await fetch(request, { cache: 'no-store' });
            if (networkResponse.ok) {
                return networkResponse;
            }
        } catch (error) {
        }
    }
    
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse && !IS_DEVELOPMENT) {
        updateCacheInBackground(request);
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request, {
            cache: IS_DEVELOPMENT ? 'no-store' : 'default'
        });
        
        if (networkResponse.ok) {
            if (!IS_DEVELOPMENT) {
                const cache = await caches.open(STATIC_CACHE);
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        }
        
        return networkResponse;
    } catch (error) {
        return cachedResponse || new Response('Asset not available', { 
            status: 404,
            statusText: 'Not Found'
        });
    }
}

async function handleCDNAsset(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        return new Response('CDN asset unavailable', { 
            status: 504,
            statusText: 'Gateway Timeout'
        });
    }
}

async function updateCacheInBackground(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            await cache.put(request, networkResponse);
            console.log(`SW: Background updated: ${request.url}`);
        }
    } catch (error) {
        console.warn('SW: Background update failed:', error);
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
                .dev-info {
                    font-size: 0.8rem;
                    opacity: 0.7;
                    margin-top: 1rem;
                    border-top: 1px solid rgba(255,255,255,0.2);
                    padding-top: 1rem;
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
                ${IS_DEVELOPMENT ? '<div class="dev-info">Development Mode: Minimal caching active</div>' : ''}
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

function isStaticAsset(pathname) {
    return pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|webp|bmp)$/);
}

function isDocument(pathname) {
    return pathname === '/' || 
           pathname === `${BASE_PATH}/` || 
           pathname.endsWith('.html') || 
           (!pathname.includes('.') && !pathname.startsWith('/api'));
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
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage(info);
            }
        });
    }
    
    if (event.data && event.data.type === 'FORCE_UPDATE') {
        console.log('SW: Force update requested');
        self.skipWaiting();
    }
});

async function getCacheInfo() {
    try {
        const cacheNames = await caches.keys();
        const info = { development: IS_DEVELOPMENT };
        
        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            info[cacheName] = {
                count: keys.length,
                urls: keys.slice(0, 10).map(req => req.url)
            };
        }
        
        return info;
    } catch (error) {
        return { error: error.message };
    }
}

self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    if (IS_DEVELOPMENT) return;
    
    try {
        const cache = await caches.open(STATIC_CACHE);
        const requests = await cache.keys();
        
        for (const request of requests.slice(0, 5)) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.put(request, response);
                }
            } catch (error) {
                console.warn('SW: Background sync failed for:', request.url);
            }
        }
    } catch (error) {
        console.warn('SW: Background sync error:', error);
    }
}