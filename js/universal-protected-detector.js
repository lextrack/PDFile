class UniversalProtectedDocumentDetector {
    constructor() {
        this.certificatePatterns = {
            spanish: [
                'certificado', 'diploma', 'título', 'curso', 'capacitación', 
                'constancia', 'acreditación', 'licencia', 'habilitación',
                'por haber cumplido', 'satisfactoriamente', 'otorga el presente',
                'valida tu diploma', 'valida tu certificado', 'achs', 'seguro laboral'
            ],
            english: [
                'certificate', 'diploma', 'degree', 'certification', 'license',
                'accreditation', 'qualification', 'completion', 'achievement',
                'hereby certify', 'has successfully completed', 'is hereby awarded',
                'validate certificate', 'verify diploma', 'transcripts'
            ],
            portuguese: [
                'certificado', 'diploma', 'título', 'curso', 'capacitação',
                'licença', 'habilitação', 'conclusão', 'certificação',
                'por ter completado', 'satisfatoriamente', 'concede o presente'
            ],
            french: [
                'certificat', 'diplôme', 'titre', 'cours', 'formation',
                'licence', 'habilitation', 'achèvement', 'certification',
                'ayant satisfait', 'avec succès', 'décerne le présent'
            ],
            german: [
                'zertifikat', 'diplom', 'titel', 'kurs', 'ausbildung',
                'lizenz', 'befähigung', 'abschluss', 'zertifizierung',
                'erfolgreich abgeschlossen', 'hiermit bescheinigt'
            ],
            italian: [
                'certificato', 'diploma', 'titolo', 'corso', 'formazione',
                'licenza', 'abilitazione', 'completamento', 'certificazione',
                'aver completato', 'con successo', 'rilascia il presente'
            ]
        };

        this.technologyPatterns = [
            // PDF Libraries
            'tcpdf', 'www.tcpdf.org', 'powered by tcpdf',
            'itext', 'itextpdf', 'itext.com',
            'fpdf', 'www.fpdf.org',
            'dompdf', 'github.com/dompdf',
            'wkhtmltopdf', 'wkhtmltopdf.org',
            'prince xml', 'princexml.com',
            'phantomjs', 'slimerjs',
            
            // Report Tools
            'crystal reports', 'business objects',
            'jasperreports', 'pentaho',
            'birt report', 'eclipse birt',
            'cognos', 'reportlab',
            
            // Digital Signature Providers
            'docusign', 'adobe sign', 'hellosign',
            'signaturit', 'signnow', 'pandadoc',
            
            // Enterprise Systems
            'sap', 'oracle', 'peoplesoft', 'workday',
            'successfactors', 'cornerstone ondemand',
            'moodle', 'blackboard', 'canvas lms',
            
            // Government/Official
            'gobierno', 'government', 'gouvernement', 
            'ministério', 'ministerio', 'ministry',
            'prefeitura', 'ayuntamiento', 'municipality'
        ];

        this.institutionPatterns = [
            // Educational
            'university', 'universidad', 'universidade', 'université', 'universität',
            'college', 'instituto', 'school', 'academia', 'training center',
            
            // Professional Bodies
            'association', 'asociación', 'associação', 'colegio profesional',
            'board of', 'council of', 'chamber of', 'bar association',
            
            // Certification Bodies
            'iso ', 'ieee', 'pmp', 'cissp', 'comptia', 'cisco', 'microsoft',
            'google', 'amazon web services', 'aws', 'azure', 'salesforce',
            
            // Health & Safety
            'occupational safety', 'seguridad laboral', 'saúde ocupacional',
            'first aid', 'primeros auxilios', 'medical', 'health department',
            
            // Government Agencies (examples)
            'department of', 'departamento de', 'ministério da',
            'secretaría de', 'agencia', 'agency'
        ];

        this.protectionPatterns = [
            // Encryption
            '/encrypt', '/filter', '/v 1', '/v 2', '/v 3', '/v 4', '/v 5',
            '/length 40', '/length 128', '/length 256',
            '/aes', '/rc4', '/security',
            
            // Permissions
            '/p -', '/o (', '/u (',
            'permissions', 'restrict', 'protection',
            
            // Digital Signatures
            '/sig', '/byterange', '/cert', '/signature',
            '/subfilter', '/adbe.pkcs7',
            
            // Form Fields (often protected)
            '/acroform', '/fields', '/da (', '/dr'
        ];

        this.filenamePatterns = [
            'cert', 'diploma', 'certificate', 'qualification',
            'license', 'award', 'completion', 'transcript',
            'credential', 'badge', 'achievement'
        ];
    }

    analyzeDocument(file, pdfContent) {
        const analysis = {
            fileName: file.name,
            fileSize: file.size,
            isProtected: false,
            protectionLevel: 'none',
            detectedLanguage: 'unknown',
            documentType: 'unknown',
            technology: 'unknown',
            institution: 'unknown',
            protectionReasons: [],
            confidence: 0,
            processingRecommendation: 'normal'
        };

        const content = pdfContent.toLowerCase();
        const fileName = file.name.toLowerCase();

        analysis.detectedLanguage = this.detectLanguage(content);

        const typeDetection = this.detectDocumentType(content, fileName);
        analysis.documentType = typeDetection.type;
        analysis.confidence += typeDetection.confidence;

        analysis.technology = this.detectTechnology(content);

        analysis.institution = this.detectInstitution(content);

        const protectionAnalysis = this.analyzeProtection(content);
        analysis.isProtected = protectionAnalysis.hasProtection;
        analysis.protectionLevel = protectionAnalysis.level;
        analysis.protectionReasons = protectionAnalysis.reasons;
        analysis.confidence += protectionAnalysis.confidence;

        analysis.processingRecommendation = this.getProcessingRecommendation(analysis);

        return analysis;
    }

    detectLanguage(content) {
        const scores = {};
        
        Object.keys(this.certificatePatterns).forEach(lang => {
            scores[lang] = 0;
            this.certificatePatterns[lang].forEach(pattern => {
                if (content.includes(pattern)) {
                    scores[lang] += pattern.length;
                }
            });
        });

        const topLanguage = Object.keys(scores).reduce((a, b) => 
            scores[a] > scores[b] ? a : b
        );

        return scores[topLanguage] > 0 ? topLanguage : 'unknown';
    }

    detectDocumentType(content, fileName) {
        let confidence = 0;
        let type = 'unknown';

        const allPatterns = Object.values(this.certificatePatterns).flat();
        const matches = allPatterns.filter(pattern => content.includes(pattern));
        
        if (matches.length > 0) {
            confidence += matches.length * 10;
            
            if (matches.some(m => ['diploma', 'degree', 'título'].includes(m))) {
                type = 'diploma';
            } else if (matches.some(m => ['certificate', 'certificado', 'certificat'].includes(m))) {
                type = 'certificate';
            } else if (matches.some(m => ['license', 'licencia', 'licence'].includes(m))) {
                type = 'license';
            } else {
                type = 'credential';
            }
        }

        const filenameMatches = this.filenamePatterns.filter(pattern => 
            fileName.includes(pattern)
        );
        
        if (filenameMatches.length > 0) {
            confidence += filenameMatches.length * 15;
            if (type === 'unknown') {
                type = filenameMatches[0];
            }
        }

        return { type, confidence };
    }

    detectTechnology(content) {
        const matches = this.technologyPatterns.filter(pattern => 
            content.includes(pattern)
        );
        
        if (matches.length > 0) {
            const priorityTech = ['tcpdf', 'itext', 'crystal reports', 'docusign'];
            const priorityMatch = matches.find(match => 
                priorityTech.some(tech => match.includes(tech))
            );
            
            return priorityMatch || matches[0];
        }
        
        return 'unknown';
    }

    detectInstitution(content) {
        const matches = this.institutionPatterns.filter(pattern => 
            content.includes(pattern)
        );
        
        return matches.length > 0 ? matches[0] : 'unknown';
    }

    analyzeProtection(content) {
        const analysis = {
            hasProtection: false,
            level: 'none',
            reasons: [],
            confidence: 0
        };

        this.protectionPatterns.forEach(pattern => {
            if (content.includes(pattern)) {
                analysis.hasProtection = true;
                analysis.reasons.push(pattern);
                analysis.confidence += 5;
            }
        });

        if (analysis.reasons.length > 0) {
            if (analysis.reasons.some(r => r.includes('/v 4') || r.includes('/v 5') || r.includes('256'))) {
                analysis.level = 'high';
            } else if (analysis.reasons.some(r => r.includes('/v 2') || r.includes('/v 3') || r.includes('128'))) {
                analysis.level = 'medium';
            } else {
                analysis.level = 'low';
            }
        }

        return analysis;
    }

    getProcessingRecommendation(analysis) {
        if (analysis.confidence > 30 && 
            ['certificate', 'diploma', 'license'].includes(analysis.documentType)) {
            
            if (analysis.technology === 'tcpdf' || analysis.technology.includes('tcpdf')) {
                return 'specialized_tcpdf';
            } else if (analysis.protectionLevel === 'high') {
                return 'specialized_protected';
            } else {
                return 'specialized_certificate';
            }
        }
        
        if (analysis.isProtected) {
            return analysis.protectionLevel === 'high' ? 
                'specialized_protected' : 'careful_processing';
        }
        
        return 'normal';
    }

    shouldUseSpecializedProcessing(file, pdfContent) {
        const analysis = this.analyzeDocument(file, pdfContent);
        
        console.log(`Document analysis for ${file.name}:`, analysis);
        
        const needsSpecialProcessing = [
            'specialized_tcpdf',
            'specialized_protected', 
            'specialized_certificate'
        ].includes(analysis.processingRecommendation);
        
        return {
            needsSpecialProcessing,
            analysis,
            processingMethod: analysis.processingRecommendation
        };
    }
}

window.UniversalProtectedDocumentDetector = UniversalProtectedDocumentDetector;