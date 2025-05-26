import * as vscode from 'vscode';
import * as path from 'path';

export class PugFileWatcher {
    private fileWatcher: vscode.FileSystemWatcher;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        // Watch for file moves, renames, and deletions
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.pug');
        
        this.fileWatcher.onDidCreate(this.onFileCreated, this, this.disposables);
        this.fileWatcher.onDidDelete(this.onFileDeleted, this, this.disposables);
        
        // Listen for file renames through workspace events
        vscode.workspace.onDidRenameFiles(this.onFilesRenamed, this, this.disposables);
    }

    private async onFileCreated(uri: vscode.Uri): Promise<void> {
        // Handle new file creation if needed
    }

    private async onFileDeleted(uri: vscode.Uri): Promise<void> {
        // Find and warn about broken references
        await this.findBrokenReferences(uri);
    }

    private async onFilesRenamed(event: vscode.FileRenameEvent): Promise<void> {
        for (const file of event.files) {
            if (file.oldUri.fsPath.endsWith('.pug')) {
                await this.updateFileReferences(file.oldUri, file.newUri);
            }
        }
    }

    private async updateFileReferences(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(oldUri);
        if (!workspaceFolder) {return;}

        // Calculate relative paths
        const oldRelativePath = path.relative(workspaceFolder.uri.fsPath, oldUri.fsPath);
        const newRelativePath = path.relative(workspaceFolder.uri.fsPath, newUri.fsPath);

        // Remove file extensions for include/extends statements
        const oldPathWithoutExt = this.removeExtension(oldRelativePath);
        const newPathWithoutExt = this.removeExtension(newRelativePath);

        // Find all Pug files that might reference the moved file
        const pugFiles = await vscode.workspace.findFiles('**/*.pug', '**/node_modules/**');
        const workspaceEdit = new vscode.WorkspaceEdit();

        for (const fileUri of pugFiles) {
            if (fileUri.toString() === newUri.toString()) {
                continue; // Skip the renamed file itself
            }

            const document = await vscode.workspace.openTextDocument(fileUri);
            const edits = await this.findAndUpdateReferences(
                document, 
                oldPathWithoutExt, 
                newPathWithoutExt,
                fileUri,
                workspaceFolder.uri
            );

            if (edits.length > 0) {
                workspaceEdit.set(fileUri, edits);
            }
        }

        if (workspaceEdit.size > 0) {
            const applied = await vscode.workspace.applyEdit(workspaceEdit);
            if (applied) {
                vscode.window.showInformationMessage(
                    `Updated ${workspaceEdit.size} file(s) with new path references.`
                );
            }
        }
    }

    private async findAndUpdateReferences(
        document: vscode.TextDocument,
        oldPath: string,
        newPath: string,
        documentUri: vscode.Uri,
        workspaceUri: vscode.Uri
    ): Promise<vscode.TextEdit[]> {
        
        const edits: vscode.TextEdit[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for include statements
            const includeMatch = line.match(/^(\s*include\s+)(.+)$/);
            if (includeMatch) {
                const includePath = includeMatch[2].trim();
                const resolvedOldPath = this.resolveIncludePath(includePath, documentUri, workspaceUri);
                
                if (this.pathsMatch(resolvedOldPath, oldPath)) {
                    const newIncludePath = this.calculateRelativePath(documentUri, newPath, workspaceUri);
                    const startPos = new vscode.Position(i, includeMatch[1].length);
                    const endPos = new vscode.Position(i, line.length);
                    edits.push(vscode.TextEdit.replace(new vscode.Range(startPos, endPos), newIncludePath));
                }
            }

            // Check for extends statements
            const extendsMatch = line.match(/^(\s*extends\s+)(.+)$/);
            if (extendsMatch) {
                const extendsPath = extendsMatch[2].trim();
                const resolvedOldPath = this.resolveIncludePath(extendsPath, documentUri, workspaceUri);
                
                if (this.pathsMatch(resolvedOldPath, oldPath)) {
                    const newExtendsPath = this.calculateRelativePath(documentUri, newPath, workspaceUri);
                    const startPos = new vscode.Position(i, extendsMatch[1].length);
                    const endPos = new vscode.Position(i, line.length);
                    edits.push(vscode.TextEdit.replace(new vscode.Range(startPos, endPos), newExtendsPath));
                }
            }
        }

        return edits;
    }

    private resolveIncludePath(includePath: string, documentUri: vscode.Uri, workspaceUri: vscode.Uri): string {
        // Convert the include path to an absolute path, then to workspace-relative
        const documentDir = path.dirname(documentUri.fsPath);
        
        let absolutePath: string;
        if (path.isAbsolute(includePath)) {
            absolutePath = path.join(workspaceUri.fsPath, includePath);
        } else {
            absolutePath = path.resolve(documentDir, includePath);
        }
        
        return path.relative(workspaceUri.fsPath, absolutePath);
    }

    private calculateRelativePath(fromUri: vscode.Uri, toPath: string, workspaceUri: vscode.Uri): string {
        const fromDir = path.dirname(fromUri.fsPath);
        const toAbsolutePath = path.join(workspaceUri.fsPath, toPath);
        
        let relativePath = path.relative(fromDir, toAbsolutePath);
        
        // Ensure forward slashes for consistency
        relativePath = relativePath.replace(/\\/g, '/');
        
        // Add './' prefix if not already present and not going up directories
        if (!relativePath.startsWith('./') && !relativePath.startsWith('../')) {
            relativePath = './' + relativePath;
        }
        
        return relativePath;
    }

    private pathsMatch(path1: string, path2: string): boolean {
        // Normalize paths for comparison
        const normalized1 = path.normalize(path1).replace(/\\/g, '/');
        const normalized2 = path.normalize(path2).replace(/\\/g, '/');
        
        return normalized1 === normalized2;
    }

    private removeExtension(filePath: string): string {
        const ext = path.extname(filePath);
        return filePath.slice(0, -ext.length);
    }

    private async findBrokenReferences(deletedUri: vscode.Uri): Promise<void> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(deletedUri);
        if (!workspaceFolder) {return;}

        const deletedRelativePath = path.relative(workspaceFolder.uri.fsPath, deletedUri.fsPath);
        const deletedPathWithoutExt = this.removeExtension(deletedRelativePath);

        const pugFiles = await vscode.workspace.findFiles('**/*.pug', '**/node_modules/**');
        const brokenReferences: Array<{ file: vscode.Uri; line: number; text: string }> = [];

        for (const fileUri of pugFiles) {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const text = document.getText();
            const lines = text.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                const includeMatch = line.match(/^(\s*(?:include|extends)\s+)(.+)$/);
                if (includeMatch) {
                    const includePath = includeMatch[2].trim();
                    const resolvedPath = this.resolveIncludePath(includePath, fileUri, workspaceFolder.uri);
                    
                    if (this.pathsMatch(resolvedPath, deletedPathWithoutExt)) {
                        brokenReferences.push({
                            file: fileUri,
                            line: i + 1,
                            text: line.trim()
                        });
                    }
                }
            }
        }

        if (brokenReferences.length > 0) {
            const message = `Found ${brokenReferences.length} broken reference(s) to deleted file: ${deletedUri.fsPath}`;
            const action = await vscode.window.showWarningMessage(
                message,
                'Show References',
                'Dismiss'
            );

            if (action === 'Show References') {
                this.showBrokenReferences(brokenReferences);
            }
        }
    }

    private async showBrokenReferences(references: Array<{ file: vscode.Uri; line: number; text: string }>): Promise<void> {
        const outputChannel = vscode.window.createOutputChannel('Pug Broken References');
        outputChannel.clear();
        outputChannel.appendLine('Broken references found:');
        outputChannel.appendLine('');

        for (const ref of references) {
            const relativePath = vscode.workspace.asRelativePath(ref.file);
            outputChannel.appendLine(`${relativePath}:${ref.line} - ${ref.text}`);
        }

        outputChannel.show();
    }

    public dispose(): void {
        this.fileWatcher.dispose();
        this.disposables.forEach(d => d.dispose());
    }
} 