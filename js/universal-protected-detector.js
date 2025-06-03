class UniversalProtectedDocumentDetector {
    constructor() {
        this.certificatePatterns = {
            spanish: [
                // Básico
                'certificado', 'diploma', 'título', 'curso', 'capacitación', 
                'constancia', 'acreditación', 'licencia', 'habilitación',
                'certificación', 'credencial', 'distintivo', 'reconocimiento',
                
                // Frases de certificación
                'por haber cumplido', 'satisfactoriamente', 'otorga el presente',
                'se certifica que', 'hace constar que', 'certifica que',
                'aprobó el curso', 'completó exitosamente', 'finalizó el programa',
                'cumple con los requisitos', 'ha demostrado competencia',
                
                // Validación
                'valida tu diploma', 'valida tu certificado', 'validar certificado',
                'verificar diploma', 'código de verificación', 'autenticidad',
                
                // Seguridad laboral Chile
                'achs', 'seguro laboral', 'asociación chilena de seguridad',
                'instituto de seguridad del trabajo', 'ist chile',
                'instituto de seguridad laboral', 'isl chile',
                'mutual de seguridad', 'prevención de riesgos',
                'seguridad industrial', 'higiene ocupacional',
                'salud en el trabajo', 'elementos de protección personal',
                'trabajos en altura', 'espacios confinados',
                'primeros auxilios', 'evacuación y emergencias',
                'uso de extintores', 'manejo defensivo',
                
                // Minería Chile
                'codelco', 'corporación nacional del cobre',
                'capacitación minera', 'seguridad minera', 'operación de equipos',
                'manejo de maquinaria pesada', 'voladura', 'tronadura',
                'geomecánica', 'ventilación de minas',
                
                // Gobierno y organismos Chile
                'gobierno de chile', 'ministerio del trabajo',
                'dirección del trabajo', 'sence', 'suseso',
                'servicio nacional de capacitación',
                'superintendencia de seguridad social',
                
                // Educación Chile
                'universidad de chile', 'pontificia universidad católica',
                'universidad técnica federico santa maría',
                'universidad de concepción', 'duoc uc', 'inacap',
                'instituto aiep', 'centro de formación técnica',
                
                // Colegios profesionales Chile
                'colegio de ingenieros', 'colegio médico',
                'colegio de profesores', 'colegio de contadores',
                'colegio de arquitectos',
                
                // Empresas Chile
                'cchc', 'cámara chilena de la construcción',
                'sofofa', 'sociedad de fomento fabril',
                'asimet', 'sonami', 'escondida', 'anglo american'
            ],
            
            english: [
                // Basic
                'certificate', 'diploma', 'degree', 'certification', 'license',
                'accreditation', 'qualification', 'completion', 'achievement',
                'training certificate', 'course completion', 'credential',
                
                // Certification phrases
                'hereby certify', 'has successfully completed', 'is hereby awarded',
                'has demonstrated proficiency', 'meets the requirements',
                'has earned', 'is qualified', 'is certified',
                
                // Validation
                'validate certificate', 'verify diploma', 'verification code',
                'authenticate document', 'document verification',
                
                // Safety and occupational
                'safety training', 'occupational health', 'industrial hygiene',
                'risk assessment', 'hazard identification',
                'personal protective equipment', 'ppe training',
                'first aid', 'cpr certification', 'fire safety',
                'confined space', 'working at heights',
                'hazardous materials', 'defensive driving',
                
                // Professional development
                'continuing education', 'professional development',
                'skills assessment', 'competency evaluation',
                
                // Mining and industry
                'mining safety', 'equipment operation', 'heavy machinery',
                'blasting certification', 'mine ventilation',
                'metallurgy', 'mineral processing'
            ],
            
            portuguese: [
                'certificado', 'diploma', 'título', 'curso', 'capacitação',
                'licença', 'habilitação', 'conclusão', 'certificação',
                'credencial', 'qualificação', 'reconhecimento',
                'por ter completado', 'satisfatoriamente', 'concede o presente',
                'certifica que', 'atesta que', 'comprova que',
                'validar certificado', 'verificar diploma',
                'segurança do trabalho', 'saúde ocupacional',
                'prevenção de acidentes', 'equipamentos de proteção',
                'primeiros socorros', 'combate a incêndios'
            ],
            
            french: [
                'certificat', 'diplôme', 'titre', 'cours', 'formation',
                'licence', 'habilitation', 'achèvement', 'certification',
                'qualification', 'reconnaissance', 'attestation',
                'ayant satisfait', 'avec succès', 'décerne le présent',
                'certifie que', 'atteste que', 'confirme que',
                'valider certificat', 'vérifier diplôme',
                'sécurité au travail', 'santé occupationnelle',
                'prévention des risques', 'équipements de protection',
                'premiers secours', 'lutte contre l\'incendie'
            ],
            
            german: [
                'zertifikat', 'diplom', 'titel', 'kurs', 'ausbildung',
                'lizenz', 'befähigung', 'abschluss', 'zertifizierung',
                'qualifikation', 'anerkennung', 'bescheinigung',
                'erfolgreich abgeschlossen', 'hiermit bescheinigt',
                'bescheinigt dass', 'bestätigt dass',
                'zertifikat validieren', 'diplom verifizieren',
                'arbeitssicherheit', 'arbeitsschutz',
                'risikobeurteilung', 'schutzausrüstung',
                'erste hilfe', 'brandschutz'
            ],
            
            italian: [
                'certificato', 'diploma', 'titolo', 'corso', 'formazione',
                'licenza', 'abilitazione', 'completamento', 'certificazione',
                'qualifica', 'riconoscimento', 'attestato',
                'aver completato', 'con successo', 'rilascia il presente',
                'certifica che', 'attesta che', 'conferma che',
                'validare certificato', 'verificare diploma',
                'sicurezza sul lavoro', 'salute occupazionale',
                'prevenzione rischi', 'dispositivi di protezione',
                'primo soccorso', 'antincendio'
            ]
        };

        this.technologyPatterns = [
            // PDF Libraries
            'tcpdf', 'www.tcpdf.org', 'powered by tcpdf', 'tcpdf protection',
            'itext', 'itextpdf', 'itext.com', 'itextsharp',
            'fpdf', 'www.fpdf.org', 'fpdf.org',
            'dompdf', 'github.com/dompdf', 'dompdf/dompdf',
            'wkhtmltopdf', 'wkhtmltopdf.org', 'qt webkit',
            'prince xml', 'princexml.com', 'prince pdf',
            'phantomjs', 'slimerjs', 'headless chrome',
            'puppeteer', 'playwright', 'selenium',
            
            // Report Tools
            'crystal reports', 'sap crystal', 'business objects',
            'jasperreports', 'jaspersoft', 'pentaho reporting',
            'birt report', 'eclipse birt', 'actuate birt',
            'cognos', 'ibm cognos', 'reportlab', 'weasyprint',
            'pdftk', 'ghostscript', 'poppler', 'mupdf',
            
            // Enterprise Systems
            'sap', 'oracle', 'peoplesoft', 'workday',
            'successfactors', 'cornerstone ondemand', 'talentlms',
            'moodle', 'blackboard', 'canvas lms', 'schoology',
            'brightspace', 'edmodo', 'google classroom',
            
            // Government/Official
            'gobierno', 'government', 'gouvernement', 'regierung',
            'ministério', 'ministerio', 'ministry', 'ministerium',
            'prefeitura', 'ayuntamiento', 'municipality', 'gemeinde',
            'senado', 'congreso', 'parlamento', 'asamblea',
            
            // Chilean specific systems
            'sistema de capacitación', 'plataforma sence',
            'registro nacional', 'servicio civil',
            'contraloría general', 'tribunal constitucional',
            
            // Digital signature systems
            'firma digital', 'digital signature', 'signature électronique',
            'adobe acrobat', 'docusign', 'adobe sign',
            'hellosign', 'signaturit', 'signnow', 'pandadoc',
            'certisign', 'iti', 'serasa', 'valid certificadora'
        ];

        this.institutionPatterns = [
            // Educational
            'university', 'universidad', 'universidade', 'université', 'universität',
            'college', 'instituto', 'school', 'academia', 'training center',
            'centro de formación', 'centro de capacitación', 'escuela',
            'facultad', 'departamento académico', 'campus',
            
            // Chilean universities
            'universidad de chile', 'pontificia universidad católica',
            'universidad técnica federico santa maría', 'universidad de concepción',
            'universidad de santiago', 'universidad austral',
            'universidad católica de valparaíso', 'universidad de la frontera',
            
            // Technical institutes Chile
            'duoc uc', 'inacap', 'instituto aiep', 'instituto profesional',
            'centro de formación técnica', 'cft', 'instituto técnico',
            
            // Professional Bodies
            'association', 'asociación', 'associação', 'colegio profesional',
            'board of', 'council of', 'chamber of', 'bar association',
            'ordem dos', 'conselho regional', 'sindicato',
            
            // Chilean professional colleges
            'colegio de ingenieros de chile', 'colegio médico de chile',
            'colegio de profesores', 'colegio de contadores',
            'colegio de arquitectos', 'colegio de abogados',
            
            // Certification Bodies
            'iso ', 'ieee', 'pmp', 'cissp', 'comptia', 'cisco', 'microsoft',
            'google', 'amazon web services', 'aws', 'azure', 'salesforce',
            'oracle certification', 'red hat', 'vmware', 'citrix',
            
            // Health & Safety
            'occupational safety', 'seguridad laboral', 'saúde ocupacional',
            'first aid', 'primeros auxilios', 'medical', 'health department',
            'cruz roja', 'red cross', 'bomberos', 'fire department',
            'defensa civil', 'emergency services', 'rescue training',
            
            // Chilean safety institutions
            'achs', 'asociación chilena de seguridad',
            'instituto de seguridad del trabajo', 'ist',
            'instituto de seguridad laboral', 'isl',
            'mutual de seguridad', 'suseso',
            
            // Government Agencies
            'department of', 'departamento de', 'ministério da',
            'secretaría de', 'agencia', 'agency', 'servicio',
            'dirección', 'superintendencia', 'subsecretaría',
            
            // Chilean government
            'gobierno de chile', 'ministerio del trabajo',
            'dirección del trabajo', 'sence', 'seremi',
            'intendencia', 'gobernación', 'contraloría',
            
            // Industry associations Chile
            'cchc', 'cámara chilena de la construcción',
            'sofofa', 'sociedad de fomento fabril',
            'asimet', 'sonami', 'sociedad nacional de minería',
            'cámara de comercio', 'asociación de industriales',
            
            // Mining companies Chile
            'codelco', 'escondida', 'anglo american',
            'antofagasta minerals', 'barrick', 'kinross',
            'newmont', 'freeport', 'los pelambres'
        ];

        this.protectionPatterns = [
            // Encryption
            '/encrypt', '/filter', '/v 1', '/v 2', '/v 3', '/v 4', '/v 5',
            '/length 40', '/length 128', '/length 256',
            '/aes', '/rc4', '/security', '/cf', '/stmf', '/strf',
            
            // Permissions
            '/p -', '/o (', '/u (', '/oe (', '/ue (',
            'permissions', 'restrict', 'protection', 'access',
            'modify', 'print', 'copy', 'extract',
            
            // Digital Signatures
            '/sig', '/byterange', '/cert', '/signature',
            '/subfilter', '/adbe.pkcs7', '/adbe.x509.rsa_sha1',
            '/adbe.pkcs7.detached', '/adbe.pkcs7.sha1',
            '/contact info', '/reason', '/location',
            
            // Form Fields
            '/acroform', '/fields', '/da (', '/dr', '/needappearances',
            '/sigflags', '/xfa', '/calculation order'
        ];

        this.filenamePatterns = [
            // Basic patterns
            'cert', 'diploma', 'certificate', 'qualification',
            'license', 'award', 'completion', 'transcript',
            'credential', 'badge', 'achievement', 'recognition',
            
            // Spanish patterns
            'certificado', 'diploma', 'titulo', 'capacitacion',
            'acreditacion', 'licencia', 'constancia',
            
            // Safety patterns
            'seguridad', 'safety', 'prevencion', 'riesgos',
            'achs', 'ist', 'isl', 'mutual',
            
            // Training patterns
            'curso', 'training', 'capacitacion', 'formacion',
            'entrenamiento', 'workshop', 'seminario'
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