import * as vscode from 'vscode';
import { PugDefinitionProvider } from './definitionProvider';
import { completionProvider } from './completionProvider';
import { createIndentationDiagnostics, updateIndentationDiagnostics } from './indentationDiagnostics';
import { findTodosInWorkspace } from './todoIndexer';
import { getDirectDependencies } from './PugDependencyResolver';
import { PugPasteHandler } from './pasteProvider';
import { activateMixinIndexer } from './mixinIndexer';
import { PugRenameProvider } from './pugRenameProvider';
import { PugFileWatcher } from './pugFileWatcher';
import { PugDocumentSymbolProvider, PugWorkspaceSymbolProvider } from './pugSymbolProvider';
import { PugReferenceProvider } from './pugReferenceProvider';
import { PugDocumentHighlightProvider } from './pugHighlightProvider';
import { PugFoldingRangeProvider } from './pugFoldingProvider';
import { PugSignatureHelpProvider } from './pugSignatureHelpProvider';

// Output channel utility
let todoOutputChannel: vscode.OutputChannel | undefined;
function getTodoOutputChannel(): vscode.OutputChannel {
    if (!todoOutputChannel) {
        todoOutputChannel = vscode.window.createOutputChannel('Pug TODOs');
    }
    return todoOutputChannel;
}

// Global instances for cleanup
let fileWatcher: PugFileWatcher | undefined;
let registeredProviders: vscode.Disposable[] = [];

// Pug file detection utility
function isPugFile(document: vscode.TextDocument): boolean {
    return document.fileName.endsWith('.pug');
}

function isPugUri(uri: vscode.Uri): boolean {
    return uri.fsPath.endsWith('.pug');
}

// Utility functions for Pug file detection

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
    console.log('Pug Support - Advanced extension activating (startup-based detection)...');

    // Check for other Pug formatters and log compatibility info
    const extensions = vscode.extensions.all;
    const pugFormatters = extensions.filter(ext => 
        ext.id.includes('pug') && 
        ext.id !== 'miral-kashiwagi.pug-support' &&
        ext.isActive
    );
    
    if (pugFormatters.length > 0) {
        console.log('Detected other Pug extensions:', pugFormatters.map(ext => ext.id));
        console.log('Pug Support - Advanced will not register formatting to avoid conflicts');
    }

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

    // Register advanced language features
    const renameProvider = new PugRenameProvider();
    registeredProviders.push(vscode.languages.registerRenameProvider(PUG_FILTERS, renameProvider));

    // Register NEW basic language features
    const documentSymbolProvider = new PugDocumentSymbolProvider();
    registeredProviders.push(vscode.languages.registerDocumentSymbolProvider(PUG_FILTERS, documentSymbolProvider));

    const workspaceSymbolProvider = new PugWorkspaceSymbolProvider();
    registeredProviders.push(vscode.languages.registerWorkspaceSymbolProvider(workspaceSymbolProvider));

    const referenceProvider = new PugReferenceProvider();
    registeredProviders.push(vscode.languages.registerReferenceProvider(PUG_FILTERS, referenceProvider));

    const documentHighlightProvider = new PugDocumentHighlightProvider();
    registeredProviders.push(vscode.languages.registerDocumentHighlightProvider(PUG_FILTERS, documentHighlightProvider));

    const foldingRangeProvider = new PugFoldingRangeProvider();
    registeredProviders.push(vscode.languages.registerFoldingRangeProvider(PUG_FILTERS, foldingRangeProvider));

    const signatureHelpProvider = new PugSignatureHelpProvider();
    registeredProviders.push(vscode.languages.registerSignatureHelpProvider(PUG_FILTERS, signatureHelpProvider, '(', ','));

    // Register basic providers with multiple filters
    registeredProviders.push(vscode.languages.registerCompletionItemProvider(PUG_FILTERS, completionProvider, ...['.', '#', ' ']));
    registeredProviders.push(vscode.languages.registerHoverProvider(PUG_FILTERS, hoverProvider));

    // Initialize file watcher for automatic path updates
    fileWatcher = new PugFileWatcher();
    context.subscriptions.push(fileWatcher);

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

    // Register commands
    const findTodosCommand = vscode.commands.registerCommand('pug.findTodos', async () => {
        await findTodosInWorkspace(getTodoOutputChannel);
    });

    const listFileDependenciesCommand = vscode.commands.registerCommand('pug.listFileDependencies', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            if (isPugFile(document)) {
                const dependencies = await getDirectDependencies(document);
                getTodoOutputChannel().clear();
                getTodoOutputChannel().show(true);
                getTodoOutputChannel().appendLine(`Direct dependencies for ${vscode.workspace.asRelativePath(document.uri)}:`);
                if (dependencies.size > 0) {
                    dependencies.forEach(dep => {
                        getTodoOutputChannel().appendLine(`  - ${dep}`);
                    });
                } else {
                    getTodoOutputChannel().appendLine('  No direct dependencies found.');
                }
            } else {
                vscode.window.showInformationMessage('This command can only be run on a Pug file.');
            }
        } else {
            vscode.window.showInformationMessage('No active editor found.');
        }
    });

    const createFromTemplateCommand = vscode.commands.registerCommand('pug.createFromTemplate', async () => {
        const templatePath = vscode.Uri.joinPath(context.extensionUri, 'templates', 'basic.pug');
        try {
            const templateFiles = await vscode.workspace.findFiles('**/*.pug', '**/node_modules/**', 100);
            const templateQuickPickItems = templateFiles.map(uri => ({ label: vscode.workspace.asRelativePath(uri), detail: uri.fsPath, uri }));
            const selectedTemplateUri = await vscode.window.showQuickPick(
                templateQuickPickItems,
                { placeHolder: 'Select a Pug template to create a new file from' }
            );
            if (selectedTemplateUri && selectedTemplateUri.uri) {
                const fileName = await vscode.window.showInputBox({
                    prompt: 'Enter file name (without extension)',
                    value: 'untitled'
                });
                if (fileName) {
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(selectedTemplateUri.uri) || vscode.workspace.workspaceFolders?.[0];
                    if (workspaceFolder) {
                        const newFileName = `${fileName}.pug`;
                        const newFilePath = vscode.Uri.joinPath(workspaceFolder.uri, newFileName);
                        await vscode.workspace.fs.copy(selectedTemplateUri.uri, newFilePath, { overwrite: false });
                        const document = await vscode.workspace.openTextDocument(newFilePath);
                        await vscode.window.showTextDocument(document);
                    } else {
                        vscode.window.showErrorMessage('Could not determine a workspace folder to create the new Pug file.');
                    }
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create file from template: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    // Add all providers to context subscriptions
    context.subscriptions.push(...registeredProviders);
    
    context.subscriptions.push(
        findTodosCommand, 
        listFileDependenciesCommand,
        createFromTemplateCommand
    );

    // Log successful activation
    console.log('Pug Support - Advanced extension activated successfully');
    console.log(`Registered ${registeredProviders.length} language providers`);
}

export function deactivate() {
    if (todoOutputChannel) {
        todoOutputChannel.dispose();
    }
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    // Dispose all registered providers
    registeredProviders.forEach(provider => provider.dispose());
    registeredProviders = [];
}

