class TCPDFCertificateProcessor extends ProtectedPDFProcessor {
    constructor() {
        super();
        this.tcpdfPatterns = [
            'Powered by TCPDF',
            'www.tcpdf.org',
            'TCPDF_PROTECTION',
            'ValidacionCertificado',
            'achs',
            'seguro laboral',
            'codelco',
            'mutual',
            'chile',
            'gobierno',
            'Valida tu diploma'
        ];
        
        this.certificatePatterns = [
            'certificado',
            'diploma', 
            'curso',
            'capacitación'
        ];
    }

    async detectTCPDFProtection(file) {
        try {
            const arrayBuffer = await Utils.fileToArrayBuffer(file);
            const bytes = new Uint8Array(arrayBuffer.slice(0, 16384));
            const pdfString = String.fromCharCode.apply(null, bytes);
            
            const isTCPDF = this.tcpdfPatterns.some(pattern => 
                pdfString.toLowerCase().includes(pattern.toLowerCase())
            );
            
            const isCertificate = this.certificatePatterns.some(pattern =>
                pdfString.toLowerCase().includes(pattern.toLowerCase())
            );
            
            const isACHS = pdfString.toLowerCase().includes('achs') || 
                          pdfString.toLowerCase().includes('seguro laboral');
            
            const hasValidation = pdfString.includes('Valida') || 
                                 pdfString.includes('diploma') ||
                                 pdfString.includes('certificado');
            
            const encryptionInfo = this.analyzeEncryption(pdfString);
            
            return {
                isTCPDF,
                isCertificate,
                isACHS,
                hasValidation,
                hasSignature: pdfString.includes('/Sig') || pdfString.includes('/ByteRange'),
                encryptionLevel: encryptionInfo.level,
                hasOwnerPassword: encryptionInfo.hasOwnerPassword,
                hasUserPassword: encryptionInfo.hasUserPassword,
                restrictions: encryptionInfo.restrictions
            };
            
        } catch (error) {
            console.warn('Could not analyze PDF structure:', error);
            return { isTCPDF: false, hasValidation: false };
        }
    }

    analyzeEncryption(pdfString) {
        const restrictions = [];
        let level = 'none';
        let hasOwnerPassword = false;
        let hasUserPassword = false;
        
        if (pdfString.includes('/Encrypt')) {
            if (pdfString.includes('/V 4') || pdfString.includes('/V 5')) {
                level = 'AES-256';
            } else if (pdfString.includes('/V 2') || pdfString.includes('/V 3')) {
                level = 'AES-128';
            } else if (pdfString.includes('/V 1')) {
                level = 'RC4-40';
            } else {
                level = 'unknown';
            }
            
            if (pdfString.includes('/O ')) hasOwnerPassword = true;
            if (pdfString.includes('/U ')) hasUserPassword = true;
            
            if (pdfString.includes('/P ')) {
                if (pdfString.includes('-44')) restrictions.push('no-print');
                if (pdfString.includes('-4')) restrictions.push('no-modify');
                if (pdfString.includes('-16')) restrictions.push('no-copy');
                if (pdfString.includes('-32')) restrictions.push('no-annotations');
            }
        }
        
        return {
            level,
            hasOwnerPassword,
            hasUserPassword,
            restrictions
        };
    }

    async processTCPDFCertificate(file, password = '') {
        try {
            const analysis = await this.detectTCPDFProtection(file);
            
            console.log(`Processing certificate: ${file.name}`, analysis);
            
            if (analysis.isACHS) {
                Utils.showToast(`Processing ACHS certificate: ${file.name}. Using specialized ACHS method...`, 'info');
            } else {
                Utils.showToast(`Processing TCPDF certificate: ${file.name}. Using specialized method...`, 'info');
            }
            
            const arrayBuffer = await Utils.fileToArrayBuffer(file);
            
            const pdfJSConfig = {
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
                useSystemFonts: true,
                disableFontFace: false,
                disableRange: false,
                disableStream: false,
                disableAutoFetch: false,
                stopAtErrors: false,
                maxImageSize: 2048 * 2048,
                isEvalSupported: false,
                disableCreateObjectURL: false,
                ignoreErrors: true,
                pdfBug: false
            });
            
            let pdfDoc;
            try {
                pdfDoc = await loadingTask.promise;
            } catch (passwordError) {
                console.error('Error loading certificate:', passwordError);
                
                if (passwordError.name === 'PasswordException' || passwordError.message.includes('password')) {
                    if (!password) {
                        console.log('Attempting to process certificate without password...');
                        return await this.processWithoutPassword(file, analysis);
                    } else {
                        const result = await PasswordDialog.promptForPassword(file.name);
                        
                        if (result.action === 'skip') {
                            throw new Error(`SKIP_FILE:User chose to skip password-protected file: ${file.name}`);
                        } else if (result.action === 'use_password') {
                            return await this.processTCPDFCertificate(file, result.password);
                        } else if (result.action === 'try_without') {
                            return await this.processWithoutPassword(file, analysis);
                        }
                    }
                }
                
                return await this.processWithoutPassword(file, analysis);
            }
            
            const numPages = pdfDoc.numPages;
            console.log(`Certificate loaded with ${numPages} pages`);
            
            return await this.renderCertificateToNewPDF(pdfDoc, file, analysis, numPages);
            
        } catch (error) {
            console.error(`Failed to process certificate ${file.name}:`, error);
            
            if (error.message.startsWith('SKIP_FILE:')) {
                throw error;
            }
            
            console.log('Attempting fallback processing...');
            return await super.processProtectedPDF(file, password);
        }
    }

    async processWithoutPassword(file, analysis) {
        try {
            console.log('Processing certificate without password - using image rendering method');
            Utils.showToast(`Converting ${file.name} to images for merging...`, 'info');
            
            const result = await super.processProtectedPDF(file, '');
            
            result.processedWithoutPassword = true;
            result.isCertificate = true;
            result.isACHS = analysis.isACHS;
            
            return result;
            
        } catch (error) {
            console.error('Fallback processing also failed:', error);
            throw new Error(`SKIP_FILE:Could not process certificate: ${file.name}. The file may have strong security restrictions.`);
        }
    }

    async renderCertificateToNewPDF(pdfDoc, file, analysis, numPages) {
        const newPdfDoc = await PDFLib.PDFDocument.create();
        let successfulPages = 0;
        
        const scale = analysis.isACHS ? 4.0 : 3.5;
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            Utils.updateProgress(
                20 + (pageNum / numPages) * 60, 
                `Converting certificate page ${pageNum}/${numPages}...`
            );
            
            try {
                const page = await pdfDoc.getPage(pageNum);
                const imageData = await this.renderCertificatePage(page, analysis, scale);
                
                if (imageData && imageData.length > 5000) {
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
                    console.log(`Successfully processed certificate page ${pageNum}`);
                } else {
                    console.warn(`Certificate page ${pageNum} appears empty, creating placeholder`);
                    await this.createCertificatePlaceholder(newPdfDoc, pageNum, page, file.name);
                    successfulPages++;
                }
                
            } catch (pageError) {
                console.warn(`Error processing certificate page ${pageNum}:`, pageError);
                await this.createCertificatePlaceholder(newPdfDoc, pageNum, null, file.name);
            }
        }
        
        if (successfulPages === 0) {
            throw new Error(`No certificate pages could be processed from ${file.name}`);
        }
        
        const pdfBytes = await newPdfDoc.save();
        
        const conversionRate = successfulPages / numPages;
        console.log(`Certificate conversion: ${successfulPages}/${numPages} pages (${Math.round(conversionRate * 100)}%)`);
        
        if (conversionRate >= 0.8) {
            if (analysis.isACHS) {
                Utils.showToast(`Successfully converted ACHS certificate: ${file.name}`, 'success');
            } else {
                Utils.showToast(`Successfully converted certificate: ${file.name}`, 'success');
            }
        } else {
            Utils.showToast(`Partially converted certificate: ${file.name} (${successfulPages}/${numPages} pages)`, 'warning');
        }
        
        return {
            document: await PDFLib.PDFDocument.load(pdfBytes),
            file: file,
            pageCount: successfulPages,
            id: Utils.generateId(),
            isConverted: true,
            originalWasProtected: true,
            isCertificate: true,
            isACHS: analysis.isACHS,
            conversionSuccess: conversionRate,
            protectionLevel: analysis.encryptionLevel,
            hadRestrictions: analysis.restrictions.length > 0
        };
    }

    async renderCertificatePage(page, analysis, scale = 4.0) {
        try {
            const viewport = page.getViewport({ scale });
            
            this.canvas.width = Math.floor(viewport.width);
            this.canvas.height = Math.floor(viewport.height);
            
            this.context.fillStyle = '#FFFFFF';
            this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.context.imageSmoothingEnabled = true;
            this.context.imageSmoothingQuality = 'high';
            this.context.textRenderingOptimization = 'optimizeQuality';
            
            const renderContext = {
                canvasContext: this.context,
                viewport: viewport,
                enableWebGL: false,
                renderInteractiveForms: true,
                intent: 'print',
                annotationMode: 2,
                optionalContentConfigPromise: null,
                includeAnnotationStorage: true,
                annotationCanvasMap: new Map()
            };
            
            const renderTask = page.render(renderContext);
            
            await Promise.race([
                renderTask.promise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Certificate render timeout')), 30000)
                )
            ]);
            
            const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const quality = this.assessCertificateQuality(imageData);
            
            console.log(`Certificate page quality assessment:`, quality);
            
            if (quality.score < 0.2) {
                console.warn('Very low quality certificate render, trying multiple fallbacks');
                return await this.multipleFallbackRender(page, analysis, scale);
            }
            
            return await this.canvasToPngArrayBuffer();
            
        } catch (error) {
            console.error('Error in certificate page rendering:', error);
            return await this.multipleFallbackRender(page, analysis, scale * 0.8);
        }
    }

    async multipleFallbackRender(page, analysis, scale) {
        const fallbackConfigs = [
            { scale: scale * 0.8, intent: 'display', annotations: false },
            { scale: scale * 0.6, intent: 'print', annotations: true },
            { scale: scale * 1.2, intent: 'display', annotations: true },
            { scale: 2.0, intent: 'print', annotations: false }
        ];
        
        for (let i = 0; i < fallbackConfigs.length; i++) {
            const config = fallbackConfigs[i];
            console.log(`Attempting fallback render ${i + 1} with config:`, config);
            
            try {
                const result = await this.fallbackCertificateRender(page, config.scale, config.intent, config.annotations);
                if (result) {
                    console.log(`Fallback render ${i + 1} successful`);
                    return result;
                }
            } catch (error) {
                console.warn(`Fallback render ${i + 1} failed:`, error);
            }
        }
        
        console.error('All fallback renders failed');
        return null;
    }

    async fallbackCertificateRender(page, scale, intent = 'display', includeAnnotations = false) {
        try {
            const viewport = page.getViewport({ scale });
            
            this.canvas.width = Math.floor(viewport.width);
            this.canvas.height = Math.floor(viewport.height);
            
            this.context.fillStyle = '#FFFFFF';
            this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            const renderContext = {
                canvasContext: this.context,
                viewport: viewport,
                enableWebGL: false,
                renderInteractiveForms: includeAnnotations,
                intent: intent,
                annotationMode: includeAnnotations ? 2 : 0
            };
            
            await page.render(renderContext).promise;
            
            const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const quality = this.assessCertificateQuality(imageData);
            
            if (quality.score > 0.1) {
                return await this.canvasToPngArrayBuffer();
            } else {
                return null;
            }
            
        } catch (error) {
            console.error('Fallback certificate render failed:', error);
            return null;
        }
    }

    assessCertificateQuality(imageData) {
        const data = imageData.data;
        let nonWhitePixels = 0;
        let colorVariation = 0;
        let textLikePixels = 0;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (r < 250 || g < 250 || b < 250) {
                nonWhitePixels++;
                colorVariation += Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
                
                if (r < 100 && g < 100 && b < 100) {
                    textLikePixels++;
                }
            }
        }
        
        const totalPixels = data.length / 4;
        const contentRatio = nonWhitePixels / totalPixels;
        const textRatio = textLikePixels / totalPixels;
        const avgColorVariation = colorVariation / (nonWhitePixels || 1);
        const score = (contentRatio * 0.5) + (textRatio * 0.4) + ((avgColorVariation / 255) * 0.1);
        
        return {
            score,
            contentRatio,
            textRatio,
            avgColorVariation,
            hasText: textRatio > 0.001
        };
    }

    async createCertificatePlaceholder(pdfDoc, pageNum, originalPage = null, fileName = 'Certificate') {
        let width = 595, height = 842;
        
        if (originalPage) {
            try {
                const viewport = originalPage.getViewport({ scale: 1.0 });
                width = viewport.width;
                height = viewport.height;
            } catch (e) {
                console.warn('Could not get certificate page dimensions');
            }
        }
        
        const placeholderPage = pdfDoc.addPage([width, height]);
        
        placeholderPage.drawRectangle({
            x: 30,
            y: 30,
            width: width - 60,
            height: height - 60,
            borderColor: PDFLib.rgb(0.2, 0.2, 0.2),
            borderWidth: 4
        });
        
        placeholderPage.drawRectangle({
            x: 50,
            y: 50,
            width: width - 100,
            height: height - 100,
            borderColor: PDFLib.rgb(0.6, 0.6, 0.6),
            borderWidth: 2
        });
        
        placeholderPage.drawText('CERTIFICADO', {
            x: width / 2 - 80,
            y: height - 100,
            size: 28,
            color: PDFLib.rgb(0.1, 0.1, 0.1)
        });
        
        placeholderPage.drawText(`Página ${pageNum} de ${fileName}`, {
            x: width / 2 - 100,
            y: height - 150,
            size: 16,
            color: PDFLib.rgb(0.3, 0.3, 0.3)
        });
        
        placeholderPage.drawText('Esta página no pudo ser procesada', {
            x: width / 2 - 120,
            y: height / 2 + 20,
            size: 14,
            color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        placeholderPage.drawText('debido a restricciones de seguridad', {
            x: width / 2 - 130,
            y: height / 2 - 10,
            size: 14,
            color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        placeholderPage.drawText('El contenido original se mantiene protegido', {
            x: width / 2 - 140,
            y: height / 2 - 40,
            size: 12,
            color: PDFLib.rgb(0.6, 0.6, 0.6)
        });
        
        placeholderPage.drawText('CONTENIDO PROTEGIDO', {
            x: width / 2 - 100,
            y: 100,
            size: 20,
            color: PDFLib.rgb(0.9, 0.9, 0.9),
            opacity: 0.3
        });
    }
}