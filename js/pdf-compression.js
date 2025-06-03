class AdvancedPDFCompressor {
    constructor() {
        this.compressionLevels = {
            low: { 
                imageQuality: 0.90,
                renderScale: 1.2,
                removeMetadata: false,
                removeBookmarks: false,
                removeAnnotations: false,
                description: 'Minimal compression - maintains highest quality'
            },
            medium: { 
                imageQuality: 0.75,
                renderScale: 1.0,
                removeMetadata: true,
                removeBookmarks: false,
                removeAnnotations: false,
                description: 'Balanced compression - good quality and size reduction'
            },
            high: { 
                imageQuality: 0.60,
                renderScale: 0.8,
                removeMetadata: true,
                removeBookmarks: true,
                removeAnnotations: false,
                description: 'High compression - prioritizes smaller file size'
            },
            maximum: { 
                imageQuality: 0.50,
                renderScale: 0.6,
                removeMetadata: true,
                removeBookmarks: true,
                removeAnnotations: true,
                description: 'Maximum compression - smallest file size'
            }
        };
    }

    async compressPDF(file, level = 'medium') {
        try {
            Utils.updateProgress(5, 'Loading PDF document...');
            
            const arrayBuffer = await Utils.fileToArrayBuffer(file);
            const originalSize = file.size;
            const settings = this.compressionLevels[level];
            
            Utils.updateProgress(15, `Applying ${level} compression...`);

            const compressedBytes = await this.compressByRendering(arrayBuffer, settings);
            
            Utils.updateProgress(90, 'Finalizing compression...');
            
            const compressedSize = compressedBytes.length;
            const compressionRatio = originalSize > 0 ? 
                ((originalSize - compressedSize) / originalSize * 100) : 0;
            
            const blob = new Blob([compressedBytes], { type: 'application/pdf' });
            const originalName = file.name.replace('.pdf', '');
            const filename = `${originalName}_compressed_${level}.pdf`;
            
            Utils.downloadFile(blob, filename);
            Utils.updateProgress(100, 'Compression completed');
            
            const savedPercentage = Math.max(0, compressionRatio).toFixed(1);
            const message = compressedSize < originalSize ? 
                `PDF compressed successfully!\n\nOriginal: ${Utils.formatFileSize(originalSize)}\nCompressed: ${Utils.formatFileSize(compressedSize)}\nSaved: ${savedPercentage}% (${level} compression)` :
                `PDF processed successfully!\n\nSize: ${Utils.formatFileSize(compressedSize)}\n\nNote: This PDF was already well optimized.`;
            
            Utils.showToast(message, compressedSize < originalSize ? 'success' : 'info');
            
            return {
                originalSize,
                compressedSize,
                compressionRatio: parseFloat(savedPercentage),
                filename,
                level
            };
            
        } catch (error) {
            console.error('Compression error:', error);
            throw this.handleCompressionError(error);
        }
    }

    async compressByRendering(arrayBuffer, settings) {
        try {
            Utils.updateProgress(20, 'Initializing PDF rendering...');
            
            const loadingTask = pdfjsLib.getDocument({ 
                data: arrayBuffer,
                verbosity: 0
            });
            const pdfDoc = await loadingTask.promise;

            const newPdfDoc = await PDFLib.PDFDocument.create();
            const totalPages = pdfDoc.numPages;
            
            Utils.updateProgress(30, `Processing ${totalPages} pages...`);
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                try {
                    const page = await pdfDoc.getPage(pageNum);
                    
                    const viewport = page.getViewport({ scale: settings.renderScale });
                    canvas.width = Math.floor(viewport.width);
                    canvas.height = Math.floor(viewport.height);

                    context.fillStyle = '#FFFFFF';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    
                    await page.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise;
                    
                    const imageDataUrl = canvas.toDataURL('image/jpeg', settings.imageQuality);
                    const imageBytes = this.dataUrlToUint8Array(imageDataUrl);
                    
                    const image = await newPdfDoc.embedJpg(imageBytes);
                    const pdfPage = newPdfDoc.addPage([viewport.width, viewport.height]);
                    
                    pdfPage.drawImage(image, {
                        x: 0,
                        y: 0,
                        width: viewport.width,
                        height: viewport.height
                    });
                    
                    const progress = 30 + (pageNum / totalPages) * 50;
                    Utils.updateProgress(progress, `Processing page ${pageNum}/${totalPages}...`);
                    
                } catch (pageError) {
                    console.error(`Error processing page ${pageNum}:`, pageError);

                    this.createErrorPage(newPdfDoc, pageNum, pageError.message);
                }
            }
            
            Utils.updateProgress(85, 'Applying final optimizations...');
            
            this.applyMetadataOptimizations(newPdfDoc, settings);
            
            const saveOptions = {
                useObjectStreams: true,
                addDefaultPage: false,
                objectStreamsInForm: true,
                updateFieldAppearances: false
            };
            
            return await newPdfDoc.save(saveOptions);
            
        } catch (error) {
            console.error('Rendering compression failed:', error);

            return await this.basicPDFLibCompression(arrayBuffer, settings);
        }
    }

    async basicPDFLibCompression(arrayBuffer, settings) {
        try {
            Utils.updateProgress(40, 'Using basic compression method...');
            
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            
            this.applyMetadataOptimizations(pdfDoc, settings);
            
            const saveOptions = {
                useObjectStreams: true,
                addDefaultPage: false,
                objectStreamsInForm: true,
                updateFieldAppearances: false
            };
            
            return await pdfDoc.save(saveOptions);
            
        } catch (error) {
            console.error('Basic compression also failed:', error);
            throw new Error('Could not compress PDF with any available method');
        }
    }

    applyMetadataOptimizations(pdfDoc, settings) {
        try {
            if (settings.removeMetadata) {
                pdfDoc.setTitle('');
                pdfDoc.setAuthor('');
                pdfDoc.setSubject('');
                pdfDoc.setKeywords([]);
                pdfDoc.setCreator('PDFile Compressor');
                pdfDoc.setProducer('PDFile Compressor');
                pdfDoc.setCreationDate(new Date());
                pdfDoc.setModificationDate(new Date());
            }

            if (settings.removeAnnotations) {
                const pages = pdfDoc.getPages();
                pages.forEach((page, index) => {
                    try {
                        const pageRef = page.ref;
                        const pageDict = pdfDoc.context.lookup(pageRef);
                        if (pageDict && pageDict.has && pageDict.has(PDFLib.PDFName.of('Annots'))) {
                            pageDict.delete(PDFLib.PDFName.of('Annots'));
                        }
                    } catch (error) {
                        console.warn(`Could not remove annotations from page ${index + 1}:`, error);
                    }
                });
            }

            if (settings.removeBookmarks) {
                try {
                    const catalog = pdfDoc.catalog;
                    if (catalog && catalog.has && catalog.has(PDFLib.PDFName.of('Outlines'))) {
                        catalog.delete(PDFLib.PDFName.of('Outlines'));
                    }
                } catch (error) {
                    console.warn('Could not remove bookmarks:', error);
                }
            }

        } catch (error) {
            console.warn('Some metadata optimizations failed:', error);
        }
    }

    createErrorPage(pdfDoc, pageNum, errorMessage) {
        try {
            const page = pdfDoc.addPage([595, 842]);
            
            page.drawText(`Error processing page ${pageNum}`, {
                x: 50,
                y: 750,
                size: 16,
                color: PDFLib.rgb(0.8, 0.2, 0.2)
            });
            
            page.drawText(`Error: ${errorMessage}`, {
                x: 50,
                y: 720,
                size: 12,
                color: PDFLib.rgb(0.5, 0.5, 0.5)
            });
            
            page.drawText('This page could not be compressed', {
                x: 50,
                y: 690,
                size: 12,
                color: PDFLib.rgb(0.5, 0.5, 0.5)
            });
            
        } catch (error) {
            console.error('Could not create error page:', error);
        }
    }

    dataUrlToUint8Array(dataUrl) {
        const base64 = dataUrl.split(',')[1];
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        return bytes;
    }

    handleCompressionError(error) {
        if (error.message.includes('encrypted') || error.message.includes('password')) {
            return new Error('Cannot compress password-protected PDFs. Please remove password protection first.');
        } else if (error.message.includes('Invalid PDF')) {
            return new Error('The PDF file appears to be corrupted or invalid.');
        } else if (error.message.includes('memory') || error.message.includes('size')) {
            return new Error('The PDF file is too large or complex to compress with the selected settings.');
        } else {
            return new Error(`Could not compress PDF: ${error.message}`);
        }
    }

    showCompressionOptions(file) {
        return new Promise((resolve, reject) => {
            const modalHTML = `
                <div class="modal fade" id="compressionModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="bi bi-file-zip me-2"></i>
                                    PDF Compression Settings
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="mb-3">
                                    <strong>File:</strong> ${file.name}<br>
                                    <strong>Current size:</strong> ${Utils.formatFileSize(file.size)}
                                </div>
                                
                                <div class="compression-options">
                                    <div class="form-check mb-3 p-3 border rounded">
                                        <input class="form-check-input" type="radio" name="compressionLevel" id="low" value="low">
                                        <label class="form-check-label w-100" for="low">
                                            <div class="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <strong>Low Compression</strong>
                                                    <br><small class="text-muted">${this.compressionLevels.low.description}</small>
                                                </div>
                                                <span class="badge bg-success">~5-15%</span>
                                            </div>
                                        </label>
                                    </div>
                                    
                                    <div class="form-check mb-3 p-3 border rounded bg-light">
                                        <input class="form-check-input" type="radio" name="compressionLevel" id="medium" value="medium" checked>
                                        <label class="form-check-label w-100" for="medium">
                                            <div class="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <strong>Medium Compression</strong> <span class="badge bg-primary ms-2">Recommended</span>
                                                    <br><small class="text-muted">${this.compressionLevels.medium.description}</small>
                                                </div>
                                                <span class="badge bg-warning">~15-35%</span>
                                            </div>
                                        </label>
                                    </div>
                                    
                                    <div class="form-check mb-3 p-3 border rounded">
                                        <input class="form-check-input" type="radio" name="compressionLevel" id="high" value="high">
                                        <label class="form-check-label w-100" for="high">
                                            <div class="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <strong>High Compression</strong>
                                                    <br><small class="text-muted">${this.compressionLevels.high.description}</small>
                                                </div>
                                                <span class="badge bg-warning">~35-55%</span>
                                            </div>
                                        </label>
                                    </div>
                                    
                                    <div class="form-check mb-3 p-3 border rounded border-danger">
                                        <input class="form-check-input" type="radio" name="compressionLevel" id="maximum" value="maximum">
                                        <label class="form-check-label w-100" for="maximum">
                                            <div class="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <strong>Maximum Compression</strong> <span class="badge bg-danger ms-2">Quality Loss</span>
                                                    <br><small class="text-muted">${this.compressionLevels.maximum.description}</small>
                                                </div>
                                                <span class="badge bg-danger">~55-80%</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="alert alert-info small mt-3">
                                    <i class="bi bi-info-circle me-1"></i>
                                    <strong>How it works:</strong>
                                    <ul class="mb-0 mt-2">
                                        <li>Renders each page as optimized JPEG image</li>
                                        <li>Adjusts image quality and resolution</li>
                                        <li>Removes unnecessary metadata</li>
                                        <li>Optimizes PDF structure</li>
                                        <li>Fallback methods for complex PDFs</li>
                                    </ul>
                                </div>
                                
                                <div class="alert alert-warning small">
                                    <i class="bi bi-exclamation-triangle me-1"></i>
                                    Higher compression may affect text selection and image quality. The process converts pages to images.
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" id="cancelCompression">Cancel</button>
                                <button type="button" class="btn btn-primary" id="startCompression">
                                    <i class="bi bi-file-zip me-1"></i>Compress PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            const existingModal = document.getElementById('compressionModal');
            if (existingModal) existingModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            const modal = new bootstrap.Modal(document.getElementById('compressionModal'), {
                backdrop: 'static',
                keyboard: true
            });
            
            let isResolved = false;
            
            modal.show();

            document.getElementById('startCompression').addEventListener('click', () => {
                if (isResolved) return;
                
                const selectedInput = document.querySelector('input[name="compressionLevel"]:checked');
                const selectedLevel = selectedInput ? selectedInput.value : 'medium';
                
                isResolved = true;
                modal.hide();
                
                setTimeout(() => {
                    resolve(selectedLevel);
                }, 100);
            });
            
            document.getElementById('cancelCompression').addEventListener('click', () => {
                if (isResolved) return;
                
                isResolved = true;
                modal.hide();
                
                setTimeout(() => {
                    reject(new Error('User cancelled compression'));
                }, 100);
            });
            
            document.getElementById('compressionModal').addEventListener('hidden.bs.modal', () => {
                if (!isResolved) {
                    isResolved = true;
                    reject(new Error('User cancelled compression'));
                }

                setTimeout(() => {
                    const modalElement = document.getElementById('compressionModal');
                    if (modalElement) modalElement.remove();
                }, 300);
            });
        });
    }
}

class PDFCompressor extends AdvancedPDFCompressor {
    // Inherits all the features of Advanced PDF Compressor
}

window.AdvancedPDFCompressor = AdvancedPDFCompressor;
window.PDFCompressor = PDFCompressor;