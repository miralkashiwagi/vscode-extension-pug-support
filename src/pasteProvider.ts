import * as vscode from 'vscode';

export class PugPasteProvider implements vscode.DocumentPasteEditProvider {

    async provideDocumentPasteEdits(
        document: vscode.TextDocument,
        ranges: readonly vscode.Range[],
        dataTransfer: vscode.DataTransfer,
        context: vscode.DocumentPasteEditContext, // Corrected: Added context parameter
        token: vscode.CancellationToken
    ): Promise<vscode.DocumentPasteEdit[] | undefined> {
        const pastedText = await dataTransfer.get('text/plain')?.asString();
        if (!pastedText || token.isCancellationRequested) {
            return;
        }

        const edits: vscode.DocumentPasteEdit[] = [];

        for (const range of ranges) {
            const lineAtCursor = document.lineAt(range.start.line);
            const textBeforeCursorOnLine = lineAtCursor.text.substring(0, range.start.character);
            const trimmedTextBeforeCursor = textBeforeCursorOnLine.trimRight();

            let baseIndent = lineAtCursor.text.substring(0, lineAtCursor.firstNonWhitespaceCharacterIndex);
            let prefixForPipedText = '';
            let isPipedContext = false;

            const pipeMatch = /\|\s*$/.exec(trimmedTextBeforeCursor);
            if (pipeMatch) {
                isPipedContext = true;
                baseIndent = textBeforeCursorOnLine.substring(0, textBeforeCursorOnLine.lastIndexOf('|') + 1);
                prefixForPipedText = ' '; 
            }

            // Corrected: Pass document to normalizeIndent
            const normalizedPastedText = this.normalizeIndent(pastedText, document, isPipedContext ? baseIndent + prefixForPipedText : baseIndent);
            const lines = normalizedPastedText.split(/\r?\n/);

            let resultText = '';
            if (lines.length === 1) {
                resultText = (isPipedContext ? prefixForPipedText : '') + lines[0];
            } else {
                resultText = (isPipedContext ? prefixForPipedText : '') + lines[0]; 
                for (let i = 1; i < lines.length; i++) {
                    resultText += '\n' + (isPipedContext ? baseIndent + prefixForPipedText : baseIndent) + lines[i];
                }
            }
            
            // Corrected: Set title in constructor
            const title = isPipedContext ? 'Paste with Pug Pipe Formatting' : 'Paste Pug Content';
            const pasteEdit = new vscode.DocumentPasteEdit(resultText, title, vscode.DocumentDropOrPasteEditKind.Text);
            edits.push(pasteEdit);
        }
        return edits;
    }

    // Corrected: Accept document instead of editorOptions
    private normalizeIndent(text: string, document: vscode.TextDocument, targetBaseIndentForNonPiped: string): string {
        const lines = text.split(/\r?\n/);
        if (lines.length <= 1) return text.trimLeft();

        // Corrected: Get editor settings from vscode.workspace.getConfiguration
        const editorConfig = vscode.workspace.getConfiguration('editor', document.uri);
        const tabSize = editorConfig.get<number>('tabSize', 4);
        const insertSpaces = editorConfig.get<boolean>('insertSpaces', true);

        let minIndentLength = Infinity;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '' && i === lines.length -1) continue; 
            if (line.trim() === '' && i === 0) continue;

            let currentIndentLength = 0;
            for (const char of line) {
                if (char === ' ') currentIndentLength++;
                else if (char === '\t') currentIndentLength += tabSize; 
                else break;
            }
            minIndentLength = Math.min(minIndentLength, currentIndentLength);
        }
        
        if (minIndentLength === Infinity) minIndentLength = 0;

        return lines.map((line, index) => {
            if (line.trim() === '' && index === lines.length -1 && lines.length > 1) return ''; 
            
            let currentIndentLength = 0;
            let contentStart = 0;
            for (let i = 0; i < line.length; i++) {
                if (line[i] === ' ') currentIndentLength++;
                else if (line[i] === '\t') currentIndentLength += tabSize;
                else {
                    contentStart = i;
                    break;
                }
                if (i === line.length - 1) contentStart = line.length; 
            }

            const relativeIndentLength = Math.max(0, currentIndentLength - minIndentLength);
            
            let newIndentStr = '';
            if (insertSpaces) {
                newIndentStr = ' '.repeat(relativeIndentLength);
            } else {
                newIndentStr = '\t'.repeat(Math.floor(relativeIndentLength / tabSize)) + ' '.repeat(relativeIndentLength % tabSize);
            }
            return newIndentStr + line.substring(contentStart);
        }).join('\n');
    }
}
