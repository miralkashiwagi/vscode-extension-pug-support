import * as vscode from 'vscode';

export class PugReferenceProvider implements vscode.ReferenceProvider {
    
    public async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
    ): Promise<vscode.Location[]> {
        
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return [];
        }

        const word = document.getText(wordRange);
        const line = document.lineAt(position);
        
        // Check if we're looking for mixin references
        if (this.isMixinDefinition(line.text, position.character) || 
            this.isMixinCall(line.text, position.character)) {
            
            return await this.findMixinReferences(word, context.includeDeclaration);
        }

        // Check if we're looking for include/extends references
        if (this.isIncludeOrExtends(line.text, position.character)) {
            return await this.findFileReferences(document, word);
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

    private isIncludeOrExtends(lineText: string, position: number): boolean {
        const includePattern = /^\s*(include|extends)\s+(.+)$/;
        const match = lineText.match(includePattern);
        if (match) {
            const pathStart = lineText.indexOf(match[2]);
            const pathEnd = pathStart + match[2].length;
            return position >= pathStart && position <= pathEnd;
        }
        return false;
    }

    private async findMixinReferences(
        mixinName: string, 
        includeDeclaration: boolean
    ): Promise<vscode.Location[]> {
        
        const locations: vscode.Location[] = [];
        
        // Find all Pug files in workspace
        const pugFiles = await vscode.workspace.findFiles('**/*.pug', '**/node_modules/**');
        
        for (const fileUri of pugFiles) {
            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                const fileLocations = this.findMixinReferencesInDocument(document, mixinName, includeDeclaration);
                locations.push(...fileLocations);
            } catch (error) {
                // Skip files that can't be opened
                continue;
            }
        }

        return locations;
    }

    private findMixinReferencesInDocument(
        document: vscode.TextDocument, 
        mixinName: string, 
        includeDeclaration: boolean
    ): vscode.Location[] {
        
        const locations: vscode.Location[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Find mixin definitions
            if (includeDeclaration) {
                const mixinDefPattern = new RegExp(`^\\s*mixin\\s+${this.escapeRegExp(mixinName)}\\b`);
                if (mixinDefPattern.test(line)) {
                    const startIndex = line.indexOf(mixinName);
                    const location = new vscode.Location(
                        document.uri,
                        new vscode.Range(i, startIndex, i, startIndex + mixinName.length)
                    );
                    locations.push(location);
                }
            }

            // Find mixin calls
            const mixinCallPattern = new RegExp(`^\\s*\\+${this.escapeRegExp(mixinName)}\\b`);
            if (mixinCallPattern.test(line)) {
                const startIndex = line.indexOf(mixinName);
                const location = new vscode.Location(
                    document.uri,
                    new vscode.Range(i, startIndex, i, startIndex + mixinName.length)
                );
                locations.push(location);
            }
        }

        return locations;
    }

    private async findFileReferences(
        currentDocument: vscode.TextDocument, 
        fileName: string
    ): Promise<vscode.Location[]> {
        
        const locations: vscode.Location[] = [];
        
        // Find all Pug files in workspace
        const pugFiles = await vscode.workspace.findFiles('**/*.pug', '**/node_modules/**');
        
        for (const fileUri of pugFiles) {
            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                const fileLocations = this.findFileReferencesInDocument(document, fileName);
                locations.push(...fileLocations);
            } catch (error) {
                // Skip files that can't be opened
                continue;
            }
        }

        return locations;
    }

    private findFileReferencesInDocument(
        document: vscode.TextDocument, 
        fileName: string
    ): vscode.Location[] {
        
        const locations: vscode.Location[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Find include/extends statements that reference this file
            const includePattern = new RegExp(`^\\s*(?:include|extends)\\s+.*${this.escapeRegExp(fileName)}`);
            if (includePattern.test(line)) {
                const startIndex = line.indexOf(fileName);
                if (startIndex !== -1) {
                    const location = new vscode.Location(
                        document.uri,
                        new vscode.Range(i, startIndex, i, startIndex + fileName.length)
                    );
                    locations.push(location);
                }
            }
        }

        return locations;
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
} 