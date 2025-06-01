import * as vscode from 'vscode';
import * as path from 'path';
import { getAllReferencedFiles } from './pathUtils';

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
        // \w+ を [\w-]+ に変更してハイフンも含めるようにする
        const mixinCallPattern = /^\s*\+([\w-]+)\s*\(/;
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

        // 循環参照防止
        if (searchedFiles.has(document.uri.fsPath)) {

            return null;
        }
        searchedFiles.add(document.uri.fsPath);

        // まず現在のファイル内を探索
        const localDefinition = this.findMixinInDocument(document, mixinName);
        if (localDefinition) {

            return localDefinition;
        }

        // 共通のgetAllReferencedFilesを使用してincludeとextends先を再帰的に探索

        const referencedFiles = await getAllReferencedFiles(document);

        
        // 参照ファイルが無い場合はログを出力して終了
        if (referencedFiles.length === 0) {

            return null;
        }
        
        for (const fileUri of referencedFiles) {
            try {

                const includedDocument = await vscode.workspace.openTextDocument(fileUri);
                const definition = await this.findMixinDefinitionRecursive(includedDocument, mixinName, searchedFiles);
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

        const documentText = document.getText();
        const lines = documentText.split(/\r?\n/);
        
        // Escape special regex characters in mixinName
        const escapedMixinName = this.escapeRegExp(mixinName);
        const mixinDefPattern = `^\\s*mixin\\s+${escapedMixinName}(?:\\s*\\(([^\\)]*)\\)|\\s|$)`;
        const mixinDefRegex = new RegExp(mixinDefPattern);

        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(mixinDefRegex);
            
            if (match) {

                const parametersString = match[1] || '';
                const parameters = parametersString
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p.length > 0);
                
                // Look for documentation comments above the mixin
                const commentsAbove: string[] = [];
                for (let j = i - 1; j >= 0; j--) {
                    const prevLine = lines[j].trim();
                    if (prevLine.startsWith('//')) {
                        commentsAbove.push(prevLine.substring(2).trim());
                    } else if (prevLine === '') {
                        continue;
                    } else {
                        break;
                    }
                }
                const documentation = commentsAbove.join('\n');
                

                return {
                    parameters,
                    documentation: documentation
                };
            }
        }
        

        return null;
    }
    

    // getIncludedFilesメソッドを削除し、共通の実装を使用


    
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
} 