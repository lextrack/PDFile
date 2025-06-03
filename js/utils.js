class Utils {
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    static fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    static fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    static downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    static showToast(message, type = 'info') {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }

        const toastId = 'toast-' + this.generateId();
        const toastHTML = `
            <div id="${toastId}" class="toast fade-in" role="alert">
                <div class="toast-header">
                    <i class="bi bi-${this.getToastIcon(type)} text-${this.getToastColor(type)} me-2"></i>
                    <strong class="me-auto">PDFile</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: type === 'error' ? 3000 : 2000
        });
        
        toast.show();

        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    static getToastIcon(type) {
        const icons = {
            success: 'check-circle-fill',
            error: 'exclamation-triangle-fill',
            warning: 'exclamation-circle-fill',
            info: 'info-circle-fill'
        };
        return icons[type] || icons.info;
    }

    static getToastColor(type) {
        const colors = {
            success: 'success',
            error: 'danger',
            warning: 'warning',
            info: 'info'
        };
        return colors[type] || colors.info;
    }

    static isPDF(file) {
        return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    }

    static isImage(file) {
        const imageTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
            'image/webp', 'image/bmp', 'image/tiff', 'image/svg+xml'
        ];
        
        const imageExtensions = [
            '.jpg', '.jpeg', '.png', '.gif', '.webp', 
            '.bmp', '.tiff', '.tif', '.svg'
        ];
        
        return imageTypes.includes(file.type) || 
               imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    static isText(file) {
        const textTypes = [
            'text/plain', 'text/csv', 'text/html', 'text/markdown',
            'text/xml', 'application/json'
        ];
        
        const textExtensions = [
            '.txt', '.csv', '.html', '.htm', '.md', '.markdown',
            '.xml', '.json', '.log'
        ];
        
        return textTypes.includes(file.type) || 
               textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    static getFileCategory(file) {
        const fileName = file.name.toLowerCase();
        
        if (fileName.endsWith('.csv')) return 'csv';
        if (fileName.endsWith('.html') || fileName.endsWith('.htm')) return 'html';
        if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) return 'markdown';
        if (fileName.endsWith('.json')) return 'json';
        if (fileName.endsWith('.xml')) return 'xml';
        if (fileName.endsWith('.log')) return 'log';
        
        return 'text';
    }

    static getMimeTypeFromExtension(extension) {
        const mimeTypes = {
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'tiff': 'image/tiff',
            'tif': 'image/tiff',
            'svg': 'image/svg+xml',
            'txt': 'text/plain',
            'csv': 'text/csv',
            'html': 'text/html',
            'htm': 'text/html',
            'md': 'text/markdown',
            'markdown': 'text/markdown',
            'json': 'application/json',
            'xml': 'text/xml'
        };
        return mimeTypes[extension] || 'application/octet-stream';
    }

    static isDocument(file) {
        const docTypes = [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.oasis.opendocument.text'
        ];
        
        const docExtensions = ['.doc', '.docx', '.odt'];
        
        return docTypes.includes(file.type) || 
               docExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    static needsConversion(file) {
        const convertibleTypes = [
            'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/svg+xml'
        ];
        
        const convertibleExtensions = ['.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg'];
        
        return convertibleTypes.includes(file.type) || 
               convertibleExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    static getFileType(file) {
        if (this.isPDF(file)) return 'pdf';
        if (this.isImage(file)) return 'image';
        if (this.isText(file)) return 'text';
        if (this.isDocument(file)) return 'document';
        return 'unknown';
    }

    static updateProgress(percentage, text) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', percentage);
        }
        
        if (progressText && text) {
            progressText.textContent = text;
        }
    }

    static showProgress(text = 'Processing...') {
        try {
            const modalElement = document.getElementById('progressModal');
            if (!modalElement) {
                console.error('Progress modal not found');
                return;
            }

            let modal = bootstrap.Modal.getInstance(modalElement);
            if (!modal) {
                modal = new bootstrap.Modal(modalElement, {
                    backdrop: 'static',
                    keyboard: false
                });
            }
            
            this.updateProgress(0, text);
            modal.show();
            
        } catch (error) {
            console.error('Error showing progress:', error);
        }
    }

    static hideProgress() {
        try {
            const modalElement = document.getElementById('progressModal');
            if (!modalElement) return;

            let modal = bootstrap.Modal.getInstance(modalElement);
            
            if (!modal) {
                modal = new bootstrap.Modal(modalElement);
            }
            
            modal.hide();
            
            setTimeout(() => {
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            }, 300);
            
        } catch (error) {
            console.error('Error hiding progress:', error);
            const modalElement = document.getElementById('progressModal');
            if (modalElement) {
                modalElement.style.display = 'none';
                modalElement.classList.remove('show');
                modalElement.setAttribute('aria-hidden', 'true');
            }
            
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    static createImageFromBlob(blob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Error loading image'));
            };
            
            img.src = url;
        });
    }

    static resizeImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(resolve, file.type || 'image/jpeg', quality);
            };
            
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    static validateFileSize(file, maxSizeMB = 100) {
        const maxBytes = maxSizeMB * 1024 * 1024;
        return file.size <= maxBytes;
    }

    static capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    static sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9.-]/gi, '_').replace(/_+/g, '_');
    }

    static async readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    static detectTextEncoding(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                const arr = new Uint8Array(reader.result.slice(0, 4));
                let header = '';
                for (let i = 0; i < arr.length; i++) {
                    header += arr[i].toString(16);
                }
                
                if (header.startsWith('efbbbf')) {
                    resolve('utf-8');
                } else if (header.startsWith('fffe') || header.startsWith('feff')) {
                    resolve('utf-16');
                } else {
                    resolve('utf-8');
                }
            };
            reader.readAsArrayBuffer(file.slice(0, 4));
        });
    }

    static isValidImageFormat(file) {
        const validFormats = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
            'image/webp', 'image/bmp', 'image/tiff', 'image/svg+xml'
        ];
        return validFormats.includes(file.type);
    }

    static getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
    }

    static async validatePDFFile(file) {
        try {
            if (!this.isPDF(file)) {
                return { isValid: false, error: 'Not a PDF file' };
            }
            
            if (!this.validateFileSize(file)) {
                return { isValid: false, error: 'File too large (max 50MB)' };
            }
            
            const arrayBuffer = await this.fileToArrayBuffer(file);
            const bytes = new Uint8Array(arrayBuffer.slice(0, 1024));
            const pdfString = String.fromCharCode.apply(null, bytes);
            
            let warnings = [];
            
            if (pdfString.includes('/Encrypt') || pdfString.includes('/Filter')) {
                warnings.push('This PDF appears to be encrypted/protected');
            }
            
            if (pdfString.includes('/Sig') || pdfString.includes('/Cert') || 
                file.name.toLowerCase().includes('certificat') || 
                file.name.toLowerCase().includes('certificate')) {
                warnings.push('This appears to be a certificate or signed document');
            }
            
            return { 
                isValid: true, 
                warnings: warnings,
                hasEncryption: warnings.some(w => w.includes('encrypted'))
            };
            
        } catch (error) {
            return { 
                isValid: false, 
                error: `Could not validate PDF: ${error.message}` 
            };
        }
    }

    static showPDFValidationWarnings(fileName, validation) {
        if (validation.warnings && validation.warnings.length > 0) {
            const warningMessages = validation.warnings.map(w => `• ${w}`).join('\n');
            this.showToast(
                `${fileName}:\n${warningMessages}\n\nProcessing will be attempted but may have limitations.`,
                'warning'
            );
        }
    }
}

class PasswordDialog {
    static async promptForPassword(fileName) {
        return new Promise((resolve, reject) => {
            const modalHTML = `
                <div class="modal fade" id="passwordModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="bi bi-lock-fill me-2 text-warning"></i>
                                    Password Required
                                </h5>
                            </div>
                            <div class="modal-body">
                                <p class="mb-3">The PDF file <strong>${fileName}</strong> is password protected.</p>
                                <div class="mb-3">
                                    <label for="pdfPassword" class="form-label">Enter password:</label>
                                    <input type="password" class="form-control" id="pdfPassword" 
                                           placeholder="PDF password" autocomplete="off">
                                    <div class="form-text">Leave empty to try processing without password</div>
                                </div>
                                <div class="alert alert-info small">
                                    <i class="bi bi-info-circle me-1"></i>
                                    If no password is provided, we'll attempt to convert the document by rendering it as images (quality may be reduced).
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" id="passwordCancel">
                                    Skip File
                                </button>
                                <button type="button" class="btn btn-warning" id="passwordTryWithout">
                                    Try Without Password
                                </button>
                                <button type="button" class="btn btn-primary" id="passwordSubmit">
                                    Use Password
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            const existingModal = document.getElementById('passwordModal');
            if (existingModal) existingModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            const modal = new bootstrap.Modal(document.getElementById('passwordModal'), {
                backdrop: 'static',
                keyboard: false
            });
            
            const passwordInput = document.getElementById('pdfPassword');
            const cancelBtn = document.getElementById('passwordCancel');
            const tryWithoutBtn = document.getElementById('passwordTryWithout');
            const submitBtn = document.getElementById('passwordSubmit');

            modal.show();
            setTimeout(() => passwordInput.focus(), 300);
            
            cancelBtn.addEventListener('click', () => {
                modal.hide();
                resolve({ action: 'skip' });
            });
            
            tryWithoutBtn.addEventListener('click', () => {
                modal.hide();
                resolve({ action: 'try_without', password: '' });
            });
            
            submitBtn.addEventListener('click', () => {
                const password = passwordInput.value;
                modal.hide();
                resolve({ action: 'use_password', password: password });
            });
            
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const password = passwordInput.value;
                    modal.hide();
                    resolve({ action: 'use_password', password: password });
                }
            });
            
            document.getElementById('passwordModal').addEventListener('hidden.bs.modal', () => {
                setTimeout(() => {
                    const modalElement = document.getElementById('passwordModal');
                    if (modalElement) modalElement.remove();
                }, 300);
            });
        });
    }
}

window.PasswordDialog = PasswordDialog;