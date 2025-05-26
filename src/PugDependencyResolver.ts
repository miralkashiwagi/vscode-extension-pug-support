import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs'; // Or use vscode.workspace.fs for async operations

/**
 * Resolves and returns the set of absolute file paths that the given Pug document directly depends on
 * through `include` and `extends` statements.
 * @param document The Pug document to analyze.
 * @returns A Promise that resolves to a Set of absolute paths to dependent files.
 */
export async function getDirectDependencies(document: vscode.TextDocument): Promise<Set<string>> {
    const dependencies = new Set<string>();
    const documentText = document.getText();
    const documentDir = path.dirname(document.uri.fsPath);

    // Regex for include: include path/to/file.pug or include path/to/file
    // Regex for extends: extends path/to/template.pug or extends path/to/template
    const directiveRegex = /^\s*(?:include|extends)\s+([^\s]+)/gm;
    let match;

    while ((match = directiveRegex.exec(documentText)) !== null) {
        const relativePath = match[1];
        let resolvedPath = path.resolve(documentDir, relativePath);

        // Try to resolve path with .pug, or no extension
        const potentialPaths = [
            resolvedPath,
            resolvedPath + '.pug'
        ];

        let foundPath: string | undefined;
        for (const p of potentialPaths) {
            try {
                // Using vscode.workspace.fs for async and workspace-aware file operations
                const stat = await vscode.workspace.fs.stat(vscode.Uri.file(p));
                if (stat.type === vscode.FileType.File) {
                    foundPath = p;
                    break;
                }
            } catch (error) {
                // File doesn't exist or other error, try next potential path
            }
        }

        if (foundPath) {
            dependencies.add(foundPath);
        }
    }

    return dependencies;
}
