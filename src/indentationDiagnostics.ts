import * as vscode from 'vscode';

export function createIndentationDiagnostics(): vscode.DiagnosticCollection {
    return vscode.languages.createDiagnosticCollection('pug-lint');
}

export function updateIndentationDiagnostics(document: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection): void {
    if (document && (document.languageId === 'pug' || document.languageId === 'jade')) {
        const diags: vscode.Diagnostic[] = [];
        const text = document.getText();
        
        // JetBrains IDEと同じアルゴリズムを実装
        let lastRange: vscode.Range | null = null;
        let lastCharType: string = '';
        
        const lines = text.split(/\r?\n/);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 空行や最終行はスキップ
            if (line.trim() === '' || i === lines.length - 1) {
                continue;
            }
            
            // 行の最初の文字を確認
            const firstChar = line.charAt(0);
            if (firstChar !== ' ' && firstChar !== '\t') {
                continue;
            }
            
            // 同じ文字が続く範囲を見つける
            let endIndex = 1;
            while (endIndex < line.length && line.charAt(endIndex) === firstChar) {
                endIndex++;
            }
            
            // JetBrains IDEロジック: 異なるインデント文字タイプが混在している場合
            if (lastCharType !== '' && lastCharType !== firstChar) {
                // 前の範囲と現在の範囲の両方をエラーとして報告
                if (lastRange) {
                    diags.push(new vscode.Diagnostic(
                        lastRange,
                        'Mixed tabs and spaces in indentation (JetBrains-style validation)',
                        vscode.DiagnosticSeverity.Warning
                    ));
                }
                
                const currentRange = new vscode.Range(
                    new vscode.Position(i, 0),
                    new vscode.Position(i, endIndex)
                );
                diags.push(new vscode.Diagnostic(
                    currentRange,
                    'Mixed tabs and spaces in indentation (JetBrains-style validation)',
                    vscode.DiagnosticSeverity.Warning
                ));
                
                break; // JetBrains IDEは最初の混在を検出したら停止
            }
            
            // 同一行内でのタブ・スペース混在チェック
            if (endIndex < line.length) {
                const nextChar = line.charAt(endIndex);
                if (nextChar === ' ' || nextChar === '\t') {
                    // 同一行内での混在
                    const range1 = new vscode.Range(
                        new vscode.Position(i, endIndex - 1),
                        new vscode.Position(i, endIndex)
                    );
                    const range2 = new vscode.Range(
                        new vscode.Position(i, endIndex),
                        new vscode.Position(i, endIndex + 1)
                    );
                    
                    diags.push(new vscode.Diagnostic(
                        range1,
                        'Mixed tabs and spaces in same line',
                        vscode.DiagnosticSeverity.Error
                    ));
                    diags.push(new vscode.Diagnostic(
                        range2,
                        'Mixed tabs and spaces in same line',
                        vscode.DiagnosticSeverity.Error
                    ));
                    
                    break;
                }
            }
            
            lastCharType = firstChar;
            lastRange = new vscode.Range(
                new vscode.Position(i, 0),
                new vscode.Position(i, endIndex)
            );
        }
        
        // 従来のシンプルなチェックも併用（互換性のため）
        lines.forEach((lineText, lineNumber) => {
            const leadingWhitespace = lineText.match(/^(\s*)/)?.[0];
            if (leadingWhitespace && leadingWhitespace.length > 0) {
                const hasTabs = leadingWhitespace.includes('\t');
                const hasSpaces = leadingWhitespace.includes(' ');
                if (hasTabs && hasSpaces) {
                    const range = new vscode.Range(
                        new vscode.Position(lineNumber, 0),
                        new vscode.Position(lineNumber, leadingWhitespace.length)
                    );
                    
                    // 重複チェック
                    const exists = diags.some(d => d.range.isEqual(range));
                    if (!exists) {
                        diags.push(new vscode.Diagnostic(
                            range, 
                            'Mixed tabs and spaces in indentation.', 
                            vscode.DiagnosticSeverity.Warning
                        ));
                    }
                }
            }
        });
        
        diagnostics.set(document.uri, diags);
    }
}
