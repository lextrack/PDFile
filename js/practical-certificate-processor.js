class PracticalCertificateProcessor {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d', { 
            willReadFrequently: true,
            alpha: false
        });
        this.canvas.style.display = 'none';
        document.body.appendChild(this.canvas);
    }

    async processCertificateForMerge(file) {
        try {
            console.log(`Processing certificate for merge: ${file.name}`);
            
            try {
                const arrayBuffer = await Utils.fileToArrayBuffer(file);
                const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { 
                    ignoreEncryption: true,
                    updateMetadata: false,
                    parseSpeed: PDFLib.ParseSpeeds.Slow
                });
                
                console.log(`Direct load successful for ${file.name}`);
                return {
                    document: pdfDoc,
                    file: file,
                    pageCount: pdfDoc.getPageCount(),
                    id: Utils.generateId(),
                    isConverted: false,
                    originalWasProtected: true,
                    processingMethod: 'direct_load'
                };
            } catch (directError) {
                console.log(`Direct load failed, trying conversion: ${directError.message}`);
            }

            const convertedPdf = await this.convertCertificateToNewPDF(file);
            return convertedPdf;
            
        } catch (error) {
            console.error(`All methods failed for ${file.name}:`, error);
            
            return await this.createCertificateInfoPDF(file);
        }
    }

    async convertCertificateToNewPDF(file) {
        const arrayBuffer = await Utils.fileToArrayBuffer(file);
        const loadingTask = pdfjsLib.getDocument({ 
            data: arrayBuffer,
            verbosity: 0,
            disableFontFace: true,
            useSystemFonts: false,
            disableRange: true,
            disableStream: true,
            disableAutoFetch: true,
            stopAtErrors: false,
            maxImageSize: -1,
            isEvalSupported: false,
            fontExtraProperties: true,
            ignoreErrors: true,
            disableCreateObjectURL: true
        });
        
        let pdfDoc;
        try {
            pdfDoc = await loadingTask.promise;
        } catch (error) {
            console.error('PDF.js load failed:', error);
            throw new Error(`Cannot process certificate: ${error.message}`);
        }
        
        const numPages = pdfDoc.numPages;
        const newPdfDoc = await PDFLib.PDFDocument.create();
        
        console.log(`Converting ${numPages} pages from certificate`);
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const success = await this.renderCertificatePageAdvanced(page, newPdfDoc, pageNum);
                
                if (!success) {
                    console.warn(`Failed to render page ${pageNum}, creating info page`);
                    await this.createCertificateInfoPage(newPdfDoc, file.name, pageNum);
                }
            } catch (pageError) {
                console.error(`Error on page ${pageNum}:`, pageError);
                await this.createCertificateInfoPage(newPdfDoc, file.name, pageNum);
            }
        }
        
        const pdfBytes = await newPdfDoc.save();
        
        return {
            document: await PDFLib.PDFDocument.load(pdfBytes),
            file: file,
            pageCount: numPages,
            id: Utils.generateId(),
            isConverted: true,
            originalWasProtected: true,
            processingMethod: 'pdf_js_conversion'
        };
    }

    async renderCertificatePageAdvanced(page, newPdfDoc, pageNum) {
        try {
            const viewport = page.getViewport({ scale: 1.0 });
            const originalWidth = viewport.width;
            const originalHeight = viewport.height;
            
            const scale = 3.0;
            const scaledViewport = page.getViewport({ scale });
            
            this.canvas.width = scaledViewport.width;
            this.canvas.height = scaledViewport.height;
            
            this.context.fillStyle = '#FFFFFF';
            this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.context.imageSmoothingEnabled = false;
            this.context.textRenderingOptimization = 'optimizeSpeed';
            
            const renderContext = {
                canvasContext: this.context,
                viewport: scaledViewport,
                enableWebGL: false,
                renderInteractiveForms: false,
                intent: 'display',
                annotationMode: 0,
                includeAnnotationStorage: false,
                optionalContentConfigPromise: null
            };
            
            const renderTask = page.render(renderContext);
            await Promise.race([
                renderTask.promise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Render timeout')), 20000)
                )
            ]);
            
            const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const hasContent = this.detectContentInCanvas(imageData);
            
            if (!hasContent) {
                console.warn(`Page ${pageNum} appears to be blank after rendering`);
                return false;
            }
            
            const pngBytes = await this.canvasToArrayBuffer();
            if (!pngBytes || pngBytes.byteLength < 1000) {
                console.warn(`Page ${pageNum} PNG conversion failed or too small`);
                return false;
            }
            
            const image = await newPdfDoc.embedPng(pngBytes);
            const pdfPage = newPdfDoc.addPage([originalWidth, originalHeight]);
            
            pdfPage.drawImage(image, {
                x: 0,
                y: 0,
                width: originalWidth,
                height: originalHeight
            });
            
            console.log(`Successfully converted page ${pageNum}`);
            return true;
            
        } catch (error) {
            console.error(`Error rendering page ${pageNum}:`, error);
            return false;
        }
    }

    detectContentInCanvas(imageData) {
        const data = imageData.data;
        let nonWhitePixels = 0;
        const sampleSize = Math.min(data.length, 40000);
        
        for (let i = 0; i < sampleSize; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (r < 240 || g < 240 || b < 240) {
                nonWhitePixels++;
            }
        }
        
        const contentPercentage = (nonWhitePixels / (sampleSize / 16)) * 100;
        console.log(`Content detection: ${contentPercentage.toFixed(2)}% non-white pixels`);
        
        return contentPercentage > 1;
    }

    async canvasToArrayBuffer() {
        return new Promise((resolve, reject) => {
            this.canvas.toBlob((blob) => {
                if (blob && blob.size > 500) {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(blob);
                } else {
                    resolve(null);
                }
            }, 'image/png', 1.0);
        });
    }

    async createCertificateInfoPage(newPdfDoc, fileName, pageNum) {
        const page = newPdfDoc.addPage([595, 842]);
        
        page.drawRectangle({
            x: 50, y: 50, width: 495, height: 742,
            borderColor: PDFLib.rgb(0.2, 0.2, 0.2), borderWidth: 3
        });
        
        page.drawRectangle({
            x: 70, y: 70, width: 455, height: 702,
            borderColor: PDFLib.rgb(0.7, 0.7, 0.7), borderWidth: 1
        });
        
        page.drawText('CERTIFICADO', {
            x: 230, y: 750, size: 24, color: PDFLib.rgb(0.3, 0.3, 0.3)
        });
        
        page.drawText('(Contenido Protegido)', {
            x: 200, y: 720, size: 16, color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        page.drawText(`Archivo: ${fileName}`, {
            x: 90, y: 650, size: 14, color: PDFLib.rgb(0.2, 0.2, 0.2)
        });
        
        page.drawText(`Página: ${pageNum}`, {
            x: 90, y: 620, size: 14, color: PDFLib.rgb(0.2, 0.2, 0.2)
        });
        
        page.drawText('Esta página contiene un certificado protegido', {
            x: 90, y: 580, size: 12, color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
        
        page.drawText('que no puede ser reproducido debido a', {
            x: 90, y: 560, size: 12, color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
        
        page.drawText('restricciones de seguridad del documento original.', {
            x: 90, y: 540, size: 12, color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
        
        page.drawText('El certificado original mantiene su validez legal.', {
            x: 90, y: 500, size: 11, color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        page.drawText('CONTENIDO PROTEGIDO', {
            x: 150, y: 400, size: 28, color: PDFLib.rgb(0.9, 0.9, 0.9)
        });
    }

    async createCertificateInfoPDF(file) {
        const newPdfDoc = await PDFLib.PDFDocument.create();
        await this.createCertificateInfoPage(newPdfDoc, file.name, 1);
        
        const pdfBytes = await newPdfDoc.save();
        
        return {
            document: await PDFLib.PDFDocument.load(pdfBytes),
            file: file,
            pageCount: 1,
            id: Utils.generateId(),
            isConverted: true,
            originalWasProtected: true,
            processingMethod: 'info_only'
        };
    }

    cleanup() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

async function processProtectedCertificate(file) {
    const processor = new PracticalCertificateProcessor();
    try {
        const result = await processor.processCertificateForMerge(file);
        console.log(`Certificate processed successfully: ${file.name}`, result.processingMethod);
        return result;
    } finally {
        processor.cleanup();
    }
}

window.PracticalCertificateProcessor = PracticalCertificateProcessor;
window.processProtectedCertificate = processProtectedCertificate;