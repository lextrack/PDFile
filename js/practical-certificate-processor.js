class PracticalCertificateProcessor {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d', { 
            willReadFrequently: true,
            alpha: false
        });
        this.canvas.style.display = 'none';
        document.body.appendChild(this.canvas);
        
        this.certificateKeywords = [
            // Spanish - Basic
            'certificado', 'diploma', 'título', 'curso', 'capacitación',
            'constancia', 'acreditación', 'licencia', 'habilitación',
            'certificación', 'credencial', 'reconocimiento',
            
            // Spanish - Certification phrases
            'por haber cumplido', 'satisfactoriamente', 'otorga el presente',
            'se certifica que', 'hace constar que', 'certifica que',
            'aprobó el curso', 'completó exitosamente', 'finalizó el programa',
            'cumple con los requisitos', 'ha demostrado competencia',
            'acredita conocimientos', 'posee las competencias',
            
            // Validation patterns
            'valida tu diploma', 'valida tu certificado', 'validar certificado',
            'verificar diploma', 'código de verificación', 'autenticidad',
            'validate certificate', 'verify diploma', 'verification code',
            
            // ACHS and safety institutions (Chile)
            'achs', 'asociación chilena de seguridad', 'seguro laboral',
            'instituto de seguridad del trabajo', 'ist chile', 'ist.cl',
            'instituto de seguridad laboral', 'isl chile', 'isl.cl',
            'mutual de seguridad', 'suseso', 'superintendencia de seguridad social',
            
            // Safety training topics
            'prevención de riesgos', 'seguridad industrial', 'higiene ocupacional',
            'salud en el trabajo', 'elementos de protección personal', 'uso de epp',
            'trabajos en altura', 'espacios confinados', 'manejo de sustancias peligrosas',
            'primeros auxilios', 'evacuación y emergencias', 'extinción de incendios',
            'uso de extintores', 'manejo defensivo', 'conducción segura',
            'ergonomía', 'factores psicosociales', 'vigilancia de la salud',
            
            // Mining specific (Chile)
            'codelco', 'corporación nacional del cobre', 'capacitación minera',
            'seguridad minera', 'operación de equipos', 'manejo de maquinaria pesada',
            'voladura', 'tronadura', 'explosivos', 'geomecánica',
            'ventilación de minas', 'procesamiento de minerales', 'metalurgia',
            'escondida', 'anglo american', 'antofagasta minerals',
            'barrick', 'kinross', 'newmont', 'los pelambres',
            
            // Government and official institutions (Chile)
            'gobierno de chile', 'gob.cl', 'ministerio del trabajo',
            'dirección del trabajo', 'dt.gob.cl', 'mintrab.gob.cl',
            'sence', 'servicio nacional de capacitación', 'sence.cl',
            'seremi', 'secretaría regional ministerial',
            'contraloría general de la república', 'registro civil',
            
            // Educational institutions (Chile)
            'universidad de chile', 'uchile.cl', 'pontificia universidad católica',
            'puc.cl', 'universidad técnica federico santa maría', 'usm.cl',
            'universidad de concepción', 'udec.cl', 'universidad de santiago',
            'usach.cl', 'universidad austral', 'uach.cl',
            'duoc uc', 'inacap', 'instituto aiep', 'centro de formación técnica',
            'cft', 'instituto profesional', 'ip',
            
            // Professional colleges (Chile)
            'colegio de ingenieros de chile', 'colegio médico de chile',
            'colegio de profesores', 'colegio de contadores',
            'colegio de arquitectos', 'colegio de abogados',
            'colegio de periodistas', 'colegio de enfermeras',
            
            // Industry associations (Chile)
            'cchc', 'cámara chilena de la construcción',
            'sofofa', 'sociedad de fomento fabril',
            'asimet', 'asociación de industrias metalúrgicas',
            'sonami', 'sociedad nacional de minería',
            'cámara de comercio', 'asociación de industriales',
            
            // International certifications
            'iso 45001', 'ohsas 18001', 'iso 14001', 'iso 9001',
            'nfpa', 'osha', 'ansi', 'astm', 'aws', 'asme',
            
            // English patterns
            'certificate', 'diploma', 'degree', 'certification', 'license',
            'accreditation', 'qualification', 'completion', 'achievement',
            'training certificate', 'course completion', 'professional development',
            'hereby certify', 'has successfully completed', 'is hereby awarded',
            'safety training', 'occupational health', 'industrial hygiene',
            'risk assessment', 'hazard identification', 'first aid',
            'cpr certification', 'fire safety', 'confined space',
            'working at heights', 'hazardous materials', 'defensive driving',
            
            // Portuguese patterns
            'certificado', 'diploma', 'curso', 'capacitação', 'treinamento',
            'licença', 'habilitação', 'conclusão', 'certificação',
            'por ter completado', 'satisfatoriamente', 'concede o presente',
            'segurança do trabalho', 'saúde ocupacional', 'prevenção de acidentes',
            
            // Technology indicators
            'tcpdf', 'www.tcpdf.org', 'powered by tcpdf',
            'itext', 'fpdf', 'crystal reports', 'jasperreports'
        ];
        
        // Enhanced institution detection
        this.institutionTypes = {
            'ACHS': ['achs', 'asociación chilena de seguridad', 'achs.cl'],
            'IST': ['instituto de seguridad del trabajo', 'ist chile', 'ist.cl'],
            'ISL': ['instituto de seguridad laboral', 'isl chile', 'isl.cl'],
            'Codelco': ['codelco', 'corporación nacional del cobre'],
            'Government': ['gobierno de chile', 'gob.cl', 'ministerio', 'dirección del trabajo'],
            'University': ['universidad', 'university', 'instituto profesional', 'centro de formación'],
            'Mining': ['minería', 'mining', 'escondida', 'anglo american', 'barrick'],
            'Professional': ['colegio de', 'professional college', 'asociación profesional'],
            'International': ['iso', 'ohsas', 'nfpa', 'osha', 'ansi']
        };
    }

    async processCertificateForMerge(file) {
        try {
            console.log(`Processing certificate for merge: ${file.name}`);
            
            const certificateInfo = await this.analyzeCertificateContent(file);
            
            if (certificateInfo.isHighConfidenceCertificate) {
                console.log(`High confidence certificate detected: ${certificateInfo.type} from ${certificateInfo.institution}`);
                Utils.showToast(`Processing ${certificateInfo.type} certificate from ${certificateInfo.institution}...`, 'info');
            }
            
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
                    processingMethod: 'direct_load',
                    certificateInfo: certificateInfo
                };
            } catch (directError) {
                console.log(`Direct load failed, trying specialized conversion: ${directError.message}`);
            }

            const convertedPdf = await this.convertCertificateToNewPDF(file, certificateInfo);
            return convertedPdf;
            
        } catch (error) {
            console.error(`All methods failed for ${file.name}:`, error);
            
            return await this.createCertificateInfoPDF(file);
        }
    }

    async analyzeCertificateContent(file) {
        try {
            const arrayBuffer = await Utils.fileToArrayBuffer(file);
            const bytes = new Uint8Array(arrayBuffer.slice(0, 32768));
            const pdfString = String.fromCharCode.apply(null, bytes);
            const content = pdfString.toLowerCase();
            const fileName = file.name.toLowerCase();
            
            let confidence = 0;
            let detectedKeywords = [];
            let institutionType = 'Unknown';
            let certificateType = 'General';

            this.certificateKeywords.forEach(keyword => {
                if (content.includes(keyword.toLowerCase()) || fileName.includes(keyword.toLowerCase())) {
                    confidence += keyword.length > 5 ? 2 : 1;
                    detectedKeywords.push(keyword);
                }
            });
            
            for (const [type, patterns] of Object.entries(this.institutionTypes)) {
                if (patterns.some(pattern => content.includes(pattern.toLowerCase()))) {
                    institutionType = type;
                    confidence += 5;
                    break;
                }
            }
            
            if (content.includes('diploma') || content.includes('título')) {
                certificateType = 'Diploma';
                confidence += 3;
            } else if (content.includes('licencia') || content.includes('license')) {
                certificateType = 'License';
                confidence += 3;
            } else if (content.includes('capacitación') || content.includes('training')) {
                certificateType = 'Training Certificate';
                confidence += 2;
            } else if (content.includes('seguridad') || content.includes('safety')) {
                certificateType = 'Safety Certificate';
                confidence += 2;
            }
            
            const isTCPDF = content.includes('tcpdf') || content.includes('www.tcpdf.org');
            if (isTCPDF) confidence += 3;
            
            const hasValidation = content.includes('valida') || content.includes('verificar') || 
                                content.includes('validate') || content.includes('verification');
            if (hasValidation) confidence += 2;
            
            const filenameIndicators = ['cert', 'diploma', 'capacit', 'segur', 'achs', 'ist'];
            filenameIndicators.forEach(indicator => {
                if (fileName.includes(indicator)) {
                    confidence += 2;
                }
            });
            
            return {
                isHighConfidenceCertificate: confidence >= 10,
                confidence: confidence,
                detectedKeywords: detectedKeywords,
                institution: institutionType,
                type: certificateType,
                isTCPDF: isTCPDF,
                hasValidation: hasValidation,
                fileSize: file.size,
                fileName: file.name
            };
            
        } catch (error) {
            console.warn('Could not analyze certificate content:', error);
            return {
                isHighConfidenceCertificate: false,
                confidence: 0,
                institution: 'Unknown',
                type: 'General'
            };
        }
    }

    async convertCertificateToNewPDF(file, certificateInfo = {}) {
        const arrayBuffer = await Utils.fileToArrayBuffer(file);

        const loadingTask = pdfjsLib.getDocument({ 
            data: arrayBuffer,
            verbosity: 0,
            disableFontFace: false,
            useSystemFonts: true,
            disableRange: false,
            disableStream: false,
            disableAutoFetch: false,
            stopAtErrors: false,
            maxImageSize: 4096 * 4096,
            isEvalSupported: false,
            fontExtraProperties: true,
            ignoreErrors: true,
            disableCreateObjectURL: false,
            pdfBug: false,
            enableXfa: true
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
        
        console.log(`Converting ${numPages} pages from ${certificateInfo.type || 'certificate'} (${certificateInfo.institution || 'unknown institution'})`);
        
        let successfulPages = 0;
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const renderingStrategy = this.getRenderingStrategy(certificateInfo);
                const success = await this.renderCertificatePageWithStrategy(page, newPdfDoc, pageNum, renderingStrategy);
                
                if (success) {
                    successfulPages++;
                } else {
                    console.warn(`Failed to render page ${pageNum}, creating enhanced info page`);
                    await this.createEnhancedCertificateInfoPage(newPdfDoc, file.name, pageNum, certificateInfo);
                }
            } catch (pageError) {
                console.error(`Error on page ${pageNum}:`, pageError);
                await this.createEnhancedCertificateInfoPage(newPdfDoc, file.name, pageNum, certificateInfo);
            }
        }
        
        newPdfDoc.setTitle(`Converted Certificate - ${file.name}`);
        newPdfDoc.setSubject(`${certificateInfo.type || 'Certificate'} from ${certificateInfo.institution || 'Institution'}`);
        newPdfDoc.setCreator('PDFile Certificate Processor');
        newPdfDoc.setProducer('PDFile with enhanced certificate support');
        
        const pdfBytes = await newPdfDoc.save();
        
        return {
            document: await PDFLib.PDFDocument.load(pdfBytes),
            file: file,
            pageCount: successfulPages,
            id: Utils.generateId(),
            isConverted: true,
            originalWasProtected: true,
            processingMethod: 'enhanced_pdf_js_conversion',
            certificateInfo: certificateInfo,
            conversionRate: successfulPages / numPages
        };
    }

    getRenderingStrategy(certificateInfo) {
        if (certificateInfo.institution === 'ACHS' || certificateInfo.institution === 'IST') {
            return {
                scale: 4.0,
                intent: 'print',
                includeAnnotations: true,
                backgroundColor: '#FFFFFF'
            };
        } else if (certificateInfo.institution === 'Codelco') {
            return {
                scale: 3.5,
                intent: 'print',
                includeAnnotations: true,
                backgroundColor: '#FFFFFF'
            };
        } else if (certificateInfo.institution === 'University') {
            return {
                scale: 3.0,
                intent: 'display',
                includeAnnotations: false,
                backgroundColor: '#FFFFFF'
            };
        } else {
            return {
                scale: 3.0,
                intent: 'print',
                includeAnnotations: true,
                backgroundColor: '#FFFFFF'
            };
        }
    }

    async renderCertificatePageWithStrategy(page, newPdfDoc, pageNum, strategy) {
        try {
            const viewport = page.getViewport({ scale: 1.0 });
            const originalWidth = viewport.width;
            const originalHeight = viewport.height;
            
            const scaledViewport = page.getViewport({ scale: strategy.scale });
            
            this.canvas.width = scaledViewport.width;
            this.canvas.height = scaledViewport.height;
            this.context.fillStyle = strategy.backgroundColor;
            this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.context.imageSmoothingEnabled = true;
            this.context.imageSmoothingQuality = 'high';
            
            const renderContext = {
                canvasContext: this.context,
                viewport: scaledViewport,
                enableWebGL: false,
                renderInteractiveForms: strategy.includeAnnotations,
                intent: strategy.intent,
                annotationMode: strategy.includeAnnotations ? 2 : 0,
                includeAnnotationStorage: strategy.includeAnnotations,
                optionalContentConfigPromise: null
            };
            
            const renderTask = page.render(renderContext);
            await Promise.race([
                renderTask.promise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Render timeout')), 30000)
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
            
            console.log(`Successfully converted page ${pageNum} using ${strategy.intent} strategy`);
            return true;
            
        } catch (error) {
            console.error(`Error rendering page ${pageNum}:`, error);
            return false;
        }
    }

    async createEnhancedCertificateInfoPage(newPdfDoc, fileName, pageNum, certificateInfo = {}) {
        const page = newPdfDoc.addPage([595, 842]);

        let borderColor = PDFLib.rgb(0.2, 0.2, 0.2);
        let accentColor = PDFLib.rgb(0.3, 0.3, 0.3);
        
        if (certificateInfo.institution === 'ACHS') {
            borderColor = PDFLib.rgb(0.0, 0.4, 0.8); 
            accentColor = PDFLib.rgb(0.0, 0.3, 0.6);
        } else if (certificateInfo.institution === 'Codelco') {
            borderColor = PDFLib.rgb(0.8, 0.2, 0.0);
            accentColor = PDFLib.rgb(0.6, 0.1, 0.0);
        }
        
        page.drawRectangle({
            x: 50, y: 50, width: 495, height: 742,
            borderColor: borderColor, borderWidth: 3
        });
        
        page.drawRectangle({
            x: 70, y: 70, width: 455, height: 702,
            borderColor: PDFLib.rgb(0.7, 0.7, 0.7), borderWidth: 1
        });
        
        const title = certificateInfo.type || 'CERTIFICADO';
        page.drawText(title.toUpperCase(), {
            x: 297 - (title.length * 6), y: 750, size: 24, color: accentColor
        });
        
        page.drawText('(Contenido Protegido)', {
            x: 200, y: 720, size: 16, color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        if (certificateInfo.institution && certificateInfo.institution !== 'Unknown') {
            page.drawText(`Institución: ${certificateInfo.institution}`, {
                x: 90, y: 680, size: 14, color: PDFLib.rgb(0.2, 0.2, 0.2)
            });
        }
        page.drawText(`Archivo: ${fileName}`, {
            x: 90, y: 650, size: 14, color: PDFLib.rgb(0.2, 0.2, 0.2)
        });
        
        page.drawText(`Página: ${pageNum}`, {
            x: 90, y: 620, size: 14, color: PDFLib.rgb(0.2, 0.2, 0.2)
        });
        
        if (certificateInfo.confidence) {
            page.drawText(`Nivel de confianza: ${certificateInfo.confidence}/20`, {
                x: 90, y: 590, size: 12, color: PDFLib.rgb(0.4, 0.4, 0.4)
            });
        }
        
        page.drawText('Esta página contiene un certificado protegido', {
            x: 90, y: 550, size: 12, color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
        
        page.drawText('que no puede ser reproducido debido a', {
            x: 90, y: 530, size: 12, color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
        
        page.drawText('restricciones de seguridad del documento original.', {
            x: 90, y: 510, size: 12, color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
        
        page.drawText('El certificado original mantiene su validez legal.', {
            x: 90, y: 470, size: 11, color: PDFLib.rgb(0.5, 0.5, 0.5)
        });
        
        page.drawText('CONTENIDO PROTEGIDO', {
            x: 150, y: 400, size: 28, color: PDFLib.rgb(0.9, 0.9, 0.9)
        });
        
        page.drawText(`Procesado por PDFile - ${new Date().toLocaleDateString()}`, {
            x: 90, y: 100, size: 10, color: PDFLib.rgb(0.6, 0.6, 0.6)
        });
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

    async createCertificateInfoPDF(file) {
        const newPdfDoc = await PDFLib.PDFDocument.create();
        await this.createEnhancedCertificateInfoPage(newPdfDoc, file.name, 1, {
            type: 'Certificado',
            institution: 'Institución Protegida'
        });
        
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