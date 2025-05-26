import * as vscode from 'vscode';

export class PugRenameProvider implements vscode.RenameProvider {
    
    public async provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string,
        token: vscode.CancellationToken
    ): Promise<vscode.WorkspaceEdit | undefined> {
        
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        const line = document.lineAt(position);
        
        // Check if we're renaming a mixin
        if (this.isMixinDefinition(line.text, position.character) || 
            this.isMixinCall(line.text, position.character)) {
            
            return await this.renameMixin(document, word, newName);
        }

        // Check if we're renaming a file path in include/extends
        if (this.isIncludeOrExtends(line.text, position.character)) {
            return await this.renameFilePath(document, wordRange, newName);
        }

        return undefined;
    }

    public prepareRename(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.ProviderResult<vscode.Range | { range: vscode.Range; placeholder: string }> {
        
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            throw new Error('No symbol found at this position');
        }

        const word = document.getText(wordRange);
        const line = document.lineAt(position);
        
        if (this.isMixinDefinition(line.text, position.character) || 
            this.isMixinCall(line.text, position.character)) {
            
            return {
                range: wordRange,
                placeholder: word
            };
        }

        if (this.isIncludeOrExtends(line.text, position.character)) {
            return {
                range: wordRange,
                placeholder: word
            };
        }

        throw new Error('Cannot rename this symbol');
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

    private async renameMixin(
        document: vscode.TextDocument,
        oldName: string,
        newName: string
    ): Promise<vscode.WorkspaceEdit> {
        
        const workspaceEdit = new vscode.WorkspaceEdit();
        
        // Find all Pug files in the workspace
        const pugFiles = await vscode.workspace.findFiles('**/*.pug', '**/node_modules/**');
        
        for (const fileUri of pugFiles) {
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const edits = this.findMixinReferences(doc, oldName, newName);
            
            if (edits.length > 0) {
                workspaceEdit.set(fileUri, edits);
            }
        }

        return workspaceEdit;
    }

    private findMixinReferences(
        document: vscode.TextDocument,
        oldName: string,
        newName: string
    ): vscode.TextEdit[] {
        
        const edits: vscode.TextEdit[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Find mixin definitions
            const mixinDefPattern = new RegExp(`^(\\s*mixin\\s+)${this.escapeRegExp(oldName)}(\\b)`, 'g');
            let match = mixinDefPattern.exec(line);
            if (match) {
                const startPos = new vscode.Position(i, match[1].length);
                const endPos = new vscode.Position(i, match[1].length + oldName.length);
                edits.push(vscode.TextEdit.replace(new vscode.Range(startPos, endPos), newName));
            }

            // Find mixin calls
            const mixinCallPattern = new RegExp(`^(\\s*\\+)${this.escapeRegExp(oldName)}(\\b)`, 'g');
            match = mixinCallPattern.exec(line);
            if (match) {
                const startPos = new vscode.Position(i, match[1].length);
                const endPos = new vscode.Position(i, match[1].length + oldName.length);
                edits.push(vscode.TextEdit.replace(new vscode.Range(startPos, endPos), newName));
            }
        }

        return edits;
    }

    private async renameFilePath(
        document: vscode.TextDocument,
        range: vscode.Range,
        newPath: string
    ): Promise<vscode.WorkspaceEdit> {
        
        const workspaceEdit = new vscode.WorkspaceEdit();
        const currentPath = document.getText(range);
        
        // Update the current file
        workspaceEdit.replace(document.uri, range, newPath);
        
        // Find all files that might reference this file
        const pugFiles = await vscode.workspace.findFiles('**/*.pug', '**/node_modules/**');
        
        for (const fileUri of pugFiles) {
            if (fileUri.toString() === document.uri.toString()) {
                continue; // Skip the current file as it's already handled
            }
            
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const edits = this.findFilePathReferences(doc, currentPath, newPath);
            
            if (edits.length > 0) {
                workspaceEdit.set(fileUri, edits);
            }
        }

        return workspaceEdit;
    }

    private findFilePathReferences(
        document: vscode.TextDocument,
        oldPath: string,
        newPath: string
    ): vscode.TextEdit[] {
        
        const edits: vscode.TextEdit[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Find include/extends statements
            const includePattern = new RegExp(`^(\\s*(?:include|extends)\\s+)${this.escapeRegExp(oldPath)}(\\s*$)`, 'g');
            const match = includePattern.exec(line);
            if (match) {
                const startPos = new vscode.Position(i, match[1].length);
                const endPos = new vscode.Position(i, match[1].length + oldPath.length);
                edits.push(vscode.TextEdit.replace(new vscode.Range(startPos, endPos), newPath));
            }
        }

        return edits;
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
} 