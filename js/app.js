class PDFManipulatorApp {
    constructor() {
        this.uiHandler = new UIHandler();
        this.pdfOperations = new PDFOperations();
        this.isInitialized = false;
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
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration.scope);
                })
                .catch(error => {
                    console.log('Error registering Service Worker:', error);
                });
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
            if (event.target !== window) {
                console.error('Resource loading error:', event.target.src || event.target.href);
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
            }
        }
        
        Utils.showToast(message, 'error');
    }

    showWelcomeMessage() {
        const hasVisited = localStorage.getItem('pdfManipulator_hasVisited');
        
        if (!hasVisited) {
            setTimeout(() => {
                Utils.showToast('Welcome to PDFile! Select a tool to get started.', 'info');
                localStorage.setItem('pdfManipulator_hasVisited', 'true');
            }, 1000);
        }
    }

    getUsageStats() {
        const stats = {
            filesProcessed: parseInt(localStorage.getItem('pdfManipulator_filesProcessed') || '0'),
            toolsUsed: JSON.parse(localStorage.getItem('pdfManipulator_toolsUsed') || '{}'),
            lastUsed: localStorage.getItem('pdfManipulator_lastUsed'),
            version: '1.0.0'
        };
        
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
        
        console.log('Cleanup completed');
    }

    exportConfig() {
        return {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            stats: this.getUsageStats()
        };
    }

    importConfig(config) {
        if (!config || !config.version) {
            throw new Error('Invalid configuration');
        }
        
        Utils.showToast('Configuration imported successfully', 'success');
    }

    async checkForUpdates() {
        try {
            const currentVersion = '1.0.0';
            const latestVersion = currentVersion;
            
            if (currentVersion !== latestVersion) {
                Utils.showToast(`New version available: ${latestVersion}`, 'info');
                return true;
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
            } else {
                Utils.showToast('No internet connection. Some features may not be available.', 'warning');
            }
        };
        
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
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
                            <h6>Available tools:</h6>
                            <ul>
                                <li><strong>Merge PDFs:</strong> Combine multiple PDF files into one</li>
                                <li><strong>Split PDF:</strong> Extract specific pages from a PDF</li>
                                <li><strong>Reorder pages:</strong> Change the order of pages</li>
                                <li><strong>Compress PDF:</strong> Compress PDFs</li>
                                <li><strong>Convert to PDF:</strong> Convert images and text to PDF</li>
                                <li><strong>View PDF:</strong> Preview documents</li>
                            </ul>
                            
                            <h6>Keyboard shortcuts:</h6>
                            <ul>
                                <li><kbd>Ctrl/Cmd + S</kbd> - Process files</li>
                                <li><kbd>Ctrl/Cmd + h</kbd> - Show this help</li>
                                <li><kbd>Escape</kbd> - Cancel/Go back</li>
                                <li><kbd>Delete</kbd> - Remove selected element</li>
                            </ul>
                            
                            <h6>Limits:</h6>
                            <ul>
                                <li>Maximum file size: 50 MB</li>
                                <li>Supported formats: PDF, JPG, PNG, GIF, WEBP, BMP, TIFF, SVG, TXT, CSV, HTML, MD, JSON, XML, RTF</li>
                                <li>Local processing (no server upload)</li>
                            </ul>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
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
                                <i class="bi bi-search me-2"></i>Quick search
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="text" class="form-control" id="quickSearchInput" 
                                   placeholder="Search tool..." autofocus>
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
            { name: 'Merge PDFs', key: 'merge', description: 'Combine multiple PDF files' },
            { name: 'Split PDF', key: 'split', description: 'Extract specific pages' },
            { name: 'Reorder pages', key: 'reorder', description: 'Change page order' },
            { name: 'Compress PDF', key: 'compress', description: 'Compress PDFs files' },
            { name: 'Convert to PDF', key: 'convert', description: 'Convert images and text' },
            { name: 'View PDF', key: 'view', description: 'Preview documents' }
        ];
        
        const updateResults = (query) => {
            const filtered = tools.filter(tool => 
                tool.name.toLowerCase().includes(query.toLowerCase()) ||
                tool.description.toLowerCase().includes(query.toLowerCase())
            );
            
            searchResults.innerHTML = filtered.map(tool => `
                <div class="search-result p-2 border rounded mb-2" data-tool="${tool.key}" 
                     style="cursor: pointer;">
                    <strong>${tool.name}</strong>
                    <div class="text-muted small">${tool.description}</div>
                </div>
            `).join('');
            
            searchResults.querySelectorAll('.search-result').forEach(result => {
                result.addEventListener('click', () => {
                    const toolKey = result.dataset.tool;
                    modal.hide();
                    this.uiHandler.selectTool(toolKey);
                });
            });
        };
        
        searchInput.addEventListener('input', (e) => {
            updateResults(e.target.value);
        });
        
        updateResults('');
        modal.show();
    }

    setupLifecycleHandling() {
        window.addEventListener('beforeunload', (e) => {
            this.cleanup();
            
            if (this.uiHandler.selectedFiles.length > 0) {
                e.preventDefault();
                e.returnValue = 'Are you sure you want to leave? Unprocessed files will be lost.';
                return e.returnValue;
            }
        });
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Application paused');
            } else {
                console.log('Application resumed');
                this.checkForUpdates();
            }
        });
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
                language: navigator.language
            };
            
            localStorage.setItem('pdfManipulator_metrics', JSON.stringify(metrics));
        });
        
        let errorCount = 0;
        window.addEventListener('error', () => {
            errorCount++;
            localStorage.setItem('pdfManipulator_errorCount', errorCount.toString());
        });
    }

    getSystemInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            onLine: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled,
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            memory: navigator.deviceMemory || 'unknown',
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown'
        };
    }

    restart() {
        this.cleanup();
        
        const keys = Object.keys(localStorage).filter(key => key.startsWith('pdfManipulator_'));
        keys.forEach(key => localStorage.removeItem(key));
        
        window.location.reload();
    }

    destroy() {
        this.cleanup();
        
        window.removeEventListener('error', this.handleGlobalError);
        window.removeEventListener('unhandledrejection', this.handleGlobalError);
        
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
        
    } catch (error) {
        console.error('Fatal error initializing application:', error);
        
        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-danger m-3';
        errorMessage.innerHTML = `
            <h4>Initialization Error</h4>
            <p>The application could not start properly. Please reload the page.</p>
            <button type="button" class="btn btn-outline-danger" onclick="window.location.reload()">
                Reload page
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

window.Utils = Utils;
window.PDFOperations = PDFOperations;
window.UIHandler = UIHandler;