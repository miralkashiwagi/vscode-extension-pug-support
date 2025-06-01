import * as vscode from 'vscode';
import * as path from 'path';
import { getMixinDefinitions, MixinDefinition } from './mixinIndexer';
import { resolvePugPath, getAllReferencedFiles } from './pathUtils';

export class PugDefinitionProvider implements vscode.DefinitionProvider {
    private async findMixinDefinitionInIncludedFiles(document: vscode.TextDocument, mixinName: string, searchedFiles: Set<string> = new Set()): Promise<vscode.Location[]> {
        const locations: vscode.Location[] = [];
        searchedFiles.add(document.uri.fsPath);
        // IncludeとExtendsファイル内で定義されたミックスインを探索
        // 共通のgetAllReferencedFilesを使用してincludeとextendsファイルを取得
        const referencedFiles = await getAllReferencedFiles(document);
        const promises: Promise<void>[] = [];

        for (const fileUri of referencedFiles) {
            if (searchedFiles.has(fileUri.fsPath)) {
                continue;
            }
            
            promises.push(
                (async () => {
                    try {
                        const includedDoc = await vscode.workspace.openTextDocument(fileUri);
                        const includedText = includedDoc.getText();
                        const includedDocumentLines = includedText.split(/\r?\n/);
                        
                        // Allow leading whitespace for mixin definitions
                        const mixinDefinitionRegex = new RegExp('^\\s*mixin\\s+' + mixinName + '(?:\\s|\\(|$)');
                        for (let i = 0; i < includedDocumentLines.length; i++) {
                            const currentLineText = includedDocumentLines[i];
                            if (mixinDefinitionRegex.test(currentLineText)) {
                                locations.push(new vscode.Location(fileUri, new vscode.Position(i, 0)));
                            }
                        }

                        // Recursively search in further included files
                        const nestedLocations = await this.findMixinDefinitionInIncludedFiles(includedDoc, mixinName, searchedFiles);
                        locations.push(...nestedLocations);

                    } catch (e: any) {
                        console.error(`[PugDefinitionProvider] Error reading or parsing included file ${fileUri.fsPath}:`, e);
                    }
                })()
            );
        }

        await Promise.all(promises);
        return locations;
    }

    public async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
        const line = document.lineAt(position.line);
        const lineText = line.text;

        // More flexible include regex that allows for indentation, comments, and quoted paths
        const includeRegex = /(?:^|\s)include\s+(['"]?)([^'"]+)\1|(?:^|\s)include\s+([^\s]+)/;
        const includeMatch = lineText.match(includeRegex);
        if (includeMatch) {
            const includedPath = includeMatch[2] || includeMatch[3]; // Path is in group 2 (quoted) or group 3 (unquoted)
            const pathStartIndex = lineText.indexOf(includedPath);
            const pathEndIndex = pathStartIndex + includedPath.length;
            
            // More lenient cursor position check - anywhere on the include line
            const includeKeywordIndex = lineText.indexOf('include');
            if (includeKeywordIndex !== -1 && 
                position.character >= includeKeywordIndex && 
                position.character <= lineText.length) {
                
                // 共通のresolvePugPath関数を使用
                const finalUri = await resolvePugPath(includedPath, document.uri.fsPath);
                
                if (finalUri) {
                    return new vscode.Location(finalUri, new vscode.Position(0, 0));
                }
            }
        }

        // More flexible extends regex that allows for indentation, comments, and quoted paths
        const extendsRegex = /(?:^|\s)extends\s+(['"]?)([^'"]+)\1|(?:^|\s)extends\s+([^\s]+)/;
        const extendsMatch = lineText.match(extendsRegex);
        if (extendsMatch) {
            const extendedPath = extendsMatch[2] || extendsMatch[3]; // Path is in group 2 (quoted) or group 3 (unquoted)
            const pathStartIndex = lineText.indexOf(extendedPath);
            const pathEndIndex = pathStartIndex + extendedPath.length;
            
            // More lenient cursor position check - anywhere on the extends line
            const extendsKeywordIndex = lineText.indexOf('extends');
            if (extendsKeywordIndex !== -1 && 
                position.character >= extendsKeywordIndex && 
                position.character <= lineText.length) {
                
                // 共通のresolvePugPath関数を使用
                const finalUri = await resolvePugPath(extendedPath, document.uri.fsPath);
                
                if (finalUri) {
                    return new vscode.Location(finalUri, new vscode.Position(0, 0));
                }
            }
        }

        const mixinCallRegex = /^\s*\+\s*([A-Za-z0-9_-]+)(?:\s*\(.*\))?/;
        const mixinCallMatch = lineText.match(mixinCallRegex);
        if (mixinCallMatch) {
            const mixinName = mixinCallMatch[1];
            const callNameStartIndex = lineText.indexOf(mixinName, lineText.indexOf('+') + 1);
            const callNameEndIndex = callNameStartIndex + mixinName.length;

            if (position.character >= callNameStartIndex && position.character <= callNameEndIndex) {
                // ★ 1. Try to find in the index first
                const indexedDefinitions = getMixinDefinitions(mixinName);
                if (indexedDefinitions && indexedDefinitions.length > 0) {
                    return indexedDefinitions.map(def => new vscode.Location(def.uri, def.range));
                }

                // ★ 2. Fallback to current file search
                for (let i = 0; i < document.lineCount; i++) {
                    const potentialDefinitionLine = document.lineAt(i).text;
                    const mixinDefinitionRegex = new RegExp(`^\s*mixin\s+${mixinName}(?:\s*\(.*\))?`);
                    if (potentialDefinitionLine.match(mixinDefinitionRegex)) {
                        // For current file, create a range for the mixin name itself
                        const defNameStartIndex = potentialDefinitionLine.indexOf(mixinName, potentialDefinitionLine.indexOf('mixin') + 5);
                        const defNameEndIndex = defNameStartIndex + mixinName.length;
                        const range = new vscode.Range(i, defNameStartIndex, i, defNameEndIndex);
                        return new vscode.Location(document.uri, range);
                    }
                }

                // ★ 3. Fallback to included files search (existing logic)
                const searchedFiles = new Set<string>();
                searchedFiles.add(document.uri.fsPath); // Add current document to avoid re-searching it if included by itself (though unlikely for mixin search)
                const includedDefinitions = await this.findMixinDefinitionInIncludedFiles(document, mixinName, searchedFiles);
                if (includedDefinitions.length > 0) {
                    return includedDefinitions; // These are already vscode.Location[]
                }
            }
        }

        const mixinDefinitionRegex = /^\s*mixin\s+([A-Za-z0-9_-]+)(?:\s*\(.*\))?/;
        const mixinDefinitionMatch = lineText.match(mixinDefinitionRegex);
        if (mixinDefinitionMatch) {
            const mixinName = mixinDefinitionMatch[1];
            const defNameStartIndex = lineText.indexOf(mixinName, lineText.indexOf('mixin') + 5);
            const defNameEndIndex = defNameStartIndex + mixinName.length;
            if (position.character >= defNameStartIndex && position.character <= defNameEndIndex) {
                const range = new vscode.Range(position.line, defNameStartIndex, position.line, defNameEndIndex);
                return new vscode.Location(document.uri, range);
            }
        }

        const wordRange = document.getWordRangeAtPosition(position);
        const word = wordRange ? document.getText(wordRange) : '';
        return null;
    }
}
