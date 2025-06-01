import * as vscode from 'vscode';
import * as path from 'path';

export class PugSignatureHelpProvider implements vscode.SignatureHelpProvider {


    public async provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.SignatureHelpContext
    ): Promise<vscode.SignatureHelp | undefined> {
        // デバッグ用ログ出力
        const lineText = document.lineAt(position).text;
        console.log('[PugSignatureHelpProvider] called', {
            lineText,
            position,
            triggerKind: context.triggerKind,
            triggerCharacter: context.triggerCharacter
        });
        
        const currentChar = position.character;
        
        // Check if we're in a mixin call
        const mixinCallMatch = this.getMixinCallAtPosition(lineText, currentChar);
        if (!mixinCallMatch) {
            return undefined;
        }
        
        const mixinName = mixinCallMatch.name;
        const parameterIndex = mixinCallMatch.parameterIndex;
        
        // Find mixin definition
        const mixinDefinition = await this.findMixinDefinitionRecursive(document, mixinName);
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
    
    private async findMixinDefinitionRecursive(
        document: vscode.TextDocument,
        mixinName: string,
        searchedFiles: Set<string> = new Set()
    ): Promise<{ parameters: string[]; documentation?: string } | null> {
        console.log('[PugSignatureHelpProvider] findMixinDefinitionRecursive: start', { file: document.uri.fsPath, mixinName });
        // 循環参照防止
        if (searchedFiles.has(document.uri.fsPath)) {
            console.log('[PugSignatureHelpProvider] findMixinDefinitionRecursive: already searched', document.uri.fsPath);
            return null;
        }
        searchedFiles.add(document.uri.fsPath);

        // まず現在のファイル内を探索
        const localDefinition = this.findMixinInDocument(document, mixinName);
        if (localDefinition) {
            console.log('[PugSignatureHelpProvider] findMixinDefinitionRecursive: found in', document.uri.fsPath);
            return localDefinition;
        }

        // include先を再帰的に探索
        const includedFiles = await this.getIncludedFiles(document);
        for (const fileUri of includedFiles) {
            try {
                console.log('[PugSignatureHelpProvider] findMixinDefinitionRecursive: searching include', fileUri.fsPath);
                const includedDocument = await vscode.workspace.openTextDocument(fileUri);
                const definition = await this.findMixinDefinitionRecursive(includedDocument, mixinName, searchedFiles);
                if (definition) {
                    console.log('[PugSignatureHelpProvider] findMixinDefinitionRecursive: found in include', fileUri.fsPath);
                    return definition;
                }
            } catch (error) {
                console.log('[PugSignatureHelpProvider] findMixinDefinitionRecursive: failed to open include', fileUri.fsPath, error);
                continue;
            }
        }
        console.log('[PugSignatureHelpProvider] findMixinDefinitionRecursive: not found in', document.uri.fsPath);
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
        const includeRegex = /^\s*include\s+([^\s]+)/gm;
        const dirPath = path.dirname(document.uri.fsPath);
        let match: RegExpExecArray | null;
        while ((match = includeRegex.exec(text)) !== null) {
            const includePath = match[1];
            // パス解決: 現在のファイルのディレクトリ基準
            let absoluteIncludePath = path.resolve(dirPath, includePath);
            let triedPaths = [absoluteIncludePath];
            if (!absoluteIncludePath.endsWith('.pug')) {
                triedPaths.push(absoluteIncludePath + '.pug');
            }
            for (const filePath of triedPaths) {
                try {
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                    if (stat.type === vscode.FileType.File) {
                        includedFiles.push(vscode.Uri.file(filePath));
                        break;
                    }
                } catch {
                    // ファイルがなければスキップ
                }
            }
        }
        return includedFiles;
    }


    
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
} 