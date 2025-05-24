import * as vscode from 'vscode';

export function createIndentationDiagnostics(): vscode.DiagnosticCollection {
    return vscode.languages.createDiagnosticCollection('pug-lint');
}

export function updateIndentationDiagnostics(document: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection): void {
    if (document && (document.languageId === 'pug' || document.languageId === 'jade')) {
        const diags: vscode.Diagnostic[] = [];
        const lines = document.getText().split(/\r?\n/);
        lines.forEach((lineText, lineNumber) => {
            const leadingWhitespace = lineText.match(/^(\s*)/)?.[0];
            if (leadingWhitespace) {
                const hasTabs = leadingWhitespace.includes('\t');
                const hasSpaces = leadingWhitespace.includes(' ');
                if (hasTabs && hasSpaces) {
                    const range = new vscode.Range(
                        new vscode.Position(lineNumber, 0),
                        new vscode.Position(lineNumber, leadingWhitespace.length)
                    );
                    diags.push(new vscode.Diagnostic(range, 'Mixed tabs and spaces in indentation.', vscode.DiagnosticSeverity.Warning));
                }
            }
        });
        diagnostics.set(document.uri, diags);
    }
}
