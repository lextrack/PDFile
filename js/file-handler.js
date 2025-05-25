class FileHandler {
    constructor(uiHandler) {
        this.uiHandler = uiHandler;
        this.setupFileUploadListeners();
    }

    setupFileUploadListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        let isProcessingClick = false;

        uploadArea.addEventListener('click', (e) => {
            if (isProcessingClick) return;
            if (e.target === fileInput) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            isProcessingClick = true;
            fileInput.click();
            
            setTimeout(() => {
                isProcessingClick = false;
            }, 100);
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const files = Array.from(e.target.files);
                this.handleFiles(files, true);
            }
            e.target.value = '';
        });

        fileInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (!uploadArea.contains(e.relatedTarget)) {
                uploadArea.classList.remove('dragover');
            }
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            this.handleFiles(files, true);
        });
    }

    async preValidatePDFs(files) {
        const validFiles = [];
        const problematicFiles = [];
        const certificateFiles = [];
        
        for (const file of files) {
            if (!Utils.isPDF(file)) {
                continue;
            }
            
            try {
                const arrayBuffer = await Utils.fileToArrayBuffer(file);
                const bytes = new Uint8Array(arrayBuffer.slice(0, 8192));
                const pdfString = String.fromCharCode.apply(null, bytes);
                
                let hasProblems = false;
                let problemReason = '';
                let isCertificate = false;
                let isACHS = false;
                let protectionLevel = 'none';
                
                const certificatePatterns = [
                    'certificado',
                    'diploma',
                    'curso',
                    'capacitación',
                    'achs',
                    'seguro laboral',
                    'USO DE EXTINTORES',
                    'Por haber cumplido satisfactoriamente',
                    'Valida tu diploma',
                    'www.tcpdf.org'
                ];
                
                isCertificate = certificatePatterns.some(pattern => 
                    pdfString.toLowerCase().includes(pattern.toLowerCase())
                );
                
                isACHS = pdfString.toLowerCase().includes('achs') || 
                        pdfString.toLowerCase().includes('seguro laboral');
                
                if (pdfString.includes('/Encrypt')) {
                    if (pdfString.includes('/V 4') || pdfString.includes('/V 5') || 
                        pdfString.includes('/Length 256') || pdfString.includes('/AES')) {
                        protectionLevel = 'high';
                        hasProblems = true;
                        problemReason = 'High-level encryption (AES-256)';
                    } else if (pdfString.includes('/V 2') || pdfString.includes('/V 3')) {
                        protectionLevel = 'medium';
                        hasProblems = true;
                        problemReason = 'Medium-level encryption (AES-128)';
                    } else {
                        protectionLevel = 'low';
                        problemReason = 'Basic encryption (RC4)';
                    }
                }
                
                if (pdfString.includes('/Sig') && pdfString.includes('/ByteRange')) {
                    hasProblems = true;
                    problemReason = problemReason ? 
                        `${problemReason} + Digital signature` : 
                        'Digital signature detected';
                }
                
                if (pdfString.includes('/P ')) {
                    const restrictions = [];
                    if (pdfString.includes('-44')) restrictions.push('printing');
                    if (pdfString.includes('-4')) restrictions.push('editing');
                    if (pdfString.includes('-16')) restrictions.push('copying');
                    if (pdfString.includes('-32')) restrictions.push('annotations');
                    
                    if (restrictions.length > 0) {
                        problemReason = problemReason ? 
                            `${problemReason} + Restricted: ${restrictions.join(', ')}` : 
                            `Restricted: ${restrictions.join(', ')}`;
                    }
                }
                
                if (isCertificate) {
                    certificateFiles.push({
                        file: file,
                        isACHS: isACHS,
                        protectionLevel: protectionLevel,
                        reason: problemReason || 'Certificate document (may have protections)'
                    });
                    
                    validFiles.push(file);
                    
                } else if (hasProblems) {
                    problematicFiles.push({
                        file: file,
                        reason: problemReason,
                        protectionLevel: protectionLevel
                    });
                    
                    validFiles.push(file);
                    
                } else {
                    validFiles.push(file);
                }
                
            } catch (error) {
                problematicFiles.push({
                    file: file,
                    reason: `Cannot analyze file structure: ${error.message}`,
                    protectionLevel: 'unknown'
                });
                
                validFiles.push(file);
            }
        }
        
        if (certificateFiles.length > 0) {
            const certificateNames = certificateFiles.map(c => {
                const type = c.isACHS ? '(ACHS)' : '(Certificate)';
                return `• ${c.file.name} ${type}`;
            }).join('\n');
            
            Utils.showToast(
                `Detected ${certificateFiles.length} certificate(s):\n${certificateNames}\n\nThese will be processed with specialized methods.`,
                'info'
            );
        }
        
        if (problematicFiles.length > 0 && certificateFiles.length === 0) {
            const problemList = problematicFiles.map(p => 
                `• ${p.file.name}: ${p.reason}`
            ).join('\n');
            
            Utils.showToast(
                `Warning: ${problematicFiles.length} file(s) may cause issues:\n${problemList}\n\nProcessing will be attempted with conversion methods.`,
                'warning'
            );
        }
        
        return { 
            validFiles, 
            problematicFiles,
            certificateFiles,
            summary: {
                total: files.filter(f => Utils.isPDF(f)).length,
                certificates: certificateFiles.length,
                problematic: problematicFiles.length,
                normal: validFiles.length - certificateFiles.length - problematicFiles.length
            }
        };
    }

    async handleFiles(files, accumulate = false) {
        if (files.length === 0) return;

        const basicValidFiles = this.validateFiles(files);
        
        if (basicValidFiles.length === 0) {
            Utils.showToast('No valid files selected', 'error');
            return;
        }

        let finalValidFiles = basicValidFiles;
        let problematicFiles = [];
        let certificateFiles = [];
        
        if (this.uiHandler.currentTool === 'merge') {
            const pdfFiles = basicValidFiles.filter(f => Utils.isPDF(f));
            if (pdfFiles.length > 0) {
                const validation = await this.preValidatePDFs(pdfFiles);
                const nonPdfFiles = basicValidFiles.filter(f => !Utils.isPDF(f));
                
                finalValidFiles = [...validation.validFiles, ...nonPdfFiles];
                problematicFiles = validation.problematicFiles;
                certificateFiles = validation.certificateFiles;
                
                if (certificateFiles.length > 0 || problematicFiles.length > 0) {
                    const userChoice = await CertificateInfoDialog.showCertificateWarning(
                        certificateFiles, 
                        problematicFiles
                    );
                    
                    if (userChoice.action === 'cancel') {
                        Utils.showToast('File processing cancelled by user', 'info');
                        return;
                    }
                    
                    setTimeout(() => {
                        CertificateInfoDialog.showProcessingTips();
                    }, 500);
                }
            }
        }

        if (accumulate && this.uiHandler.selectedFiles.length > 0) {
            const newUniqueFiles = finalValidFiles.filter(newFile => {
                return !this.uiHandler.selectedFiles.some(existingFile => 
                    existingFile.name === newFile.name && 
                    existingFile.size === newFile.size &&
                    existingFile.lastModified === newFile.lastModified
                );
            });

            if (newUniqueFiles.length === 0) {
                Utils.showToast('Selected files are already in the list', 'warning');
                return;
            }

            if (newUniqueFiles.length !== finalValidFiles.length) {
                const duplicates = finalValidFiles.length - newUniqueFiles.length;
                Utils.showToast(
                    `${newUniqueFiles.length} file(s) added. ${duplicates} duplicate(s) ignored.`, 
                    'info'
                );
            } else {
                let message = `${newUniqueFiles.length} file(s) added`;
                if (certificateFiles.length > 0) {
                    message += ` (including ${certificateFiles.length} certificate(s))`;
                }
                Utils.showToast(message, 'success');
            }

            this.uiHandler.selectedFiles = [...this.uiHandler.selectedFiles, ...newUniqueFiles];
            
        } else {
            this.uiHandler.selectedFiles = finalValidFiles;
            
            if (finalValidFiles.length > 0) {
                let message = `${finalValidFiles.length} file(s) selected`;
                if (certificateFiles.length > 0) {
                    message += ` (${certificateFiles.length} certificate(s))`;
                }
                if (problematicFiles.length > 0) {
                    message += ` (${problematicFiles.length} protected)`;
                }
                Utils.showToast(message, 'success');
            }
        }

        this.uiHandler.showWorkspace();
        await this.uiHandler.displayFiles();
    }

    createTextFileItem(file, index) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item text-file fade-in';
        fileItem.dataset.index = index;
        
        const fileType = Utils.getFileCategory(file);
        const iconClass = this.getFileIcon('text', file);
        const preview = this.generateTextPreview(file);
        
        fileItem.innerHTML = `
            <div class="file-type-indicator ${fileType}">${fileType.toUpperCase()}</div>
            <div class="file-icon">
                <i class="bi ${iconClass}"></i>
            </div>
            <div class="file-name">${file.name}</div>
            <div class="file-size">${Utils.formatFileSize(file.size)}</div>
            <div class="text-preview">${preview}</div>
            <div class="conversion-quality">
                <div class="quality-dot active"></div>
                <div class="quality-dot active"></div>
                <div class="quality-dot active"></div>
            </div>
            <div class="file-actions">
                <button class="btn btn-sm btn-outline-primary view-btn" title="Preview">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-success config-btn" title="Configure">
                    <i class="bi bi-gear"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger remove-btn" title="Remove">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        
        const viewBtn = fileItem.querySelector('.view-btn');
        const configBtn = fileItem.querySelector('.config-btn');
        const removeBtn = fileItem.querySelector('.remove-btn');
        
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.viewFile(file, index);
        });
        
        configBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showConversionConfig(file, index);
        });
        
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeFile(index);
        });
        
        return fileItem;
    }

    async generateTextPreview(file) {
        try {
            const text = await file.text();
            const lines = text.split('\n').slice(0, 3);
            const preview = lines.map(line => line.trim()).join(' ').substring(0, 100);
            return preview || 'Empty file';
        } catch (error) {
            return 'Preview unavailable';
        }
    }

    showConversionConfig(file, index) {
        const existingConfig = document.querySelector('.conversion-config.active');
        if (existingConfig) {
            existingConfig.remove();
        }
        
        const fileItem = document.querySelector(`[data-index="${index}"]`);
        
        const configPanel = document.createElement('div');
        configPanel.className = 'conversion-config active';
        configPanel.innerHTML = `
            <h6><i class="bi bi-gear me-2"></i>Conversion Settings for ${file.name}</h6>
            <div class="row">
                <div class="col-md-6">
                    <label class="form-label">Font Size</label>
                    <select class="form-select form-select-sm" id="fontSize-${index}">
                        <option value="9">Small (9pt)</option>
                        <option value="11" selected>Normal (11pt)</option>
                        <option value="12">Medium (12pt)</option>
                        <option value="14">Large (14pt)</option>
                    </select>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Line Height</label>
                    <select class="form-select form-select-sm" id="lineHeight-${index}">
                        <option value="1.2">Compact (1.2)</option>
                        <option value="1.4" selected>Normal (1.4)</option>
                        <option value="1.6">Comfortable (1.6)</option>
                        <option value="1.8">Spacious (1.8)</option>
                    </select>
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-md-6">
                    <label class="form-label">Margins</label>
                    <select class="form-select form-select-sm" id="margin-${index}">
                        <option value="40">Narrow (40pt)</option>
                        <option value="60" selected>Normal (60pt)</option>
                        <option value="80">Wide (80pt)</option>
                    </select>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Page Size</label>
                    <select class="form-select form-select-sm" id="pageSize-${index}">
                        <option value="a4" selected>A4 (210×297mm)</option>
                        <option value="letter">Letter (8.5×11")</option>
                        <option value="legal">Legal (8.5×14")</option>
                    </select>
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-12">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="preserveFormatting-${index}" checked>
                        <label class="form-check-label" for="preserveFormatting-${index}">
                            Preserve original formatting
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="detectHeaders-${index}" checked>
                        <label class="form-check-label" for="detectHeaders-${index}">
                            Auto-detect headers and structure
                        </label>
                    </div>
                </div>
            </div>
            <div class="mt-3 text-end">
                <button class="btn btn-sm btn-secondary me-2" onclick="this.parentElement.parentElement.remove()">
                    Cancel
                </button>
                <button class="btn btn-sm btn-primary" onclick="this.parentElement.parentElement.classList.add('saved'); setTimeout(() => this.parentElement.parentElement.remove(), 1000);">
                    <i class="bi bi-check-lg me-1"></i>Save Settings
                </button>
            </div>
        `;
        
        fileItem.insertAdjacentElement('afterend', configPanel);
        configPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    getConversionConfig(fileIndex) {
        const defaultConfig = {
            fontSize: 11,
            lineHeight: 1.4,
            margin: 60,
            pageSize: 'a4',
            preserveFormatting: true,
            detectHeaders: true
        };
        
        try {
            const fontSize = document.getElementById(`fontSize-${fileIndex}`)?.value;
            const lineHeight = document.getElementById(`lineHeight-${fileIndex}`)?.value;
            const margin = document.getElementById(`margin-${fileIndex}`)?.value;
            const pageSize = document.getElementById(`pageSize-${fileIndex}`)?.value;
            const preserveFormatting = document.getElementById(`preserveFormatting-${fileIndex}`)?.checked;
            const detectHeaders = document.getElementById(`detectHeaders-${fileIndex}`)?.checked;
            
            return {
                fontSize: fontSize ? parseInt(fontSize) : defaultConfig.fontSize,
                lineHeight: lineHeight ? parseFloat(lineHeight) : defaultConfig.lineHeight,
                margin: margin ? parseInt(margin) : defaultConfig.margin,
                pageSize: pageSize || defaultConfig.pageSize,
                preserveFormatting: preserveFormatting !== undefined ? preserveFormatting : defaultConfig.preserveFormatting,
                detectHeaders: detectHeaders !== undefined ? detectHeaders : defaultConfig.detectHeaders
            };
        } catch (error) {
            return defaultConfig;
        }
    }

    validateFiles(files) {
        const validFiles = [];
        
        for (const file of files) {
            let isValid = false;
            let errorMessage = '';
            
            switch (this.uiHandler.currentTool) {
                case 'merge':
                case 'split':
                case 'reorder':
                case 'compress':
                case 'view':
                    isValid = Utils.isPDF(file);
                    errorMessage = 'Only PDF files are supported for this tool';
                    break;
                case 'convert':
                    isValid = Utils.isImage(file) || Utils.isText(file);
                    errorMessage = 'Only images and text files are supported for conversion';
                    break;
                default:
                    isValid = Utils.isPDF(file) || Utils.isImage(file) || Utils.isText(file);
                    errorMessage = 'Unsupported file format';
                    break;
            }
            
            if (isValid && Utils.validateFileSize(file)) {
                validFiles.push(file);
            } else if (!isValid) {
                Utils.showToast(`${file.name}: ${errorMessage}`, 'warning');
            } else {
                Utils.showToast(`File too large: ${file.name} (max 50MB)`, 'warning');
            }
        }
        
        return validFiles;
    }

    createFileItem(file, index) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item fade-in';
        fileItem.dataset.index = index;
        
        const isDraggable = this.uiHandler.currentTool === 'merge' || this.uiHandler.currentTool === 'reorder';
        fileItem.draggable = isDraggable;
        
        if (isDraggable) {
            fileItem.classList.add('draggable-item');
        }
        
        const fileType = Utils.getFileType(file);
        const iconClass = this.getFileIcon(fileType, file);
        
        const orderNumber = this.uiHandler.currentTool === 'merge' ? 
            `<div class="order-number">${index + 1}</div>` : '';
        
        const dragHandle = isDraggable ? 
            `<div class="drag-handle" title="Drag to reorder">
                <i class="bi bi-grip-vertical"></i>
            </div>` : '';
        
        const fileInfo = this.getFileInfo(file);
        
        fileItem.innerHTML = `
            ${dragHandle}
            ${orderNumber}
            <div class="file-icon">
                <i class="bi ${iconClass}"></i>
            </div>
            <div class="file-name">${file.name}</div>
            <div class="file-size">${Utils.formatFileSize(file.size)}</div>
            <div class="file-type">${fileInfo}</div>
            <div class="file-actions">
                <button class="btn btn-sm btn-outline-primary view-btn" title="View">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger remove-btn" title="Remove">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
            ${this.uiHandler.currentTool === 'reorder' ? `<div class="page-number">${index + 1}</div>` : ''}
        `;
        
        const viewBtn = fileItem.querySelector('.view-btn');
        const removeBtn = fileItem.querySelector('.remove-btn');
        
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.viewFile(file, index);
        });
        
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeFile(index);
        });
        
        if (this.uiHandler.currentTool === 'split') {
            fileItem.addEventListener('click', () => {
                fileItem.classList.toggle('selected');
            });
        }
        
        return fileItem;
    }

    getFileIcon(fileType, file) {
        const extension = Utils.getFileExtension(file.name);
        
        const icons = {
            pdf: 'bi-file-earmark-pdf-fill',
            image: this.getImageIcon(extension),
            text: this.getTextIcon(extension),
            document: 'bi-file-earmark-word-fill'
        };
        
        return icons[fileType] || 'bi-file-earmark-fill';
    }

    getImageIcon(extension) {
        const imageIcons = {
            'jpg': 'bi-file-earmark-image-fill',
            'jpeg': 'bi-file-earmark-image-fill',
            'png': 'bi-file-earmark-image-fill',
            'gif': 'bi-file-earmark-image-fill',
            'webp': 'bi-file-earmark-image-fill',
            'bmp': 'bi-file-earmark-image-fill',
            'tiff': 'bi-file-earmark-image-fill',
            'tif': 'bi-file-earmark-image-fill',
            'svg': 'bi-file-earmark-code-fill'
        };
        
        return imageIcons[extension] || 'bi-file-earmark-image-fill';
    }

    getTextIcon(extension) {
        const textIcons = {
            'txt': 'bi-file-earmark-text-fill',
            'csv': 'bi-file-earmark-spreadsheet-fill',
            'html': 'bi-file-earmark-code-fill',
            'htm': 'bi-file-earmark-code-fill',
            'md': 'bi-file-earmark-richtext-fill',
            'markdown': 'bi-file-earmark-richtext-fill',
            'json': 'bi-file-earmark-code-fill',
            'xml': 'bi-file-earmark-code-fill',
            'log': 'bi-file-earmark-text-fill'
        };
        
        return textIcons[extension] || 'bi-file-earmark-text-fill';
    }

    getFileInfo(file) {
        const extension = Utils.getFileExtension(file.name).toUpperCase();
        const category = Utils.getFileCategory(file);
        
        const descriptions = {
            'csv': 'CSV Spreadsheet',
            'html': 'HTML Document',
            'markdown': 'Markdown Document',
            'json': 'JSON Data',
            'xml': 'XML Document',
            'log': 'Log File',
            'text': 'Text Document'
        };
        
        return descriptions[category] || `${extension} File`;
    }

    removeFile(index) {
        this.uiHandler.selectedFiles.splice(index, 1);
        this.uiHandler.displayFiles();
        
        if (this.uiHandler.selectedFiles.length === 0) {
            this.uiHandler.goBack();
        } else {
            Utils.showToast('File removed', 'info');
        }
    }

    async viewFile(file, index) {
        if (Utils.isPDF(file)) {
            await this.uiHandler.pdfViewer.showPDFViewer(file);
        } else if (Utils.isImage(file)) {
            this.uiHandler.pdfViewer.showImageViewer(file);
        } else if (Utils.isText(file)) {
            await this.uiHandler.pdfViewer.showTextViewer(file);
        } else {
            Utils.showToast('File preview not supported for this format', 'info');
        }
    }
}