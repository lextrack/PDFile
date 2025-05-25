class BaseConverter {
    constructor() {
        this.defaultConfig = {
            fontSize: 11,
            lineHeight: 1.4,
            margin: 60,
            pageSize: 'a4'
        };
    }

    mergeConfig(customConfig = {}) {
        return { ...this.defaultConfig, ...customConfig };
    }

    sanitizeText(text) {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, (char) => {
                if (char === '\n' || char === '\t') return char;
                return ' ';
            })
            .replace(/[^\x20-\x7E\n\t\u00A0-\u00FF]/g, (char) => {
                const code = char.charCodeAt(0);
                if (code === 8226) return '•';
                if (code === 8211 || code === 8212) return '-';
                if (code === 8216 || code === 8217) return "'";
                if (code === 8220 || code === 8221) return '"';
                return '?';
            })
            .replace(/\t/g, '    ');
    }

    safeWidthCalculation(font, text, fontSize) {
        try {
            const cleanText = text.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
            return font.widthOfTextAtSize(cleanText, fontSize);
        } catch (error) {
            return text.length * fontSize * 0.6;
        }
    }

    async convert(content, config = {}) {
        throw new Error('Convert method must be implemented by subclass');
    }
}

class TextConverter extends BaseConverter {
    constructor() {
        super();
        this.defaultConfig = {
            ...this.defaultConfig,
            preserveFormatting: true,
            detectHeaders: true,
            headerSize: 16,
            subHeaderSize: 14
        };
    }

    async convert(content, config = {}) {
        const finalConfig = this.mergeConfig(config);
        const pdfDoc = await PDFLib.PDFDocument.create();
        
        const fonts = {
            helvetica: await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica),
            helveticaBold: await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold),
            courier: await pdfDoc.embedFont(PDFLib.StandardFonts.Courier),
            courierBold: await pdfDoc.embedFont(PDFLib.StandardFonts.CourierBold)
        };
        
        let currentPage = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = currentPage.getSize();
        finalConfig.maxWidth = width - (finalConfig.margin * 2);
        
        let yPosition = height - finalConfig.margin;
        const effectiveLineHeight = finalConfig.fontSize * finalConfig.lineHeight;
        
        const cleanText = this.preprocessText(content);
        const processedContent = this.parseTextContent(cleanText);
        
        for (const element of processedContent) {
            const result = await this.renderTextElement(
                element, 
                currentPage, 
                pdfDoc, 
                fonts, 
                finalConfig, 
                yPosition
            );
            
            currentPage = result.page;
            yPosition = result.yPosition;
        }
        
        this.addMetadata(pdfDoc, 'Converted Text Document');
        return await pdfDoc.save();
    }

    preprocessText(text) {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
            .replace(/\t/g, '    ')
            .split('\n')
            .map(line => {
                const leadingSpaces = line.match(/^\s*/)[0];
                const content = line.trim();
                return content ? leadingSpaces + content : '';
            })
            .join('\n')
            .replace(/\n\s*\n\s*\n/g, '\n\n');
    }

    parseTextContent(text) {
        const lines = text.split('\n');
        const elements = [];
        let currentParagraph = [];
        let inCodeBlock = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
                if (currentParagraph.length > 0) {
                    elements.push({
                        type: 'paragraph',
                        content: currentParagraph.join('\n'),
                        style: 'normal'
                    });
                    currentParagraph = [];
                }
                inCodeBlock = !inCodeBlock;
                continue;
            }
            
            if (inCodeBlock) {
                elements.push({
                    type: 'code',
                    content: line,
                    style: 'monospace'
                });
                continue;
            }
            
            if (trimmedLine.match(/^#{1,6}\s/)) {
                if (currentParagraph.length > 0) {
                    elements.push({
                        type: 'paragraph',
                        content: currentParagraph.join('\n'),
                        style: 'normal'
                    });
                    currentParagraph = [];
                }
                
                const level = trimmedLine.match(/^#+/)[0].length;
                const title = trimmedLine.replace(/^#+\s*/, '');
                
                elements.push({
                    type: 'header',
                    content: title,
                    level: level,
                    style: 'bold'
                });
                continue;
            }
            
            const listMatch = trimmedLine.match(/^[\s]*[-*+•]\s+(.+)/) || 
                            trimmedLine.match(/^[\s]*\d+[\.\)]\s+(.+)/);
            
            if (listMatch) {
                if (currentParagraph.length > 0) {
                    elements.push({
                        type: 'paragraph',
                        content: currentParagraph.join('\n'),
                        style: 'normal'
                    });
                    currentParagraph = [];
                }
                
                const indent = line.length - line.trimStart().length;
                elements.push({
                    type: 'list',
                    content: listMatch[1],
                    indent: Math.floor(indent / 2),
                    style: 'normal'
                });
                continue;
            }
            
            if (trimmedLine.match(/^[-=_]{3,}$/)) {
                if (currentParagraph.length > 0) {
                    elements.push({
                        type: 'paragraph',
                        content: currentParagraph.join('\n'),
                        style: 'normal'
                    });
                    currentParagraph = [];
                }
                
                elements.push({
                    type: 'separator',
                    content: '---',
                    style: 'normal'
                });
                continue;
            }
            
            if (trimmedLine === '') {
                if (currentParagraph.length > 0) {
                    elements.push({
                        type: 'paragraph',
                        content: currentParagraph.join('\n'),
                        style: 'normal'
                    });
                    currentParagraph = [];
                }
                continue;
            }
            
            currentParagraph.push(line);
        }
        
        if (currentParagraph.length > 0) {
            elements.push({
                type: 'paragraph',
                content: currentParagraph.join('\n'),
                style: 'normal'
            });
        }
        
        return elements;
    }

    async renderTextElement(element, page, pdfDoc, fonts, config, yPosition) {
        const { width, height } = page.getSize();
        const effectiveLineHeight = config.fontSize * config.lineHeight;
        let currentPage = page;
        let currentY = yPosition;
        
        switch (element.type) {
            case 'header':
                const headerSize = element.level === 1 ? config.headerSize : 
                                element.level === 2 ? config.subHeaderSize : 
                                config.fontSize + 2;
                
                currentY -= effectiveLineHeight * 0.5;
                
                if (currentY < config.margin + headerSize) {
                    currentPage = pdfDoc.addPage([width, height]);
                    currentY = height - config.margin;
                }
                
                currentPage.drawText(element.content.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?'), {
                    x: config.margin,
                    y: currentY,
                    size: headerSize,
                    font: fonts.helveticaBold,
                    color: PDFLib.rgb(0.2, 0.2, 0.2)
                });
                
                currentY -= headerSize * 1.2;
                currentY -= effectiveLineHeight * 0.3;
                break;
                
            case 'paragraph':
                const paragraphLines = this.wrapTextAdvanced(
                    element.content, 
                    fonts.helvetica, 
                    config.fontSize, 
                    config.maxWidth
                );
                
                for (const line of paragraphLines) {
                    if (currentY < config.margin + config.fontSize) {
                        currentPage = pdfDoc.addPage([width, height]);
                        currentY = height - config.margin;
                    }
                    
                    const leadingSpaces = line.match(/^\s*/)[0].length;
                    const xOffset = config.margin + (leadingSpaces * 4);
                    const content = line.trim();
                    
                    if (content) {
                        const cleanContent = content.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
                        currentPage.drawText(cleanContent, {
                            x: Math.min(xOffset, config.margin + 40),
                            y: currentY,
                            size: config.fontSize,
                            font: fonts.helvetica,
                            color: PDFLib.rgb(0.1, 0.1, 0.1)
                        });
                    }
                    
                    currentY -= effectiveLineHeight;
                }
                
                currentY -= effectiveLineHeight * 0.3;
                break;
                
            case 'list':
                if (currentY < config.margin + config.fontSize) {
                    currentPage = pdfDoc.addPage([width, height]);
                    currentY = height - config.margin;
                }
                
                const bullet = '• ';
                const indentX = config.margin + (element.indent * 20);
                
                currentPage.drawText(bullet, {
                    x: indentX,
                    y: currentY,
                    size: config.fontSize,
                    font: fonts.helvetica,
                    color: PDFLib.rgb(0.3, 0.3, 0.3)
                });
                
                const listLines = this.wrapTextAdvanced(
                    element.content,
                    fonts.helvetica,
                    config.fontSize,
                    config.maxWidth - (element.indent * 20) - 20
                );
                
                for (let i = 0; i < listLines.length; i++) {
                    if (currentY < config.margin + config.fontSize) {
                        currentPage = pdfDoc.addPage([width, height]);
                        currentY = height - config.margin;
                    }
                    
                    const cleanListContent = listLines[i].trim().replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
                    currentPage.drawText(cleanListContent, {
                        x: indentX + 15,
                        y: currentY,
                        size: config.fontSize,
                        font: fonts.helvetica,
                        color: PDFLib.rgb(0.1, 0.1, 0.1)
                    });
                    
                    currentY -= effectiveLineHeight;
                }
                break;
                
            case 'code':
                if (currentY < config.margin + config.fontSize) {
                    currentPage = pdfDoc.addPage([width, height]);
                    currentY = height - config.margin;
                }
                
                const codeWidth = Math.min(
                    this.safeWidthCalculation(fonts.courier, element.content, config.fontSize - 1) + 20,
                    config.maxWidth
                );
                
                currentPage.drawRectangle({
                    x: config.margin - 5,
                    y: currentY - 2,
                    width: codeWidth + 10,
                    height: config.fontSize + 4,
                    color: PDFLib.rgb(0.95, 0.95, 0.95)
                });
                
                const cleanContent = element.content.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
                
                currentPage.drawText(cleanContent, {
                    x: config.margin,
                    y: currentY,
                    size: config.fontSize - 1,
                    font: fonts.courier,
                    color: PDFLib.rgb(0.2, 0.2, 0.2)
                });
                
                currentY -= effectiveLineHeight;
                break;
                
            case 'separator':
                if (currentY < config.margin + 20) {
                    currentPage = pdfDoc.addPage([width, height]);
                    currentY = height - config.margin;
                }
                
                currentY -= effectiveLineHeight * 0.5;
                
                currentPage.drawLine({
                    start: { x: config.margin, y: currentY },
                    end: { x: width - config.margin, y: currentY },
                    thickness: 1,
                    color: PDFLib.rgb(0.7, 0.7, 0.7)
                });
                
                currentY -= effectiveLineHeight * 0.5;
                break;
        }
        
        return { page: currentPage, yPosition: currentY };
    }

    wrapTextAdvanced(text, font, fontSize, maxWidth) {
        if (!text || maxWidth <= 0) return [''];
        
        const lines = text.split('\n');
        const wrappedLines = [];
        
        for (const line of lines) {
            if (!line.trim()) {
                wrappedLines.push('');
                continue;
            }
            
            const leadingSpaces = line.match(/^\s*/)[0];
            const words = line.trim().split(/\s+/);
            const indentWidth = this.safeWidthCalculation(font, leadingSpaces, fontSize);
            const availableWidth = maxWidth - indentWidth;
            
            if (availableWidth <= 0) {
                wrappedLines.push(line);
                continue;
            }
            
            let currentLine = leadingSpaces;
            let currentWidth = indentWidth;
            
            for (const word of words) {
                const wordWidth = this.safeWidthCalculation(font, word + ' ', fontSize);
                
                if (currentWidth + wordWidth > maxWidth && currentLine.trim() !== '') {
                    wrappedLines.push(currentLine.trimEnd());
                    currentLine = leadingSpaces + word + ' ';
                    currentWidth = indentWidth + wordWidth;
                } else {
                    currentLine += word + ' ';
                    currentWidth += wordWidth;
                }
            }
            
            if (currentLine.trim()) {
                wrappedLines.push(currentLine.trimEnd());
            }
        }
        
        return wrappedLines.length > 0 ? wrappedLines : [''];
    }

    addMetadata(pdfDoc, title) {
        pdfDoc.setTitle(title);
        pdfDoc.setCreator('PDFile');
        pdfDoc.setProducer('PDFile with PDF-lib');
        pdfDoc.setCreationDate(new Date());
    }
}

class CSVConverter extends BaseConverter {
    constructor() {
        super();
        this.defaultConfig = {
            ...this.defaultConfig,
            fontSize: 8,
            headerFontSize: 9,
            margin: 30,
            rowHeight: 18,
            cellPadding: 6,
            autoColumnWidth: true,
            maxColumnWidth: 150,
            minColumnWidth: 40,
            alternateRowColors: true,
            headerBackground: true,
            showBorders: true,
            wrapText: true
        };
    }

    async convert(csvContent, config = {}) {
        const finalConfig = this.mergeConfig(config);
        const pdfDoc = await PDFLib.PDFDocument.create();
        const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        
        const cleanContent = this.sanitizeText(csvContent);
        const rows = this.parseCSV(cleanContent);
        
        if (rows.length === 0) {
            throw new Error('No data to convert');
        }
        
        const maxCols = Math.max(...rows.map(row => row.length));
        const columnWidths = this.calculateColumnWidths(rows, maxCols, finalConfig, font, boldFont);
        
        let currentPage = pdfDoc.addPage([841.89, 595.28]);
        const { width, height } = currentPage.getSize();
        
        const tableWidth = columnWidths.reduce((sum, w) => sum + w, 0);
        const startX = (width - tableWidth) / 2;
        
        let yPosition = height - finalConfig.margin;
        let isFirstRow = true;
        let pageCount = 1;
        
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex];
            const requiredHeight = this.calculateRowHeight(row, columnWidths, finalConfig, font, boldFont, isFirstRow);
            
            if (yPosition < finalConfig.margin + requiredHeight) {
                currentPage = pdfDoc.addPage([841.89, 595.28]);
                yPosition = height - finalConfig.margin;
                pageCount++;
                
                if (!isFirstRow && finalConfig.headerBackground) {
                    this.drawHeaderRow(currentPage, rows[0], columnWidths, startX, yPosition, finalConfig, boldFont);
                    yPosition -= this.calculateRowHeight(rows[0], columnWidths, finalConfig, font, boldFont, true);
                }
            }
            
            this.drawRow(currentPage, row, columnWidths, startX, yPosition, finalConfig, font, boldFont, isFirstRow, rowIndex);
            
            yPosition -= requiredHeight;
            isFirstRow = false;
        }
        
        this.addMetadata(pdfDoc, 'CSV Data Table');
        return await pdfDoc.save();
    }

    parseCSV(csvContent) {
        const lines = csvContent.split('\n').filter(line => line.trim());
        const rows = [];
        
        for (const line of lines) {
            const row = this.parseCSVLine(line);
            if (row.some(cell => cell.trim())) {
                rows.push(row);
            }
        }
        
        return rows;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < line.length) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i += 2;
                    continue;
                }
                inQuotes = !inQuotes;
            } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
            
            i++;
        }
        
        result.push(current.trim());
        return result.map(cell => {
            let cleanCell = cell.replace(/^"(.*)"$/, '$1');
            cleanCell = cleanCell.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
            return cleanCell;
        });
    }

    calculateColumnWidths(rows, maxCols, config, font, boldFont) {
        const widths = new Array(maxCols).fill(config.minColumnWidth);
        
        if (!config.autoColumnWidth) {
            const availableWidth = 841.89 - (config.margin * 2);
            const uniformWidth = availableWidth / maxCols;
            return new Array(maxCols).fill(Math.min(uniformWidth, config.maxColumnWidth));
        }
        
        for (let colIndex = 0; colIndex < maxCols; colIndex++) {
            let maxWidth = config.minColumnWidth;
            
            for (let rowIndex = 0; rowIndex < Math.min(rows.length, 50); rowIndex++) {
                const cell = rows[rowIndex][colIndex] || '';
                const isHeader = rowIndex === 0;
                const currentFont = isHeader ? boldFont : font;
                const fontSize = isHeader ? config.headerFontSize : config.fontSize;
                
                const words = cell.split(' ');
                const longestWord = words.reduce((longest, word) => 
                    word.length > longest.length ? word : longest, ''
                );
                
                const wordWidth = this.safeWidthCalculation(currentFont, longestWord, fontSize);
                const cellWidth = wordWidth + (config.cellPadding * 2) + 10;
                
                maxWidth = Math.max(maxWidth, Math.min(cellWidth, config.maxColumnWidth));
            }
            
            widths[colIndex] = maxWidth;
        }
        
        const totalWidth = widths.reduce((sum, w) => sum + w, 0);
        const availableWidth = 841.89 - (config.margin * 2);
        
        if (totalWidth > availableWidth) {
            const scale = availableWidth / totalWidth;
            return widths.map(w => Math.max(w * scale, config.minColumnWidth));
        }
        
        return widths;
    }

    calculateRowHeight(row, columnWidths, config, font, boldFont, isHeader) {
        let maxLines = 1;
        
        if (config.wrapText) {
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const cell = row[colIndex] || '';
                const currentFont = isHeader ? boldFont : font;
                const fontSize = isHeader ? config.headerFontSize : config.fontSize;
                const cellWidth = columnWidths[colIndex] - (config.cellPadding * 2);
                
                const lines = this.wrapCellText(cell, currentFont, fontSize, cellWidth);
                maxLines = Math.max(maxLines, lines.length);
            }
        }
        
        return Math.max(config.rowHeight, maxLines * (config.fontSize + 2) + (config.cellPadding * 2));
    }

    wrapCellText(text, font, fontSize, maxWidth) {
        if (!text || !config.wrapText) return [text];
        
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const lineWidth = this.safeWidthCalculation(font, testLine, fontSize);
            
            if (lineWidth <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    lines.push(word);
                }
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines.length > 0 ? lines : [''];
    }

    drawRow(page, row, columnWidths, startX, yPosition, config, font, boldFont, isHeader, rowIndex) {
        const rowHeight = this.calculateRowHeight(row, columnWidths, config, font, boldFont, isHeader);
        const rowY = yPosition - rowHeight;
        
        if (config.alternateRowColors && !isHeader && rowIndex % 2 === 0) {
            page.drawRectangle({
                x: startX,
                y: rowY,
                width: columnWidths.reduce((sum, w) => sum + w, 0),
                height: rowHeight,
                color: PDFLib.rgb(0.98, 0.98, 0.98)
            });
        }
        
        if (isHeader && config.headerBackground) {
            page.drawRectangle({
                x: startX,
                y: rowY,
                width: columnWidths.reduce((sum, w) => sum + w, 0),
                height: rowHeight,
                color: PDFLib.rgb(0.9, 0.9, 0.9)
            });
        }
        
        let currentX = startX;
        
        for (let colIndex = 0; colIndex < columnWidths.length; colIndex++) {
            const cellValue = row[colIndex] || '';
            const cellWidth = columnWidths[colIndex];
            const currentFont = isHeader ? boldFont : font;
            const fontSize = isHeader ? config.headerFontSize : config.fontSize;
            
            if (config.showBorders) {
                page.drawRectangle({
                    x: currentX,
                    y: rowY,
                    width: cellWidth,
                    height: rowHeight,
                    borderColor: PDFLib.rgb(0.8, 0.8, 0.8),
                    borderWidth: 0.5
                });
            }
            
            if (cellValue.trim()) {
                const maxCellWidth = cellWidth - (config.cellPadding * 2);
                const lines = this.wrapCellText(cellValue, currentFont, fontSize, maxCellWidth);
                
                for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                    let displayText = lines[lineIndex];
                    
                    while (this.safeWidthCalculation(currentFont, displayText, fontSize) > maxCellWidth && displayText.length > 0) {
                        displayText = displayText.slice(0, -1);
                    }
                    
                    if (displayText !== lines[lineIndex] && displayText.length > 3) {
                        displayText = displayText.slice(0, -3) + '...';
                    }
                    
                    if (displayText.trim()) {
                        const lineY = yPosition - (config.cellPadding + (lineIndex + 1) * (fontSize + 2));
                        
                        page.drawText(displayText, {
                            x: currentX + config.cellPadding,
                            y: lineY,
                            size: fontSize,
                            font: currentFont,
                            color: PDFLib.rgb(0.1, 0.1, 0.1)
                        });
                    }
                }
            }
            
            currentX += cellWidth;
        }
    }

    drawHeaderRow(page, headerRow, columnWidths, startX, yPosition, config, boldFont) {
        this.drawRow(page, headerRow, columnWidths, startX, yPosition, config, null, boldFont, true, 0);
    }

    addMetadata(pdfDoc, title) {
        pdfDoc.setTitle(title);
        pdfDoc.setCreator('PDFile');
        pdfDoc.setProducer('PDFile with PDF-lib');
        pdfDoc.setCreationDate(new Date());
    }
}

class HTMLConverter extends BaseConverter {
    async convert(htmlContent, config = {}) {
        const cleanHtml = this.cleanHTML(htmlContent);
        const textContent = this.extractHTMLContent(cleanHtml);
        
        const textConverter = new TextConverter();
        return await textConverter.convert(textContent, config);
    }

    cleanHTML(html) {
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<h[1-6][^>]*>/gi, '\n### ')
            .replace(/<\/h[1-6]>/gi, '\n\n')
            .replace(/<strong[^>]*>|<b[^>]*>/gi, '**')
            .replace(/<\/strong>|<\/b>/gi, '**')
            .replace(/<em[^>]*>|<i[^>]*>/gi, '*')
            .replace(/<\/em>|<\/i>/gi, '*')
            .replace(/<li[^>]*>/gi, '• ')
            .replace(/<[^>]+>/g, '');
    }

    extractHTMLContent(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || '';
    }
}

class MarkdownConverter extends BaseConverter {
    async convert(markdownContent, config = {}) {
        const cleanedContent = this.cleanSpecialCharacters(markdownContent);
        const processedContent = this.parseMarkdownContent(cleanedContent);
        const textConverter = new TextConverter();
        return await textConverter.convert(processedContent, config);
    }

    cleanSpecialCharacters(text) {
        const replacements = {
            '├': '|--',
            '└': '`--',
            '│': '|',
            '─': '-',
            '┌': '+--',
            '┐': '--+',
            '┘': '--+',
            '┴': '+',
            '┬': '+',
            '┼': '+',
            '▪': '*',
            '▫': 'o',
            '◦': 'o',
            '◯': 'o',
            '→': '->',
            '←': '<-',
            '↑': '^',
            '↓': 'v',
            '⇒': '=>',
            '⇐': '<=',
            '≥': '>=',
            '≤': '<=',
            '≠': '!=',
            '±': '+/-',
            '×': 'x',
            '÷': '/',
            '€': 'EUR',
            '£': 'GBP',
            '¥': 'JPY',
            '©': '(c)',
            '®': '(R)',
            '™': '(TM)',
            '"': '"',
            '"': '"',
            '"': '"',
            '"': '"',
            '—': '--',
            '…': '...',
            '—': '--',
            '…': '...',
            'α': 'alpha',
            'β': 'beta',
            'γ': 'gamma',
            'δ': 'delta',
            'π': 'pi',
            'Σ': 'sum',
            '∞': 'infinity',
            '√': 'sqrt',
            '°': ' degrees',
            '§': 'section',
            '¶': 'paragraph',
            '†': '+',
            '‡': '++',
            '¤': 'currency',
            '¢': 'cents',
            '¦': '|',
            '¨': '"',
            '¬': 'not',
            '¯': '-',
            '´': "'",
            '¸': ','
        };

        let cleanText = text;
        
        Object.keys(replacements).forEach(char => {
            cleanText = cleanText.replace(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacements[char]);
        });
        
        cleanText = cleanText.replace(/[^\x00-\x7F]/g, (char) => {
            const code = char.charCodeAt(0);
            if (code >= 160 && code <= 255) {
                return char;
            }
            return '?';
        });
        
        return cleanText;
    }

    parseMarkdownContent(markdown) {
        return markdown
            .replace(/^### (.*$)/gim, '### $1')
            .replace(/^## (.*$)/gim, '## $1')
            .replace(/^# (.*$)/gim, '# $1')
            .replace(/^\> (.*$)/gim, '    $1')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/!\[([^\]]*)\]\(([^\)]*)\)/g, '[Image: $1]')
            .replace(/\[([^\]]*)\]\(([^\)]*)\)/g, '$1 ($2)')
            .replace(/```([^`]*?)```/gs, (match, code) => {
                return code.split('\n').map(line => '    ' + line).join('\n');
            })
            .replace(/`([^`]+)`/g, '$1')
            .replace(/^\* (.+)/gm, '• $1')
            .replace(/^\+ (.+)/gm, '• $1')
            .replace(/^- (.+)/gm, '• $1')
            .replace(/^\d+\. (.+)/gm, '• $1')
            .replace(/^---+$/gm, '───────────────────────────────────────────────────────────')
            .replace(/^\*\*\*+$/gm, '───────────────────────────────────────────────────────────');
    }
}

class JSONConverter extends BaseConverter {
    async convert(jsonContent, config = {}) {
        try {
            const formattedJson = JSON.stringify(JSON.parse(jsonContent), null, 2);
            const textConverter = new TextConverter();
            const finalConfig = {
                ...config,
                fontFamily: 'courier'
            };
            return await textConverter.convert(formattedJson, finalConfig);
        } catch (error) {
            const textConverter = new TextConverter();
            return await textConverter.convert(jsonContent, config);
        }
    }
}

class XMLConverter extends BaseConverter {
    async convert(xmlContent, config = {}) {
        const textConverter = new TextConverter();
        const finalConfig = {
            ...config,
            fontFamily: 'courier'
        };
        return await textConverter.convert(xmlContent, finalConfig);
    }
}

class ImageConverter extends BaseConverter {
    async convert(imageFiles, config = {}) {
        const pdfDoc = await PDFLib.PDFDocument.create();
        
        for (let i = 0; i < imageFiles.length; i++) {
            const imageFile = imageFiles[i];
            let imageBytes;
            
            if (Utils.needsConversion(imageFile)) {
                imageBytes = await this.convertImageFormat(imageFile);
            } else {
                imageBytes = await Utils.fileToArrayBuffer(imageFile);
            }
            
            let image;
            const convertedType = Utils.needsConversion(imageFile) ? 'image/png' : imageFile.type;
            
            if (convertedType === 'image/jpeg' || convertedType === 'image/jpg') {
                image = await pdfDoc.embedJpg(imageBytes);
            } else if (convertedType === 'image/png') {
                image = await pdfDoc.embedPng(imageBytes);
            } else {
                continue;
            }
            
            const page = pdfDoc.addPage();
            const { width, height } = page.getSize();
            
            const imageAspectRatio = image.width / image.height;
            const pageAspectRatio = width / height;
            
            let drawWidth, drawHeight;
            if (imageAspectRatio > pageAspectRatio) {
                drawWidth = width - 40;
                drawHeight = drawWidth / imageAspectRatio;
            } else {
                drawHeight = height - 40;
                drawWidth = drawHeight * imageAspectRatio;
            }
            
            const x = (width - drawWidth) / 2;
            const y = (height - drawHeight) / 2;
            
            page.drawImage(image, {
                x: x,
                y: y,
                width: drawWidth,
                height: drawHeight
            });
            
            const progress = ((i + 1) / imageFiles.length) * 100;
            Utils.updateProgress(progress, `Converting images... ${i + 1}/${imageFiles.length}`);
        }
        
        this.addMetadata(pdfDoc, 'Converted Images');
        return await pdfDoc.save();
    }

    async convertImageFormat(imageFile) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsArrayBuffer(blob);
                    } else {
                        reject(new Error('Could not convert image'));
                    }
                }, 'image/png');
            };
            
            img.onerror = reject;
            img.src = URL.createObjectURL(imageFile);
        });
    }

    addMetadata(pdfDoc, title) {
        pdfDoc.setTitle(title);
        pdfDoc.setCreator('PDFile');
        pdfDoc.setProducer('PDFile with PDF-lib');
        pdfDoc.setCreationDate(new Date());
    }
}

class FormatConverterFactory {
    static getConverter(fileType) {
        switch (fileType) {
            case 'text':
            case 'log':
                return new TextConverter();
            case 'csv':
                return new CSVConverter();
            case 'html':
                return new HTMLConverter();
            case 'markdown':
            case 'md':
                return new MarkdownConverter();
            case 'json':
                return new JSONConverter();
            case 'xml':
                return new XMLConverter();
            case 'image':
                return new ImageConverter();
            default:
                return new TextConverter();
        }
    }

    static async convertFile(file, fileType, config = {}) {
        const converter = this.getConverter(fileType);
        
        if (fileType === 'image') {
            return await converter.convert([file], config);
        }
        
        const content = await file.text();
        return await converter.convert(content, config);
    }

    static async convertMultipleFiles(files, fileType, config = {}) {
        if (fileType === 'image') {
            const converter = this.getConverter(fileType);
            return await converter.convert(files, config);
        }
        
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
        
        const converter = this.getConverter(fileType === 'json' ? 'text' : fileType);
        const finalConfig = {
            fontSize: 10,
            lineHeight: 1.3,
            margin: 50,
            preserveFormatting: true,
            detectHeaders: true,
            ...config
        };
        
        if (fileType === 'json') {
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
                finalConfig.fontFamily = 'courier';
                return await converter.convert(formattedContent, finalConfig);
            } catch {
                return await converter.convert(combinedContent, finalConfig);
            }
        }
        
        return await converter.convert(combinedContent, finalConfig);
    }
}

window.FormatConverterFactory = FormatConverterFactory;