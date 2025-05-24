import * as vscode from 'vscode';
import * as prettier from 'prettier';
import { PugDefinitionProvider } from './definitionProvider';
import { completionProvider } from './completionProvider';
import { createIndentationDiagnostics, updateIndentationDiagnostics } from './indentationDiagnostics';
import { findTodosInWorkspace } from './todoIndexer';
import { getDirectDependencies } from './PugDependencyResolver';
import { PugPasteProvider } from './pasteProvider';
import { activateMixinIndexer } from './mixinIndexer';

// Output channel utility
let todoOutputChannel: vscode.OutputChannel | undefined;
function getTodoOutputChannel(): vscode.OutputChannel {
    if (!todoOutputChannel) {
        todoOutputChannel = vscode.window.createOutputChannel('Pug/Jade TODOs');
    }
    return todoOutputChannel;
}

// シンプルな Hover Provider
const hoverProvider: vscode.HoverProvider = {
    provideHover(document, position, token) {
        const range = document.getWordRangeAtPosition(position);
        if (!range) { return null; }
        const word = document.getText(range);
        // よく使われるPug/Jadeキーワードに簡単な説明を返す
        switch(word) {
            case 'mixin':
                return new vscode.Hover('**mixin**: Pugの関数的な構造で、再利用可能なテンプレート部品を定義します。');
            case 'block':
                return new vscode.Hover('**block**: 継承テンプレートで内容を差し替え可能な領域を定義します。');
            case 'extends':
                return new vscode.Hover('**extends**: 他のPug/Jadeテンプレートを継承します。');
            case 'include':
                return new vscode.Hover('**include**: 他のファイルを現在のテンプレートに挿入します。');
            default:
                return null;
        }
    }
};

export function activate(context: vscode.ExtensionContext) {
    const PUG_MODE: vscode.DocumentFilter = { language: 'pug', scheme: 'file' };
    const JADE_MODE: vscode.DocumentFilter = { language: 'jade', scheme: 'file' };

    const formattingProvider = {
        async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
            const text = document.getText();
            try {
                const formattedText = await prettier.format(text, {
                    parser: document.languageId === 'jade' ? 'pug' : document.languageId,
                    plugins: ['@prettier/plugin-pug'],
                    tabWidth: vscode.workspace.getConfiguration('editor', document.uri).get('tabSize', 2) as number,
                    useTabs: !vscode.workspace.getConfiguration('editor', document.uri).get('insertSpaces', true),
                });
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(text.length)
                );
                return [vscode.TextEdit.replace(fullRange, formattedText)];
            } catch (error) {
                console.error('Error formatting Pug/Jade document:', error);
                vscode.window.showErrorMessage(`Error formatting ${document.languageId.toUpperCase()} document: ${error instanceof Error ? error.message : String(error)}`);
                return [];
            }
        }
    };
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(PUG_MODE, formattingProvider));
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(JADE_MODE, formattingProvider));

    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(PUG_MODE, completionProvider, ...['.', '#', ' ']));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(JADE_MODE, completionProvider, ...['.', '#', ' ']));

    context.subscriptions.push(vscode.languages.registerHoverProvider(PUG_MODE, hoverProvider));
    context.subscriptions.push(vscode.languages.registerHoverProvider(JADE_MODE, hoverProvider));

    const pugDefinitionProviderInstance = new PugDefinitionProvider();
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(PUG_MODE, pugDefinitionProviderInstance));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(JADE_MODE, pugDefinitionProviderInstance));

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

    context.subscriptions.push(findTodosCommand, listFileDependenciesCommand);
}

export function deactivate() {
    if (todoOutputChannel) {
        todoOutputChannel.dispose();
    }
}

