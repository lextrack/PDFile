class PageReorderHandler {
    constructor(uiHandler) {
        this.uiHandler = uiHandler;
        this.draggedIndex = -1;
        this.dropTargetIndex = -1;
        this.isDragging = false;
        this.draggedElement = null;
    }

    async displayPDFPages(file) {
        const fileList = document.getElementById('fileList');
        
        try {
            const instructionDiv = document.createElement('div');
            instructionDiv.className = 'merge-instructions alert alert-info fade-in';
            instructionDiv.innerHTML = `
                <i class="bi bi-arrows-move me-2"></i>
                <strong>Drag pages to change their order</strong>
                <br><small>The PDF will be regenerated with the new page order</small>
            `;
            fileList.appendChild(instructionDiv);

            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'text-center p-4';
            loadingDiv.innerHTML = `
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading pages...</span>
                </div>
                <p class="mt-2 text-muted">Processing PDF pages...</p>
            `;
            fileList.appendChild(loadingDiv);

            const arrayBuffer = await Utils.fileToArrayBuffer(file);
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDoc = await loadingTask.promise;
            
            loadingDiv.remove();
            
            this.uiHandler.pdfPages = [];
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const pageItem = await this.createPageItem(pdfDoc, i, file);
                fileList.appendChild(pageItem);
                this.uiHandler.pdfPages.push(i);
            }
            
            this.setupPageDragAndDrop();
            
        } catch (error) {
            console.error('Error loading pages:', error);
            fileList.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Error loading PDF pages. 
                    <br><small>Make sure the file is a valid PDF.</small>
                </div>
            `;
            Utils.showToast('Error loading PDF pages', 'error');
        }
    }

    async createPageItem(pdfDoc, pageNum, file) {
        const pageItem = document.createElement('div');
        pageItem.className = 'file-item page-item fade-in draggable-item';
        pageItem.dataset.pageNumber = pageNum;
        pageItem.dataset.originalIndex = pageNum - 1;
        pageItem.draggable = true;
        
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'page-thumbnail-container';
        thumbnailContainer.style.cssText = `
            width: 120px;
            height: 160px;
            background: #f8f9fa;
            border: 2px solid #dee2e6;
            border-radius: 8px;
            margin: 0 auto 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        `;

        pageItem.innerHTML = `
            <div class="drag-handle" title="Drag to reorder">
                <i class="bi bi-grip-vertical"></i>
            </div>
            <div class="order-number">${pageNum}</div>
            <div class="page-thumbnail-container"></div>
            <div class="file-name">Page ${pageNum}</div>
            <div class="file-size">${file.name}</div>
            <div class="file-actions">
                <button class="btn btn-sm btn-outline-primary view-page-btn" title="View full page">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger remove-page-btn" title="Remove page">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;

        const newThumbnailContainer = pageItem.querySelector('.page-thumbnail-container');
        newThumbnailContainer.replaceWith(thumbnailContainer);

        try {
            const page = await pdfDoc.getPage(pageNum);
            const scale = 0.5;
            const viewport = page.getViewport({ scale });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.cssText = `
                max-width: 100%;
                max-height: 100%;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            await page.render(renderContext).promise;
            thumbnailContainer.appendChild(canvas);
            
        } catch (error) {
            console.error(`Error rendering page ${pageNum}:`, error);
            thumbnailContainer.innerHTML = `
                <div class="text-center text-muted">
                    <i class="bi bi-file-earmark-pdf" style="font-size: 2rem;"></i>
                    <br><small>Page ${pageNum}</small>
                </div>
            `;
        }

        const viewBtn = pageItem.querySelector('.view-page-btn');
        const removeBtn = pageItem.querySelector('.remove-page-btn');
        
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.viewPDFPage(file, pageNum);
        });
        
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removePage(pageNum, pageItem);
        });
        
        return pageItem;
    }

    setupPageDragAndDrop() {
        const fileList = document.getElementById('fileList');
        
        fileList.removeEventListener('dragstart', this.handlePageDragStart);
        fileList.removeEventListener('dragend', this.handlePageDragEnd);
        fileList.removeEventListener('dragover', this.handlePageDragOver);
        fileList.removeEventListener('drop', this.handlePageDrop);
        fileList.removeEventListener('dragenter', this.handleDragEnter);
        fileList.removeEventListener('dragleave', this.handleDragLeave);
        
        fileList.addEventListener('dragstart', this.handlePageDragStart.bind(this));
        fileList.addEventListener('dragend', this.handlePageDragEnd.bind(this));
        fileList.addEventListener('dragover', this.handlePageDragOver.bind(this));
        fileList.addEventListener('drop', this.handlePageDrop.bind(this));
        fileList.addEventListener('dragenter', this.handleDragEnter.bind(this));
        fileList.addEventListener('dragleave', this.handleDragLeave.bind(this));
        
        console.log('Page drag and drop configured successfully');
    }

    handlePageDragStart(e) {
        const pageItem = e.target.closest('.page-item');
        if (!pageItem || !pageItem.draggable) {
            console.log('Drag start ignored - invalid target');
            return;
        }
        
        console.log('Drag started for page:', pageItem.dataset.pageNumber);
        
        const pageItems = Array.from(document.querySelectorAll('.page-item'));
        this.draggedIndex = pageItems.indexOf(pageItem);
        this.draggedElement = pageItem;
        this.isDragging = true;
        
        pageItem.classList.add('dragging');
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', pageItem.outerHTML);
        
        this.createPageDragImage(e, pageItem);
    }

    createPageDragImage(e, pageItem) {
        const dragImage = document.createElement('div');
        dragImage.className = 'drag-preview';
        dragImage.style.cssText = `
            position: absolute;
            top: -1000px;
            left: -1000px;
            width: 160px;
            height: 200px;
            background: rgba(255, 255, 255, 0.95);
            border: 2px solid #0d6efd;
            border-radius: 12px;
            padding: 0.5rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
            transform: rotate(2deg);
            font-family: inherit;
            pointer-events: none;
            z-index: 9999;
        `;

        const pageNumber = pageItem.dataset.pageNumber;
        const thumbnail = pageItem.querySelector('canvas');
        
        if (thumbnail) {
            const thumbnailClone = thumbnail.cloneNode(true);
            thumbnailClone.style.cssText = `
                width: 80px;
                height: 100px;
                object-fit: contain;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                margin-bottom: 0.5rem;
            `;
            dragImage.appendChild(thumbnailClone);
        } else {
            dragImage.innerHTML += `
                <div style="width: 80px; height: 100px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem;">
                    <i class="bi bi-file-earmark-pdf" style="font-size: 2rem; color: #dc3545;"></i>
                </div>
            `;
        }
        
        dragImage.innerHTML += `
            <div style="font-size: 0.9rem; font-weight: 600; color: #2c3e50;">
                Page ${pageNumber}
            </div>
            <div style="position: absolute; top: 8px; right: 8px; background: #28a745; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold;">
                ${pageNumber}
            </div>
        `;

        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 80, 100);

        setTimeout(() => {
            if (document.body.contains(dragImage)) {
                document.body.removeChild(dragImage);
            }
        }, 0);
    }

    handlePageDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (!this.isDragging || !this.draggedElement) return;
        
        const pageItem = e.target.closest('.page-item');
        if (!pageItem || pageItem === this.draggedElement) return;
        
        document.querySelectorAll('.page-item').forEach(item => {
            item.classList.remove('drop-target', 'drop-above', 'drop-below');
        });
        
        const rect = pageItem.getBoundingClientRect();
        const midPoint = rect.top + (rect.height / 2);
        
        if (e.clientY < midPoint) {
            pageItem.classList.add('drop-above');
        } else {
            pageItem.classList.add('drop-below');
        }
        
        pageItem.classList.add('drop-target');
    }

    handlePageDrop(e) {
        e.preventDefault();
        
        if (!this.isDragging || !this.draggedElement) {
            console.log('Drop ignored - no drag in progress');
            return;
        }
        
        const dropTarget = e.target.closest('.page-item');
        if (!dropTarget || dropTarget === this.draggedElement) {
            console.log('Drop ignored - invalid target');
            this.cleanupDragState();
            return;
        }
        
        console.log('Drop executed');
        
        const fileList = document.getElementById('fileList');
        const rect = dropTarget.getBoundingClientRect();
        const midPoint = rect.top + (rect.height / 2);
        
        if (e.clientY < midPoint) {
            fileList.insertBefore(this.draggedElement, dropTarget);
        } else {
            const nextSibling = dropTarget.nextElementSibling;
            if (nextSibling) {
                fileList.insertBefore(this.draggedElement, nextSibling);
            } else {
                fileList.appendChild(this.draggedElement);
            }
        }
        
        this.cleanupDragState();
        this.updatePageOrder();
        
        Utils.showToast('Page order updated', 'success');
    }

    handlePageDragEnd(e) {
        console.log('Drag ended');
        this.cleanupDragState();
    }

    cleanupDragState() {
        document.querySelectorAll('.page-item').forEach(item => {
            item.classList.remove('dragging', 'drop-target', 'drop-above', 'drop-below');
        });
        
        document.querySelectorAll('.drag-preview').forEach(preview => {
            if (document.body.contains(preview)) {
                document.body.removeChild(preview);
            }
        });
        
        this.isDragging = false;
        this.draggedElement = null;
        this.draggedIndex = -1;
        this.dropTargetIndex = -1;
    }

    handleDragEnter(e) {
        e.preventDefault();
    }

    handleDragLeave(e) {
        e.preventDefault();
        
        const pageItem = e.target.closest('.page-item');
        if (pageItem && !pageItem.contains(e.relatedTarget)) {
            pageItem.classList.remove('drop-target', 'drop-above', 'drop-below');
        }
    }

    updatePageOrder() {
        const pageItems = document.querySelectorAll('.page-item');
        const newOrder = [];
        
        pageItems.forEach((item, index) => {
            const pageNumber = parseInt(item.dataset.pageNumber);
            newOrder.push(pageNumber);
            
            const orderNumber = item.querySelector('.order-number');
            if (orderNumber) {
                orderNumber.textContent = index + 1;
            }
            
            item.dataset.index = index;
        });
        
        this.uiHandler.pdfPages = newOrder;
    }

    async viewPDFPage(file, pageNumber) {
        try {
            await this.uiHandler.pdfViewer.showPDFViewer(file, pageNumber);
        } catch (error) {
            console.error('Error showing page:', error);
            Utils.showToast('Error showing page', 'error');
        }
    }

    removePage(pageNumber, pageItem) {
        if (confirm(`Remove page ${pageNumber} from the final document?`)) {
            pageItem.remove();
            
            this.uiHandler.pdfPages = this.uiHandler.pdfPages.filter(p => p !== pageNumber);
            
            const remainingPages = document.querySelectorAll('.page-item');
            remainingPages.forEach((item, index) => {
                const orderNumber = item.querySelector('.order-number');
                if (orderNumber) {
                    orderNumber.textContent = index + 1;
                }
            });
            
            Utils.showToast(`Page ${pageNumber} removed`, 'info');
            
            if (this.uiHandler.pdfPages.length === 0) {
                this.uiHandler.goBack();
            }
        }
    }

    async executeReorder() {
        if (this.uiHandler.selectedFiles.length !== 1) {
            throw new Error('Select exactly one PDF file to reorder');
        }
        
        if (!this.uiHandler.pdfPages || this.uiHandler.pdfPages.length === 0) {
            throw new Error('No pages to reorder');
        }
        
        Utils.updateProgress(20, 'Loading PDF document...');
        
        const pdfOperations = new PDFOperations();
        const pdfData = await pdfOperations.loadPDF(this.uiHandler.selectedFiles[0]);
        
        Utils.updateProgress(50, 'Reordering pages according to your selection...');
        
        const reorderedPdfBytes = await pdfOperations.reorderPDF(pdfData, this.uiHandler.pdfPages);
        
        Utils.updateProgress(90, 'Preparing download...');
        
        const blob = new Blob([reorderedPdfBytes], { type: 'application/pdf' });
        const originalName = this.uiHandler.selectedFiles[0].name.replace('.pdf', '');
        Utils.downloadFile(blob, `${originalName}_reordered.pdf`);
        
        Utils.updateProgress(100, 'Completed');
        
        const orderSummary = this.uiHandler.pdfPages.map((pageNum, index) => 
            `Position ${index + 1}: Page ${pageNum}`
        ).join('\n');
        
        console.log('Pages reordered:\n' + orderSummary);
        Utils.showToast(`PDF reordered with ${this.uiHandler.pdfPages.length} pages`, 'success');
    }
}