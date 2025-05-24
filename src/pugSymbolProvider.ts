import * as vscode from 'vscode';

export class PugDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    
    public provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        
        const symbols: vscode.DocumentSymbol[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineText = line.trim();

            // Mixin definitions
            const mixinMatch = lineText.match(/^mixin\s+([a-zA-Z][a-zA-Z0-9_-]*)\s*(\([^)]*\))?/);
            if (mixinMatch) {
                const mixinName = mixinMatch[1];
                const params = mixinMatch[2] || '';
                const range = new vscode.Range(i, 0, i, line.length);
                const selectionRange = new vscode.Range(
                    i, 
                    line.indexOf(mixinName), 
                    i, 
                    line.indexOf(mixinName) + mixinName.length
                );

                const symbol = new vscode.DocumentSymbol(
                    `${mixinName}${params}`,
                    'Mixin Definition',
                    vscode.SymbolKind.Function,
                    range,
                    selectionRange
                );
                symbols.push(symbol);
            }

            // Block definitions
            const blockMatch = lineText.match(/^block\s+([a-zA-Z][a-zA-Z0-9_-]*)/);
            if (blockMatch) {
                const blockName = blockMatch[1];
                const range = new vscode.Range(i, 0, i, line.length);
                const selectionRange = new vscode.Range(
                    i, 
                    line.indexOf(blockName), 
                    i, 
                    line.indexOf(blockName) + blockName.length
                );

                const symbol = new vscode.DocumentSymbol(
                    blockName,
                    'Block Definition',
                    vscode.SymbolKind.Module,
                    range,
                    selectionRange
                );
                symbols.push(symbol);
            }

            // Include statements
            const includeMatch = lineText.match(/^include\s+(.+)$/);
            if (includeMatch) {
                const includePath = includeMatch[1].trim();
                const range = new vscode.Range(i, 0, i, line.length);
                const selectionRange = new vscode.Range(
                    i, 
                    line.indexOf(includePath), 
                    i, 
                    line.indexOf(includePath) + includePath.length
                );

                const symbol = new vscode.DocumentSymbol(
                    includePath,
                    'Include',
                    vscode.SymbolKind.File,
                    range,
                    selectionRange
                );
                symbols.push(symbol);
            }

            // Extends statements
            const extendsMatch = lineText.match(/^extends\s+(.+)$/);
            if (extendsMatch) {
                const extendsPath = extendsMatch[1].trim();
                const range = new vscode.Range(i, 0, i, line.length);
                const selectionRange = new vscode.Range(
                    i, 
                    line.indexOf(extendsPath), 
                    i, 
                    line.indexOf(extendsPath) + extendsPath.length
                );

                const symbol = new vscode.DocumentSymbol(
                    extendsPath,
                    'Extends',
                    vscode.SymbolKind.Interface,
                    range,
                    selectionRange
                );
                symbols.push(symbol);
            }
        }

        return symbols;
    }
}

export class PugWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
    
    public async provideWorkspaceSymbols(
        query: string,
        token: vscode.CancellationToken
    ): Promise<vscode.SymbolInformation[]> {
        
        const symbols: vscode.SymbolInformation[] = [];
        
        // Find all Pug/Jade files in workspace
        const pugFiles = await vscode.workspace.findFiles('**/*.{pug,jade}', '**/node_modules/**');
        
        for (const fileUri of pugFiles) {
            if (token.isCancellationRequested) {
                break;
            }

            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                const fileSymbols = await this.getSymbolsFromDocument(document, query);
                symbols.push(...fileSymbols);
            } catch (error) {
                // Skip files that can't be opened
                continue;
            }
        }

        return symbols;
    }

    private async getSymbolsFromDocument(
        document: vscode.TextDocument, 
        query: string
    ): Promise<vscode.SymbolInformation[]> {
        
        const symbols: vscode.SymbolInformation[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineText = line.trim();

            // Only include symbols that match the query
            if (query && !lineText.toLowerCase().includes(query.toLowerCase())) {
                continue;
            }

            // Mixin definitions
            const mixinMatch = lineText.match(/^mixin\s+([a-zA-Z][a-zA-Z0-9_-]*)\s*(\([^)]*\))?/);
            if (mixinMatch) {
                const mixinName = mixinMatch[1];
                if (!query || mixinName.toLowerCase().includes(query.toLowerCase())) {
                    const location = new vscode.Location(
                        document.uri,
                        new vscode.Position(i, line.indexOf(mixinName))
                    );

                    const symbol = new vscode.SymbolInformation(
                        mixinName,
                        vscode.SymbolKind.Function,
                        `${vscode.workspace.asRelativePath(document.uri)}`,
                        location
                    );
                    symbols.push(symbol);
                }
            }

            // Block definitions
            const blockMatch = lineText.match(/^block\s+([a-zA-Z][a-zA-Z0-9_-]*)/);
            if (blockMatch) {
                const blockName = blockMatch[1];
                if (!query || blockName.toLowerCase().includes(query.toLowerCase())) {
                    const location = new vscode.Location(
                        document.uri,
                        new vscode.Position(i, line.indexOf(blockName))
                    );

                    const symbol = new vscode.SymbolInformation(
                        blockName,
                        vscode.SymbolKind.Module,
                        `${vscode.workspace.asRelativePath(document.uri)}`,
                        location
                    );
                    symbols.push(symbol);
                }
            }
        }

        return symbols;
    }
} 