import * as vscode from 'vscode';
import { PugDefinitionProvider } from './definitionProvider';
import { completionProvider } from './completionProvider';
import { createIndentationDiagnostics, updateIndentationDiagnostics } from './indentationDiagnostics';
import { PugPasteHandler } from './pasteProvider';
import { activateMixinIndexer } from './mixinIndexer';
import { PugDocumentSymbolProvider, PugWorkspaceSymbolProvider } from './pugSymbolProvider';
import { PugSignatureHelpProvider } from './pugSignatureHelpProvider';

// Global instances for cleanup
let registeredProviders: vscode.Disposable[] = [];

// Pug file detection utility
function isPugFile(document: vscode.TextDocument): boolean {
    return document.fileName.endsWith('.pug');
}

// シンプルな Hover Provider
const hoverProvider: vscode.HoverProvider = {
    provideHover(document, position, token) {
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
};

export function activate(context: vscode.ExtensionContext) {


    // Create multiple document filters for better compatibility
    const PUG_FILTERS: vscode.DocumentSelector = [
        { pattern: '**/*.pug', scheme: 'file' },
        { pattern: '**/*.pug', scheme: 'untitled' },
        // Fallback: if any existing pug language is registered, use it
        'pug'
    ];

    // Register providers using multiple document filters for maximum compatibility
    const pugDefinitionProviderInstance = new PugDefinitionProvider();
    registeredProviders.push(vscode.languages.registerDefinitionProvider(PUG_FILTERS, pugDefinitionProviderInstance));

    // Register NEW basic language features
    const documentSymbolProvider = new PugDocumentSymbolProvider();
    registeredProviders.push(vscode.languages.registerDocumentSymbolProvider(PUG_FILTERS, documentSymbolProvider));

    const workspaceSymbolProvider = new PugWorkspaceSymbolProvider();
    registeredProviders.push(vscode.languages.registerWorkspaceSymbolProvider(workspaceSymbolProvider));

    // const documentHighlightProvider = new PugDocumentHighlightProvider();
    // registeredProviders.push(vscode.languages.registerDocumentHighlightProvider(PUG_FILTERS, documentHighlightProvider));

    // const foldingRangeProvider = new PugFoldingRangeProvider();
    // registeredProviders.push(vscode.languages.registerFoldingRangeProvider(PUG_FILTERS, foldingRangeProvider));

    const signatureHelpProvider = new PugSignatureHelpProvider();
    registeredProviders.push(vscode.languages.registerSignatureHelpProvider(PUG_FILTERS, signatureHelpProvider, '(', ','));

    // Register basic providers with multiple filters
    registeredProviders.push(vscode.languages.registerCompletionItemProvider(PUG_FILTERS, completionProvider, ...['.', '#', ' ']));
    registeredProviders.push(vscode.languages.registerHoverProvider(PUG_FILTERS, hoverProvider));


    // Register diagnostics
    const diagnostics = createIndentationDiagnostics();
    context.subscriptions.push(diagnostics);
    const updateDiagnostics = (document: vscode.TextDocument) => {
        if (isPugFile(document)) {
            updateIndentationDiagnostics(document, diagnostics);
        }
    };
    
    if (vscode.window.activeTextEditor && isPugFile(vscode.window.activeTextEditor.document)) {
        updateDiagnostics(vscode.window.activeTextEditor.document);
    }
    
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && isPugFile(editor.document)) {
            updateDiagnostics(editor.document);
        }
    }));
    
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        if (isPugFile(event.document)) {
            updateDiagnostics(event.document);
        }
    }));
    
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => {
        if (isPugFile(doc)) {
            diagnostics.delete(doc.uri);
        }
    }));

    // Register Paste Handler
    const pasteHandler = new PugPasteHandler();
    context.subscriptions.push(pasteHandler);

    // Activate Mixin Indexer
    activateMixinIndexer(context);


    // Add all providers to context subscriptions
    context.subscriptions.push(...registeredProviders);
    

    // Log successful activation
    console.log('Pug Support - Advanced extension activated successfully');;
}

export function deactivate() {
    // Dispose all registered providers
    registeredProviders.forEach(provider => provider.dispose());
    registeredProviders = [];
}

