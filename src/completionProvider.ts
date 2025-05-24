import * as vscode from 'vscode';

export const completionProvider: vscode.CompletionItemProvider = {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        // Basic Pug keywords
        const pugKeywords = [
            'if', 'else if', 'else', 'unless',
            'each', 'for', 'while',
            'case', 'when', 'default',
            'mixin', '+mixinName',
            'block', 'extends', 'include',
            'doctype'
        ];
        // Basic HTML tags
        const htmlTags = [
            'div', 'p', 'span', 'a', 'img', 'ul', 'li', 'ol',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'form', 'input', 'button', 'select', 'option', 'textarea',
            'script', 'style', 'link', 'meta', 'head', 'body', 'html'
        ];
        const keywordCompletions = pugKeywords.map(keyword => {
            const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            if (keyword === '+mixinName') { item.insertText = '+'; }
            return item;
        });
        const tagCompletions = htmlTags.map(tag => new vscode.CompletionItem(tag, vscode.CompletionItemKind.Property));
        if (linePrefix.match(/^\s*$/) || linePrefix.match(/^\s*[a-zA-Z0-9]*$/)) {
            return [...keywordCompletions, ...tagCompletions];
        }
        if (linePrefix.endsWith('.')) {
            return [];
        }
        if (linePrefix.endsWith('#')) {
            return [];
        }
        return [];
    }
};
