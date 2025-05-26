import * as vscode from 'vscode';
import lex from 'pug-lexer';
const parsePug = require('pug-parser');
// Keep type imports if they are correctly defined as named exports in pug-parser.d.ts
import { Node as PugNode, Mixin as PugMixinNode, Block as PugBlockNode } from 'pug-parser';

export interface MixinDefinition {
    name: string;
    uri: vscode.Uri;
    range: vscode.Range; // Range of the mixin name in its definition
}

const mixinIndex: Map<string, MixinDefinition[]> = new Map();
let isIndexReady = false;

// Helper function to recursively find mixin definitions in the AST
function findMixinsRecursive(node: PugNode, documentUri: vscode.Uri, definitions: MixinDefinition[]): void {
    // Check if the current node is a Mixin definition
    // Mixin definitions have type 'Mixin' and their 'call' property is not true.
    if (node.type === 'Mixin') {
        const mixinNode = node as PugMixinNode;
        if (!mixinNode.call && mixinNode.name) {
            // Line and column are 1-based from the parser
            const line = mixinNode.line - 1;
            // Column points to the start of 'mixin keyword'. Name starts after 'mixin '
            const nameStartPosition = mixinNode.column -1 + 'mixin '.length;
            const nameEndPosition = nameStartPosition + mixinNode.name.length;
            
            const range = new vscode.Range(
                line, 
                nameStartPosition, 
                line, 
                nameEndPosition
            );
            definitions.push({ 
                name: mixinNode.name, 
                uri: documentUri, 
                range 
            });
        }
    }

    // If the node has a block (e.g., Tag, Conditional, Each, or a Mixin definition itself),
    // recurse into the block's nodes.
    // Type guard for nodes that have a 'block' property which itself has 'nodes'
    if ('block' in node && node.block && node.block.type === 'Block') {
        const blockNode = node.block as PugBlockNode;
        if (blockNode.nodes) {
            for (const childNode of blockNode.nodes) {
                findMixinsRecursive(childNode, documentUri, definitions);
            }
        }
    }
    // If the node itself is a Block (e.g. the root of the AST or an unbuffered comment's block)
    // recurse into its nodes.
    else if (node.type === 'Block') {
        const blockNode = node as PugBlockNode;
        if (blockNode.nodes) {
            for (const childNode of blockNode.nodes) {
                findMixinsRecursive(childNode, documentUri, definitions);
            }
        }
    }
    // Pug AST can also have 'nodes' directly on some elements like 'Case'
    // This part might need refinement based on all possible AST structures
    else if ('nodes' in node && Array.isArray((node as any).nodes)) {
        for (const childNode of (node as any).nodes) {
            findMixinsRecursive(childNode, documentUri, definitions);
        }
    }
}

function findMixinDefinitionsInAst(ast: PugNode, documentUri: vscode.Uri): MixinDefinition[] {
    const definitions: MixinDefinition[] = [];
    if (ast && ast.type === 'Block' && (ast as PugBlockNode).nodes) {
        findMixinsRecursive(ast, documentUri, definitions);
    }
    return definitions;
}

async function parsePugContent(content: string, uri: vscode.Uri): Promise<MixinDefinition[]> {
    try {
        const tokens = lex(content, { filename: uri.fsPath });
        const ast = parsePug(tokens, { filename: uri.fsPath });
        return findMixinDefinitionsInAst(ast, uri);
    } catch (error: any) {
        console.error(`[MixinIndexer] Error parsing Pug file ${uri.fsPath}: ${error.message}`);
        return [];
    }
}

export async function buildMixinIndex(context: vscode.ExtensionContext): Promise<void> {
    mixinIndex.clear();
    isIndexReady = false;

    const pugFiles = await vscode.workspace.findFiles('**/*.pug', '**/node_modules/**');

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: 'Indexing Pug Mixins',
        cancellable: false
    }, async (progress) => {
        for (let i = 0; i < pugFiles.length; i++) {
            const fileUri = pugFiles[i];
            progress.report({ message: `Processing ${vscode.workspace.asRelativePath(fileUri)}`, increment: (1 / pugFiles.length) * 100 });
            try {
                const fileContent = (await vscode.workspace.fs.readFile(fileUri)).toString();
                const definitions = await parsePugContent(fileContent, fileUri);
                for (const def of definitions) {
                    const existing = mixinIndex.get(def.name) || [];
                    existing.push(def);
                    mixinIndex.set(def.name, existing);
                }
            } catch (error) {
                // Errors from parsePugContent are already logged, this catches readFile errors
                console.error(`[MixinIndexer] Error reading file ${fileUri.fsPath}:`, error);
            }
        }
    });

    isIndexReady = true;
}

export function getMixinDefinitions(mixinName: string): MixinDefinition[] | undefined {
    if (!isIndexReady) {
        return undefined; 
    }
    return mixinIndex.get(mixinName);
}

export function getAllMixinNames(): string[] {
    if (!isIndexReady) {return [];}
    return Array.from(mixinIndex.keys());
}

async function handleFileChange(uri: vscode.Uri) {
    if (!uri.fsPath.endsWith('.pug')) {return;}
    
    mixinIndex.forEach((definitions, name) => {
        const filteredDefs = definitions.filter(def => def.uri.fsPath !== uri.fsPath);
        if (filteredDefs.length === 0) {
            mixinIndex.delete(name);
        } else {
            mixinIndex.set(name, filteredDefs);
        }
    });

    try {
        const content = (await vscode.workspace.fs.readFile(uri)).toString();
        const definitions = await parsePugContent(content, uri);
        for (const def of definitions) {
            const existing = mixinIndex.get(def.name) || [];
            existing.push(def);
            mixinIndex.set(def.name, existing);
        }
    } catch (error) {
        console.error(`[MixinIndexer] Error re-indexing file ${uri.fsPath} after change:`, error);
    }
}

function handleFileDelete(uri: vscode.Uri) {
    if (!uri.fsPath.endsWith('.pug')) {return;}
    mixinIndex.forEach((definitions, name) => {
        const filteredDefs = definitions.filter(def => def.uri.fsPath !== uri.fsPath);
        if (filteredDefs.length === 0) {
            mixinIndex.delete(name);
        } else {
            mixinIndex.set(name, filteredDefs);
        }
    });
}

export function activateMixinIndexer(context: vscode.ExtensionContext) {
    buildMixinIndex(context); 

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.pug');
    watcher.onDidChange(uri => handleFileChange(uri));
    watcher.onDidCreate(uri => handleFileChange(uri));
    watcher.onDidDelete(uri => handleFileDelete(uri));

    context.subscriptions.push(watcher);

    context.subscriptions.push(
        vscode.commands.registerCommand('pug.rebuildMixinIndex', () => {
            buildMixinIndex(context);
        })
    );
}
