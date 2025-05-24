import * as vscode from 'vscode';

export class PugFoldingRangeProvider implements vscode.FoldingRangeProvider {
    
    public provideFoldingRanges(
        document: vscode.TextDocument,
        context: vscode.FoldingContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.FoldingRange[]> {
        
        const foldingRanges: vscode.FoldingRange[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        // Stack to keep track of open blocks
        const openBlocks: Array<{ line: number; indent: number; type: string }> = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            const indent = this.getIndentLevel(line);
            
            // Skip empty lines and comments
            if (trimmedLine === '' || trimmedLine.startsWith('//')) {
                continue;
            }
            
            // Close blocks that have ended (indentation decreased)
            while (openBlocks.length > 0 && openBlocks[openBlocks.length - 1].indent >= indent) {
                const block = openBlocks.pop()!;
                if (i - 1 > block.line) { // Only create folding range if there's content to fold
                    foldingRanges.push(new vscode.FoldingRange(
                        block.line,
                        i - 1,
                        this.getFoldingKind(block.type)
                    ));
                }
            }
            
            // Check for foldable constructs
            const blockType = this.getBlockType(trimmedLine);
            if (blockType) {
                openBlocks.push({ line: i, indent, type: blockType });
            }
        }
        
        // Close any remaining open blocks
        while (openBlocks.length > 0) {
            const block = openBlocks.pop()!;
            if (lines.length - 1 > block.line) {
                foldingRanges.push(new vscode.FoldingRange(
                    block.line,
                    lines.length - 1,
                    this.getFoldingKind(block.type)
                ));
            }
        }
        
        return foldingRanges;
    }
    
    private getIndentLevel(line: string): number {
        let indent = 0;
        for (const char of line) {
            if (char === ' ') {
                indent++;
            } else if (char === '\t') {
                indent += 4; // Treat tab as 4 spaces
            } else {
                break;
            }
        }
        return indent;
    }
    
    private getBlockType(line: string): string | null {
        // Mixin definitions
        if (/^mixin\s+\w+/.test(line)) {
            return 'mixin';
        }
        
        // Block definitions
        if (/^block\s+\w+/.test(line)) {
            return 'block';
        }
        
        // Conditional statements
        if (/^if\s+/.test(line) || /^unless\s+/.test(line)) {
            return 'conditional';
        }
        
        // Case statements
        if (/^case\s+/.test(line)) {
            return 'case';
        }
        
        // Each loops
        if (/^each\s+/.test(line)) {
            return 'loop';
        }
        
        // HTML tags with content
        if (/^[a-zA-Z][a-zA-Z0-9]*(\.|#|$|\s)/.test(line)) {
            return 'tag';
        }
        
        // Doctype declarations
        if (/^doctype\s+/.test(line)) {
            return 'doctype';
        }
        
        return null;
    }
    
    private getFoldingKind(blockType: string): vscode.FoldingRangeKind | undefined {
        switch (blockType) {
            case 'mixin':
            case 'block':
                return vscode.FoldingRangeKind.Region;
            case 'conditional':
            case 'case':
            case 'loop':
                return vscode.FoldingRangeKind.Region;
            case 'tag':
                return undefined; // Default folding
            case 'doctype':
                return vscode.FoldingRangeKind.Region;
            default:
                return undefined;
        }
    }
} 