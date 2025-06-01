class SignatureHandler {
    constructor(uiHandler) {
        this.uiHandler = uiHandler;
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.signatureImage = null;
        this.currentPDF = null;
        this.selectedPage = 1;
        this.signatureX = 50;
        this.signatureY = 50;
    }

    initialize() {
        this.canvas = document.getElementById('signaturePad');
        this.ctx = this.canvas.getContext('2d');
        
        this.canvas.width = 600;
        this.canvas.height = 200;
        
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = '#000000';
        
        this.setupEventListeners();
        this.clearCanvas();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });

        document.getElementById('clearSignature').addEventListener('click', () => {
            this.clearCanvas();
        });

        document.getElementById('saveSignature').addEventListener('click', () => {
            this.saveSignature();
        });
    }

    startDrawing(e) {
        this.isDrawing = true;
        [this.lastX, this.lastY] = this.getMousePos(e);
    }

    draw(e) {
        if (!this.isDrawing) return;

        const [x, y] = this.getMousePos(e);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        
        [this.lastX, this.lastY] = [x, y];
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return [
            e.clientX - rect.left,
            e.clientY - rect.top
        ];
    }

    clearCanvas() {
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.signatureImage = null;
    }

    async saveSignature() {
        // Convert signature to PNG
        this.signatureImage = this.canvas.toDataURL('image/png');
        
        if (this.isCanvasEmpty()) {
            Utils.showToast('Please draw a signature first', 'warning');
            return;
        }

        try {
            const file = this.uiHandler.selectedFiles[0];
            if (!file) {
                Utils.showToast('Please select a PDF file first', 'error');
                return;
            }

            Utils.showProgress('Adding signature to PDF...');

            const arrayBuffer = await Utils.fileToArrayBuffer(file);
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            
            // Convert signature to Uint8Array
            const signatureBytes = await fetch(this.signatureImage).then(res => res.arrayBuffer());
            const signatureImage = await pdfDoc.embedPng(signatureBytes);
            
            // Add signature to selected page
            const pages = pdfDoc.getPages();
            const page = pages[this.selectedPage - 1];
            const { width, height } = page.getSize();
            
            // Calculate signature dimensions while maintaining aspect ratio
            const maxWidth = width * 0.3;
            const maxHeight = height * 0.1;
            const signatureWidth = Math.min(signatureImage.width, maxWidth);
            const signatureHeight = (signatureImage.height * signatureWidth) / signatureImage.width;

            page.drawImage(signatureImage, {
                x: this.signatureX,
                y: height - this.signatureY - signatureHeight,
                width: signatureWidth,
                height: signatureHeight
            });

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            
            Utils.downloadFile(blob, `signed_${file.name}`);
            Utils.showToast('Signature added successfully!', 'success');
            
        } catch (error) {
            console.error('Error adding signature:', error);
            Utils.showToast('Error adding signature to PDF', 'error');
        } finally {
            Utils.hideProgress();
        }
    }

    isCanvasEmpty() {
        const blank = document.createElement('canvas');
        blank.width = this.canvas.width;
        blank.height = this.canvas.height;
        
        const blankCtx = blank.getContext('2d');
        blankCtx.fillStyle = 'white';
        blankCtx.fillRect(0, 0, blank.width, blank.height);
        
        return this.canvas.toDataURL() === blank.toDataURL();
    }

    showSignaturePad() {
        const container = document.getElementById('signaturePadContainer');
        container.style.display = 'block';
        this.initialize();
    }

    hideSignaturePad() {
        const container = document.getElementById('signaturePadContainer');
        container.style.display = 'none';
    }
}