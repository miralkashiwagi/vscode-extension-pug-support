import * as vscode from 'vscode';

// Pug file detection utility
function isPugFile(document: vscode.TextDocument): boolean {
    return document.fileName.endsWith('.pug');
}

export class PugHoverProvider implements vscode.HoverProvider {
    public provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        if (!isPugFile(document)) {
            return null;
        }
        
        const range = document.getWordRangeAtPosition(position);
        if (!range) { return null; }
        const word = document.getText(range);
        
        // よく使われるPugキーワードに簡単な説明を返す
        switch(word) {
            case 'mixin':
                return new vscode.Hover([
                    '**mixin**: Pugの関数的な構造で、再利用可能なテンプレート部品を定義します。',
                    '',
                    '```pug',
                    'mixin button(text, type="button")',
                    '  button(type=type)= text',
                    '',
                    '+button("Click me", "submit")',
                    '```'
                ]);
            case 'block':
                return new vscode.Hover([
                    '**block**: 継承テンプレートで内容を差し替え可能な領域を定義します。',
                    '',
                    '```pug',
                    '// layout.pug',
                    'html',
                    '  head',
                    '    block title',
                    '  body',
                    '    block content',
                    '',
                    '// page.pug', 
                    'extends layout',
                    'block title',
                    '  title My Page',
                    'block content',
                    '  p Hello World',
                    '```'
                ]);
            case 'extends':
                return new vscode.Hover([
                    '**extends**: 他のPugテンプレートを継承します。',
                    '',
                    '```pug',
                    'extends ./layout',
                    '',
                    'block content',
                    '  h1 Page Content',
                    '```'
                ]);
            case 'include':
                return new vscode.Hover([
                    '**include**: 他のファイルを現在のテンプレートに挿入します。',
                    '',
                    '```pug',
                    'include ./header',
                    'main',
                    '  p Content here',
                    'include ./footer',
                    '```'
                ]);
            case 'each':
                return new vscode.Hover([
                    '**each**: 配列やオブジェクトをイテレーションします。',
                    '',
                    '```pug',
                    'ul',
                    '  each item in items',
                    '    li= item.name',
                    '',
                    '// インデックス付き',
                    'each item, index in items',
                    '  p #{index}: #{item}',
                    '```'
                ]);
            case 'if':
                return new vscode.Hover([
                    '**if**: 条件分岐を行います。',
                    '',
                    '```pug',
                    'if user.isAuthenticated',
                    '  p Welcome, #{user.name}!',
                    'else',
                    '  p Please log in',
                    '```'
                ]);
            case 'case':
                return new vscode.Hover([
                    '**case**: switch文のような条件分岐を行います。',
                    '',
                    '```pug',
                    'case status',
                    '  when "active"',
                    '    p.active Active',
                    '  when "inactive"',
                    '    p.inactive Inactive',
                    '  default',
                    '    p.unknown Unknown',
                    '```'
                ]);
            default:
                return null;
        }
    }
}

// インスタンスをエクスポート
export const pugHoverProvider = new PugHoverProvider();
