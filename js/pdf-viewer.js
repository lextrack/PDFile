class PDFViewer {
    constructor(uiHandler) {
        this.uiHandler = uiHandler;
        this.createModalStructure();
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
                                        <button class="btn btn-outline-light btn-sm" id="modalZoomOut" title="Zoom Out">
                                            <i class="bi bi-dash"></i>
                                        </button>
                                        <span class="mx-2 text-light" id="modalZoomLevel">150%</span>
                                        <button class="btn btn-outline-light btn-sm" id="modalZoomIn" title="Zoom In">
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
                <div class="pdf-canvas-container text-center p-3" style="overflow: auto; max-height: calc(100vh - 200px); background: #f8f9fa;">
                    <canvas id="modalPdfCanvas" class="pdf-canvas shadow-lg" style="border-radius: 8px; max-width: 100%;"></canvas>
                </div>
            `;

            this.setupModalPDFControls(file);
            await this.renderModalPDFPage();
            
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

    setupModalPDFControls(file) {
        const prevBtn = document.getElementById('modalPrevPage');
        const nextBtn = document.getElementById('modalNextPage');
        const zoomInBtn = document.getElementById('modalZoomIn');
        const zoomOutBtn = document.getElementById('modalZoomOut');
        const downloadBtn = document.getElementById('modalDownloadBtn');

        prevBtn.replaceWith(prevBtn.cloneNode(true));
        nextBtn.replaceWith(nextBtn.cloneNode(true));
        zoomInBtn.replaceWith(zoomInBtn.cloneNode(true));
        zoomOutBtn.replaceWith(zoomOutBtn.cloneNode(true));
        downloadBtn.replaceWith(downloadBtn.cloneNode(true));

        const newPrevBtn = document.getElementById('modalPrevPage');
        const newNextBtn = document.getElementById('modalNextPage');
        const newZoomInBtn = document.getElementById('modalZoomIn');
        const newZoomOutBtn = document.getElementById('modalZoomOut');
        const newDownloadBtn = document.getElementById('modalDownloadBtn');

        newPrevBtn.addEventListener('click', () => {
            if (this.uiHandler.currentPageNum > 1) {
                this.uiHandler.currentPageNum--;
                this.renderModalPDFPage();
            }
        });

        newNextBtn.addEventListener('click', () => {
            if (this.uiHandler.currentPageNum < this.uiHandler.totalPages) {
                this.uiHandler.currentPageNum++;
                this.renderModalPDFPage();
            }
        });

        newZoomInBtn.addEventListener('click', () => {
            if (this.uiHandler.pdfScale < 3) {
                this.uiHandler.pdfScale += 0.25;
                this.renderModalPDFPage();
                document.getElementById('modalZoomLevel').textContent = `${Math.round(this.uiHandler.pdfScale * 100)}%`;
            }
        });

        newZoomOutBtn.addEventListener('click', () => {
            if (this.uiHandler.pdfScale > 0.5) {
                this.uiHandler.pdfScale -= 0.25;
                this.renderModalPDFPage();
                document.getElementById('modalZoomLevel').textContent = `${Math.round(this.uiHandler.pdfScale * 100)}%`;
            }
        });

        newDownloadBtn.addEventListener('click', () => {
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

            this.updateModalPDFControls();

        } catch (error) {
            if (error.name !== 'RenderingCancelledException') {
                console.error('Error rendering page:', error);
            }
        }
    }

    updateModalPDFControls() {
        const prevBtn = document.getElementById('modalPrevPage');
        const nextBtn = document.getElementById('modalNextPage');
        const pageInfo = document.getElementById('modalPageInfo');

        if (prevBtn) prevBtn.disabled = this.uiHandler.currentPageNum <= 1;
        if (nextBtn) nextBtn.disabled = this.uiHandler.currentPageNum >= this.uiHandler.totalPages;
        if (pageInfo) pageInfo.textContent = `Page ${this.uiHandler.currentPageNum} of ${this.uiHandler.totalPages}`;
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
                    if (this.uiHandler.pdfScale < 3) {
                        this.uiHandler.pdfScale += 0.25;
                        this.renderModalPDFPage();
                        document.getElementById('modalZoomLevel').textContent = `${Math.round(this.uiHandler.pdfScale * 100)}%`;
                    }
                    break;
                case '-':
                    e.preventDefault();
                    if (this.uiHandler.pdfScale > 0.5) {
                        this.uiHandler.pdfScale -= 0.25;
                        this.renderModalPDFPage();
                        document.getElementById('modalZoomLevel').textContent = `${Math.round(this.uiHandler.pdfScale * 100)}%`;
                    }
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

    async showPDFViewerInline(file) {
        const viewer = document.getElementById('pdfViewer');
        viewer.style.display = 'block';
        
        viewer.innerHTML = `
            <div class="pdf-controls">
                <button class="btn btn-outline-secondary" id="prevPage" disabled>
                    <i class="bi bi-chevron-left"></i>
                </button>
                <span class="page-info" id="pageInfo">Loading...</span>
                <button class="btn btn-outline-secondary" id="nextPage" disabled>
                    <i class="bi bi-chevron-right"></i>
                </button>
                <div class="zoom-controls ms-3">
                    <button class="btn btn-outline-secondary btn-sm" id="zoomOut">
                        <i class="bi bi-dash"></i>
                    </button>
                    <span class="mx-2" id="zoomLevel">${Math.round(this.uiHandler.pdfScale * 100)}%</span>
                    <button class="btn btn-outline-secondary btn-sm" id="zoomIn">
                        <i class="bi bi-plus"></i>
                    </button>
                </div>
            </div>
            <div class="pdf-canvas-container" style="text-align: center; padding: 20px; overflow: auto; max-height: 600px;">
                <canvas id="pdfCanvas" class="pdf-canvas"></canvas>
            </div>
        `;

        try {
            if (typeof pdfjsLib === 'undefined') {
                throw new Error('PDF.js not available');
            }

            const arrayBuffer = await Utils.fileToArrayBuffer(file);
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            this.uiHandler.currentPDFDoc = await loadingTask.promise;
            this.uiHandler.totalPages = this.uiHandler.currentPDFDoc.numPages;
            this.uiHandler.currentPageNum = 1;

            this.setupPDFControls();
            await this.renderPDFPage();
            
            viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (error) {
            console.error('Error loading PDF:', error);
            viewer.innerHTML = `
                <div class="pdf-error text-center p-4">
                    <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                    <h5 class="mt-3">Error loading PDF</h5>
                    <p class="text-muted">Could not display file preview.</p>
                    <p class="small text-muted">File: ${file.name}</p>
                </div>
            `;
        }
    }

    setupPDFControls() {
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');

        prevBtn?.addEventListener('click', () => {
            if (this.uiHandler.currentPageNum > 1) {
                this.uiHandler.currentPageNum--;
                this.renderPDFPage();
            }
        });

        nextBtn?.addEventListener('click', () => {
            if (this.uiHandler.currentPageNum < this.uiHandler.totalPages) {
                this.uiHandler.currentPageNum++;
                this.renderPDFPage();
            }
        });

        zoomInBtn?.addEventListener('click', () => {
            if (this.uiHandler.pdfScale < 3) {
                this.uiHandler.pdfScale += 0.25;
                this.renderPDFPage();
                document.getElementById('zoomLevel').textContent = `${Math.round(this.uiHandler.pdfScale * 100)}%`;
            }
        });

        zoomOutBtn?.addEventListener('click', () => {
            if (this.uiHandler.pdfScale > 0.5) {
                this.uiHandler.pdfScale -= 0.25;
                this.renderPDFPage();
                document.getElementById('zoomLevel').textContent = `${Math.round(this.uiHandler.pdfScale * 100)}%`;
            }
        });
    }

    async renderPDFPage() {
        if (!this.uiHandler.currentPDFDoc) return;

        try {
            if (this.uiHandler.renderTask) {
                this.uiHandler.renderTask.cancel();
            }

            const page = await this.uiHandler.currentPDFDoc.getPage(this.uiHandler.currentPageNum);
            const canvas = document.getElementById('pdfCanvas');
            const context = canvas.getContext('2d');

            const viewport = page.getViewport({ scale: this.uiHandler.pdfScale });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            this.uiHandler.renderTask = page.render(renderContext);
            await this.uiHandler.renderTask.promise;

            this.updatePDFControls();

        } catch (error) {
            if (error.name !== 'RenderingCancelledException') {
                console.error('Error rendering page:', error);
            }
        }
    }

    updatePDFControls() {
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');

        if (prevBtn) prevBtn.disabled = this.uiHandler.currentPageNum <= 1;
        if (nextBtn) nextBtn.disabled = this.uiHandler.currentPageNum >= this.uiHandler.totalPages;
        if (pageInfo) pageInfo.textContent = `Page ${this.uiHandler.currentPageNum} of ${this.uiHandler.totalPages}`;
    }
}