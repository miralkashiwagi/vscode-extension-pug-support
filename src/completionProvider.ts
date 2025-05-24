import * as vscode from 'vscode';

// JetBrains IDEと同じロジック: script/styleタグでクラス補完を制限
function shouldProhibitClassCompletion(document: vscode.TextDocument, position: vscode.Position): boolean {
    const lineText = document.lineAt(position).text;
    const tagMatch = lineText.match(/^\s*([a-zA-Z]+)/);
    
    if (tagMatch) {
        const tagName = tagMatch[1].toLowerCase();
        return ['script', 'style'].includes(tagName);
    }
    
    return false;
}

// ドキュメント内のmixinを取得
function getMixinCompletions(document: vscode.TextDocument): vscode.CompletionItem[] {
    const text = document.getText();
    const mixinRegex = /^\s*mixin\s+([a-zA-Z][a-zA-Z0-9_-]*)\s*(\([^)]*\))?/gm;
    const mixins: vscode.CompletionItem[] = [];
    let match;

    while ((match = mixinRegex.exec(text)) !== null) {
        const mixinName = match[1];
        const params = match[2] || '';
        
        const item = new vscode.CompletionItem(mixinName, vscode.CompletionItemKind.Function);
        item.detail = `mixin ${mixinName}${params}`;
        item.insertText = mixinName;
        
        if (params) {
            item.insertText = `${mixinName}()`;
            item.command = {
                command: 'editor.action.triggerParameterHints',
                title: 'Trigger Parameter Hints'
            };
        }
        
        mixins.push(item);
    }

    return mixins;
}

export const completionProvider: vscode.CompletionItemProvider = {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        
        // JetBrains IDEと同じキーワードセット
        const pugKeywords = [
            'if', 'else', 'else if', 'until', 'while', 'unless',
            'each', 'for', 'case', 'when', 'default',
            'include', 'extends', 'doctype', 'yield',
            'mixin', 'block'
        ];
        
        // Basic HTML tags
        const htmlTags = [
            'div', 'p', 'span', 'a', 'img', 'ul', 'li', 'ol',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'form', 'input', 'button', 'select', 'option', 'textarea',
            'script', 'style', 'link', 'meta', 'head', 'body', 'html',
            'nav', 'header', 'footer', 'section', 'article', 'aside'
        ];

        // JetBrains IDEのようにスマートな挿入ハンドラーを実装
        const keywordCompletions = pugKeywords.map(keyword => {
            const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            
            // JetBrains IDEの挿入ロジック: else, default, yieldは空白を追加しない
            if (!['else', 'default', 'yield'].includes(keyword)) {
                item.insertText = keyword + ' ';
                item.command = {
                    command: 'editor.action.triggerSuggest',
                    title: 'Trigger Suggest'
                };
            }
            
            return item;
        });

        const tagCompletions = htmlTags.map(tag => {
            const item = new vscode.CompletionItem(tag, vscode.CompletionItemKind.Property);
            // タグの詳細情報を追加
            item.detail = `HTML tag: <${tag}>`;
            return item;
        });

        // 基本的な行の場合はキーワードとタグの両方を提供
        if (linePrefix.match(/^\s*$/) || linePrefix.match(/^\s*[a-zA-Z0-9]*$/)) {
            return [...keywordCompletions, ...tagCompletions];
        }

        // クラス補完 - JetBrains IDEと同様にscript/styleタグでは制限
        if (linePrefix.endsWith('.')) {
            if (shouldProhibitClassCompletion(document, position)) {
                return []; // script/styleタグではクラス補完を無効化
            }
            
            // 基本的なCSSクラス補完
            const commonClasses = [
                'container', 'row', 'col', 'btn', 'form-control',
                'text-center', 'text-left', 'text-right',
                'hidden', 'visible', 'active', 'disabled'
            ];
            
            return commonClasses.map(cls => {
                const item = new vscode.CompletionItem(cls, vscode.CompletionItemKind.Value);
                item.detail = `CSS class: .${cls}`;
                return item;
            });
        }

        // ID補完
        if (linePrefix.endsWith('#')) {
            const commonIds = ['main', 'header', 'footer', 'content', 'sidebar'];
            return commonIds.map(id => {
                const item = new vscode.CompletionItem(id, vscode.CompletionItemKind.Value);
                item.detail = `CSS ID: #${id}`;
                return item;
            });
        }

        // Mixin補完
        if (linePrefix.match(/^\s*\+/)) {
            return getMixinCompletions(document);
        }

        return [];
    }
};
