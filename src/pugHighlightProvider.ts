import * as vscode from 'vscode';

export class PugDocumentHighlightProvider implements vscode.DocumentHighlightProvider {
    
    public provideDocumentHighlights(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentHighlight[]> {
        
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return [];
        }

        const word = document.getText(wordRange);
        const line = document.lineAt(position);
        
        // Check if we're highlighting a mixin
        if (this.isMixinDefinition(line.text, position.character) || 
            this.isMixinCall(line.text, position.character)) {
            
            return this.highlightMixinUsages(document, word);
        }

        // Check if we're highlighting a block
        if (this.isBlockDefinition(line.text, position.character) || 
            this.isBlockUsage(line.text, position.character)) {
            
            return this.highlightBlockUsages(document, word);
        }

        return [];
    }

    private isMixinDefinition(lineText: string, position: number): boolean {
        const mixinDefPattern = /^\s*mixin\s+(\w+)/;
        const match = lineText.match(mixinDefPattern);
        if (match) {
            const mixinNameStart = lineText.indexOf(match[1]);
            const mixinNameEnd = mixinNameStart + match[1].length;
            return position >= mixinNameStart && position <= mixinNameEnd;
        }
        return false;
    }

    private isMixinCall(lineText: string, position: number): boolean {
        const mixinCallPattern = /^\s*\+(\w+)/;
        const match = lineText.match(mixinCallPattern);
        if (match) {
            const mixinNameStart = lineText.indexOf(match[1]);
            const mixinNameEnd = mixinNameStart + match[1].length;
            return position >= mixinNameStart && position <= mixinNameEnd;
        }
        return false;
    }

    private isBlockDefinition(lineText: string, position: number): boolean {
        const blockDefPattern = /^\s*block\s+(\w+)/;
        const match = lineText.match(blockDefPattern);
        if (match) {
            const blockNameStart = lineText.indexOf(match[1]);
            const blockNameEnd = blockNameStart + match[1].length;
            return position >= blockNameStart && position <= blockNameEnd;
        }
        return false;
    }

    private isBlockUsage(lineText: string, position: number): boolean {
        // Block usage in extends/overrides
        const blockUsagePattern = /^\s*block\s+(\w+)/;
        const match = lineText.match(blockUsagePattern);
        if (match) {
            const blockNameStart = lineText.indexOf(match[1]);
            const blockNameEnd = blockNameStart + match[1].length;
            return position >= blockNameStart && position <= blockNameEnd;
        }
        return false;
    }

    private highlightMixinUsages(document: vscode.TextDocument, mixinName: string): vscode.DocumentHighlight[] {
        const highlights: vscode.DocumentHighlight[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Highlight mixin definitions
            const mixinDefPattern = new RegExp(`^\\s*mixin\\s+${this.escapeRegExp(mixinName)}\\b`);
            if (mixinDefPattern.test(line)) {
                const startIndex = line.indexOf(mixinName);
                if (startIndex !== -1) {
                    const range = new vscode.Range(i, startIndex, i, startIndex + mixinName.length);
                    highlights.push(new vscode.DocumentHighlight(range, vscode.DocumentHighlightKind.Write));
                }
            }

            // Highlight mixin calls
            const mixinCallPattern = new RegExp(`^\\s*\\+${this.escapeRegExp(mixinName)}\\b`);
            if (mixinCallPattern.test(line)) {
                const startIndex = line.indexOf(mixinName);
                if (startIndex !== -1) {
                    const range = new vscode.Range(i, startIndex, i, startIndex + mixinName.length);
                    highlights.push(new vscode.DocumentHighlight(range, vscode.DocumentHighlightKind.Read));
                }
            }
        }

        return highlights;
    }

    private highlightBlockUsages(document: vscode.TextDocument, blockName: string): vscode.DocumentHighlight[] {
        const highlights: vscode.DocumentHighlight[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Highlight block definitions and usages
            const blockPattern = new RegExp(`^\\s*block\\s+${this.escapeRegExp(blockName)}\\b`);
            if (blockPattern.test(line)) {
                const startIndex = line.indexOf(blockName);
                if (startIndex !== -1) {
                    const range = new vscode.Range(i, startIndex, i, startIndex + blockName.length);
                    // Use Write kind for block definitions/overrides
                    highlights.push(new vscode.DocumentHighlight(range, vscode.DocumentHighlightKind.Write));
                }
            }
        }

        return highlights;
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
} 