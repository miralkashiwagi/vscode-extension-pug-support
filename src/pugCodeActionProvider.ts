import * as vscode from 'vscode';

export class PugCodeActionProvider implements vscode.CodeActionProvider {
    
    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        
        const actions: vscode.CodeAction[] = [];
        const lineText = document.lineAt(range.start.line).text;
        
        // Quick fix for missing mixin
        if (this.hasMissingMixinError(context.diagnostics)) {
            actions.push(this.createMixinQuickFix(document, range, lineText));
        }
        
        // Quick fix for deprecated tags
        if (this.hasDeprecatedTagWarning(context.diagnostics)) {
            actions.push(this.createDeprecatedTagQuickFix(document, range, lineText));
        }
        
        // Quick fix for indentation issues
        if (this.hasIndentationError(context.diagnostics)) {
            actions.push(this.createIndentationQuickFix(document, range));
        }
        
        // Always available refactoring actions
        actions.push(...this.createRefactoringActions(document, range, lineText));
        
        return actions;
    }
    
    private hasMissingMixinError(diagnostics: readonly vscode.Diagnostic[]): boolean {
        return diagnostics.some(d => d.message.includes('Undefined mixin'));
    }
    
    private hasDeprecatedTagWarning(diagnostics: readonly vscode.Diagnostic[]): boolean {
        return diagnostics.some(d => d.message.includes('deprecated'));
    }
    
    private hasIndentationError(diagnostics: readonly vscode.Diagnostic[]): boolean {
        return diagnostics.some(d => d.message.includes('indentation') || d.message.includes('mixed'));
    }
    
    private createMixinQuickFix(
        document: vscode.TextDocument, 
        range: vscode.Range, 
        lineText: string
    ): vscode.CodeAction {
        
        const action = new vscode.CodeAction(
            'Create missing mixin',
            vscode.CodeActionKind.QuickFix
        );
        
        const mixinMatch = lineText.match(/^\s*\+(\w+)/);
        if (mixinMatch) {
            const mixinName = mixinMatch[1];
            const edit = new vscode.WorkspaceEdit();
            
            // Add mixin definition at the top of the file
            const mixinDefinition = `mixin ${mixinName}\n  // TODO: Implement mixin\n\n`;
            edit.insert(document.uri, new vscode.Position(0, 0), mixinDefinition);
            
            action.edit = edit;
            action.diagnostics = [];
        }
        
        return action;
    }
    
    private createDeprecatedTagQuickFix(
        document: vscode.TextDocument, 
        range: vscode.Range, 
        lineText: string
    ): vscode.CodeAction {
        
        const action = new vscode.CodeAction(
            'Replace deprecated tag',
            vscode.CodeActionKind.QuickFix
        );
        
        const edit = new vscode.WorkspaceEdit();
        
        // Replace 'center' with 'div.text-center'
        if (lineText.includes('center')) {
            const newText = lineText.replace(/\bcenter\b/, 'div.text-center');
            edit.replace(document.uri, new vscode.Range(range.start.line, 0, range.start.line, lineText.length), newText);
        }
        
        action.edit = edit;
        return action;
    }
    
    private createIndentationQuickFix(
        document: vscode.TextDocument, 
        range: vscode.Range
    ): vscode.CodeAction {
        
        const action = new vscode.CodeAction(
            'Fix indentation',
            vscode.CodeActionKind.QuickFix
        );
        
        const edit = new vscode.WorkspaceEdit();
        const line = document.lineAt(range.start.line);
        
        // Convert tabs to spaces (using editor config)
        const tabSize = vscode.workspace.getConfiguration('editor', document.uri).get('tabSize', 2) as number;
        const newText = line.text.replace(/\t/g, ' '.repeat(tabSize));
        
        edit.replace(document.uri, line.range, newText);
        action.edit = edit;
        
        return action;
    }
    
    private createRefactoringActions(
        document: vscode.TextDocument, 
        range: vscode.Range, 
        lineText: string
    ): vscode.CodeAction[] {
        
        const actions: vscode.CodeAction[] = [];
        
        // Extract to mixin
        if (this.canExtractToMixin(lineText)) {
            const action = new vscode.CodeAction(
                'Extract to mixin',
                vscode.CodeActionKind.Refactor
            );
            
            action.command = {
                title: 'Extract to mixin',
                command: 'pug-support.extractToMixin',
                arguments: [document, range]
            };
            
            actions.push(action);
        }
        
        // Convert to include
        if (this.canConvertToInclude(lineText)) {
            const action = new vscode.CodeAction(
                'Extract to separate file',
                vscode.CodeActionKind.Refactor
            );
            
            action.command = {
                title: 'Extract to separate file',
                command: 'pug-support.extractToFile',
                arguments: [document, range]
            };
            
            actions.push(action);
        }
        
        // Inline mixin
        if (this.canInlineMixin(lineText)) {
            const action = new vscode.CodeAction(
                'Inline mixin',
                vscode.CodeActionKind.Refactor
            );
            
            action.command = {
                title: 'Inline mixin',
                command: 'pug-support.inlineMixin',
                arguments: [document, range]
            };
            
            actions.push(action);
        }
        
        return actions;
    }
    
    private canExtractToMixin(lineText: string): boolean {
        // Check if line contains HTML tags that could be extracted
        return /^\s*[a-zA-Z][a-zA-Z0-9]*(\.|#|\s|$)/.test(lineText.trim());
    }
    
    private canConvertToInclude(lineText: string): boolean {
        // Check if line is a good candidate for extraction to separate file
        return /^\s*(header|footer|nav|aside)(\.|#|\s|$)/.test(lineText.trim());
    }
    
    private canInlineMixin(lineText: string): boolean {
        // Check if line contains a mixin call
        return /^\s*\+\w+/.test(lineText.trim());
    }
} 