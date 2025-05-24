import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class PugDefinitionProvider implements vscode.DefinitionProvider {
    private async findMixinDefinitionInIncludedFiles(document: vscode.TextDocument, mixinName: string): Promise<vscode.Location[]> {
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
                promises.push(
                    (async () => {
                        try {
                            const includedDoc = await vscode.workspace.openTextDocument(includedFileUri);
                            const includedDocumentLines = includedDoc.getText().split(/\r?\n/);
                            const mixinDefinitionRegex = new RegExp(`^mixin\\s+${mixinName}(?:\\s|\\(|$)`);
                            for (let i = 0; i < includedDocumentLines.length; i++) {
                                if (mixinDefinitionRegex.test(includedDocumentLines[i])) {
                                    locations.push(new vscode.Location(includedFileUri, new vscode.Position(i, 0)));
                                }
                            }
                        } catch (e: any) {
                            console.error(`Error reading or parsing included file ${includedFileUri.fsPath}:`, e);
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
                    console.log(`File not found for include: ${resolvedPath}`, error);
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
                    console.log(`File not found for extends: ${resolvedPath}`, error);
                    return null;
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
                for (let i = 0; i < document.lineCount; i++) {
                    const potentialDefinitionLine = document.lineAt(i).text;
                    const mixinDefinitionRegex = new RegExp(`^\s*mixin\s+${mixinName}(?:\s*\(.*\))?`);
                    if (potentialDefinitionLine.match(mixinDefinitionRegex)) {
                        return new vscode.Location(document.uri, new vscode.Position(i, 0));
                    }
                }
                const includedDefinitions = await this.findMixinDefinitionInIncludedFiles(document, mixinName);
                if (includedDefinitions.length > 0) {
                    return includedDefinitions;
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
                return new vscode.Location(document.uri, new vscode.Position(position.line, 0));
            }
        }

        const wordRange = document.getWordRangeAtPosition(position);
        const word = wordRange ? document.getText(wordRange) : '';
        console.log(`${document.languageId.toUpperCase()} definition provider called for '${word}' (no specific handler found) at ${document.uri.fsPath}:${position.line}:${position.character}`);
        return null;
    }
}
