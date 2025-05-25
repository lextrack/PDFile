class ProtectedPDFProcessor {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d', { 
            willReadFrequently: true,
            alpha: false
        });
        this.canvas.style.display = 'none';
        document.body.appendChild(this.canvas);
    }

    async processProtectedPDF(file, password = '') {
        try {
            console.log(`Attempting to process protected PDF: ${file.name}`);
            Utils.showToast(`Processing protected PDF: ${file.name}. This may take longer...`, 'info');
            
            const arrayBuffer = await Utils.fileToArrayBuffer(file);
            const pdfJSConfig = window.pdfJSConfig || {
                cmapsUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                fontsUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
            };
            
            const loadingTask = pdfjsLib.getDocument({ 
                data: arrayBuffer,
                password: password,
                verbosity: 0,
                cMapUrl: pdfJSConfig.cmapsUrl,
                cMapPacked: true,
                standardFontDataUrl: pdfJSConfig.fontsUrl,
                useSystemFonts: false,
                disableFontFace: false,
                disableRange: false,
                disableStream: false,
                disableAutoFetch: false,
                maxImageSize: 1024 * 1024,
                isEvalSupported: false
            });
            
            let pdfDoc;
            try {
                pdfDoc = await loadingTask.promise;
            } catch (passwordError) {
                console.error('Password error:', passwordError);
                if (passwordError.name === 'PasswordException' || passwordError.message.includes('password')) {
                    const result = await PasswordDialog.promptForPassword(file.name);
                    
                    if (result.action === 'skip') {
                        throw new Error(`SKIP_FILE:User chose to skip password-protected file: ${file.name}`);
                    } else if (result.action === 'use_password') {
                        return await this.processProtectedPDF(file, result.password);
                    } else if (result.action === 'try_without') {
                        throw new Error(`SKIP_FILE:Password required for ${file.name}`);
                    }
                }
                throw passwordError;
            }
            
            const numPages = pdfDoc.numPages;
            console.log(`Protected PDF loaded with ${numPages} pages`);
            
            const newPdfDoc = await PDFLib.PDFDocument.create();
            let successfulPages = 0;
            
            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                Utils.updateProgress(
                    20 + (pageNum / numPages) * 60, 
                    `Converting page ${pageNum}/${numPages} of ${file.name}...`
                );
                
                try {
                    const page = await pdfDoc.getPage(pageNum);
                    const imageData = await this.renderPageToImageData(page);
                    
                    if (imageData && imageData.length > 1000) {
                        const image = await newPdfDoc.embedPng(imageData);
                        const viewport = page.getViewport({ scale: 1.0 });
                        
                        const pdfPage = newPdfDoc.addPage([viewport.width, viewport.height]);
                        
                        pdfPage.drawImage(image, {
                            x: 0,
                            y: 0,
                            width: viewport.width,
                            height: viewport.height
                        });
                        
                        successfulPages++;
                        console.log(`Successfully processed page ${pageNum}`);
                    } else {
                        console.warn(`Page ${pageNum} rendered as empty, creating placeholder`);
                        await this.createPlaceholderPage(newPdfDoc, pageNum, page);
                    }
                    
                } catch (pageError) {
                    console.warn(`Error processing page ${pageNum}:`, pageError);
                    await this.createPlaceholderPage(newPdfDoc, pageNum);
                }
            }
            
            if (successfulPages === 0) {
                throw new Error(`No pages could be processed from ${file.name}`);
            }
            
            const pdfBytes = await newPdfDoc.save();
            
            console.log(`Successfully converted ${successfulPages}/${numPages} pages from ${file.name}`);
            
            if (successfulPages < numPages) {
                Utils.showToast(
                    `Partially converted ${file.name}: ${successfulPages}/${numPages} pages successful`, 
                    'warning'
                );
            } else {
                Utils.showToast(
                    `Successfully converted protected PDF: ${file.name}`, 
                    'success'
                );
            }
            
            return {
                document: await PDFLib.PDFDocument.load(pdfBytes),
                file: file,
                pageCount: successfulPages,
                id: Utils.generateId(),
                isConverted: true,
                originalWasProtected: true,
                conversionSuccess: successfulPages / numPages
            };
            
        } catch (error) {
            console.error(`Failed to process protected PDF ${file.name}:`, error);
            throw error;
        }
    }

    async renderPageToImageData(page, scale = 2.5) {
        try {
            const viewport = page.getViewport({ scale });
            
            this.canvas.width = Math.floor(viewport.width);
            this.canvas.height = Math.floor(viewport.height);
            
            this.context.fillStyle = '#FFFFFF';
            this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.context.imageSmoothingEnabled = true;
            this.context.imageSmoothingQuality = 'high';
            
            const renderContext = {
                canvasContext: this.context,
                viewport: viewport,
                enableWebGL: false,
                renderInteractiveForms: false,
                intent: 'print'
            };
            
            const renderTask = page.render(renderContext);
            
            await Promise.race([
                renderTask.promise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Render timeout')), 15000)
                )
            ]);
            
            const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const isBlank = this.isCanvasBlank(imageData);
            
            if (isBlank) {
                console.warn('Rendered page appears to be blank');
                return await this.fallbackRender(page, scale * 0.8);
            }
            
            return await this.canvasToPngArrayBuffer();
            
        } catch (error) {
            console.error('Error in renderPageToImageData:', error);
            return await this.fallbackRender(page, scale * 0.5);
        }
    }

    async fallbackRender(page, scale) {
        try {
            console.log('Attempting fallback render...');
            const viewport = page.getViewport({ scale });
            
            this.canvas.width = Math.floor(viewport.width);
            this.canvas.height = Math.floor(viewport.height);
            
            this.context.fillStyle = '#FFFFFF';
            this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            const renderContext = {
                canvasContext: this.context,
                viewport: viewport,
                enableWebGL: false,
                renderInteractiveForms: true,
                intent: 'display'
            };
            
            await page.render(renderContext).promise;
            return await this.canvasToPngArrayBuffer();
            
        } catch (fallbackError) {
            console.error('Fallback render also failed:', fallbackError);
            return null;
        }
    }

    isCanvasBlank(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (r < 250 || g < 250 || b < 250) {
                return false;
            }
        }
        return true;
    }

    async canvasToPngArrayBuffer() {
        return new Promise((resolve, reject) => {
            this.canvas.toBlob((blob) => {
                if (blob && blob.size > 1000) {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(blob);
                } else {
                    reject(new Error('Empty or invalid blob generated'));
                }
            }, 'image/png', 0.95);
        });
    }

    async createPlaceholderPage(pdfDoc, pageNum, originalPage = null) {
        let width = 595, height = 842;
        
        if (originalPage) {
            try {
                const viewport = originalPage.getViewport({ scale: 1.0 });
                width = viewport.width;
                height = viewport.height;
            } catch (e) {
                console.warn('Could not get original page dimensions');
            }
        }
        
        const placeholderPage = pdfDoc.addPage([width, height]);
        
        placeholderPage.drawRectangle({
            x: 50,
            y: height - 100,
            width: width - 100,
            height: 80,
            borderColor: PDFLib.rgb(0.8, 0.8, 0.8),
            borderWidth: 2
        });
        
        placeholderPage.drawText(`Page ${pageNum}`, {
            x: 60,
            y: height - 60,
            size: 16,
            color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        placeholderPage.drawText('Could not process this page', {
            x: 60,
            y: height - 80,
            size: 12,
            color: PDFLib.rgb(0.7, 0.7, 0.7)
        });
    }

    cleanup() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}