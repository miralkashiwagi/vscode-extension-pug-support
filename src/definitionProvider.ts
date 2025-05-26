import * as vscode from 'vscode';
import * as path from 'path';
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
                    continue;
                }
            }

            if (finalUri) {
                const includedFileUri = finalUri;
                if (searchedFiles.has(includedFileUri.fsPath)) {
                    continue;
                }
                searchedFiles.add(includedFileUri.fsPath);

                promises.push(
                    (async () => {
                        try {
                            const includedDoc = await vscode.workspace.openTextDocument(includedFileUri);
                            const includedText = includedDoc.getText();
                            const includedDocumentLines = includedText.split(/\r?\n/);
                            
                            // Allow leading whitespace for mixin definitions
                            const mixinDefinitionRegex = new RegExp('^\\s*mixin\\s+' + mixinName + '(?:\\s|\\(|$)');
                            for (let i = 0; i < includedDocumentLines.length; i++) {
                                const currentLineText = includedDocumentLines[i];
                                if (mixinDefinitionRegex.test(currentLineText)) {
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

        // More flexible include regex that allows for indentation, comments, and quoted paths
        const includeRegex = /(?:^|\s)include\s+(['"]?)([^'"\s]+)\1/;
        const includeMatch = lineText.match(includeRegex);
        if (includeMatch) {
            const includedPath = includeMatch[2]; // Now the path is in the second capture group
            const pathStartIndex = lineText.indexOf(includedPath);
            const pathEndIndex = pathStartIndex + includedPath.length;
            
            // More lenient cursor position check - anywhere on the include line
            const includeKeywordIndex = lineText.indexOf('include');
            if (includeKeywordIndex !== -1 && 
                position.character >= includeKeywordIndex && 
                position.character <= lineText.length) {
                
                const currentDir = path.dirname(document.uri.fsPath);
                
                // Use VSCode API consistently for file system operations
                let finalUri: vscode.Uri | undefined;
                
                // Handle absolute paths (starting with /) as relative to workspace root
                const pathsToTry: string[] = [];
                
                if (includedPath.startsWith('/')) {
                    // Absolute path - resolve from workspace root
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const pathWithoutLeadingSlash = includedPath.substring(1);
                        pathsToTry.push(
                            path.resolve(workspaceRoot, pathWithoutLeadingSlash),
                            path.resolve(workspaceRoot, pathWithoutLeadingSlash + '.pug'),
                            // Also try with 'app' prefix for common Pug project structures
                            path.resolve(workspaceRoot, 'app', pathWithoutLeadingSlash),
                            path.resolve(workspaceRoot, 'app', pathWithoutLeadingSlash + '.pug')
                        );
                    }
                } else {
                    // Relative path - resolve from current directory
                    const resolvedPath = path.resolve(currentDir, includedPath);
                    pathsToTry.push(
                        resolvedPath,
                        resolvedPath + '.pug',
                        path.resolve(currentDir, includedPath + '.pug'),
                        // Try relative to workspace root if available
                        ...(vscode.workspace.workspaceFolders ? [
                            path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, includedPath),
                            path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, includedPath + '.pug')
                        ] : [])
                    );
                }
                
                for (const pathToTry of pathsToTry) {
                    try {
                        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(pathToTry));
                        if (stat.type === vscode.FileType.File) {
                            finalUri = vscode.Uri.file(pathToTry);
                            break;
                        }
                    } catch {
                        // Continue to next path
                    }
                }
                
                if (finalUri) {
                    return new vscode.Location(finalUri, new vscode.Position(0, 0));
                }
            }
        }

        // More flexible extends regex that allows for indentation, comments, and quoted paths
        const extendsRegex = /(?:^|\s)extends\s+(['"]?)([^'"\s]+)\1/;
        const extendsMatch = lineText.match(extendsRegex);
        if (extendsMatch) {
            const extendedPath = extendsMatch[2]; // Now the path is in the second capture group
            const pathStartIndex = lineText.indexOf(extendedPath);
            const pathEndIndex = pathStartIndex + extendedPath.length;
            
            // More lenient cursor position check - anywhere on the extends line
            const extendsKeywordIndex = lineText.indexOf('extends');
            if (extendsKeywordIndex !== -1 && 
                position.character >= extendsKeywordIndex && 
                position.character <= lineText.length) {
                
                const currentDir = path.dirname(document.uri.fsPath);
                
                // Use VSCode API consistently for file system operations
                let finalUri: vscode.Uri | undefined;
                
                // Handle absolute paths (starting with /) as relative to workspace root
                const pathsToTry: string[] = [];
                
                if (extendedPath.startsWith('/')) {
                    // Absolute path - resolve from workspace root
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const pathWithoutLeadingSlash = extendedPath.substring(1);
                        pathsToTry.push(
                            path.resolve(workspaceRoot, pathWithoutLeadingSlash),
                            path.resolve(workspaceRoot, pathWithoutLeadingSlash + '.pug'),
                            // Also try with 'app' prefix for common Pug project structures
                            path.resolve(workspaceRoot, 'app', pathWithoutLeadingSlash),
                            path.resolve(workspaceRoot, 'app', pathWithoutLeadingSlash + '.pug')
                        );
                    }
                } else {
                    // Relative path - resolve from current directory
                    const resolvedPath = path.resolve(currentDir, extendedPath);
                    pathsToTry.push(
                        resolvedPath,
                        resolvedPath + '.pug',
                        path.resolve(currentDir, extendedPath + '.pug'),
                        // Try relative to workspace root if available
                        ...(vscode.workspace.workspaceFolders ? [
                            path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, extendedPath),
                            path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, extendedPath + '.pug')
                        ] : [])
                    );
                }
                
                for (const pathToTry of pathsToTry) {
                    try {
                        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(pathToTry));
                        if (stat.type === vscode.FileType.File) {
                            finalUri = vscode.Uri.file(pathToTry);
                            break;
                        }
                    } catch {
                        // Continue to next path
                    }
                }
                
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
