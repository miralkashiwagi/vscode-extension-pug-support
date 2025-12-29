import * as vscode from 'vscode';
import lex from 'pug-lexer';
const parsePug = require('pug-parser');
import { Node as PugNode, Block as PugBlockNode, Mixin as PugMixinNode, Code as PugCodeNode } from 'pug-parser';
import * as acorn from 'acorn';

export function createPugSyntaxDiagnostics(): vscode.DiagnosticCollection {
    return vscode.languages.createDiagnosticCollection('pug-syntax');
}

export function updatePugSyntaxDiagnostics(document: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection): void {
    const diags: vscode.Diagnostic[] = [];
    const content = document.getText();
    const filename = document.uri.fsPath;

    try {
        const tokens = lex(content, { filename });
        const ast = parsePug(tokens, { filename });
        
        // ASTを走査してJavaScript部分を検証
        validateJsInAst(ast, diags, document);
        
    } catch (error: any) {
        // Pug自体のパースエラーを処理
        if (error.line !== undefined && error.column !== undefined) {
            const line = Math.max(0, error.line - 1);
            const column = Math.max(0, error.column - 1);
            const range = new vscode.Range(line, column, line, column + 1);
            
            diags.push(new vscode.Diagnostic(
                range,
                `Pug Syntax Error: ${error.msg || error.message}`,
                vscode.DiagnosticSeverity.Error
            ));
        } else {
            // 位置情報がないエラー
            const range = new vscode.Range(0, 0, 0, 0);
            diags.push(new vscode.Diagnostic(
                range,
                `Pug Error: ${error.message}`,
                vscode.DiagnosticSeverity.Error
            ));
        }
    }

    diagnostics.set(document.uri, diags);
}

function validateJsInAst(node: PugNode, diags: vscode.Diagnostic[], document?: vscode.TextDocument): void {
    // Codeノード (- let ... など) の検証
    if (node.type === 'Code') {
        const codeNode = node as PugCodeNode;
        try {
            acorn.parse(codeNode.val, { ecmaVersion: 2020, allowReturnOutsideFunction: true });
        } catch (e: any) {
            addJsDiagnostic(codeNode, e, diags, document);
        }
    }

    // Mixin引数の検証 (Pugが通してもJSとして怪しい場合への備え)
    if (node.type === 'Mixin' && node.call && (node as PugMixinNode).args) {
        const mixinNode = node as PugMixinNode;
        if (mixinNode.args) {
            try {
                // acorn.parseExpressionAt は式として妥当か検証するのに適している
                acorn.parseExpressionAt(mixinNode.args, 0, { ecmaVersion: 2020 });
            } catch (e: any) {
                addJsDiagnostic(mixinNode, e, diags, document);
            }
        }
    }

    // 再帰的に子ノードを探索
    if ('block' in node && node.block && node.block.type === 'Block') {
        for (const childNode of node.block.nodes) {
            validateJsInAst(childNode, diags, document);
        }
    } else if (node.type === 'Block') {
        const blockNode = node as PugBlockNode;
        for (const childNode of blockNode.nodes) {
            validateJsInAst(childNode, diags, document);
        }
    } else if ('nodes' in node && Array.isArray((node as any).nodes)) {
        for (const childNode of (node as any).nodes) {
            validateJsInAst(childNode, diags, document);
        }
    }
}

function addJsDiagnostic(node: any, error: any, diags: vscode.Diagnostic[], document?: vscode.TextDocument): void {
    // node.line, node.column はPugファイル内でのCodeノード等の開始位置
    // error.loc.line, error.loc.column はCodeノード内（文字列内）での相対位置
    // JSのパースエラーは1-based
    
    let line = node.line - 1;
    let column = node.column - 1;

    // Codeノードで、かつ文書が提供されている場合、開始位置のオフセットを計算する
    if (node.type === 'Code' && document) {
        const startLineText = document.lineAt(line).text;
        // '-' 以降に文字がない場合、コードは次の行から始まっている
        const afterDash = startLineText.substring(column + 1).trim();
        if (afterDash === '') {
            line++;
            column = 0; // 次の行のインデントは acorn 側の loc.column に任せる
        }
    }
    
    if (error.loc) {
        // 文字列内の相対位置を絶対位置に変換
        // adjustedLine が 1 の場合、元の line に加算される
        
        // エラー位置の調整: ユーザーの要望により、カンマ忘れなどは前の要素の末尾にエラーを出したい場合がある
        // acornのエラー位置(error.pos)を利用して、直前の非空白文字を探す
        let adjustedColumn = error.loc.column;
        let adjustedLine = error.loc.line;
        
        const codeText = node.val || node.args || '';
        if (error.pos !== undefined && error.pos > 0) {
            let pos = error.pos - 1;
            // 空白や改行を遡る
            while (pos >= 0 && /\s/.test(codeText[pos])) {
                pos--;
            }
            if (pos >= 0) {
                // 遡った結果の行と列を再計算
                const textBefore = codeText.substring(0, pos + 1);
                const linesBefore = textBefore.split('\n');
                adjustedLine = linesBefore.length;
                adjustedColumn = linesBefore[linesBefore.length - 1].length;
            }
        }

        if (adjustedLine === 1) {
            // node.columnは '-' の位置。Codeノードの場合、valは通常数文字後に始まる
            // column はすでに '-' の後の適切な位置に調整されている可能性がある
            if (node.type === 'Code') {
                // Inline code: "- let a = 1"
                // node.column は 1 ('-')
                // acorn loc.column は 'l' の位置 (0-based なら 2?)
                // 実際には acorn は文字列の先頭を 0 とするので、'- ' 分の 2 を足す必要がある
                // 既に上のオフセット計算で column が調整されていればOK
                
                // 暫定的に、Pugのパーサーが返す column を生かしたまま acorn の column を足す
                column += adjustedColumn;
            } else if (node.type === 'Mixin') {
                // Mixin args: "+mixin(args)"
                // node.column は 1 ('+')
                // args は name と '(' の後。
                const nameLen = node.name ? node.name.length : 0;
                column += 1 + nameLen + 1 + adjustedColumn; // '+' + name + '('
            } else {
                column += adjustedColumn;
            }
        } else {
            column = adjustedColumn;
            line = line + (adjustedLine - 1);
        }
    }

    // エラー位置から行末までをハイライトする
    let endColumn = column + 1;
    if (document) {
        try {
            const lineText = document.lineAt(line).text;
            endColumn = lineText.length;
        } catch (e) {
            // 万が一、行番号が範囲外の場合はデフォルトの挙動
        }
    }

    const range = new vscode.Range(line, column, line, Math.max(column + 1, endColumn));
    diags.push(new vscode.Diagnostic(
        range,
        `JS Syntax Error: ${error.message}`,
        vscode.DiagnosticSeverity.Error
    ));
}
