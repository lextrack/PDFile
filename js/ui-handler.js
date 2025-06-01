// Add to the UIHandler class constructor:
this.signatureHandler = new SignatureHandler(this);

// Add to the selectTool method in UIHandler:
if (tool === 'sign') {
    if (this.selectedFiles.length === 0) {
        this.showUploadSection();
    } else {
        this.signatureHandler.showSignaturePad();
    }
}

// Add to the clearWorkspace method in UIHandler:
this.signatureHandler.hideSignaturePad();