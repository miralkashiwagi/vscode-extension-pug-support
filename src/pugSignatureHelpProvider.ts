import * as vscode from 'vscode';

export class PugSignatureHelpProvider implements vscode.SignatureHelpProvider {
    
    public async provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.SignatureHelpContext
    ): Promise<vscode.SignatureHelp | undefined> {
        
        const lineText = document.lineAt(position).text;
        const currentChar = position.character;
        
        // Check if we're in a mixin call
        const mixinCallMatch = this.getMixinCallAtPosition(lineText, currentChar);
        if (!mixinCallMatch) {
            return undefined;
        }
        
        const mixinName = mixinCallMatch.name;
        const parameterIndex = mixinCallMatch.parameterIndex;
        
        // Find mixin definition
        const mixinDefinition = await this.findMixinDefinition(document, mixinName);
        if (!mixinDefinition) {
            return undefined;
        }
        
        // Create signature help
        const signatureHelp = new vscode.SignatureHelp();
        const signature = new vscode.SignatureInformation(
            `${mixinName}(${mixinDefinition.parameters.join(', ')})`,
            new vscode.MarkdownString(mixinDefinition.documentation || `Mixin: **${mixinName}**`)
        );
        
        // Add parameter information
        for (let i = 0; i < mixinDefinition.parameters.length; i++) {
            const param = mixinDefinition.parameters[i];
            signature.parameters.push(new vscode.ParameterInformation(
                param,
                new vscode.MarkdownString(`Parameter: **${param}**`)
            ));
        }
        
        signatureHelp.signatures = [signature];
        signatureHelp.activeSignature = 0;
        signatureHelp.activeParameter = Math.min(parameterIndex, mixinDefinition.parameters.length - 1);
        
        return signatureHelp;
    }
    
    private getMixinCallAtPosition(lineText: string, position: number): {
        name: string;
        parameterIndex: number;
    } | null {
        
        // Look for mixin call pattern: +mixinName(
        const mixinCallPattern = /^\s*\+(\w+)\s*\(/;
        const match = lineText.match(mixinCallPattern);
        
        if (!match) {
            return null;
        }
        
        const mixinName = match[1];
        const openParenIndex = lineText.indexOf('(');
        
        // Check if cursor is after the opening parenthesis
        if (position <= openParenIndex) {
            return null;
        }
        
        // Calculate parameter index based on commas
        const textBeforeCursor = lineText.substring(openParenIndex + 1, position);
        const parameterIndex = this.countCommas(textBeforeCursor);
        
        return {
            name: mixinName,
            parameterIndex: parameterIndex
        };
    }
    
    private countCommas(text: string): number {
        let count = 0;
        let inString = false;
        let stringChar = '';
        let parenDepth = 0;
        
        for (const char of text) {
            if (!inString) {
                if (char === '"' || char === "'" || char === '`') {
                    inString = true;
                    stringChar = char;
                } else if (char === '(') {
                    parenDepth++;
                } else if (char === ')') {
                    parenDepth--;
                } else if (char === ',' && parenDepth === 0) {
                    count++;
                }
            } else {
                if (char === stringChar && text[text.indexOf(char) - 1] !== '\\') {
                    inString = false;
                }
            }
        }
        
        return count;
    }
    
    private async findMixinDefinition(
        document: vscode.TextDocument, 
        mixinName: string
    ): Promise<{
        parameters: string[];
        documentation?: string;
    } | null> {
        
        // First, search in the current document
        const localDefinition = this.findMixinInDocument(document, mixinName);
        if (localDefinition) {
            return localDefinition;
        }
        
        // Then search in included files
        const includedFiles = await this.getIncludedFiles(document);
        for (const fileUri of includedFiles) {
            try {
                const includedDocument = await vscode.workspace.openTextDocument(fileUri);
                const definition = this.findMixinInDocument(includedDocument, mixinName);
                if (definition) {
                    return definition;
                }
            } catch (error) {
                continue;
            }
        }
        
        return null;
    }
    
    private findMixinInDocument(
        document: vscode.TextDocument, 
        mixinName: string
    ): {
        parameters: string[];
        documentation?: string;
    } | null {
        
        const text = document.getText();
        const lines = text.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Match mixin definition
            const mixinDefPattern = new RegExp(`^mixin\\s+${this.escapeRegExp(mixinName)}\\s*(?:\\(([^)]*)\\))?`);
            const match = line.match(mixinDefPattern);
            
            if (match) {
                const parametersString = match[1] || '';
                const parameters = parametersString
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p.length > 0);
                
                // Look for documentation comments above the mixin
                let documentation = '';
                for (let j = i - 1; j >= 0; j--) {
                    const prevLine = lines[j].trim();
                    if (prevLine.startsWith('//')) {
                        documentation = prevLine.substring(2).trim() + '\n' + documentation;
                    } else if (prevLine === '') {
                        continue;
                    } else {
                        break;
                    }
                }
                
                return {
                    parameters,
                    documentation: documentation.trim() || undefined
                };
            }
        }
        
        return null;
    }
    
    private async getIncludedFiles(document: vscode.TextDocument): Promise<vscode.Uri[]> {
        const includedFiles: vscode.Uri[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        for (const line of lines) {
            const includeMatch = line.trim().match(/^include\s+(.+)$/);
            if (includeMatch) {
                const includePath = includeMatch[1].trim();
                const resolvedUri = this.resolveIncludePath(includePath, document);
                if (resolvedUri) {
                    includedFiles.push(resolvedUri);
                }
            }
        }
        
        return includedFiles;
    }
    
    private resolveIncludePath(includePath: string, document: vscode.TextDocument): vscode.Uri | null {
        try {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                return null;
            }
            
            const documentDir = document.uri.fsPath.substring(0, document.uri.fsPath.lastIndexOf('/'));
            let resolvedPath: string;
            
            if (includePath.startsWith('/')) {
                resolvedPath = workspaceFolder.uri.fsPath + includePath;
            } else {
                resolvedPath = documentDir + '/' + includePath;
            }
            
            // Add .pug extension if not present
            if (!resolvedPath.endsWith('.pug') && !resolvedPath.endsWith('.jade')) {
                resolvedPath += '.pug';
            }
            
            return vscode.Uri.file(resolvedPath);
        } catch (error) {
            return null;
        }
    }
    
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
} 