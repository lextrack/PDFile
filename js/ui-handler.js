class UIHandler {
    constructor() {
        this.currentTool = null;
        this.selectedFiles = [];
        this.draggedElement = null;
        this.currentPDFDoc = null;
        this.currentPageNum = 1;
        this.totalPages = 0;
        this.renderTask = null;
        this.pdfScale = 1.5;
        this.isDragging = false;
        this.pdfPages = [];
        
        this.fileHandler = new FileHandler(this);
        this.dragDropHandler = new DragDropHandler(this);
        this.pdfViewer = new PDFViewer(this);
        this.pageReorder = new PageReorderHandler(this);
    }

    init() {
        this.setupToolCardListeners();
        this.setupWorkspaceListeners();
        this.setupKeyboardShortcuts();
        this.loadPDFJS();
    }

    async loadPDFJS() {
        if (typeof pdfjsLib === 'undefined') {
            try {
                console.log('Loading PDF.js dynamically...');
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                
                await new Promise((resolve, reject) => {
                    script.onload = () => {
                        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                        console.log('PDF.js 3.11.174 loaded successfully');
                        resolve();
                    };
                    script.onerror = (error) => {
                        console.error('Error loading PDF.js:', error);
                        reject(error);
                    };
                    document.head.appendChild(script);
                });
                
                if (typeof pdfjsLib !== 'undefined') {
                    console.log('PDF.js version:', pdfjsLib.version || '3.11.174');
                }
                
            } catch (error) {
                console.error('Failed to load PDF.js dynamically:', error);
                if (typeof pdfjsLib !== 'undefined') {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                }
            }
        } else {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            console.log('PDF.js already loaded, worker updated');
            
            if (pdfjsLib.version) {
                console.log('Current PDF.js version:', pdfjsLib.version);
            }
        }
    }

    setupToolCardListeners() {
        const toolCards = document.querySelectorAll('.tool-card');
        toolCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const tool = card.dataset.tool;
                toolCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectTool(tool);
            });
        });
    }

    setupWorkspaceListeners() {
        const backBtn = document.getElementById('backBtn');
        const processBtn = document.getElementById('processBtn');
        const clearFilesBtn = document.getElementById('clearFilesBtn');
        
        processBtn?.addEventListener('click', () => {
            this.processFiles();
        });

        backBtn?.addEventListener('click', () => {
            this.goBack();
        });

        clearFilesBtn?.addEventListener('click', () => {
            if (this.selectedFiles.length > 0) {
                if (confirm('Are you sure you want to remove all files?')) {
                    this.selectedFiles = [];
                    this.displayFiles();
                    Utils.showToast('All files have been removed', 'info');
                    this.goBack();
                }
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.processFiles();
                        break;
                    case 'n':
                        e.preventDefault();
                        this.goBack();
                        break;
                }
            }
            
            if (e.key === 'Escape') {
                if (this.currentTool) {
                    this.goBack();
                }
            }
        });
    }

    selectTool(tool) {
        if (this.currentTool === tool) {
            this.showUploadSection();
            return;
        }
        
        if (this.currentTool && this.currentTool !== tool) {
            if (this.selectedFiles.length > 0) {
                Utils.showToast(
                    `Switching to "${this.getToolDisplayName(tool)}". Previous files cleared.`, 
                    'info'
                );
            }
            this.clearWorkspace();
        }
        
        this.currentTool = tool;
        this.showUploadSection();
        this.updateWorkspaceTitle(tool);
    }

    getToolDisplayName(tool) {
        const names = {
            merge: 'Merge PDFs',
            split: 'Split PDF',
            reorder: 'Reorder Pages',
            compress: 'Compress PDF',
            convert: 'Convert to PDF',
            view: 'View PDF'
        };
        return names[tool] || tool;
    }

    clearWorkspace() {
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('workspace').style.display = 'none';
        document.getElementById('pdfViewer').style.display = 'none';
        
        this.selectedFiles = [];
        this.currentPDFDoc = null;
        this.currentPageNum = 1;
        this.totalPages = 0;
        this.pdfPages = [];
        
        document.getElementById('fileList').innerHTML = '';
        document.getElementById('pdfViewer').innerHTML = '';
        
        document.getElementById('fileInput').value = '';
        if (document.getElementById('imageInput')) {
            document.getElementById('imageInput').value = '';
        }
        
        this.revokeObjectURLs();
    }

    showUploadSection() {
        document.getElementById('uploadSection').style.display = 'block';
        document.getElementById('uploadSection').scrollIntoView({ behavior: 'smooth' });
    }

    updateWorkspaceTitle(tool) {
        const titles = {
            merge: 'Merge PDFs',
            split: 'Split PDF',
            reorder: 'Reorder Pages',
            compress: 'Compress PDF',
            convert: 'Convert to PDF',
            view: 'View PDF'
        };
        
        const titleElement = document.getElementById('workspaceTitle');
        titleElement.textContent = titles[tool] || 'Workspace';
    }

    async displayFiles() {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        
        if (this.currentTool === 'reorder' && this.selectedFiles.length === 1) {
            await this.pageReorder.displayPDFPages(this.selectedFiles[0]);
            return;
        }
        
        if (this.currentTool === 'merge' && this.selectedFiles.length > 1) {
            const instructionDiv = document.createElement('div');
            instructionDiv.className = 'merge-instructions alert alert-info fade-in';
            instructionDiv.innerHTML = `
                <i class="bi bi-info-circle me-2"></i>
                <strong>Drag files to change merge order</strong>
                <br><small>Files will be merged in the order shown below (top to bottom)</small>
            `;
            fileList.appendChild(instructionDiv);
        }
        
        for (let i = 0; i < this.selectedFiles.length; i++) {
            const file = this.selectedFiles[i];
            const fileItem = this.fileHandler.createFileItem(file, i);
            fileList.appendChild(fileItem);
        }
        
        if (this.currentTool === 'merge' || this.currentTool === 'reorder') {
            this.dragDropHandler.setupDragAndDrop();
        }
    }

    showWorkspace() {
        document.getElementById('workspace').style.display = 'block';
        document.getElementById('workspace').scrollIntoView({ behavior: 'smooth' });
    
    }

    async processFiles() {
        if (this.selectedFiles.length === 0) {
            Utils.showToast('No files to process', 'warning');
            return;
        }
        
        try {
            Utils.showProgress('Starting processing...');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            await this.executeCurrentTool();
            
            Utils.showToast('Processing completed successfully', 'success');
            
            if (window.pdfApp) {
                window.pdfApp.updateUsageStats(this.currentTool);
            }
            
        } catch (error) {
            console.error('Processing error:', error);
            Utils.showToast(error.message || 'Error during processing', 'error');
        } finally {
            setTimeout(() => {
                Utils.hideProgress();
            }, 500);
        }
    }

    async executeCurrentTool() {
        switch (this.currentTool) {
            case 'merge':
                await this.executeMerge();
                break;
            case 'split':
                await this.executeSplit();
                break;
            case 'reorder':
                await this.pageReorder.executeReorder();
                break;
            case 'compress':
                await this.executeCompress();
                break;
            case 'convert':
                await this.executeConvert();
                break;
            default:
                throw new Error('Tool not implemented');
        }
    }

    async executeCompress() {
        if (this.selectedFiles.length !== 1) {
            throw new Error('Select exactly one PDF file to compress');
        }
        
        const file = this.selectedFiles[0];
        
        if (!Utils.isPDF(file)) {
            throw new Error('Only PDF files can be compressed');
        }
        
        try {
            const compressor = new PDFCompressor();
            const compressionLevel = await compressor.showCompressionOptions(file);
            Utils.showProgress('Starting compression...');
            await compressor.compressPDF(file, compressionLevel);
            
        } catch (error) {
            if (error.message === 'User cancelled compression') {
                Utils.showToast('Compression cancelled', 'info');
                return;
            }
            throw error;
        }
    }

    async executeMerge() {
        const pdfOperations = new PDFOperations();
        const pdfDataArray = [];
        const skippedFiles = [];
        const processedFiles = [];
        
        Utils.updateProgress(10, 'Loading PDF files...');
        
        for (let i = 0; i < this.selectedFiles.length; i++) {
            const file = this.selectedFiles[i];
            Utils.updateProgress(10 + (i / this.selectedFiles.length) * 30, 
                            `Loading ${file.name}... (${i + 1}/${this.selectedFiles.length})`);
            
            try {
                const pdfData = await pdfOperations.loadPDF(file);
                pdfDataArray.push(pdfData);
                processedFiles.push(file.name);
            } catch (error) {
                console.warn(`Skipping file ${file.name}:`, error.message);
                
                if (error.message.startsWith('SKIP_FILE:')) {
                    const cleanError = error.message.replace('SKIP_FILE:', '');
                    skippedFiles.push({
                        name: file.name,
                        reason: cleanError
                    });
                } else {
                    skippedFiles.push({
                        name: file.name,
                        reason: `Unexpected error: ${error.message}`
                    });
                }
            }
        }
        
        if (pdfDataArray.length === 0) {
            const skippedList = skippedFiles.map(f => `• ${f.name}: ${f.reason}`).join('\n');
            throw new Error(`No files could be processed:\n\n${skippedList}\n\nTry with different PDF files.`);
        }
        
        if (skippedFiles.length > 0) {
            const skippedNames = skippedFiles.map(f => f.name).join(', ');
            Utils.showToast(
                `${skippedFiles.length} file(s) skipped due to security restrictions: ${skippedNames}`, 
                'warning'
            );
            
            console.warn('Skipped files details:', skippedFiles);
        }
        
        Utils.updateProgress(50, `Merging ${pdfDataArray.length} processable documents...`);
        const mergedPdfBytes = await pdfOperations.mergePDFs(pdfDataArray);
        
        Utils.updateProgress(90, 'Preparing download...');
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        
        const fileName = pdfDataArray.length > 1 ? 
            `${pdfDataArray.length}_pdfs_merged.pdf` : 
            'merged_document.pdf';
            
        Utils.downloadFile(blob, fileName);
        
        Utils.updateProgress(100, 'Completed');
        
        const successSummary = processedFiles.map((name, index) => 
            `${index + 1}. ${name}`
        ).join('\n');
        
        console.log('PDFs merged successfully:\n' + successSummary);
        
        if (skippedFiles.length > 0) {
            console.log('Skipped files:\n' + skippedFiles.map(f => `• ${f.name}: ${f.reason}`).join('\n'));
        }
        
        let finalMessage = `Successfully merged ${pdfDataArray.length} PDF(s)`;
        if (skippedFiles.length > 0) {
            finalMessage += `\n${skippedFiles.length} file(s) were skipped due to security restrictions`;
        }
        
        Utils.showToast(finalMessage, pdfDataArray.length > 0 ? 'success' : 'warning');
    }

    async executeSplit() {
        if (this.selectedFiles.length !== 1) {
            throw new Error('Select exactly one PDF file to split');
        }
        
        Utils.updateProgress(20, 'Requesting pages to extract...');
        
        const pages = prompt('Enter page numbers to extract (comma separated):');
        if (!pages) {
            throw new Error('Operation cancelled by user');
        }
        
        const pageNumbers = pages.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
        if (pageNumbers.length === 0) {
            throw new Error('No valid pages specified');
        }
        
        Utils.updateProgress(40, 'Loading PDF document...');
        
        const pdfOperations = new PDFOperations();
        const pdfData = await pdfOperations.loadPDF(this.selectedFiles[0]);
        
        Utils.updateProgress(70, 'Extracting pages...');
        
        const splitPdfBytes = await pdfOperations.splitPDF(pdfData, pageNumbers);
        
        Utils.updateProgress(90, 'Preparing download...');
        
        const blob = new Blob([splitPdfBytes], { type: 'application/pdf' });
        Utils.downloadFile(blob, 'extracted_pages.pdf');
        
        Utils.updateProgress(100, 'Completed');
    }

    async executeConvert() {
        const imageFiles = this.selectedFiles.filter(file => Utils.isImage(file));
        const textFiles = this.selectedFiles.filter(file => Utils.isText(file));
        
        const totalFiles = imageFiles.length + textFiles.length;
        let processedFiles = 0;
        
        if (totalFiles === 0) {
            throw new Error('No files selected for conversion');
        }
        
        Utils.updateProgress(5, 'Starting conversion process...');
        
        const results = [];
        
        if (imageFiles.length > 0) {
            Utils.updateProgress(10, `Converting ${imageFiles.length} image(s) to PDF...`);
            
            try {
                const pdfBytes = await FormatConverterFactory.convertMultipleFiles(imageFiles, 'image');
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                
                if (imageFiles.length === 1) {
                    const fileName = imageFiles[0].name.replace(/\.[^/.]+$/, '') + '.pdf';
                    Utils.downloadFile(blob, fileName);
                } else {
                    Utils.downloadFile(blob, `${imageFiles.length}_images_converted.pdf`);
                }
                
                results.push({
                    type: 'images',
                    count: imageFiles.length,
                    success: true,
                    fileName: imageFiles.length === 1 ? 
                        imageFiles[0].name.replace(/\.[^/.]+$/, '') + '.pdf' :
                        `${imageFiles.length}_images_converted.pdf`
                });
                
                processedFiles += imageFiles.length;
                Utils.updateProgress(30 + (processedFiles / totalFiles) * 30, 
                    `Successfully converted ${imageFiles.length} image(s)`);
                
            } catch (error) {
                console.error('Error converting images:', error);
                results.push({
                    type: 'images',
                    count: imageFiles.length,
                    success: false,
                    error: error.message
                });
            }
        }
        
        if (textFiles.length > 0) {
            Utils.updateProgress(40, 'Converting text files to PDF...');
            
            const fileGroups = this.groupTextFilesByType(textFiles);
            
            for (const [fileType, files] of Object.entries(fileGroups)) {
                Utils.updateProgress(
                    40 + (processedFiles / totalFiles) * 40, 
                    `Converting ${files.length} ${fileType.toUpperCase()} file(s)...`
                );
                
                try {
                    if (files.length === 1) {
                        const file = files[0];
                        const fileIndex = this.selectedFiles.indexOf(file);
                        const config = this.fileHandler.getConversionConfig ? 
                            this.fileHandler.getConversionConfig(fileIndex) : {};
                        
                        const pdfBytes = await FormatConverterFactory.convertFile(file, fileType, config);
                        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                        const fileName = file.name.replace(/\.[^/.]+$/, '') + '.pdf';
                        
                        Utils.downloadFile(blob, fileName);
                        
                        results.push({
                            type: fileType,
                            count: 1,
                            success: true,
                            fileName: fileName,
                            originalFile: file.name
                        });
                        
                    } else {
                        const combinedPdfBytes = await FormatConverterFactory.convertMultipleFiles(files, fileType);
                        const blob = new Blob([combinedPdfBytes], { type: 'application/pdf' });
                        const fileName = `${files.length}_${fileType}_files_converted.pdf`;
                        
                        Utils.downloadFile(blob, fileName);
                        
                        results.push({
                            type: fileType,
                            count: files.length,
                            success: true,
                            fileName: fileName,
                            originalFiles: files.map(f => f.name)
                        });
                    }
                    
                    processedFiles += files.length;
                    
                    const progressPercent = 40 + (processedFiles / totalFiles) * 40;
                    Utils.updateProgress(progressPercent, 
                        `Converted ${files.length} ${fileType.toUpperCase()} file(s) successfully`);
                    
                } catch (error) {
                    console.error(`Error converting ${fileType} files:`, error);
                    results.push({
                        type: fileType,
                        count: files.length,
                        success: false,
                        error: error.message,
                        originalFiles: files.map(f => f.name)
                    });
                }
            }
        }
        
        Utils.updateProgress(90, 'Finalizing conversion...');
        
        this.showConversionSummary(results);
        
        Utils.updateProgress(100, 'Conversion completed');
    }

    groupTextFilesByType(textFiles) {
        const groups = {};
        
        for (const file of textFiles) {
            const category = Utils.getFileCategory(file);
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(file);
        }
        
        return groups;
    }

    showConversionSummary(results) {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        let message = '';
        
        if (successful.length > 0) {
            message += `✅ Successfully converted:\n`;
            successful.forEach(result => {
                if (result.count === 1) {
                    message += `• ${result.originalFile || result.fileName}\n`;
                } else {
                    message += `• ${result.count} ${result.type.toUpperCase()} files → ${result.fileName}\n`;
                }
            });
        }
        
        if (failed.length > 0) {
            message += `\n❌ Failed conversions:\n`;
            failed.forEach(result => {
                message += `• ${result.count} ${result.type.toUpperCase()} file(s): ${result.error}\n`;
            });
        }
        
        const totalFiles = results.reduce((sum, r) => sum + r.count, 0);
        const successfulFiles = successful.reduce((sum, r) => sum + r.count, 0);
        
        if (successfulFiles === totalFiles) {
            Utils.showToast(message.trim(), 'success');
        } else if (successfulFiles > 0) {
            Utils.showToast(message.trim(), 'warning');
        } else {
            Utils.showToast('All conversions failed:\n' + message.trim(), 'error');
        }
    }

    async convertSingleTextFile(pdfOperations, file, fileType, config = {}) {
        const content = await file.text();
        const conversionOptions = {
            fontSize: config.fontSize || 11,
            lineHeight: config.lineHeight || 1.4,
            margin: config.margin || 60,
            preserveFormatting: config.preserveFormatting !== false,
            detectHeaders: config.detectHeaders !== false,
            ...config
        };
        
        switch (fileType) {
            case 'csv':
                return await pdfOperations.csvToPDF(content, conversionOptions);
            case 'html':
                return await pdfOperations.htmlToPDF(content, conversionOptions);
            case 'markdown':
                return await pdfOperations.markdownToPDF(content, conversionOptions);
            case 'json':
                const formattedJson = JSON.stringify(JSON.parse(content), null, 2);
                return await pdfOperations.textToPDF(formattedJson, {
                    ...conversionOptions,
                    fontFamily: 'courier'
                });
            case 'xml':
                return await pdfOperations.textToPDF(content, {
                    ...conversionOptions,
                    fontFamily: 'courier'
                });
            default:
                return await pdfOperations.textToPDF(content, conversionOptions);
        }
    }

    async convertMultipleTextFiles(pdfOperations, files, fileType) {
        let combinedContent = '';
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const content = await file.text();
            
            if (i > 0) {
                combinedContent += '\n\n';
                combinedContent += '═'.repeat(60) + '\n';
            }
            
            combinedContent += `FILE: ${file.name}\n`;
            combinedContent += '─'.repeat(40) + '\n\n';
            combinedContent += content;
            
            if (i < files.length - 1) {
                combinedContent += '\n\n';
            }
        }
        
        const conversionOptions = {
            fontSize: 10,
            lineHeight: 1.3,
            margin: 50,
            preserveFormatting: true,
            detectHeaders: true
        };
        
        switch (fileType) {
            case 'csv':
                return await pdfOperations.textToPDF(combinedContent, conversionOptions);
            case 'html':
                return await pdfOperations.htmlToPDF(combinedContent, conversionOptions);
            case 'markdown':
                return await pdfOperations.markdownToPDF(combinedContent, conversionOptions);
            case 'json':
                try {
                    const formattedContent = combinedContent.replace(
                        /FILE: (.+\.json)\n─+\n\n([\s\S]*?)(?=\n\n═|$)/g,
                        (match, fileName, jsonContent) => {
                            try {
                                const formatted = JSON.stringify(JSON.parse(jsonContent.trim()), null, 2);
                                return `FILE: ${fileName}\n${'─'.repeat(40)}\n\n${formatted}`;
                            } catch {
                                return match;
                            }
                        }
                    );
                    return await pdfOperations.textToPDF(formattedContent, {
                        ...conversionOptions,
                        fontFamily: 'courier'
                    });
                } catch {
                    return await pdfOperations.textToPDF(combinedContent, conversionOptions);
                }
            default:
                return await pdfOperations.textToPDF(combinedContent, conversionOptions);
        }
    }

    showConversionSummary(results) {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        let message = '';
        
        if (successful.length > 0) {
            message += `✅ Successfully converted:\n`;
            successful.forEach(result => {
                if (result.count === 1) {
                    message += `• ${result.originalFile || result.fileName}\n`;
                } else {
                    message += `• ${result.count} ${result.type.toUpperCase()} files → ${result.fileName}\n`;
                }
            });
        }
        
        if (failed.length > 0) {
            message += `\n❌ Failed conversions:\n`;
            failed.forEach(result => {
                message += `• ${result.count} ${result.type.toUpperCase()} file(s): ${result.error}\n`;
            });
        }
        
        const totalFiles = results.reduce((sum, r) => sum + r.count, 0);
        const successfulFiles = successful.reduce((sum, r) => sum + r.count, 0);
        
        if (successfulFiles === totalFiles) {
            Utils.showToast(message.trim(), 'success');
        } else if (successfulFiles > 0) {
            Utils.showToast(message.trim(), 'warning');
        } else {
            Utils.showToast('All conversions failed:\n' + message.trim(), 'error');
        }
    }

    revokeObjectURLs() {
        const blobElements = document.querySelectorAll('img[src^="blob:"], a[href^="blob:"]');
        blobElements.forEach(element => {
            const url = element.src || element.href;
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });
    }

    goBack() {
        this.clearWorkspace();
        this.currentTool = null;
        this.deselectAllToolCards();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    deselectAllToolCards() {
        const toolCards = document.querySelectorAll('.tool-card');
        toolCards.forEach(card => card.classList.remove('selected'));
    }
}