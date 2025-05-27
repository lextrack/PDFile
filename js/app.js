class PDFManipulatorApp {
    constructor() {
        this.uiHandler = new UIHandler();
        this.pdfOperations = new PDFOperations();
        this.isInitialized = false;
        this.basePath = this.getBasePath();
    }

    getBasePath() {
        if (window.location.hostname.includes('github.io') && window.location.pathname.includes('PDFile')) {
            return '/PDFile';
        }
        return '';
    }

    init() {
        if (this.isInitialized) return;
        
        try {
            this.checkBrowserCompatibility();
            this.uiHandler.init();
            this.setupServiceWorker();
            this.setupErrorHandling();
            this.showWelcomeMessage();
            this.setupConnectionHandling();
            this.setupGlobalShortcuts();
            this.setupLifecycleHandling();
            this.setupAnalytics();
            this.setupURLParameterHandling();
            
            this.isInitialized = true;
            console.log('PDFile App initialized successfully');
            
        } catch (error) {
            console.error('Error initializing application:', error);
            Utils.showToast('Error initializing application', 'error');
        }
    }

    checkBrowserCompatibility() {
        const requiredFeatures = [
            'FileReader',
            'Blob',
            'URL',
            'Promise',
            'fetch'
        ];
        
        const missingFeatures = requiredFeatures.filter(feature => {
            return !(feature in window);
        });
        
        if (missingFeatures.length > 0) {
            throw new Error(`Browser not compatible. Missing: ${missingFeatures.join(', ')}`);
        }
        
        if (!window.PDFLib) {
            console.warn('PDF-lib not available. Some functions may not work.');
        }
        
        const userAgent = navigator.userAgent.toLowerCase();
        const isOldBrowser = userAgent.includes('msie') || 
                           (userAgent.includes('chrome') && parseInt(userAgent.match(/chrome\/(\d+)/)?.[1] || 0) < 80) ||
                           (userAgent.includes('firefox') && parseInt(userAgent.match(/firefox\/(\d+)/)?.[1] || 0) < 75);
        
        if (isOldBrowser) {
            Utils.showToast('Your browser may have limited compatibility. Consider updating for best experience.', 'warning');
        }
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            const swPath = `${this.basePath}/sw.js`;
            
            navigator.serviceWorker.register(swPath).then(registration => {
                console.log('SW registered:', registration.scope);
                
                registration.update();
                
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateAvailable();
                        }
                    });
                });
            });
            
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        }
    }

    showUpdateAvailable() {
        const updateHTML = `
            <div class="alert alert-success alert-dismissible fade show position-fixed" 
                style="top: 20px; right: 20px; z-index: 9999; max-width: 400px;" 
                id="updateAlert">
                <i class="bi bi-arrow-clockwise me-2"></i>
                <strong>Update Available!</strong>
                <p class="mb-2">A new version of PDFile is ready.</p>
                <button type="button" class="btn btn-sm btn-success me-2" onclick="this.updateApp()">
                    Update Now
                </button>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const existingAlert = document.getElementById('updateAlert');
        if (existingAlert) existingAlert.remove();
        
        document.body.insertAdjacentHTML('beforeend', updateHTML);
        
        const updateButton = document.querySelector('#updateAlert .btn-success');
        if (updateButton) {
            updateButton.onclick = () => this.updateApp();
        }
        
        setTimeout(() => {
            const alert = document.getElementById('updateAlert');
            if (alert) alert.remove();
        }, 30000);
    }

    updateApp() {
        console.log('Updating app...');
        
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SKIP_WAITING'
            });
        }
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(registration => {
                if (registration && registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
            });
        }
        
        setTimeout(() => {
            window.location.reload(true);
        }, 500);
    }

    setupURLParameterHandling() {
        const urlParams = new URLSearchParams(window.location.search);
        const tool = urlParams.get('tool');
        
        if (tool && ['merge', 'split', 'reorder', 'compress', 'convert', 'view'].includes(tool)) {
            setTimeout(() => {
                this.uiHandler.selectTool(tool);
            }, 500);
        }
    }

    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Uncaught error:', event.error);
            this.handleGlobalError(event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleGlobalError(event.reason);
            event.preventDefault();
        });
        
        window.addEventListener('error', (event) => {
            if (event.target !== window && event.target.tagName) {
                console.error('Resource loading error:', event.target.src || event.target.href);
                if (event.target.tagName === 'SCRIPT') {
                    Utils.showToast('Some features may not work properly due to loading issues', 'warning');
                }
            }
        }, true);
    }

    handleGlobalError(error) {
        let message = 'An unexpected error has occurred';
        
        if (error instanceof Error) {
            if (error.name === 'QuotaExceededError') {
                message = 'Not enough storage space available';
            } else if (error.name === 'NetworkError') {
                message = 'Network connection error';
            } else if (error.message.includes('PDF')) {
                message = 'Error processing PDF file';
            } else if (error.message.includes('fetch')) {
                message = 'Network request failed';
            } else if (error.message.includes('AbortError')) {
                message = 'Operation was cancelled';
            }
        }
        
        Utils.showToast(message, 'error');
    }

    showWelcomeMessage() {
        const hasVisited = localStorage.getItem('pdfManipulator_hasVisited');
        
        if (!hasVisited) {
            setTimeout(() => {
                Utils.showToast('Welcome to PDFile! Select a tool to get started. All processing happens locally in your browser.', 'info');
                localStorage.setItem('pdfManipulator_hasVisited', 'true');
            }, 1000);
        }
    }

    getUsageStats() {
        const stats = {
            filesProcessed: parseInt(localStorage.getItem('pdfManipulator_filesProcessed') || '0'),
            toolsUsed: JSON.parse(localStorage.getItem('pdfManipulator_toolsUsed') || '{}'),
            lastUsed: localStorage.getItem('pdfManipulator_lastUsed'),
            version: '1.2.1',
            totalSessions: parseInt(localStorage.getItem('pdfManipulator_sessions') || '0') + 1
        };
        
        localStorage.setItem('pdfManipulator_sessions', stats.totalSessions.toString());
        
        return stats;
    }

    updateUsageStats(tool) {
        const filesProcessed = parseInt(localStorage.getItem('pdfManipulator_filesProcessed') || '0') + 1;
        localStorage.setItem('pdfManipulator_filesProcessed', filesProcessed.toString());
        
        const toolsUsed = JSON.parse(localStorage.getItem('pdfManipulator_toolsUsed') || '{}');
        toolsUsed[tool] = (toolsUsed[tool] || 0) + 1;
        localStorage.setItem('pdfManipulator_toolsUsed', JSON.stringify(toolsUsed));
        
        localStorage.setItem('pdfManipulator_lastUsed', new Date().toISOString());
    }

    cleanup() {
        const urls = document.querySelectorAll('img[src^="blob:"], a[href^="blob:"]');
        urls.forEach(element => {
            const url = element.src || element.href;
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });
        
        this.pdfOperations.clearCache();
        
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        });
        
        console.log('Cleanup completed');
    }

    exportConfig() {
        return {
            version: '1.2.1',
            timestamp: new Date().toISOString(),
            stats: this.getUsageStats(),
            settings: {
                theme: localStorage.getItem('pdfManipulator_theme') || 'auto',
                language: localStorage.getItem('pdfManipulator_language') || 'en'
            }
        };
    }

    importConfig(config) {
        if (!config || !config.version) {
            throw new Error('Invalid configuration');
        }
        
        if (config.settings) {
            Object.keys(config.settings).forEach(key => {
                localStorage.setItem(`pdfManipulator_${key}`, config.settings[key]);
            });
        }
        
        Utils.showToast('Configuration imported successfully', 'success');
    }

    async checkForUpdates() {
        try {
            const currentVersion = '1.2.1';
            
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'CHECK_UPDATE',
                    version: currentVersion
                });
            }
            
            return false;
        } catch (error) {
            console.error('Error checking for updates:', error);
            return false;
        }
    }

    setupConnectionHandling() {
        const updateOnlineStatus = () => {
            if (navigator.onLine) {
                Utils.showToast('Connection restored', 'success');
                document.body.classList.remove('offline');
            } else {
                Utils.showToast('Working offline. Some features may be limited.', 'warning');
                document.body.classList.add('offline');
            }
        };
        
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        
        if (!navigator.onLine) {
            document.body.classList.add('offline');
        }
    }

    setupGlobalShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                this.showHelp();
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === '1') {
                e.preventDefault();
                this.showQuickSearch();
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.showQuickSearch();
            }
            
            if (e.key === 'F1') {
                e.preventDefault();
                this.showHelp();
            }
        });
    }

    showHelp() {
        const helpModal = `
            <div class="modal fade" id="helpModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-question-circle me-2"></i>Help - PDFile
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Available Tools:</h6>
                                    <ul>
                                        <li><strong>Merge PDFs:</strong> Combine multiple PDF files into one</li>
                                        <li><strong>Split PDF:</strong> Extract specific pages from a PDF</li>
                                        <li><strong>Reorder Pages:</strong> Change the order of pages</li>
                                        <li><strong>Compress PDF:</strong> Reduce file size</li>
                                        <li><strong>Convert to PDF:</strong> Convert images and text to PDF files</li>
                                        <li><strong>View PDF:</strong> Preview documents</li>
                                    </ul>
                                </div>
                                <div class="col-md-6">
                                    <h6>Keyboard Shortcuts:</h6>
                                    <ul>
                                        <li><kbd>Ctrl/Cmd + S</kbd> - Process files</li>
                                        <li><kbd>Ctrl/Cmd + H</kbd> - Show this help</li>
                                        <li><kbd>Ctrl/Cmd + K</kbd> - Quick search</li>
                                        <li><kbd>Escape</kbd> - Cancel/Go back</li>
                                        <li><kbd>Delete</kbd> - Remove selected element</li>
                                        <li><kbd>F1</kbd> - Help</li>
                                    </ul>
                                </div>
                            </div>
                            
                            <hr>
                            
                            <h6>File Limits & Support:</h6>
                            <div class="row">
                                <div class="col-md-6">
                                    <ul>
                                        <li>Maximum file size: 100 MB</li>
                                        <li>Supported PDF formats: Standard, some encrypted</li>
                                        <li>Image formats: JPG, PNG, GIF, WEBP, BMP, SVG</li>
                                    </ul>
                                </div>
                                <div class="col-md-6">
                                    <ul>
                                        <li>Text formats: TXT, CSV, HTML, JSON, XML</li>
                                        <li>Local processing (no server upload)</li>
                                        <li>Works offline after first load</li>
                                    </ul>
                                </div>
                            </div>
                            
                            <div class="alert alert-info mt-3">
                                <i class="bi bi-shield-check me-2"></i>
                                <strong>Privacy & Security:</strong> All file processing happens locally in your browser. 
                                Your files never leave your device and are not uploaded to any server.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <a href="https://github.com/lextrack/PDFile" target="_blank" class="btn btn-outline-primary">
                                <i class="bi bi-github me-2"></i>View on GitHub
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const existingModal = document.getElementById('helpModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', helpModal);
        const modal = new bootstrap.Modal(document.getElementById('helpModal'));
        modal.show();
    }

    showQuickSearch() {
        const searchModal = `
            <div class="modal fade" id="searchModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-search me-2"></i>Quick Search
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="text" class="form-control" id="quickSearchInput" 
                                   placeholder="Search tools..." autofocus>
                            <div id="searchResults" class="mt-3"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const existingModal = document.getElementById('searchModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', searchModal);
        const modal = new bootstrap.Modal(document.getElementById('searchModal'));
        
        const searchInput = document.getElementById('quickSearchInput');
        const searchResults = document.getElementById('searchResults');
        
        const tools = [
            { name: 'Merge PDFs', key: 'merge', description: 'Combine multiple PDF files', icon: 'bi-files' },
            { name: 'Split PDF', key: 'split', description: 'Extract specific pages', icon: 'bi-scissors' },
            { name: 'Reorder Pages', key: 'reorder', description: 'Change page order', icon: 'bi-border-outer' },
            { name: 'Compress PDF', key: 'compress', description: 'Reduce file size', icon: 'bi-file-zip' },
            { name: 'Convert to PDF', key: 'convert', description: 'Convert images and text', icon: 'bi-arrow-repeat' },
            { name: 'View PDF', key: 'view', description: 'Preview documents', icon: 'bi-eye' }
        ];
        
        const updateResults = (query) => {
            const filtered = tools.filter(tool => 
                tool.name.toLowerCase().includes(query.toLowerCase()) ||
                tool.description.toLowerCase().includes(query.toLowerCase())
            );
            
            searchResults.innerHTML = filtered.map(tool => `
                <div class="search-result p-3 border rounded mb-2 d-flex align-items-center" 
                     data-tool="${tool.key}" style="cursor: pointer; transition: all 0.2s ease;">
                    <i class="bi ${tool.icon} me-3 text-primary" style="font-size: 1.5rem;"></i>
                    <div>
                        <strong>${tool.name}</strong>
                        <div class="text-muted small">${tool.description}</div>
                    </div>
                </div>
            `).join('');
            
            searchResults.querySelectorAll('.search-result').forEach(result => {
                result.addEventListener('click', () => {
                    const toolKey = result.dataset.tool;
                    modal.hide();
                    this.uiHandler.selectTool(toolKey);
                });
                
                result.addEventListener('mouseenter', () => {
                    result.style.backgroundColor = '#f8f9fa';
                    result.style.transform = 'translateX(5px)';
                });
                
                result.addEventListener('mouseleave', () => {
                    result.style.backgroundColor = '';
                    result.style.transform = '';
                });
            });
        };
        
        searchInput.addEventListener('input', (e) => {
            updateResults(e.target.value);
        });
        
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const firstResult = searchResults.querySelector('.search-result');
                if (firstResult) {
                    firstResult.click();
                }
            }
        });
        
        updateResults('');
        modal.show();
    }

    setupLifecycleHandling() {
        window.addEventListener('beforeunload', (e) => {
            this.cleanup();
            
            if (this.uiHandler.selectedFiles && this.uiHandler.selectedFiles.length > 0) {
                e.preventDefault();
                e.returnValue = 'Are you sure you want to leave? Unprocessed files will be lost.';
                return e.returnValue;
            }
        });
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Application paused');
                this.saveCurrentState();
            } else {
                console.log('Application resumed');
                this.checkForUpdates();
                this.restoreCurrentState();
            }
        });
        
        window.addEventListener('pagehide', () => {
            this.cleanup();
        });
    }

    saveCurrentState() {
        try {
            const state = {
                currentTool: this.uiHandler.currentTool,
                timestamp: Date.now()
            };
            sessionStorage.setItem('pdfManipulator_state', JSON.stringify(state));
        } catch (error) {
            console.warn('Could not save current state:', error);
        }
    }

    restoreCurrentState() {
        try {
            const stateStr = sessionStorage.getItem('pdfManipulator_state');
            if (stateStr) {
                const state = JSON.parse(stateStr);
                const timeDiff = Date.now() - state.timestamp;
                
                if (timeDiff < 30 * 60 * 1000 && state.currentTool) {
                    setTimeout(() => {
                        this.uiHandler.selectTool(state.currentTool);
                    }, 500);
                }
            }
        } catch (error) {
            console.warn('Could not restore current state:', error);
        }
    }

    setupAnalytics() {
        const startTime = performance.now();
        
        window.addEventListener('load', () => {
            const loadTime = performance.now() - startTime;
            console.log(`Load time: ${loadTime.toFixed(2)}ms`);
            
            const metrics = {
                loadTime: loadTime,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                screenResolution: `${screen.width}x${screen.height}`,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                connection: navigator.connection ? {
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink
                } : null
            };
            
            localStorage.setItem('pdfManipulator_metrics', JSON.stringify(metrics));
        });
        
        let errorCount = parseInt(localStorage.getItem('pdfManipulator_errorCount') || '0');
        window.addEventListener('error', () => {
            errorCount++;
            localStorage.setItem('pdfManipulator_errorCount', errorCount.toString());
        });
        
        this.trackPerformance();
    }

    trackPerformance() {
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (entry.entryType === 'navigation') {
                            console.log('Navigation timing:', {
                                domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
                                loadComplete: entry.loadEventEnd - entry.loadEventStart
                            });
                        }
                    });
                });
                
                observer.observe({ entryTypes: ['navigation', 'measure'] });
            } catch (error) {
                console.warn('Performance observer not supported:', error);
            }
        }
    }

    getSystemInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            languages: navigator.languages,
            onLine: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            screenResolution: `${screen.width}x${screen.height}`,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            memory: navigator.deviceMemory || 'unknown',
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt,
                saveData: navigator.connection.saveData
            } : 'unknown',
            storage: {
                localStorage: this.getStorageInfo('localStorage'),
                sessionStorage: this.getStorageInfo('sessionStorage')
            }
        };
    }

    getStorageInfo(type) {
        try {
            const storage = window[type];
            const testKey = 'test';
            storage.setItem(testKey, 'test');
            storage.removeItem(testKey);
            return {
                available: true,
                length: storage.length
            };
        } catch (error) {
            return {
                available: false,
                error: error.message
            };
        }
    }

    restart() {
        this.cleanup();
        
        const keys = Object.keys(localStorage).filter(key => key.startsWith('pdfManipulator_'));
        keys.forEach(key => localStorage.removeItem(key));
        
        sessionStorage.clear();
        
        window.location.reload();
    }

    destroy() {
        this.cleanup();
        
        window.removeEventListener('error', this.handleGlobalError);
        window.removeEventListener('unhandledrejection', this.handleGlobalError);
        window.removeEventListener('beforeunload', this.cleanup);
        document.removeEventListener('visibilitychange', this.setupLifecycleHandling);
        
        this.isInitialized = false;
        
        console.log('PDFile App destroyed');
    }
}

let app;

document.addEventListener('DOMContentLoaded', () => {
    try {
        app = new PDFManipulatorApp();
        app.init();
        
        window.pdfApp = app;
        
        if (window.location.search.includes('debug=true')) {
            window.pdfAppDebug = {
                getSystemInfo: () => app.getSystemInfo(),
                getUsageStats: () => app.getUsageStats(),
                exportConfig: () => app.exportConfig(),
                cleanup: () => app.cleanup(),
                restart: () => app.restart()
            };
            console.log('Debug mode enabled. Use window.pdfAppDebug for debugging.');
        }
        
    } catch (error) {
        console.error('Fatal error initializing application:', error);
        
        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-danger m-3';
        errorMessage.innerHTML = `
            <h4><i class="bi bi-exclamation-triangle me-2"></i>Initialization Error</h4>
            <p>The application could not start properly. This might be due to:</p>
            <ul>
                <li>Incompatible browser version</li>
                <li>Missing required features</li>
                <li>Network connectivity issues</li>
            </ul>
            <button type="button" class="btn btn-outline-danger me-2" onclick="window.location.reload()">
                <i class="bi bi-arrow-clockwise me-1"></i>Reload Page
            </button>
            <button type="button" class="btn btn-outline-secondary" onclick="console.log('Error details:', arguments[0])" 
                    data-error="${encodeURIComponent(error.message)}">
                <i class="bi bi-bug me-1"></i>Show Details
            </button>
        `;
        
        document.body.insertBefore(errorMessage, document.body.firstChild);
    }
});

window.addEventListener('beforeunload', () => {
    if (app && app.isInitialized) {
        app.cleanup();
    }
});

window.addEventListener('load', () => {
    if ('serviceWorker' in navigator && app) {
        navigator.serviceWorker.ready.then(() => {
            console.log('Service Worker is ready');
        });
    }
});

window.Utils = Utils;
window.PDFOperations = PDFOperations;
window.UIHandler = UIHandler;