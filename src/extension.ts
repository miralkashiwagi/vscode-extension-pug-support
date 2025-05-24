import * as vscode from 'vscode';
// import * as prettier from 'prettier';
import { PugDefinitionProvider } from './definitionProvider';
import { completionProvider } from './completionProvider';
import { createIndentationDiagnostics, updateIndentationDiagnostics } from './indentationDiagnostics';
import { findTodosInWorkspace } from './todoIndexer';
import { getDirectDependencies } from './PugDependencyResolver';
import { PugPasteProvider } from './pasteProvider';
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
        todoOutputChannel = vscode.window.createOutputChannel('Pug/Jade TODOs');
    }
    return todoOutputChannel;
}

// Global instances for cleanup
let fileWatcher: PugFileWatcher | undefined;

// シンプルな Hover Provider
const hoverProvider: vscode.HoverProvider = {
    provideHover(document, position, token) {
        const range = document.getWordRangeAtPosition(position);
        if (!range) { return null; }
        const word = document.getText(range);
        // よく使われるPug/Jadeキーワードに簡単な説明を返す
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
                    '**extends**: 他のPug/Jadeテンプレートを継承します。',
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

    console.log('Pug Support extension activating...');
    console.log('context.extensionUri:', context.extensionUri);
    console.log('context.extensionPath (deprecated but for check):', context.extensionPath);
    console.log('vscode.workspace.workspaceFolders:', vscode.workspace.workspaceFolders);



    const PUG_MODE: vscode.DocumentFilter = { language: 'pug', scheme: 'file' };
    const JADE_MODE: vscode.DocumentFilter = { language: 'jade', scheme: 'file' };

    // Enhanced formatting provider
    // const formattingProvider = {
    //     async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    //         const text = document.getText();
    //         try {
    //             const formattedText = await prettier.format(text, {
    //                 parser: document.languageId === 'jade' ? 'pug' : document.languageId,
    //                 plugins: ['@prettier/plugin-pug'],
    //                 tabWidth: vscode.workspace.getConfiguration('editor', document.uri).get('tabSize', 2) as number,
    //                 useTabs: !vscode.workspace.getConfiguration('editor', document.uri).get('insertSpaces', true),
    //             });
    //             const fullRange = new vscode.Range(
    //                 document.positionAt(0),
    //                 document.positionAt(text.length)
    //             );
    //             return [vscode.TextEdit.replace(fullRange, formattedText)];
    //         } catch (error) {
    //             console.error('Error formatting Pug/Jade document:', error);
    //             vscode.window.showErrorMessage(`Error formatting ${document.languageId.toUpperCase()} document: ${error instanceof Error ? error.message : String(error)}`);
    //             return [];
    //         }
    //     }
    // };

    // Register basic providers
    // context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(PUG_MODE, formattingProvider));
    // context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(JADE_MODE, formattingProvider));

    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(PUG_MODE, completionProvider, ...['.', '#', ' ']));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(JADE_MODE, completionProvider, ...['.', '#', ' ']));

    context.subscriptions.push(vscode.languages.registerHoverProvider(PUG_MODE, hoverProvider));
    context.subscriptions.push(vscode.languages.registerHoverProvider(JADE_MODE, hoverProvider));

    const pugDefinitionProviderInstance = new PugDefinitionProvider();
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(PUG_MODE, pugDefinitionProviderInstance));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(JADE_MODE, pugDefinitionProviderInstance));

    // Register advanced language features
    const renameProvider = new PugRenameProvider();
    context.subscriptions.push(vscode.languages.registerRenameProvider(PUG_MODE, renameProvider));
    context.subscriptions.push(vscode.languages.registerRenameProvider(JADE_MODE, renameProvider));

    // Register NEW basic language features
    const documentSymbolProvider = new PugDocumentSymbolProvider();
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(PUG_MODE, documentSymbolProvider));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(JADE_MODE, documentSymbolProvider));

    const workspaceSymbolProvider = new PugWorkspaceSymbolProvider();
    context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(workspaceSymbolProvider));

    const referenceProvider = new PugReferenceProvider();
    context.subscriptions.push(vscode.languages.registerReferenceProvider(PUG_MODE, referenceProvider));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(JADE_MODE, referenceProvider));

    const documentHighlightProvider = new PugDocumentHighlightProvider();
    context.subscriptions.push(vscode.languages.registerDocumentHighlightProvider(PUG_MODE, documentHighlightProvider));
    context.subscriptions.push(vscode.languages.registerDocumentHighlightProvider(JADE_MODE, documentHighlightProvider));

    const foldingRangeProvider = new PugFoldingRangeProvider();
    context.subscriptions.push(vscode.languages.registerFoldingRangeProvider(PUG_MODE, foldingRangeProvider));
    context.subscriptions.push(vscode.languages.registerFoldingRangeProvider(JADE_MODE, foldingRangeProvider));

    const signatureHelpProvider = new PugSignatureHelpProvider();
    context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(PUG_MODE, signatureHelpProvider, '(', ','));
    context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(JADE_MODE, signatureHelpProvider, '(', ','));

    // Initialize file watcher for automatic path updates
    fileWatcher = new PugFileWatcher();
    context.subscriptions.push(fileWatcher);

    // Register diagnostics
    const diagnostics = createIndentationDiagnostics();
    context.subscriptions.push(diagnostics);
    const updateDiagnostics = (document: vscode.TextDocument) => updateIndentationDiagnostics(document, diagnostics);
    if (vscode.window.activeTextEditor) {
        updateDiagnostics(vscode.window.activeTextEditor.document);
    }
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            updateDiagnostics(editor.document);
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => updateDiagnostics(event.document)));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => diagnostics.delete(doc.uri)));

    // Register Paste Provider
    const pasteProvider = new PugPasteProvider();
    context.subscriptions.push(
        vscode.languages.registerDocumentPasteEditProvider({ language: 'pug' }, pasteProvider, {
            pasteMimeTypes: ['text/plain'],
            providedPasteEditKinds: [vscode.DocumentDropOrPasteEditKind.Text]
        })
    );

    // Activate Mixin Indexer
    activateMixinIndexer(context);

    // Register commands
    const findTodosCommand = vscode.commands.registerCommand('pug-support.findTodos', async () => {
        await findTodosInWorkspace(getTodoOutputChannel);
    });

    const listFileDependenciesCommand = vscode.commands.registerCommand('pug-support.listFileDependencies', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            if (document.languageId === 'pug' || document.languageId === 'jade') {
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
                vscode.window.showInformationMessage('This command can only be run on a Pug or Jade file.');
            }
        } else {
            vscode.window.showInformationMessage('No active editor found.');
        }
    });

    const createFromTemplateCommand = vscode.commands.registerCommand('pug-support.createFromTemplate', async () => {
        const templatePath = vscode.Uri.joinPath(context.extensionUri, 'templates', 'basic.pug');
        try {
            const templateContent = await vscode.workspace.fs.readFile(templatePath);
            const templateText = Buffer.from(templateContent).toString('utf8');
            
            const fileName = await vscode.window.showInputBox({
                prompt: 'Enter file name (without extension)',
                value: 'untitled'
            });
            
            if (fileName) {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    const newFilePath = vscode.Uri.joinPath(workspaceFolder.uri, `${fileName}.pug`);
                    await vscode.workspace.fs.writeFile(newFilePath, Buffer.from(templateText, 'utf8'));
                    const document = await vscode.workspace.openTextDocument(newFilePath);
                    await vscode.window.showTextDocument(document);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create file from template: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(
        findTodosCommand, 
        listFileDependenciesCommand,
        createFromTemplateCommand
    );
}

export function deactivate() {
    if (todoOutputChannel) {
        todoOutputChannel.dispose();
    }
    if (fileWatcher) {
        fileWatcher.dispose();
    }
}

