import * as vscode from 'vscode';
const pugLexer = require('pug-lexer');
const pugParser = require('pug-parser');

export interface ParsedPugDocument {
    ast: any;
    tokens: any[];
    mixins: Map<string, MixinInfo>;
    includes: IncludeInfo[];
    extends: string | null;
    diagnostics: vscode.Diagnostic[];
}

export interface MixinInfo {
    name: string;
    line: number;
    column: number;
    parameters: string[];
    usages: Array<{ line: number; column: number; document: vscode.Uri }>;
}

export interface IncludeInfo {
    path: string;
    line: number;
    column: number;
    resolvedPath?: string;
}

export class AdvancedPugParser {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private documentCache = new Map<string, ParsedPugDocument>();

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('pug-advanced');
    }

    public parseDocument(document: vscode.TextDocument): ParsedPugDocument {
        const uri = document.uri.toString();
        const text = document.getText();

        try {
            const tokens = pugLexer(text, { filename: document.fileName });
            const ast = pugParser(tokens, { filename: document.fileName });
            
            const diagnostics: vscode.Diagnostic[] = [];
            const mixins = this.extractMixins(tokens, document, diagnostics);
            const includes = this.extractIncludes(tokens, document, diagnostics);
            const extendsPath = this.extractExtends(tokens, document, diagnostics);

            // Perform advanced validations
            this.validateSyntax(ast, document, diagnostics);
            this.validateReferences(mixins, includes, document, diagnostics);

            const parsed: ParsedPugDocument = {
                ast,
                tokens,
                mixins,
                includes,
                extends: extendsPath,
                diagnostics
            };

            this.documentCache.set(uri, parsed);
            this.diagnosticCollection.set(document.uri, diagnostics);

            return parsed;
        } catch (error) {
            const diagnostics = [
                new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, 0),
                    `Parse error: ${error instanceof Error ? error.message : String(error)}`,
                    vscode.DiagnosticSeverity.Error
                )
            ];

            const parsed: ParsedPugDocument = {
                ast: null,
                tokens: [],
                mixins: new Map(),
                includes: [],
                extends: null,
                diagnostics
            };

            this.documentCache.set(uri, parsed);
            this.diagnosticCollection.set(document.uri, diagnostics);

            return parsed;
        }
    }

    private extractMixins(tokens: any[], document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): Map<string, MixinInfo> {
        const mixins = new Map<string, MixinInfo>();

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            if (token.type === 'mixin') {
                const nextToken = tokens[i + 1];
                if (nextToken && nextToken.type === 'text') {
                    const mixinName = nextToken.val.trim();
                    const position = document.positionAt(token.loc?.start || 0);
                    
                    // Extract parameters
                    const parameters: string[] = [];
                    if (i + 2 < tokens.length && tokens[i + 2].type === 'start-attributes') {
                        // Parse mixin parameters (simplified)
                        let j = i + 3;
                        while (j < tokens.length && tokens[j].type !== 'end-attributes') {
                            if (tokens[j].type === 'attribute') {
                                parameters.push(tokens[j].name);
                            }
                            j++;
                        }
                    }

                    mixins.set(mixinName, {
                        name: mixinName,
                        line: position.line,
                        column: position.character,
                        parameters,
                        usages: []
                    });
                }
            }
        }

        return mixins;
    }

    private extractIncludes(tokens: any[], document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): IncludeInfo[] {
        const includes: IncludeInfo[] = [];

        for (const token of tokens) {
            if (token.type === 'include') {
                const position = document.positionAt(token.loc?.start || 0);
                const path = token.file;
                
                includes.push({
                    path,
                    line: position.line,
                    column: position.character,
                    resolvedPath: this.resolvePath(path, document)
                });
            }
        }

        return includes;
    }

    private extractExtends(tokens: any[], document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): string | null {
        for (const token of tokens) {
            if (token.type === 'extends') {
                return token.file;
            }
        }
        return null;
    }

    private validateSyntax(ast: any, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        if (!ast) {return;}

        // Recursive AST validation
        this.validateNode(ast, document, diagnostics);
    }

    private validateNode(node: any, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        if (!node) {return;}

        switch (node.type) {
            case 'Mixin':
                this.validateMixin(node, document, diagnostics);
                break;
            case 'MixinBlock':
                this.validateMixinCall(node, document, diagnostics);
                break;
            case 'Tag':
                this.validateTag(node, document, diagnostics);
                break;
            case 'Include':
                this.validateInclude(node, document, diagnostics);
                break;
        }

        // Recursively validate child nodes
        if (node.block && node.block.nodes) {
            for (const child of node.block.nodes) {
                this.validateNode(child, document, diagnostics);
            }
        }
        if (node.nodes) {
            for (const child of node.nodes) {
                this.validateNode(child, document, diagnostics);
            }
        }
    }

    private validateMixin(node: any, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        // Check for mixin naming conventions
        if (node.name && !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(node.name)) {
            const position = new vscode.Position(node.line - 1, node.column - 1);
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(position, position.translate(0, node.name.length)),
                `Invalid mixin name: '${node.name}'. Use alphanumeric characters, underscore, or dash.`,
                vscode.DiagnosticSeverity.Warning
            ));
        }
    }

    private validateMixinCall(node: any, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        // This would be enhanced to check if the mixin is defined
        const parsed = this.documentCache.get(document.uri.toString());
        if (parsed && !parsed.mixins.has(node.name)) {
            const position = new vscode.Position(node.line - 1, node.column - 1);
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(position, position.translate(0, node.name.length)),
                `Undefined mixin: '${node.name}'`,
                vscode.DiagnosticSeverity.Error
            ));
        }
    }

    private validateTag(node: any, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        // Check for deprecated tags or attributes
        if (node.name === 'center') {
            const position = new vscode.Position(node.line - 1, node.column - 1);
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(position, position.translate(0, node.name.length)),
                `Tag '${node.name}' is deprecated. Use CSS for styling instead.`,
                vscode.DiagnosticSeverity.Information
            ));
        }
    }

    private validateInclude(node: any, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        const resolvedPath = this.resolvePath(node.file, document);
        if (resolvedPath && !this.fileExists(resolvedPath)) {
            const position = new vscode.Position(node.line - 1, node.column - 1);
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(position, position.translate(0, node.file.length)),
                `Include file not found: '${node.file}'`,
                vscode.DiagnosticSeverity.Error
            ));
        }
    }

    private validateReferences(mixins: Map<string, MixinInfo>, includes: IncludeInfo[], document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        // Check for unused mixins
        for (const [name, mixin] of mixins) {
            if (mixin.usages.length === 0) {
                const position = new vscode.Position(mixin.line, mixin.column);
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(position, position.translate(0, name.length)),
                    `Unused mixin: '${name}'`,
                    vscode.DiagnosticSeverity.Hint
                ));
            }
        }
    }

    private resolvePath(includePath: string, document: vscode.TextDocument): string | undefined {
        // Simplified path resolution
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {return undefined;}

        const basePath = document.uri.fsPath.substring(0, document.uri.fsPath.lastIndexOf('/'));
        return `${basePath}/${includePath}`;
    }

    private fileExists(path: string): boolean {
        try {
            // In a real implementation, you'd use vscode.workspace.fs
            return true; // Simplified
        } catch {
            return false;
        }
    }

    public getParsedDocument(uri: vscode.Uri): ParsedPugDocument | undefined {
        return this.documentCache.get(uri.toString());
    }

    public dispose(): void {
        this.diagnosticCollection.dispose();
        this.documentCache.clear();
    }
} 