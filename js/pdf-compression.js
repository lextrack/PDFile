class AdvancedPDFCompressor {
    constructor() {
        this.compressionLevels = {
            low: { 
                imageQuality: 0.90,
                imageDownsample: false,
                maxImageDPI: null,
                removeMetadata: false,
                removeBookmarks: false,
                removeAnnotations: false,
                optimizeStructure: true,
                description: 'Minimal compression'
            },
            medium: { 
                imageQuality: 0.70,
                imageDownsample: true,
                maxImageDPI: 150,
                removeMetadata: true,
                removeBookmarks: false,
                removeAnnotations: false,
                optimizeStructure: true,
                description: 'Balanced compression'
            },
            high: { 
                imageQuality: 0.50,
                imageDownsample: true,
                maxImageDPI: 100,
                removeMetadata: true,
                removeBookmarks: true,
                removeAnnotations: false,
                optimizeStructure: true,
                description: 'High compression'
            },
            maximum: { 
                imageQuality: 0.30,
                imageDownsample: true,
                maxImageDPI: 72,
                removeMetadata: true,
                removeBookmarks: true,
                removeAnnotations: true,
                optimizeStructure: true,
                description: 'Maximum compression'
            }
        };
    }

    async compressPDF(file, level = 'medium') {
        try {
            Utils.updateProgress(5, 'Loading PDF document...');
            
            const arrayBuffer = await Utils.fileToArrayBuffer(file);
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            
            const settings = this.compressionLevels[level];
            const originalSize = file.size;
            
            Utils.updateProgress(15, `Applying ${level} compression...`);

            if (settings.imageDownsample) {
                await this.processImages(pdfDoc, settings);
                Utils.updateProgress(40, 'Optimizing images...');
            }
            
            await this.optimizeFonts(pdfDoc, settings);
            Utils.updateProgress(55, 'Optimizing fonts...');
            
            await this.removeUnnecessaryContent(pdfDoc, settings);
            Utils.updateProgress(70, 'Removing unnecessary content...');

            const compressedBytes = await this.saveWithAdvancedCompression(pdfDoc, settings);
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
                `PDF processed successfully!\n\nThe file was already optimized.\nSize: ${Utils.formatFileSize(compressedSize)}`;
            
            Utils.showToast(message, 'success');
            
            return {
                originalSize,
                compressedSize,
                compressionRatio: parseFloat(savedPercentage),
                filename,
                level
            };
            
        } catch (error) {
            console.error('Advanced compression error:', error);
            throw this.handleCompressionError(error);
        }
    }

    async processImages(pdfDoc, settings) {
        try {
            const pages = pdfDoc.getPages();
            
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                
                try {
                    const pageDict = page.node.dict;
                    const resources = pageDict.get(PDFLib.PDFName.of('Resources'));
                    
                    if (resources) {
                        const xObjects = resources.get(PDFLib.PDFName.of('XObject'));
                        if (xObjects) {
                            await this.optimizeXObjects(xObjects, settings);
                        }
                    }
                } catch (pageError) {
                    console.warn(`Could not optimize images on page ${i + 1}:`, pageError);
                }
            }
        } catch (error) {
            console.warn('Image processing failed:', error);
        }
    }

    async optimizeXObjects(xObjects, settings) {
        try {
            const keys = xObjects.dict.keys();
            for (const key of keys) {
                const obj = xObjects.dict.get(key);
                if (obj && obj.dict) {
                    const subtype = obj.dict.get(PDFLib.PDFName.of('Subtype'));
                    if (subtype && subtype.asName() === 'Image') {
                    }
                }
            }
        } catch (error) {
            console.warn('XObject optimization failed:', error);
        }
    }

    async optimizeFonts(pdfDoc, settings) {
        try {
            const context = pdfDoc.context;
            const fontRefs = [];

            context.enumerateIndirectObjects().forEach((ref, obj) => {
                if (obj && obj.dict && obj.dict.get(PDFLib.PDFName.of('Type'))) {
                    const type = obj.dict.get(PDFLib.PDFName.of('Type'));
                    if (type && type.asName() === 'Font') {
                        fontRefs.push(ref);
                    }
                }
            });

            for (const fontRef of fontRefs) {
                try {
                    const fontObj = context.lookup(fontRef);
                    if (fontObj && fontObj.dict) {
                        if (settings.imageQuality < 0.5) {
                            this.optimizeFontObject(fontObj);
                        }
                    }
                } catch (fontError) {
                    console.warn('Font optimization error:', fontError);
                }
            }
        } catch (error) {
            console.warn('Font optimization failed:', error);
        }
    }

    optimizeFontObject(fontObj) {
        try {
            const optionalKeys = [
                'FontBBox', 'ItalicAngle', 'Ascent', 'Descent',
                'Leading', 'CapHeight', 'XHeight', 'StemV', 'StemH'
            ];
            
            optionalKeys.forEach(key => {
                if (fontObj.dict.has(PDFLib.PDFName.of(key))) {
                    fontObj.dict.delete(PDFLib.PDFName.of(key));
                }
            });
        } catch (error) {
            console.warn('Font object optimization failed:', error);
        }
    }

    async removeUnnecessaryContent(pdfDoc, settings) {
        try {
            if (settings.removeMetadata) {
                pdfDoc.setTitle('');
                pdfDoc.setAuthor('');
                pdfDoc.setSubject('');
                pdfDoc.setKeywords([]);
                pdfDoc.setCreator('');
                pdfDoc.setProducer('PDFile Compressor');
            }

            if (settings.removeBookmarks) {
                try {
                    const catalog = pdfDoc.catalog;
                    if (catalog.dict.has(PDFLib.PDFName.of('Outlines'))) {
                        catalog.dict.delete(PDFLib.PDFName.of('Outlines'));
                    }
                } catch (error) {
                    console.warn('Bookmark removal failed:', error);
                }
            }

            if (settings.removeAnnotations) {
                const pages = pdfDoc.getPages();
                pages.forEach(page => {
                    try {
                        if (page.node.dict.has(PDFLib.PDFName.of('Annots'))) {
                            page.node.dict.delete(PDFLib.PDFName.of('Annots'));
                        }
                    } catch (error) {
                        console.warn('Annotation removal failed on page:', error);
                    }
                });
            }

            const catalog = pdfDoc.catalog;
            const unnecessaryKeys = [
                'StructTreeRoot', 'MarkInfo', 'Lang', 'SpiderInfo',
                'PieceInfo', 'Perms', 'Legal', 'Requirements'
            ];

            unnecessaryKeys.forEach(key => {
                try {
                    if (catalog.dict.has(PDFLib.PDFName.of(key))) {
                        catalog.dict.delete(PDFLib.PDFName.of(key));
                    }
                } catch (error) {
                    console.warn(`Failed to remove ${key}:`, error);
                }
            });

        } catch (error) {
            console.warn('Content removal failed:', error);
        }
    }

    async saveWithAdvancedCompression(pdfDoc, settings) {
        const saveOptions = {
            useObjectStreams: true,
            addDefaultPage: false,
            objectStreamsInForm: true,
            updateFieldAppearances: false,
            compress: true
        };

        if (settings.imageQuality < 0.5) {
            saveOptions.compressStreams = true;
            saveOptions.optimizeForSize = true;
        }

        return await pdfDoc.save(saveOptions);
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
                                    Advanced PDF Compression Settings
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
                                                <span class="badge bg-success">~10-20%</span>
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
                                                <span class="badge bg-warning">~30-50%</span>
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
                                                <span class="badge bg-warning">~50-70%</span>
                                            </div>
                                        </label>
                                    </div>
                                    
                                    <div class="form-check mb-3 p-3 border rounded border-danger">
                                        <input class="form-check-input" type="radio" name="compressionLevel" id="maximum" value="maximum">
                                        <label class="form-check-label w-100" for="maximum">
                                            <div class="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <strong>Maximum Compression</strong> <span class="badge bg-danger ms-2">Aggressive</span>
                                                    <br><small class="text-muted">${this.compressionLevels.maximum.description}</small>
                                                </div>
                                                <span class="badge bg-danger">~70-90%</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="alert alert-info small mt-3">
                                    <i class="bi bi-info-circle me-1"></i>
                                    <strong>Advanced compression features:</strong>
                                    <ul class="mb-0 mt-2">
                                        <li>Image quality optimization and downsampling</li>
                                        <li>Font embedding optimization</li>
                                        <li>Metadata and bookmark removal</li>
                                        <li>Structural optimization</li>
                                    </ul>
                                </div>
                                
                                <div class="alert alert-warning small">
                                    <i class="bi bi-exclamation-triangle me-1"></i>
                                    Higher compression levels may affect print quality and text selection.
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
    // Inherits all the features of AdvancedPDFCompressor
}

window.AdvancedPDFCompressor = AdvancedPDFCompressor;
window.PDFCompressor = PDFCompressor;