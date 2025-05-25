import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getMixinDefinitions, MixinDefinition } from './mixinIndexer';

export class PugDefinitionProvider implements vscode.DefinitionProvider {
    private async findMixinDefinitionInIncludedFiles(document: vscode.TextDocument, mixinName: string, searchedFiles: Set<string> = new Set()): Promise<vscode.Location[]> {
        const locations: vscode.Location[] = [];
        const currentDocText = document.getText();
        const includeRegex = /^\s*include\s+([^\s]+)/gm;
        let includeMatch;
        const dirPath = path.dirname(document.uri.fsPath);
        const promises: Promise<void>[] = [];

        while ((includeMatch = includeRegex.exec(currentDocText)) !== null) {
            const includePath = includeMatch[1];
            let absoluteIncludePath = path.resolve(dirPath, includePath);
            let finalUri: vscode.Uri | undefined;

            const checkAndSetPath = async (filePath: string) => {
                try {
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                    if (stat.type === vscode.FileType.File) {
                        finalUri = vscode.Uri.file(filePath);
                        return true;
                    }
                } catch { /* file doesn't exist */ }
                return false;
            };

            if (!(await checkAndSetPath(absoluteIncludePath))) {
                if (!(await checkAndSetPath(absoluteIncludePath + '.pug'))) {
                    if (!(await checkAndSetPath(absoluteIncludePath + '.jade'))) {
                        continue;
                    }
                }
            }

            if (finalUri) {
                const includedFileUri = finalUri;
                if (searchedFiles.has(includedFileUri.fsPath)) {
                    console.log(`[PugDefinitionProvider] Already searched ${includedFileUri.fsPath}, skipping.`);
                    continue;
                }
                searchedFiles.add(includedFileUri.fsPath);

                promises.push(
                    (async () => {
                        try {
                            console.log(`[PugDefinitionProvider] Searching for mixin '${mixinName}' in included file: ${includedFileUri.fsPath}`);
                            const includedDoc = await vscode.workspace.openTextDocument(includedFileUri);
                            const includedText = includedDoc.getText();
                            const includedDocumentLines = includedText.split(/\r?\n/);
                            
                            // Allow leading whitespace for mixin definitions
                            const mixinDefinitionRegex = new RegExp('^\\s*mixin\\s+' + mixinName + '(?:\\s|\\(|$)');
                            // console.log(`[PugDefinitionProvider] Regex for ${mixinName}: ${mixinDefinitionRegex}`); // Logged by caller or can be re-enabled if needed
                            for (let i = 0; i < includedDocumentLines.length; i++) {
                                const currentLineText = includedDocumentLines[i];
                                // console.log(`[PugDefinitionProvider] Checking line ${i} in ${includedFileUri.fsPath}: "${currentLineText}"`); // Can be noisy, re-enable if needed
                                if (mixinDefinitionRegex.test(currentLineText)) {
                                    console.log(`[PugDefinitionProvider] Found mixin '${mixinName}' at line ${i} in ${includedFileUri.fsPath}`);
                                    locations.push(new vscode.Location(includedFileUri, new vscode.Position(i, 0)));
                                }
                            }

                            // Recursively search in further included files
                            const nestedLocations = await this.findMixinDefinitionInIncludedFiles(includedDoc, mixinName, searchedFiles);
                            locations.push(...nestedLocations);

                        } catch (e: any) {
                            console.error(`[PugDefinitionProvider] Error reading or parsing included file ${includedFileUri.fsPath}:`, e);
                        }
                    })()
                );
            }
        }

        await Promise.all(promises);
        return locations;
    }

    public async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
        const line = document.lineAt(position.line);
        const lineText = line.text;

        const includeRegex = /^\s*include\s+([^\s]+)/;
        const includeMatch = lineText.match(includeRegex);
        if (includeMatch) {
            const includedPath = includeMatch[1];
            const pathStartIndex = lineText.indexOf(includedPath);
            const pathEndIndex = pathStartIndex + includedPath.length;
            if (position.character >= pathStartIndex && position.character <= pathEndIndex) {
                const currentDir = path.dirname(document.uri.fsPath);
                let resolvedPath = path.resolve(currentDir, includedPath);
                if (!fs.existsSync(resolvedPath) && !path.extname(resolvedPath)) {
                    const pathWithPugExt = resolvedPath + '.pug';
                    if (fs.existsSync(pathWithPugExt)) {
                        resolvedPath = pathWithPugExt;
                    }
                } else if (!fs.existsSync(resolvedPath) && !path.extname(resolvedPath)) {
                    const pathWithJadeExt = resolvedPath + '.jade';
                    if (fs.existsSync(pathWithJadeExt)) {
                        resolvedPath = pathWithJadeExt;
                    }
                }
                try {
                    const stat = await fs.promises.stat(resolvedPath);
                    if (stat.isFile()) {
                        return new vscode.Location(vscode.Uri.file(resolvedPath), new vscode.Position(0, 0));
                    }
                } catch (error) {
                    console.log(`[PugDefinitionProvider] File not found for include: ${resolvedPath}`, error);
                    return null;
                }
            }
        }

        const extendsRegex = /^\s*extends\s+([^\s]+)/;
        const extendsMatch = lineText.match(extendsRegex);
        if (extendsMatch) {
            const extendedPath = extendsMatch[1];
            const pathStartIndex = lineText.indexOf(extendedPath);
            const pathEndIndex = pathStartIndex + extendedPath.length;
            if (position.character >= pathStartIndex && position.character <= pathEndIndex) {
                const currentDir = path.dirname(document.uri.fsPath);
                let resolvedPath = path.resolve(currentDir, extendedPath);
                if (!fs.existsSync(resolvedPath) && !path.extname(resolvedPath)) {
                    const pathWithPugExt = resolvedPath + '.pug';
                    if (fs.existsSync(pathWithPugExt)) {
                        resolvedPath = pathWithPugExt;
                    }
                } else if (!fs.existsSync(resolvedPath) && !path.extname(resolvedPath)) {
                    const pathWithJadeExt = resolvedPath + '.jade';
                    if (fs.existsSync(pathWithJadeExt)) {
                        resolvedPath = pathWithJadeExt;
                    }
                }
                try {
                    const stat = await fs.promises.stat(resolvedPath);
                    if (stat.isFile()) {
                        return new vscode.Location(vscode.Uri.file(resolvedPath), new vscode.Position(0, 0));
                    }
                } catch (error) {
                    console.log(`[PugDefinitionProvider] File not found for extends: ${resolvedPath}`, error);
                    return null;
                }
            }
        }

        const mixinCallRegex = /^\s*\+\s*([A-Za-z0-9_-]+)(?:\s*\(.*\))?/;
        const mixinCallMatch = lineText.match(mixinCallRegex);
        if (mixinCallMatch) {
            const mixinName = mixinCallMatch[1];
            console.log(`[PugDefinitionProvider] Mixin call found: '${mixinName}' at ${document.uri.fsPath}:${position.line}`);
            const callNameStartIndex = lineText.indexOf(mixinName, lineText.indexOf('+') + 1);
            const callNameEndIndex = callNameStartIndex + mixinName.length;

            if (position.character >= callNameStartIndex && position.character <= callNameEndIndex) {
                // ★ 1. Try to find in the index first
                const indexedDefinitions = getMixinDefinitions(mixinName);
                if (indexedDefinitions && indexedDefinitions.length > 0) {
                    console.log(`[PugDefinitionProvider] Found mixin '${mixinName}' in index:`, indexedDefinitions.map(d => d.uri.fsPath));
                    return indexedDefinitions.map(def => new vscode.Location(def.uri, def.range));
                }
                console.log(`[PugDefinitionProvider] Mixin '${mixinName}' not found in index. Searching current file...`);

                // ★ 2. Fallback to current file search
                for (let i = 0; i < document.lineCount; i++) {
                    const potentialDefinitionLine = document.lineAt(i).text;
                    const mixinDefinitionRegex = new RegExp(`^\s*mixin\s+${mixinName}(?:\s*\(.*\))?`);
                    if (potentialDefinitionLine.match(mixinDefinitionRegex)) {
                        // For current file, create a range for the mixin name itself
                        const defNameStartIndex = potentialDefinitionLine.indexOf(mixinName, potentialDefinitionLine.indexOf('mixin') + 5);
                        const defNameEndIndex = defNameStartIndex + mixinName.length;
                        const range = new vscode.Range(i, defNameStartIndex, i, defNameEndIndex);
                        console.log(`[PugDefinitionProvider] Found mixin '${mixinName}' in current file.`);
                        return new vscode.Location(document.uri, range);
                    }
                }
                console.log(`[PugDefinitionProvider] Mixin '${mixinName}' not found in current file. Searching included files...`);

                // ★ 3. Fallback to included files search (existing logic)
                const searchedFiles = new Set<string>();
                searchedFiles.add(document.uri.fsPath); // Add current document to avoid re-searching it if included by itself (though unlikely for mixin search)
                const includedDefinitions = await this.findMixinDefinitionInIncludedFiles(document, mixinName, searchedFiles);
                if (includedDefinitions.length > 0) {
                    console.log(`[PugDefinitionProvider] Found mixin '${mixinName}' in included files:`, includedDefinitions.map(loc => loc.uri.fsPath));
                    return includedDefinitions; // These are already vscode.Location[]
                }
                console.log(`[PugDefinitionProvider] Mixin '${mixinName}' not found in included files.`);
            }
        }

        const mixinDefinitionRegex = /^\s*mixin\s+([A-Za-z0-9_-]+)(?:\s*\(.*\))?/;
        const mixinDefinitionMatch = lineText.match(mixinDefinitionRegex);
        if (mixinDefinitionMatch) {
            const mixinName = mixinDefinitionMatch[1];
            const defNameStartIndex = lineText.indexOf(mixinName, lineText.indexOf('mixin') + 5);
            const defNameEndIndex = defNameStartIndex + mixinName.length;
            if (position.character >= defNameStartIndex && position.character <= defNameEndIndex) {
                 // For mixin definition itself, return its location
                const range = new vscode.Range(position.line, defNameStartIndex, position.line, defNameEndIndex);
                return new vscode.Location(document.uri, range);
            }
        }

        const wordRange = document.getWordRangeAtPosition(position);
        const word = wordRange ? document.getText(wordRange) : '';
        // console.log(`${document.languageId.toUpperCase()} definition provider called for '${word}' (no specific handler found) at ${document.uri.fsPath}:${position.line}:${position.character}`);
        return null;
    }
}
