# PDFile 📄

A basic, client-side PDF manipulation tool that runs entirely in your browser. No uploads, no servers, complete privacy.

## Screenshots
<div align="center">
  <img src="Screenshots\1.jpg" width="400"/>
  <img src="Screenshots\2.jpg" width="400"/>
  <img src="Screenshots\3.jpg" width="400"/>
  <img src="Screenshots\4.jpg" width="400"/>
</div>

## ✨ Features

### Core PDF Operations
- **🔗 Merge PDFs** - Combine multiple PDF files into one document
- **✂️ Split PDFs** - Extract specific pages from PDF documents
- **🔄 Reorder Pages** - Drag and drop to rearrange PDF pages
- **🗜️ Compress PDFs** - Reduce file size with advanced compression options
- **👁️ View PDFs** - Built-in PDF viewer with zoom and navigation

### File Format Support
**PDFs**: Standard, (some) encrypted and digitally signed
**Images**: JPG, jpg, GIF, WEBP, BMP, SVG
**Text Files**: TXT, CSV, HTML, JSON, XML

## 🚀 Try the app

You can access the live application from the pinned link, in the description section of this repository, hosted on GitHub Pages.

## 🎯 How It Works

### 1. Select a Tool
Choose from merge, split, reorder, compress, convert, or view operations.

### 2. Upload Files
Drag and drop files or click to select. Files are processed locally - nothing is uploaded to servers.

### 3. Configure & Process
Adjust settings if needed and click "Process" to perform the operation.

### 4. Download Results
Your processed files are automatically downloaded to your device.

### ⌨️ Keyboard Shortcuts
- `Ctrl/Cmd + S` - Process files
- `Ctrl/Cmd + H` - Show help
- `Ctrl/Cmd + 1` - Quick search tools
- `Escape` - Cancel/Go back
- `Delete` - Remove selected element
- `Arrow Keys` - Navigate PDF pages (in viewer)
- `+/-` - Zoom in/out (in PDF viewer)

## 🛡️ Privacy & Security

- **100% Client-Side Processing** - All operations happen in your browser
- **No File Uploads** - Your documents never leave your device
- **No Data Collection** - I don't track, store, or analyze your files
- **Offline Capable** - Works without internet connection after first load
- **Open Source** - Full transparency of code and operations

## 🏗️ Architecture

```
PDFile/
├── css/                    # Stylesheets
│   ├── styles.css         # Main styles
│   ├── pdf-viewer.css     # PDF viewer styles
│   ├── page-reorder.css   # Drag & drop styles
│   └── text-conversion.css # Text conversion styles
├── js/                     # JavaScript modules
│   ├── app.js             # Main application
│   ├── ui-handler.js      # UI management
│   ├── pdf-operations.js  # PDF processing core
│   ├── file-handler.js    # File management
│   ├── format-converters.js # Format conversion
│   └── [other specialized processors]
├── index.html             # Main interface
├── manifest.json          # PWA manifest
└── sw.js                 # Service worker
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **PDF.js** - Mozilla's PDF rendering library
- **PDF-lib** - JavaScript PDF manipulation library
- **Bootstrap** - UI framework and components
- **Bootstrap Icons** - Icon library

## 🐛 Known Issues & Limitations

- **File Size Limit**: 100MB per file
- **Protected PDFs**: Some heavily encrypted PDFs may have processing limitations
- **Mobile Performance**: Large files may process slower on mobile devices
- **Browser Memory**: Very large operations may require desktop browsers

---

**Made with ❤️ for document processing freedom**

*Keep your files private, keep your data yours.*