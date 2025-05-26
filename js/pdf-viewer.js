class PDFViewer {
    constructor(uiHandler) {
        this.uiHandler = uiHandler;
        this.createModalStructure();
        this.setupWheelZoom();
    }

    createModalStructure() {
        if (!document.getElementById('pdfViewerModal')) {
            const modalHTML = `
                <div class="modal fade" id="pdfViewerModal" tabindex="-1" aria-labelledby="pdfViewerModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-fullscreen-lg-down modal-xl">
                        <div class="modal-content">
                            <div class="modal-header bg-dark text-white">
                                <h5 class="modal-title" id="pdfViewerModalLabel">
                                    <i class="bi bi-file-earmark-pdf-fill me-2"></i>
                                    <span id="modalFileName">Document Viewer</span>
                                </h5>
                                <div class="modal-header-controls d-flex align-items-center">
                                    <div class="zoom-controls me-3">
                                        <button class="btn btn-outline-light btn-sm" id="modalZoomOut" title="Zoom Out (-)">
                                            <i class="bi bi-dash"></i>
                                        </button>
                                        <button class="btn btn-outline-light btn-sm" id="modalZoomReset" title="Fit to Width (0)">
                                            <i class="bi bi-arrows-angle-expand"></i>
                                        </button>
                                        <span class="mx-2 text-light" id="modalZoomLevel">100%</span>
                                        <button class="btn btn-outline-light btn-sm" id="modalZoomIn" title="Zoom In (+)">
                                            <i class="bi bi-plus"></i>
                                        </button>
                                    </div>
                                    <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal" aria-label="Close">
                                        <i class="bi bi-x-lg"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="modal-body p-0">
                                <div id="modalPdfViewer" class="pdf-modal-viewer">
                                    <!-- Content will be inserted here -->
                                </div>
                            </div>
                            <div class="modal-footer bg-light">
                                <div class="pdf-controls d-flex justify-content-center align-items-center w-100">
                                    <button class="btn btn-outline-secondary" id="modalPrevPage" disabled>
                                        <i class="bi bi-chevron-left"></i> Previous
                                    </button>
                                    <span class="page-info mx-3" id="modalPageInfo">Loading...</span>
                                    <button class="btn btn-outline-secondary" id="modalNextPage" disabled>
                                        Next <i class="bi bi-chevron-right"></i>
                                    </button>
                                    <div class="ms-auto">
                                        <button class="btn btn-outline-primary" id="modalDownloadBtn" title="Download PDF">
                                            <i class="bi bi-download"></i> Download
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            this.setupModalKeyboardShortcuts();
        }
    }

    async showPDFViewer(file, specificPage = null) {
        try {
            const modal = new bootstrap.Modal(document.getElementById('pdfViewerModal'), {
                backdrop: 'static',
                keyboard: true
            });
            
            document.getElementById('modalFileName').textContent = file.name;
            
            const modalViewer = document.getElementById('modalPdfViewer');
            modalViewer.innerHTML = `
                <div class="d-flex justify-content-center align-items-center" style="height: 60vh;">
                    <div class="text-center">
                        <div class="spinner-border text-primary mb-3" role="status">
                            <span class="visually-hidden">Loading PDF...</span>
                        </div>
                        <p class="text-muted">Loading PDF document...</p>
                    </div>
                </div>
            `;

            modal.show();

            if (typeof pdfjsLib === 'undefined') {
                throw new Error('PDF.js not available');
            }

            const arrayBuffer = await Utils.fileToArrayBuffer(file);
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            this.uiHandler.currentPDFDoc = await loadingTask.promise;
            this.uiHandler.totalPages = this.uiHandler.currentPDFDoc.numPages;
            this.uiHandler.currentPageNum = specificPage || 1;

            modalViewer.innerHTML = `
                <div class="pdf-canvas-container" id="pdfCanvasContainer" style="
                    overflow: auto; 
                    height: calc(100vh - 200px); 
                    background: #f8f9fa;
                    position: relative;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    padding: 20px;
                ">
                    <canvas id="modalPdfCanvas" class="pdf-canvas" style="
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                        border-radius: 8px;
                        background: white;
                        transition: transform 0.2s ease;
                        cursor: grab;
                        max-width: none;
                        max-height: none;
                    "></canvas>
                </div>
            `;

            this.setupModalPDFControls(file);
            this.setupCanvasDragScroll();
            
            await this.initializeOptimalZoom();
            
        } catch (error) {
            console.error('Error loading PDF:', error);
            const modalViewer = document.getElementById('modalPdfViewer');
            modalViewer.innerHTML = `
                <div class="d-flex justify-content-center align-items-center" style="height: 60vh;">
                    <div class="text-center">
                        <i class="bi bi-exclamation-triangle text-warning" style="font-size: 4rem;"></i>
                        <h5 class="mt-3 text-danger">Error loading PDF</h5>
                        <p class="text-muted">Could not display the PDF file.</p>
                        <p class="small text-muted">File: ${file.name}</p>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            `;
        }
    }

    async initializeOptimalZoom() {
        if (!this.uiHandler.currentPDFDoc) return;
        
        try {
            const page = await this.uiHandler.currentPDFDoc.getPage(this.uiHandler.currentPageNum);
            const viewport = page.getViewport({ scale: 1.0 });
            const container = document.getElementById('pdfCanvasContainer');
            const containerWidth = container.clientWidth - 40;
            const containerHeight = container.clientHeight - 40;
            const scaleForWidth = containerWidth / viewport.width;
            const scaleForHeight = containerHeight / viewport.height;
            
            this.uiHandler.pdfScale = Math.min(scaleForWidth, scaleForHeight, 2.0);
            
            if (this.uiHandler.pdfScale < 0.5) {
                this.uiHandler.pdfScale = 0.5;
            }
            
            await this.renderModalPDFPage();
            
        } catch (error) {
            console.error('Error initializing optimal zoom:', error);
            this.uiHandler.pdfScale = 1.0;
            await this.renderModalPDFPage();
        }
    }

    setupCanvasDragScroll() {
        const canvas = document.getElementById('modalPdfCanvas');
        const container = document.getElementById('pdfCanvasContainer');
        
        if (!canvas || !container) return;
        
        let isDragging = false;
        let startX, startY, scrollLeft, scrollTop;
        let dragStartTime = 0;
        let hasMoved = false;
        let animationFrame;
        
        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            
            const needsScrollX = container.scrollWidth > container.clientWidth;
            const needsScrollY = container.scrollHeight > container.clientHeight;
            
            if (!needsScrollX && !needsScrollY) return;
            
            isDragging = true;
            hasMoved = false;
            dragStartTime = Date.now();
            canvas.style.cursor = 'grabbing';
            canvas.classList.add('dragging');
            
            startX = e.clientX;
            startY = e.clientY;
            scrollLeft = container.scrollLeft;
            scrollTop = container.scrollTop;
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const moveThreshold = 3;
            if (!hasMoved && (Math.abs(deltaX) > moveThreshold || Math.abs(deltaY) > moveThreshold)) {
                hasMoved = true;
            }
            
            if (hasMoved) {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }
                
                animationFrame = requestAnimationFrame(() => {
                    const sensitivity = 1.2;
                    const newScrollLeft = scrollLeft - (deltaX * sensitivity);
                    const newScrollTop = scrollTop - (deltaY * sensitivity);
                    const maxScrollLeft = container.scrollWidth - container.clientWidth;
                    const maxScrollTop = container.scrollHeight - container.clientHeight;
                    const clampedLeft = Math.max(0, Math.min(maxScrollLeft, newScrollLeft));
                    const clampedTop = Math.max(0, Math.min(maxScrollTop, newScrollTop));
                    
                    container.scrollTo({
                        left: clampedLeft,
                        top: clampedTop,
                        behavior: 'auto'
                    });
                });
            }
        });
        
        document.addEventListener('mouseup', (e) => {
            if (isDragging) {
                isDragging = false;
                canvas.style.cursor = 'grab';
                canvas.classList.remove('dragging');
                
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
                }
                
                const dragDuration = Date.now() - dragStartTime;
                if (!hasMoved && dragDuration < 200) {
                    console.debug('Quick click detected, not a drag');
                }
            }
        });
        
        canvas.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });
        
        let initialTouchDistance = 0;
        let initialScale = 1;
        let touchStartTime = 0;
        let touchHasMoved = false;
        let touchAnimationFrame;
        
        canvas.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            touchHasMoved = false;
            
            if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                initialTouchDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                initialScale = this.uiHandler.pdfScale;
                e.preventDefault();
            } else if (e.touches.length === 1) {
                const needsScrollX = container.scrollWidth > container.clientWidth;
                const needsScrollY = container.scrollHeight > container.clientHeight;
                
                if (needsScrollX || needsScrollY) {
                    const touch = e.touches[0];
                    startX = touch.clientX;
                    startY = touch.clientY;
                    scrollLeft = container.scrollLeft;
                    scrollTop = container.scrollTop;
                    isDragging = true;
                }
            }
        });
        
        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                
                const scale = initialScale * (currentDistance / initialTouchDistance);
                
                if (scale >= 0.3 && scale <= 5.0) {
                    this.uiHandler.pdfScale = scale;
                    this.renderModalPDFPage();
                    document.getElementById('modalZoomLevel').textContent = `${Math.round(scale * 100)}%`;
                }
                
                e.preventDefault();
            } else if (e.touches.length === 1 && isDragging) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - startX;
                const deltaY = touch.clientY - startY;
                
                if (!touchHasMoved && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
                    touchHasMoved = true;
                }
                
                if (touchHasMoved) {
                    if (touchAnimationFrame) {
                        cancelAnimationFrame(touchAnimationFrame);
                    }
                    
                    touchAnimationFrame = requestAnimationFrame(() => {
                        const touchSensitivity = 1.0;
                        const newScrollLeft = scrollLeft - (deltaX * touchSensitivity);
                        const newScrollTop = scrollTop - (deltaY * touchSensitivity);
                        
                        const maxScrollLeft = container.scrollWidth - container.clientWidth;
                        const maxScrollTop = container.scrollHeight - container.clientHeight;
                        
                        const clampedLeft = Math.max(0, Math.min(maxScrollLeft, newScrollLeft));
                        const clampedTop = Math.max(0, Math.min(maxScrollTop, newScrollTop));
                        
                        container.scrollTo({
                            left: clampedLeft,
                            top: clampedTop,
                            behavior: 'auto'
                        });
                    });
                    
                    e.preventDefault();
                }
            }
        });
        
        canvas.addEventListener('touchend', (e) => {
            isDragging = false;
            initialTouchDistance = 0;
            
            if (touchAnimationFrame) {
                cancelAnimationFrame(touchAnimationFrame);
                touchAnimationFrame = null;
            }
            
            const touchDuration = Date.now() - touchStartTime;
            if (!touchHasMoved && touchDuration < 300) {
                console.debug('Quick tap detected');
            }
        });
        
        canvas.addEventListener('mouseenter', () => {
            if (!isDragging) {
                const needsScroll = container.scrollWidth > container.clientWidth || 
                                  container.scrollHeight > container.clientHeight;
                canvas.style.cursor = needsScroll ? 'grab' : 'default';
            }
        });
        
        canvas.addEventListener('selectstart', (e) => {
            if (isDragging || hasMoved) {
                e.preventDefault();
            }
        });
    }

    setupWheelZoom() {
        document.addEventListener('wheel', (e) => {
            const modal = document.getElementById('pdfViewerModal');
            if (!modal.classList.contains('show')) return;
            
            const canvas = document.getElementById('modalPdfCanvas');
            if (!canvas) return;
            
            const rect = canvas.getBoundingClientRect();
            const isOverCanvas = e.clientX >= rect.left && e.clientX <= rect.right &&
                               e.clientY >= rect.top && e.clientY <= rect.bottom;
            
            if (!isOverCanvas) return;
            
            e.preventDefault();
            
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = this.uiHandler.pdfScale * zoomFactor;
            
            if (newScale >= 0.3 && newScale <= 5.0) {
                this.uiHandler.pdfScale = newScale;
                this.renderModalPDFPage();
                document.getElementById('modalZoomLevel').textContent = `${Math.round(newScale * 100)}%`;
            }
        }, { passive: false });
    }

    setupModalPDFControls(file) {
        const prevBtn = document.getElementById('modalPrevPage');
        const nextBtn = document.getElementById('modalNextPage');
        const zoomInBtn = document.getElementById('modalZoomIn');
        const zoomOutBtn = document.getElementById('modalZoomOut');
        const zoomResetBtn = document.getElementById('modalZoomReset');
        const downloadBtn = document.getElementById('modalDownloadBtn');

        [prevBtn, nextBtn, zoomInBtn, zoomOutBtn, zoomResetBtn, downloadBtn].forEach(btn => {
            if (btn) btn.replaceWith(btn.cloneNode(true));
        });

        const newPrevBtn = document.getElementById('modalPrevPage');
        const newNextBtn = document.getElementById('modalNextPage');
        const newZoomInBtn = document.getElementById('modalZoomIn');
        const newZoomOutBtn = document.getElementById('modalZoomOut');
        const newZoomResetBtn = document.getElementById('modalZoomReset');
        const newDownloadBtn = document.getElementById('modalDownloadBtn');

        newPrevBtn?.addEventListener('click', () => {
            if (this.uiHandler.currentPageNum > 1) {
                this.uiHandler.currentPageNum--;
                this.renderModalPDFPage();
            }
        });

        newNextBtn?.addEventListener('click', () => {
            if (this.uiHandler.currentPageNum < this.uiHandler.totalPages) {
                this.uiHandler.currentPageNum++;
                this.renderModalPDFPage();
            }
        });

        newZoomInBtn?.addEventListener('click', () => {
            if (this.uiHandler.pdfScale < 5.0) {
                this.uiHandler.pdfScale *= 1.25;
                this.renderModalPDFPage();
                document.getElementById('modalZoomLevel').textContent = `${Math.round(this.uiHandler.pdfScale * 100)}%`;
            }
        });

        newZoomOutBtn?.addEventListener('click', () => {
            if (this.uiHandler.pdfScale > 0.3) {
                this.uiHandler.pdfScale *= 0.8;
                this.renderModalPDFPage();
                document.getElementById('modalZoomLevel').textContent = `${Math.round(this.uiHandler.pdfScale * 100)}%`;
            }
        });

        newZoomResetBtn?.addEventListener('click', () => {
            this.initializeOptimalZoom();
        });

        newDownloadBtn?.addEventListener('click', () => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(file);
            link.download = file.name;
            link.click();
            URL.revokeObjectURL(link.href);
        });

        document.getElementById('modalZoomLevel').textContent = `${Math.round(this.uiHandler.pdfScale * 100)}%`;
    }

    async renderModalPDFPage() {
        if (!this.uiHandler.currentPDFDoc) return;

        try {
            if (this.uiHandler.renderTask) {
                this.uiHandler.renderTask.cancel();
            }

            const page = await this.uiHandler.currentPDFDoc.getPage(this.uiHandler.currentPageNum);
            const canvas = document.getElementById('modalPdfCanvas');
            const container = document.getElementById('pdfCanvasContainer');
            const context = canvas.getContext('2d');

            const viewport = page.getViewport({ scale: this.uiHandler.pdfScale });
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            context.clearRect(0, 0, canvas.width, canvas.height);

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            this.uiHandler.renderTask = page.render(renderContext);
            await this.uiHandler.renderTask.promise;

            this.updateCanvasCursor();
            
            this.updateModalPDFControls();

        } catch (error) {
            if (error.name !== 'RenderingCancelledException') {
                console.error('Error rendering page:', error);
            }
        }
    }

    updateCanvasCursor() {
        const canvas = document.getElementById('modalPdfCanvas');
        const container = document.getElementById('pdfCanvasContainer');
        
        if (!canvas || !container) return;
        
        const needsScrollX = container.scrollWidth > container.clientWidth;
        const needsScrollY = container.scrollHeight > container.clientHeight;
        const needsScroll = needsScrollX || needsScrollY;
        
        canvas.classList.toggle('can-drag', needsScroll);
        
        setTimeout(() => {
            const stillNeedsScrollX = container.scrollWidth > container.clientWidth;
            const stillNeedsScrollY = container.scrollHeight > container.clientHeight;
            const stillNeedsScroll = stillNeedsScrollX || stillNeedsScrollY;
            
            canvas.classList.toggle('can-drag', stillNeedsScroll);
        }, 100);
    }

    updateModalPDFControls() {
        const prevBtn = document.getElementById('modalPrevPage');
        const nextBtn = document.getElementById('modalNextPage');
        const pageInfo = document.getElementById('modalPageInfo');
        const zoomLevel = document.getElementById('modalZoomLevel');

        if (prevBtn) prevBtn.disabled = this.uiHandler.currentPageNum <= 1;
        if (nextBtn) nextBtn.disabled = this.uiHandler.currentPageNum >= this.uiHandler.totalPages;
        if (pageInfo) pageInfo.textContent = `Page ${this.uiHandler.currentPageNum} of ${this.uiHandler.totalPages}`;
        if (zoomLevel) zoomLevel.textContent = `${Math.round(this.uiHandler.pdfScale * 100)}%`;
    }

    setupModalKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('pdfViewerModal');
            if (!modal.classList.contains('show')) return;

            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    if (this.uiHandler.currentPageNum > 1) {
                        this.uiHandler.currentPageNum--;
                        this.renderModalPDFPage();
                    }
                    break;
                    
                case 'ArrowRight':
                    e.preventDefault();
                    if (this.uiHandler.currentPageNum < this.uiHandler.totalPages) {
                        this.uiHandler.currentPageNum++;
                        this.renderModalPDFPage();
                    }
                    break;
                    
                case '+':
                case '=':
                    e.preventDefault();
                    if (this.uiHandler.pdfScale < 5.0) {
                        this.uiHandler.pdfScale *= 1.25;
                        this.renderModalPDFPage();
                        document.getElementById('modalZoomLevel').textContent = `${Math.round(this.uiHandler.pdfScale * 100)}%`;
                    }
                    break;
                    
                case '-':
                    e.preventDefault();
                    if (this.uiHandler.pdfScale > 0.3) {
                        this.uiHandler.pdfScale *= 0.8;
                        this.renderModalPDFPage();
                        document.getElementById('modalZoomLevel').textContent = `${Math.round(this.uiHandler.pdfScale * 100)}%`;
                    }
                    break;
                    
                case '0':
                    e.preventDefault();
                    this.initializeOptimalZoom();
                    break;
                    
                case 'Escape':
                    const modalInstance = bootstrap.Modal.getInstance(modal);
                    if (modalInstance) {
                        modalInstance.hide();
                    }
                    break;
            }
        });
    }
    showImageViewer(file) {
        const modal = new bootstrap.Modal(document.getElementById('pdfViewerModal'), {
            backdrop: 'static',
            keyboard: true
        });
        
        document.getElementById('modalFileName').textContent = file.name;
        
        const modalViewer = document.getElementById('modalPdfViewer');
        const url = URL.createObjectURL(file);
        
        modalViewer.innerHTML = `
            <div class="image-modal-viewer text-center p-4" style="overflow: auto; max-height: calc(100vh - 200px); background: #f8f9fa;">
                <img src="${url}" alt="${file.name}" style="max-width: 100%; max-height: 80vh; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
            </div>
        `;
        
        document.querySelector('.modal-footer .pdf-controls').innerHTML = `
            <button class="btn btn-outline-primary" onclick="
                const link = document.createElement('a');
                link.href = '${url}';
                link.download = '${file.name}';
                link.click();
            ">
                <i class="bi bi-download"></i> Download Image
            </button>
        `;
        
        modal.show();
        
        document.getElementById('pdfViewerModal').addEventListener('hidden.bs.modal', () => {
            URL.revokeObjectURL(url);
        }, { once: true });
    }

    async showTextViewer(file) {
        const modal = new bootstrap.Modal(document.getElementById('pdfViewerModal'), {
            backdrop: 'static',
            keyboard: true
        });
        
        document.getElementById('modalFileName').textContent = file.name;
        
        const modalViewer = document.getElementById('modalPdfViewer');
        
        try {
            const text = await file.text();
            modalViewer.innerHTML = `
                <div class="text-modal-viewer p-4" style="overflow: auto; max-height: calc(100vh - 200px); background: #fff;">
                    <pre style="white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.6; margin: 0; color: #333;">${text}</pre>
                </div>
            `;
        } catch (error) {
            modalViewer.innerHTML = `
                <div class="d-flex justify-content-center align-items-center" style="height: 60vh;">
                    <div class="text-center">
                        <i class="bi bi-exclamation-triangle text-warning" style="font-size: 4rem;"></i>
                        <h5 class="mt-3 text-danger">Error loading text file</h5>
                        <p class="text-muted">Could not read the text file content.</p>
                    </div>
                </div>
            `;
        }
        
        document.querySelector('.modal-footer .pdf-controls').innerHTML = `
            <button class="btn btn-outline-primary" onclick="
                const link = document.createElement('a');
                link.href = URL.createObjectURL(arguments[0]);
                link.download = '${file.name}';
                link.click();
                URL.revokeObjectURL(link.href);
            " onclick="this.onclick(arguments[0])">
                <i class="bi bi-download"></i> Download Text
            </button>
        `;
        
        modal.show();
    }
}