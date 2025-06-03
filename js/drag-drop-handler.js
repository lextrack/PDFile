class DragDropHandler {
    constructor(uiHandler) {
        this.uiHandler = uiHandler;
    }

    setupDragAndDrop() {
        const fileList = document.getElementById('fileList');
        
        fileList.removeEventListener('dragstart', this.handleDragStart);
        fileList.removeEventListener('dragend', this.handleDragEnd);
        fileList.removeEventListener('dragover', this.handleDragOver);
        fileList.removeEventListener('drop', this.handleDrop);
        
        fileList.addEventListener('dragstart', this.handleDragStart.bind(this));
        fileList.addEventListener('dragend', this.handleDragEnd.bind(this));
        fileList.addEventListener('dragover', this.handleDragOver.bind(this));
        fileList.addEventListener('drop', this.handleDrop.bind(this));
        fileList.addEventListener('dragenter', this.handleDragEnter.bind(this));
        fileList.addEventListener('dragleave', this.handleDragLeave.bind(this));
    }

    handleDragStart(e) {
        const fileItem = e.target.closest('.file-item');
        if (!fileItem || !fileItem.draggable) return;
        
        this.uiHandler.draggedElement = fileItem;
        this.uiHandler.isDragging = true;
        
        fileItem.classList.add('dragging');
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', fileItem.outerHTML);
        
        this.createCustomDragImage(e, fileItem);
    }

    createCustomDragImage(e, fileItem) {
        const dragImage = document.createElement('div');
        dragImage.className = 'drag-preview';
        dragImage.style.cssText = `
            position: absolute;
            top: -1000px;
            left: -1000px;
            width: 200px;
            height: 120px;
            background: rgba(255, 255, 255, 0.95);
            border: 2px solid #0d6efd;
            border-radius: 12px;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
            transform: rotate(3deg);
            font-family: inherit;
            pointer-events: none;
            z-index: 9999;
        `;

        const fileName = fileItem.querySelector('.file-name').textContent;
        const fileSize = fileItem.querySelector('.file-size').textContent;
        const orderNumber = fileItem.querySelector('.order-number')?.textContent || '';

        dragImage.innerHTML = `
            <div style="font-size: 2rem; color: #dc3545; margin-bottom: 0.5rem;">
                <i class="bi bi-file-earmark-pdf-fill"></i>
            </div>
            <div style="font-size: 0.8rem; font-weight: 600; color: #2c3e50; text-align: center; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">
                ${fileName}
            </div>
            <div style="font-size: 0.7rem; color: #6c757d; margin-top: 0.25rem;">
                ${fileSize}
            </div>
            ${orderNumber ? `<div style="position: absolute; top: 8px; right: 8px; background: #28a745; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold;">${orderNumber}</div>` : ''}
        `;

        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 100, 60);

        setTimeout(() => {
            if (document.body.contains(dragImage)) {
                document.body.removeChild(dragImage);
            }
        }, 0);
    }

    handleDragEnd(e) {
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        
        fileItem.classList.remove('dragging');
        fileItem.style.opacity = '';
        fileItem.style.transform = '';
        
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('drop-target', 'drop-above', 'drop-below');
        });
        
        document.querySelectorAll('.drag-preview').forEach(preview => {
            if (document.body.contains(preview)) {
                document.body.removeChild(preview);
            }
        });
        
        this.uiHandler.isDragging = false;
        this.uiHandler.draggedElement = null;
        
        this.updateFileOrder();
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (!this.uiHandler.isDragging) return;
        
        const fileItem = e.target.closest('.file-item');
        if (!fileItem || fileItem === this.uiHandler.draggedElement) return;
        
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('drop-target', 'drop-above', 'drop-below');
        });
        
        const rect = fileItem.getBoundingClientRect();
        const midPoint = rect.top + rect.height / 2;
        
        if (e.clientY < midPoint) {
            fileItem.classList.add('drop-above');
        } else {
            fileItem.classList.add('drop-below');
        }
        
        fileItem.classList.add('drop-target');
    }

    handleDrop(e) {
        e.preventDefault();
        
        if (!this.uiHandler.isDragging || !this.uiHandler.draggedElement) return;
        
        const dropTarget = e.target.closest('.file-item');
        if (!dropTarget || dropTarget === this.uiHandler.draggedElement) return;
        
        const fileList = document.getElementById('fileList');
        const rect = dropTarget.getBoundingClientRect();
        const midPoint = rect.top + rect.height / 2;
        
        if (e.clientY < midPoint) {
            fileList.insertBefore(this.uiHandler.draggedElement, dropTarget);
        } else {
            fileList.insertBefore(this.uiHandler.draggedElement, dropTarget.nextSibling);
        }
        
        dropTarget.classList.remove('drop-target', 'drop-above', 'drop-below');
        this.uiHandler.draggedElement.classList.remove('dragging');
        this.uiHandler.draggedElement.style.opacity = '';
        
        Utils.showToast('Order updated', 'success');
    }

    handleDragEnter(e) {
        e.preventDefault();
    }

    handleDragLeave(e) {
        e.preventDefault();
    }

    updateFileOrder() {
        const fileItems = document.querySelectorAll('.file-item:not(.merge-instructions)');
        const newOrder = [];
        
        fileItems.forEach((item, index) => {
            const fileName = item.querySelector('.file-name').textContent;
            const fileSize = item.querySelector('.file-size').textContent;
            
            const matchingFile = this.uiHandler.selectedFiles.find(file => 
                file.name === fileName && 
                Utils.formatFileSize(file.size) === fileSize
            );
            
            if (matchingFile) {
                newOrder.push(matchingFile);
                
                const orderNumber = item.querySelector('.order-number');
                if (orderNumber) {
                    orderNumber.textContent = index + 1;
                }
                
                const pageNumber = item.querySelector('.page-number');
                if (pageNumber) {
                    pageNumber.textContent = index + 1;
                }
                
                item.dataset.index = index;
            }
        });
        
        if (newOrder.length === this.uiHandler.selectedFiles.length) {
            this.uiHandler.selectedFiles = newOrder;
            console.log('New file order:', this.uiHandler.selectedFiles.map(f => f.name));
        }
    }
}