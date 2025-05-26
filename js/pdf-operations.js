class PDFOperations {
    constructor() {
        this.pdfs = new Map();
        this.currentTool = null;
    }

    async loadPDF(file) {
        try {
            const arrayBuffer = await Utils.fileToArrayBuffer(file);
            const bytes = new Uint8Array(arrayBuffer.slice(0, 16384));
            const pdfString = String.fromCharCode.apply(null, bytes);
            const detector = new UniversalProtectedDocumentDetector();
            const detectionResult = detector.shouldUseSpecializedProcessing(file, pdfString);
            
            if (detectionResult.needsSpecialProcessing) {
                const analysis = detectionResult.analysis;
                
                console.log(`Special processing needed for ${file.name}:`, {
                    type: analysis.documentType,
                    language: analysis.detectedLanguage,
                    technology: analysis.technology,
                    protection: analysis.protectionLevel,
                    method: analysis.processingRecommendation
                });
                
                let message = `Processing ${analysis.documentType}`;
                if (analysis.detectedLanguage !== 'unknown') {
                    message += ` (${analysis.detectedLanguage})`;
                }
                if (analysis.technology !== 'unknown') {
                    message += ` - ${analysis.technology}`;
                }
                message += `: ${file.name}`;
                
                Utils.showToast(message, 'info');
                
                switch (analysis.processingRecommendation) {
                    case 'specialized_tcpdf':
                        return await this.processWithTCPDFMethod(file, arrayBuffer, analysis);
                    
                    case 'specialized_certificate':
                        return await this.processWithCertificateMethod(file, arrayBuffer, analysis);
                    
                    case 'specialized_protected':
                        return await this.processWithProtectedMethod(file, arrayBuffer, analysis);
                    
                    default:
                        return await this.processWithCertificateMethod(file, arrayBuffer, analysis);
                }
            }
            
            let pdfDoc;
            try {
                pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            } catch (error) {
                if (error.message.includes('encrypted') || error.message.includes('Encrypted')) {
                    console.log(`Encryption detected during load, switching to specialized processing: ${file.name}`);
                    return await this.processWithProtectedMethod(file, arrayBuffer, { protectionLevel: 'detected' });
                }
                throw error;
            }
            
            const pageCount = pdfDoc.getPageCount();
            if (pageCount === 0) {
                throw new Error(`PDF has no pages: ${file.name}`);
            }
            
            const pdfData = {
                document: pdfDoc,
                file: file,
                pageCount: pageCount,
                id: Utils.generateId(),
                isEncrypted: false,
                isConverted: false
            };
            
            this.pdfs.set(pdfData.id, pdfData);
            return pdfData;
            
        } catch (error) {
            console.error('Error loading PDF:', error);
            throw error;
        }
    }

    async processWithTCPDFMethod(file, arrayBuffer, analysis) {
        console.log(`Using TCPDF specialized method for ${file.name}`);
        return await this.emergencyProcessCertificate(file, arrayBuffer);
    }

    async processWithCertificateMethod(file, arrayBuffer, analysis) {
        console.log(`Using general certificate method for ${file.name}`);
        
        try {
            if (window.processProtectedCertificate) {
                return await window.processProtectedCertificate(file);
            } else {
                return await this.emergencyProcessCertificate(file, arrayBuffer);
            }
        } catch (error) {
            console.warn(`Certificate method failed for ${file.name}, trying emergency`);
            return await this.emergencyProcessCertificate(file, arrayBuffer);
        }
    }

    async processWithProtectedMethod(file, arrayBuffer, analysis) {
        console.log(`Processing with ProtectedPDFProcessor: ${file.name}`);
        
        try {
            const processor = new ProtectedPDFProcessor();
            const result = await processor.processProtectedPDF(file, '');
            processor.cleanup();
            
            if (result && result.pageCount > 0) {
                if (result.successfulPages && result.successfulPages < result.pageCount) {
                    console.log(`ProtectedPDFProcessor partial success: ${result.successfulPages}/${result.pageCount} pages for ${file.name}`);
                } else {
                    console.log(`ProtectedPDFProcessor success: ${file.name}`);
                }
                return result;
            } else {
                throw new Error('No usable content generated');
            }
            
        } catch (error) {
            console.log(`ProtectedPDFProcessor failed for ${file.name}, trying emergency method...`);
            
            if (error.message.startsWith('FALLBACK_NEEDED:')) {
                console.debug('Expected fallback scenario:', error.message);
            } else {
                console.debug('ProtectedPDFProcessor error:', error.message);
            }
            
            return await this.emergencyProcessCertificate(file, arrayBuffer);
        }
    }


    async emergencyProcessCertificate(file, arrayBuffer) {
        try {
            console.log(`EMERGENCY PROCESSING: ${file.name} (fallback method)`);
            
            const newPdf = await PDFLib.PDFDocument.create();
            
            try {
                const loadingTask = pdfjsLib.getDocument({ 
                    data: arrayBuffer,
                    verbosity: 0,
                    stopAtErrors: false,
                    ignoreErrors: true,
                    disableFontFace: true,
                    useSystemFonts: false,
                    disableRange: false,
                    disableStream: false,
                    disableAutoFetch: false,
                    maxImageSize: -1,
                    isEvalSupported: false,
                    fontExtraProperties: true
                });
                
                const pdfDoc = await loadingTask.promise;
                const numPages = pdfDoc.numPages;
                
                console.log(`Emergency processing: ${numPages} pages from certificate`);
                
                let successfulPages = 0;
                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                    try {
                        const success = await this.renderCertificatePageEmergency(pdfDoc, pageNum, newPdf, file.name);
                        if (success) {
                            successfulPages++;
                        } else {
                            console.debug(`Emergency: Page ${pageNum} failed, creating placeholder`);
                            this.createEmergencyPlaceholder(newPdf, file.name, pageNum);
                        }
                    } catch (pageError) {
                        console.debug(`Emergency: Page ${pageNum} error: ${pageError.message}`);
                        this.createEmergencyPlaceholder(newPdf, file.name, pageNum);
                    }
                }
                
                console.log(`Emergency processing completed: ${successfulPages}/${numPages} pages successful`);
                
            } catch (pdfJsError) {
                console.log(`Emergency: PDF.js failed completely for ${file.name}, creating info document`);
                this.createEmergencyPlaceholder(newPdf, file.name, 1);
            }
            
            const finalPdfBytes = await newPdf.save();
            const finalDoc = await PDFLib.PDFDocument.load(finalPdfBytes);
            
            const pdfData = {
                document: finalDoc,
                file: file,
                pageCount: finalDoc.getPageCount(),
                id: Utils.generateId(),
                isEncrypted: false,
                isConverted: true,
                originalWasProtected: true,
                processingMethod: 'emergency_fallback'
            };
            
            this.pdfs.set(pdfData.id, pdfData);
            console.log(`EMERGENCY SUCCESS: ${file.name} processed via fallback method`);
            
            return pdfData;
            
        } catch (error) {
            console.error(`EMERGENCY FAILED for ${file.name}:`, error);
            throw new Error(`SKIP_FILE:Could not process certificate: ${file.name}`);
        }
    }

    async renderCertificatePageEmergency(pdfDoc, pageNum, newPdf, fileName) {
        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            await page.render({
                canvasContext: context,
                viewport: viewport,
                intent: 'display'
            }).promise;
            
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            let hasContent = false;
            
            for (let i = 0; i < data.length; i += 400) {
                if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
                    hasContent = true;
                    break;
                }
            }
            
            if (!hasContent) {
                console.warn(`Page ${pageNum} appears blank`);
                return false;
            }
            
            const pngDataUrl = canvas.toDataURL('image/png');
            const pngBytes = Uint8Array.from(atob(pngDataUrl.split(',')[1]), c => c.charCodeAt(0));
            
            if (pngBytes.length < 1000) {
                console.warn(`Page ${pageNum} PNG too small`);
                return false;
            }
            
            const image = await newPdf.embedPng(pngBytes);
            const pdfPage = newPdf.addPage([viewport.width / 2, viewport.height / 2]);
            
            pdfPage.drawImage(image, {
                x: 0,
                y: 0,
                width: viewport.width / 2,
                height: viewport.height / 2
            });
            
            console.log(`Page ${pageNum} rendered successfully`);
            return true;
            
        } catch (error) {
            console.error(`Error rendering page ${pageNum}:`, error);
            return false;
        }
    }

    createEmergencyPlaceholder(newPdf, fileName, pageNum) {
        const page = newPdf.addPage([595, 842]);
        
        page.drawText('CERTIFICATE', {
            x: 230, y: 750, size: 24, color: PDFLib.rgb(0.3, 0.3, 0.3)
        });
        
        page.drawRectangle({
            x: 50, y: 50, width: 495, height: 742,
            borderColor: PDFLib.rgb(0.7, 0.7, 0.7), borderWidth: 2
        });
        
        page.drawText(`File: ${fileName}`, {
            x: 70, y: 650, size: 14, color: PDFLib.rgb(0.2, 0.2, 0.2)
        });
        
        page.drawText(`Page: ${pageNum}`, {
            x: 70, y: 620, size: 14, color: PDFLib.rgb(0.2, 0.2, 0.2)
        });
        
        page.drawText('Contents of the protected certificate', {
            x: 70, y: 580, size: 12, color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
        
        page.drawText('The original document remains valid.', {
            x: 70, y: 540, size: 11, color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
    }

    async handleProtectedPDF(file, arrayBuffer) {
        try {
            const bytes = new Uint8Array(arrayBuffer.slice(0, 8192));
            const pdfString = String.fromCharCode.apply(null, bytes);
            
            const isCertificate = this.detectTCPDFDocument(pdfString, file.name) ||
                                pdfString.toLowerCase().includes('certificado') ||
                                pdfString.toLowerCase().includes('diploma') ||
                                pdfString.toLowerCase().includes('achs');
            
            if (isCertificate) {
                console.log(`Detected certificate: ${file.name}, using practical processor`);
                Utils.showToast(`Processing certificate: ${file.name}...`, 'info');
                
                if (window.processProtectedCertificate) {
                    return await window.processProtectedCertificate(file);
                } else {
                    throw new Error('Certificate processor not available');
                }
            } else {
                console.log(`Processing protected PDF: ${file.name}`);
                const processor = new ProtectedPDFProcessor();
                try {
                    return await processor.processProtectedPDF(file);
                } finally {
                    processor.cleanup();
                }
            }
            
        } catch (error) {
            console.error(`Failed to process protected PDF ${file.name}:`, error);
            
            if (error.message.startsWith('SKIP_FILE:')) {
                throw error;
            }
            
            console.log(`Creating info document for ${file.name}`);
            return await this.createInfoDocument(file);
        }
    }

    async createInfoDocument(file) {
        const newPdfDoc = await PDFLib.PDFDocument.create();
        const page = newPdfDoc.addPage([595, 842]);
        
        page.drawRectangle({
            x: 50, y: 50, width: 495, height: 742,
            borderColor: PDFLib.rgb(0.5, 0.5, 0.5), borderWidth: 2
        });
        
        page.drawText('PROTECTED DOCUMENT', {
            x: 180, y: 750, size: 20, color: PDFLib.rgb(0.3, 0.3, 0.3)
        });
        
        page.drawText(`File: ${file.name}`, {
            x: 70, y: 650, size: 14, color: PDFLib.rgb(0.2, 0.2, 0.2)
        });
        
        page.drawText(`Size: ${Utils.formatFileSize(file.size)}`, {
            x: 70, y: 620, size: 12, color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
        
        page.drawText('This document could not be processed', {
            x: 70, y: 580, size: 12, color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
        
        page.drawText('due to advanced security restrictions.', {
            x: 70, y: 560, size: 12, color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
        
        page.drawText('To include this content:', {
            x: 70, y: 520, size: 11, color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        page.drawText('1. Contact the issuer of the document', {
            x: 90, y: 500, size: 10, color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        page.drawText('2. Request an unprotected version', {
            x: 90, y: 485, size: 10, color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        page.drawText('3. Or use the original document separately', {
            x: 90, y: 470, size: 10, color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        const pdfBytes = await newPdfDoc.save();
        
        return {
            document: await PDFLib.PDFDocument.load(pdfBytes),
            file: file,
            pageCount: 1,
            id: Utils.generateId(),
            isConverted: true,
            originalWasProtected: true,
            processingMethod: 'info_document'
        };
    }

    detectTCPDFDocument(pdfString, fileName) {
        const tcpdfPatterns = [
            'Powered by TCPDF',
            'www.tcpdf.org',
            'TCPDF',
            '/Producer (TCPDF'
        ];
        
        const certificatePatterns = [
            'Valida tu diploma',
            'Valida tu certificado', 
            'ValidacionCertificado',
            'certificado',
            'diploma',
            'curso'
        ];
        
        const hasTCPDF = tcpdfPatterns.some(pattern => 
            pdfString.includes(pattern)
        );
        
        const hasCertificateContent = certificatePatterns.some(pattern => 
            pdfString.toLowerCase().includes(pattern.toLowerCase())
        );
        
        const fileNameIndicatesCertificate = fileName.toLowerCase().includes('certificat') ||
                                            fileName.toLowerCase().includes('diploma') ||
                                            fileName.toLowerCase().includes('curso');
        
        return hasTCPDF || (hasCertificateContent && fileNameIndicatesCertificate);
    }

    clearCache() {
        this.pdfs.clear();
        console.log('PDF operations cache cleared');
    }

    async mergePDFs(pdfDataArray) {
        try {
            const mergedPdf = await PDFLib.PDFDocument.create();
            let totalPages = 0;
            let encryptedCount = 0;
            let certificateCount = 0;
            let conversionIssues = [];
            
            Utils.updateProgress(10, 'Analyzing documents for merge compatibility...');
            
            for (let i = 0; i < pdfDataArray.length; i++) {
                const pdfData = pdfDataArray[i];
                const pageCount = pdfData.document.getPageCount();
                totalPages += pageCount;
                
                if (pdfData.isEncrypted || pdfData.originalWasProtected) {
                    encryptedCount++;
                }
                if (pdfData.isCertificate) {
                    certificateCount++;
                }
                
                Utils.updateProgress(
                    10 + (i / pdfDataArray.length) * 20, 
                    `Processing document ${i + 1}/${pdfDataArray.length}: ${pdfData.file.name}`
                );
                
                try {
                    const pageIndices = Array.from({ length: pageCount }, (_, idx) => idx);
                    const copiedPages = await mergedPdf.copyPages(pdfData.document, pageIndices);
                    
                    copiedPages.forEach((page) => {
                        mergedPdf.addPage(page);
                    });
                    
                    const progress = 30 + ((i + 1) / pdfDataArray.length) * 50;
                    Utils.updateProgress(progress, `Merged ${i + 1}/${pdfDataArray.length} documents...`);
                    
                } catch (copyError) {
                    console.error(`Error copying pages from ${pdfData.file.name}:`, copyError);
                    
                    let successfulPages = 0;
                    const issues = [];
                    
                    for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
                        try {
                            const [copiedPage] = await mergedPdf.copyPages(pdfData.document, [pageIdx]);
                            mergedPdf.addPage(copiedPage);
                            successfulPages++;
                        } catch (pageError) {
                            console.warn(`Skipping page ${pageIdx + 1} from ${pdfData.file.name}:`, pageError);
                            
                            if (pdfData.isCertificate || pdfData.originalWasProtected) {
                                await this.createMergePlaceholderPage(
                                    mergedPdf, 
                                    pdfData.file.name, 
                                    pageIdx + 1,
                                    pdfData.isCertificate
                                );
                                successfulPages++;
                                issues.push(`Page ${pageIdx + 1} replaced with placeholder`);
                            }
                        }
                    }
                    
                    if (successfulPages === 0) {
                        throw new Error(`Could not copy any pages from ${pdfData.file.name}`);
                    }
                    
                    if (issues.length > 0) {
                        conversionIssues.push({
                            file: pdfData.file.name,
                            issues: issues,
                            successfulPages: successfulPages,
                            totalPages: pageCount
                        });
                    }
                    
                    if (successfulPages < pageCount) {
                        Utils.showToast(
                            `Warning: ${successfulPages}/${pageCount} pages processed from ${pdfData.file.name}`, 
                            'warning'
                        );
                    }
                }
            }
            
            if (certificateCount > 0) {
                Utils.showToast(
                    `Successfully processed ${certificateCount} certificate(s). Quality may vary due to security restrictions.`, 
                    'info'
                );
            }
            
            if (encryptedCount > 0) {
                Utils.showToast(
                    `Successfully processed ${encryptedCount} protected PDF(s). Some limitations may apply.`, 
                    'info'
                );
            }
            
            Utils.updateProgress(85, 'Finalizing merged document...');
            
            mergedPdf.setTitle('Merged Document');
            mergedPdf.setCreator('PDFile');
            mergedPdf.setProducer('PDFile with PDF-lib');
            mergedPdf.setCreationDate(new Date());
            
            if (certificateCount > 0) {
                mergedPdf.setSubject(`Merged document containing ${certificateCount} certificate(s) and ${pdfDataArray.length - certificateCount} other document(s)`);
            }
            
            const pdfBytes = await mergedPdf.save({
                useObjectStreams: false,
                addDefaultPage: false,
                objectStreamsInForm: false
            });
            
            Utils.updateProgress(95, 'Merge completed successfully');
            
            const summary = {
                totalDocuments: pdfDataArray.length,
                totalPages: totalPages,
                encryptedDocuments: encryptedCount,
                certificates: certificateCount,
                conversionIssues: conversionIssues.length
            };
            
            console.log('Merge completed:', summary);
            
            if (conversionIssues.length > 0) {
                console.log('Conversion issues:', conversionIssues);
                
                const issuesSummary = conversionIssues.map(issue => 
                    `${issue.file}: ${issue.issues.length} issue(s)`
                ).join(', ');
                
                Utils.showToast(
                    `Merge completed with some issues: ${issuesSummary}. Check console for details.`,
                    'warning'
                );
            }
            
            return pdfBytes;
            
        } catch (error) {
            console.error('Error merging PDFs:', error);
            
            if (error.message.includes('encryption') || error.message.includes('protected')) {
                throw new Error('Could not merge PDFs: One or more files have security restrictions that prevent merging. Try using individual files or check if passwords are required.');
            } else if (error.message.includes('Invalid PDF')) {
                throw new Error('Could not merge PDFs: One or more files appear to be corrupted or invalid.');
            } else {
                throw new Error(`Could not merge PDF files: ${error.message}`);
            }
        }
    }

    async createMergePlaceholderPage(mergedPdf, fileName, pageNumber, isCertificate = false) {
        const placeholderPage = mergedPdf.addPage([595, 842]);
        
        if (isCertificate) {
            placeholderPage.drawRectangle({
                x: 50,
                y: 50,
                width: 495,
                height: 742,
                borderColor: PDFLib.rgb(0.8, 0.6, 0.2),
                borderWidth: 3
            });
            
            placeholderPage.drawText('CERTIFICATE', {
                x: 220,
                y: 750,
                size: 24,
                color: PDFLib.rgb(0.8, 0.6, 0.2)
            });
            
            placeholderPage.drawText('(Protected Content)', {
                x: 200,
                y: 720,
                size: 14,
                color: PDFLib.rgb(0.6, 0.6, 0.6)
            });
        } else {
            placeholderPage.drawRectangle({
                x: 50,
                y: 50,
                width: 495,
                height: 742,
                borderColor: PDFLib.rgb(0.7, 0.7, 0.7),
                borderWidth: 2
            });
        }
        
        placeholderPage.drawText(`File: ${fileName}`, {
            x: 70,
            y: 650,
            size: 16,
            color: PDFLib.rgb(0.2, 0.2, 0.2)
        });
        
        placeholderPage.drawText(`Page ${pageNumber}`, {
            x: 70,
            y: 620,
            size: 14,
            color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
        
        placeholderPage.drawText('This page could not be processed', {
            x: 70,
            y: 580,
            size: 12,
            color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        placeholderPage.drawText('due to security restrictions.', {
            x: 70,
            y: 560,
            size: 12,
            color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        if (isCertificate) {
            placeholderPage.drawText('The original certificate remains valid.', {
                x: 70,
                y: 520,
                size: 10,
                color: PDFLib.rgb(0.6, 0.6, 0.6)
            });
            
            placeholderPage.drawText('and security protection.', {
                x: 70,
                y: 505,
                size: 10,
                color: PDFLib.rgb(0.6, 0.6, 0.6)
            });
        }
        
        placeholderPage.drawText('PROTECTED CONTENT', {
            x: 150,
            y: 400,
            size: 24,
            color: PDFLib.rgb(0.9, 0.9, 0.9),
            opacity: 0.3
        });
    }

    async splitPDF(pdfData, pageNumbers) {
        try {
            const newPdf = await PDFLib.PDFDocument.create();
            
            const pageIndices = pageNumbers
                .map(num => num - 1)
                .filter(idx => idx >= 0 && idx < pdfData.pageCount);
            
            if (pageIndices.length === 0) {
                throw new Error('No valid pages specified');
            }
            
            const copiedPages = await newPdf.copyPages(pdfData.document, pageIndices);
            copiedPages.forEach((page) => newPdf.addPage(page));
            
            const pdfBytes = await newPdf.save();
            return pdfBytes;
        } catch (error) {
            console.error('Error splitting PDF:', error);
            throw new Error('Could not split PDF file');
        }
    }

    async reorderPDF(pdfData, newOrder) {
        try {
            const newPdf = await PDFLib.PDFDocument.create();
            
            console.log('Original page order:', Array.from({length: pdfData.pageCount}, (_, i) => i + 1));
            console.log('New order requested:', newOrder);
            
            const invalidPages = newOrder.filter(pageNum => pageNum < 1 || pageNum > pdfData.pageCount);
            if (invalidPages.length > 0) {
                throw new Error(`Invalid pages: ${invalidPages.join(', ')}. PDF has ${pdfData.pageCount} pages.`);
            }
            
            const pageIndices = newOrder.map(num => num - 1);
            
            Utils.updateProgress(60, `Copying pages in new order...`);
            
            const copiedPages = await newPdf.copyPages(pdfData.document, pageIndices);
            
            copiedPages.forEach((page, index) => {
                newPdf.addPage(page);
                
                const progress = 60 + ((index + 1) / copiedPages.length) * 25;
                Utils.updateProgress(progress, `Adding page ${index + 1} of ${copiedPages.length}...`);
            });
            
            Utils.updateProgress(85, 'Finalizing document...');
            
            const pdfBytes = await newPdf.save();
            
            console.log(`PDF reordered successfully. Final pages: ${newOrder.length}`);
            
            return pdfBytes;
        } catch (error) {
            console.error('Error reordering PDF:', error);
            throw new Error('Could not reorder PDF file: ' + error.message);
        }
    }

    async csvToPDF(csvContent, options = {}) {
        try {
            const converter = FormatConverterFactory.getConverter('csv');
            return await converter.convert(csvContent, options);
        } catch (error) {
            console.error('Error converting CSV:', error);
            throw new Error('Could not convert CSV to PDF: ' + error.message);
        }
    }

    async htmlToPDF(htmlContent, options = {}) {
        try {
            const converter = FormatConverterFactory.getConverter('html');
            return await converter.convert(htmlContent, options);
        } catch (error) {
            console.error('Error converting HTML:', error);
            throw new Error('Could not convert HTML to PDF: ' + error.message);
        }
    }

    async markdownToPDF(markdownContent, options = {}) {
        try {
            const converter = FormatConverterFactory.getConverter('markdown');
            return await converter.convert(markdownContent, options);
        } catch (error) {
            console.error('Error converting Markdown:', error);
            throw new Error('Could not convert Markdown to PDF');
        }
    }

    async jsonToPDF(jsonContent, options = {}) {
        try {
            const converter = FormatConverterFactory.getConverter('json');
            return await converter.convert(jsonContent, options);
        } catch (error) {
            console.error('Error converting JSON:', error);
            throw new Error('Could not convert JSON to PDF: ' + error.message);
        }
    }

    async xmlToPDF(xmlContent, options = {}) {
        try {
            const converter = FormatConverterFactory.getConverter('xml');
            return await converter.convert(xmlContent, options);
        } catch (error) {
            console.error('Error converting XML:', error);
            throw new Error('Could not convert XML to PDF: ' + error.message);
        }
    }

    async rtfToPDF(rtfContent, options = {}) {
        try {
            const converter = FormatConverterFactory.getConverter('rtf');
            return await converter.convert(rtfContent, options);
        } catch (error) {
            console.error('Error converting RTF:', error);
            throw new Error('Could not convert RTF to PDF: ' + error.message);
        }
    }

    async renderPDFPage(pdfData, pageIndex, scale = 1.5) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = 595 * scale;
            canvas.height = 842 * scale;
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#333333';
            ctx.font = `${20 * scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(
                `Page ${pageIndex + 1}`,
                canvas.width / 2,
                canvas.height / 2
            );
            
            return canvas;
        } catch (error) {
            console.error('Error rendering page:', error);
            throw new Error('Could not render PDF page');
        }
    }

    clearCache() {
        this.pdfs.clear();
    }

    getPDFInfo(pdfData) {
        return {
            pageCount: pdfData.pageCount,
            fileSize: pdfData.file.size,
            fileName: pdfData.file.name,
            lastModified: pdfData.file.lastModified
        };
    }
}