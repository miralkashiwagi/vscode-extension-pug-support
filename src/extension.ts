import * as vscode from 'vscode';
import * as prettier from 'prettier';
import * as path from 'path';
import { getDirectDependencies } from './PugDependencyResolver';
import * as fs from 'fs';

class PugDefinitionProvider implements vscode.DefinitionProvider {

	private async findMixinDefinitionInIncludedFiles(document: vscode.TextDocument, mixinName: string): Promise<vscode.Location[]> {
		const locations: vscode.Location[] = [];
		const currentDocText = document.getText();
		const includeRegex = /^\s*include\s+([^\s]+)/gm;
		let includeMatch;
		const dirPath = path.dirname(document.uri.fsPath);
		const promises: Promise<void>[] = [];

		while ((includeMatch = includeRegex.exec(currentDocText)) !== null) {
			const includePath = includeMatch[1];
			let absoluteIncludePath = path.resolve(dirPath, includePath);
			let finalUri: vscode.Uri | undefined;

			const checkAndSetPath = async (filePath: string) => {
				try {
					const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
					if (stat.type === vscode.FileType.File) {
						finalUri = vscode.Uri.file(filePath);
						return true;
					}
				} catch { /* file doesn't exist */ }
				return false;
			};
			
			if (!(await checkAndSetPath(absoluteIncludePath))) {
				if (!(await checkAndSetPath(absoluteIncludePath + '.pug'))) {
					if (!(await checkAndSetPath(absoluteIncludePath + '.jade'))) {
						// console.log(`Include file not found: ${includePath}`);
						continue;
					}
				}
			}

			if (finalUri) {
                const includedFileUri = finalUri;
                promises.push(
                    (async () => {
                        try {
                            const includedDoc = await vscode.workspace.openTextDocument(includedFileUri);
                            const includedDocumentLines = includedDoc.getText().split(/\r?\n/);
                            const mixinDefinitionRegex = new RegExp(`^mixin\s+${mixinName}(?:\s|\(|$)`);
                            for (let i = 0; i < includedDocumentLines.length; i++) {
                                if (mixinDefinitionRegex.test(includedDocumentLines[i])) {
                                    locations.push(new vscode.Location(includedFileUri, new vscode.Position(i, 0)));
                                }
                            }
                        } catch (e: any) { // Added type for error parameter
                            console.error(`Error reading or parsing included file ${includedFileUri.fsPath}:`, e);
                        }
                    })()
                );
            }
		}

		await Promise.all(promises);
		return locations;
	}

	public async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
		const line = document.lineAt(position.line);
		const lineText = line.text;

		// Regex for include: 'include path/to/file.pug'
		const includeRegex = /^\s*include\s+([^\s]+)/;
		const includeMatch = lineText.match(includeRegex);

		if (includeMatch) {
			const includedPath = includeMatch[1];
			// Check if the cursor is on the path part
			const pathStartIndex = lineText.indexOf(includedPath);
			const pathEndIndex = pathStartIndex + includedPath.length;
			if (position.character >= pathStartIndex && position.character <= pathEndIndex) {
				const currentDir = path.dirname(document.uri.fsPath);
				let resolvedPath = path.resolve(currentDir, includedPath);

				// Try with .pug extension if not specified
				if (!fs.existsSync(resolvedPath) && !path.extname(resolvedPath)) {
					const pathWithPugExt = resolvedPath + '.pug';
					if (fs.existsSync(pathWithPugExt)) {
						resolvedPath = pathWithPugExt;
					}
				}
				// Try with .jade extension if not specified and .pug didn't exist
				else if (!fs.existsSync(resolvedPath) && !path.extname(resolvedPath)) {
					const pathWithJadeExt = resolvedPath + '.jade';
					if (fs.existsSync(pathWithJadeExt)) {
						resolvedPath = pathWithJadeExt;
					}
				}

				try {
					const stat = await fs.promises.stat(resolvedPath);
					if (stat.isFile()) {
						return new vscode.Location(vscode.Uri.file(resolvedPath), new vscode.Position(0, 0));
					}
				} catch (error) {
					console.log(`File not found for include: ${resolvedPath}`, error);
					return null;
				}
			}
		}

		// Regex for extends: 'extends path/to/template.pug'
		const extendsRegex = /^\s*extends\s+([^\s]+)/;
		const extendsMatch = lineText.match(extendsRegex);

		if (extendsMatch) {
			const extendedPath = extendsMatch[1];
			// Check if the cursor is on the path part
			const pathStartIndex = lineText.indexOf(extendedPath);
			const pathEndIndex = pathStartIndex + extendedPath.length;
			if (position.character >= pathStartIndex && position.character <= pathEndIndex) {
				const currentDir = path.dirname(document.uri.fsPath);
				let resolvedPath = path.resolve(currentDir, extendedPath);

				// Try with .pug extension if not specified
				if (!fs.existsSync(resolvedPath) && !path.extname(resolvedPath)) {
					const pathWithPugExt = resolvedPath + '.pug';
					if (fs.existsSync(pathWithPugExt)) {
						resolvedPath = pathWithPugExt;
					}
				}
				// Try with .jade extension if not specified and .pug didn't exist
				else if (!fs.existsSync(resolvedPath) && !path.extname(resolvedPath)) {
					const pathWithJadeExt = resolvedPath + '.jade';
					if (fs.existsSync(pathWithJadeExt)) {
						resolvedPath = pathWithJadeExt;
					}
				}

				try {
					const stat = await fs.promises.stat(resolvedPath);
					if (stat.isFile()) {
						return new vscode.Location(vscode.Uri.file(resolvedPath), new vscode.Position(0, 0));
					}
				} catch (error) {
					console.log(`File not found for extends: ${resolvedPath}`, error);
					return null;
				}
			}
		}

		// Regex for mixin call: '+mixinName'
		const mixinCallRegex = /^\s*\+\s*([A-Za-z0-9_-]+)(?:\s*\(.*\))?/;
		const mixinCallMatch = lineText.match(mixinCallRegex);

		if (mixinCallMatch) {
			const mixinName = mixinCallMatch[1];
			const callNameStartIndex = lineText.indexOf(mixinName, lineText.indexOf('+') + 1);
			const callNameEndIndex = callNameStartIndex + mixinName.length;

			if (position.character >= callNameStartIndex && position.character <= callNameEndIndex) {
				for (let i = 0; i < document.lineCount; i++) {
					const potentialDefinitionLine = document.lineAt(i).text;
					const mixinDefinitionRegex = new RegExp(`^\s*mixin\s+${mixinName}(?:\s*\(.*\))?`);
					if (potentialDefinitionLine.match(mixinDefinitionRegex)) {
						return new vscode.Location(document.uri, new vscode.Position(i, 0));
					}
				}
                // If not found in current file, search in included files
                const includedDefinitions = await this.findMixinDefinitionInIncludedFiles(document, mixinName);
                if (includedDefinitions.length > 0) {
                    return includedDefinitions;
                }
			}
		}

		// Regex for mixin definition: 'mixin mixinName'
		const mixinDefinitionRegex = /^\s*mixin\s+([A-Za-z0-9_-]+)(?:\s*\(.*\))?/;
		const mixinDefinitionMatch = lineText.match(mixinDefinitionRegex);

		if (mixinDefinitionMatch) {
			const mixinName = mixinDefinitionMatch[1];
			const defNameStartIndex = lineText.indexOf(mixinName, lineText.indexOf('mixin') + 5);
			const defNameEndIndex = defNameStartIndex + mixinName.length;

			if (position.character >= defNameStartIndex && position.character <= defNameEndIndex) {
				return new vscode.Location(document.uri, new vscode.Position(position.line, 0));
			}
		}

		const wordRange = document.getWordRangeAtPosition(position);
		const word = wordRange ? document.getText(wordRange) : '';
		console.log(`${document.languageId.toUpperCase()} definition provider called for '${word}' (no specific handler found) at ${document.uri.fsPath}:${position.line}:${position.character}`);
		return null;
	}
}

// import * as pugLexer from 'pug-lexer'; // To be used later
// import * as pugParser from 'pug-parser'; // To be used later

let todoOutputChannel: vscode.OutputChannel | undefined;

function getTodoOutputChannel(): vscode.OutputChannel {
	if (!todoOutputChannel) {
		todoOutputChannel = vscode.window.createOutputChannel('Pug/Jade TODOs');
	}
	return todoOutputChannel;
}

export function activate(context: vscode.ExtensionContext) {

	// todoOutputChannel is now initialized by getTodoOutputChannel() on first use.

	const pugDefinitionProvider = new PugDefinitionProvider();
	const definitionProviderDisposable = vscode.languages.registerDefinitionProvider([{ language: 'pug' }, { language: 'jade' }], pugDefinitionProvider);

	console.log('"pug-support" extension is now active!');

	// Register a document formatting provider
	const PUG_MODE: vscode.DocumentFilter = { language: 'pug', scheme: 'file' };
	const JADE_MODE: vscode.DocumentFilter = { language: 'jade', scheme: 'file' };

	// --- Document Formatter ---
	const formattingProvider = {
		async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
			const text = document.getText();
			try {
				const formattedText = await prettier.format(text, {
					parser: document.languageId === 'jade' ? 'pug' : document.languageId, // Use 'pug' parser for jade as well
					plugins: ['@prettier/plugin-pug'], // Explicitly load the pug plugin
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

	// --- Completion Item Provider ---
	const completionProvider = {
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
				if (keyword === '+mixinName') { item.insertText = '+'; } // For mixin calls
				return item;
			});

			const tagCompletions = htmlTags.map(tag => new vscode.CompletionItem(tag, vscode.CompletionItemKind.Property));

			// Simple check: if line starts with whitespace or is empty, suggest tags and keywords
			if (linePrefix.match(/^\s*$/) || linePrefix.match(/^\s*[a-zA-Z0-9]*$/)) {
				return [...keywordCompletions, ...tagCompletions];
			}

			// Add more sophisticated logic here based on context if needed
			// For example, after a dot, suggest attributes or nothing
			if (linePrefix.endsWith('.')) {
				// return [new vscode.CompletionItem('className', vscode.CompletionItemKind.Property)];
				return []; // Placeholder for class/id completion
			}
			// After '#', suggest nothing or id completion
			if (linePrefix.endsWith('#')) {
				return []; // Placeholder for id completion
			}

			return [];
		}
	};
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(PUG_MODE, completionProvider, ...['.', '#', ' '])); // Trigger on space, dot, hash
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(JADE_MODE, completionProvider, ...['.', '#', ' ']));

	// --- Hover Provider ---
	const hoverProvider = {
		provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
			const wordRange = document.getWordRangeAtPosition(position);
			if (!wordRange) {
				return null;
			}
			const word = document.getText(wordRange);

			// Basic Pug keyword descriptions
			const pugKeywordDescriptions: { [key: string]: string } = {
				'if': 'Conditionally renders a block of Pug code if the expression is truthy.',
				'else if': 'Following an `if` or `else if` block, conditionally renders if the previous conditions were falsy and this expression is truthy.',
				'else': 'Following an `if` or `else if` block, renders if all preceding conditions were falsy.',
				'unless': 'Conditionally renders a block of Pug code if the expression is falsy (opposite of `if`).',
				'each': 'Iterates over an array or object. `each val, index in array` or `each val, key in object`.',
				'for': 'Similar to `each`, but often used with a more traditional loop syntax if preferred.',
				'while': 'Renders a block of Pug code as long as the given condition is truthy.',
				'case': 'Allows for multi-way conditional rendering based on an expression.',
				'when': 'A case within a `case` statement. Renders if the `case` expression matches this `when` clause.',
				'default': 'The default case in a `case` statement, rendered if no `when` clauses match.',
				'mixin': 'Defines a reusable block of Pug code. `mixin myMixin(arg1, arg2)`',
				'block': 'Defines a named block of content that can be overridden or appended to by extending templates. `block content`',
				'extends': 'Specifies a parent template that this template inherits from. `extends layout.pug`',
				'include': 'Includes another Pug file. `include partials/header.pug`',
				'doctype': 'Defines the document type. Common values: `html`, `xml`, `5` (for HTML5). `doctype html`'
			};

			if (pugKeywordDescriptions[word]) {
				const markdownString = new vscode.MarkdownString();
				markdownString.appendCodeblock(word, 'pug');
				markdownString.appendMarkdown(`\n---\n${pugKeywordDescriptions[word]}`);
				return new vscode.Hover(markdownString, wordRange);
			}

			return null;
		}
	};
	context.subscriptions.push(vscode.languages.registerHoverProvider(PUG_MODE, hoverProvider));
	context.subscriptions.push(vscode.languages.registerHoverProvider(JADE_MODE, hoverProvider));

	// --- Definition Provider Registration ---
	// The PugDefinitionProvider class is defined at the top of the file.
	// We create a single instance and register it for both Pug and Jade.
	const pugDefinitionProviderInstance = new PugDefinitionProvider();
	context.subscriptions.push(vscode.languages.registerDefinitionProvider(PUG_MODE, pugDefinitionProviderInstance));
	context.subscriptions.push(vscode.languages.registerDefinitionProvider(JADE_MODE, pugDefinitionProviderInstance));

	// --- Diagnostics (Validation) ---
	const diagnostics = vscode.languages.createDiagnosticCollection('pug-lint');
	context.subscriptions.push(diagnostics);

	function updateDiagnostics(document: vscode.TextDocument): void {
		if (document && (document.languageId === 'pug' || document.languageId === 'jade')) {
			const diags: vscode.Diagnostic[] = [];
			const lines = document.getText().split(/\r?\n/);

			lines.forEach((lineText, lineNumber) => {
				const leadingWhitespace = lineText.match(/^(\s*)/)?.[0];
				if (leadingWhitespace) {
					const hasTabs = leadingWhitespace.includes('\t');
					const hasSpaces = leadingWhitespace.includes(' ');

					if (hasTabs && hasSpaces) {
						const range = new vscode.Range(
							new vscode.Position(lineNumber, 0),
							new vscode.Position(lineNumber, leadingWhitespace.length)
						);
						diags.push(new vscode.Diagnostic(range, 'Mixed tabs and spaces in indentation.', vscode.DiagnosticSeverity.Warning));
					}
				}
			});
			diagnostics.set(document.uri, diags);
		}
	}

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

console.log('Pug/Jade support features are being set up.');

// --- TODO Indexing Command ---
const findTodosCommand = vscode.commands.registerCommand('pug-support.findTodos', async () => {
// Ensure the output channel is cleared and shown before processing files
getTodoOutputChannel().clear();
getTodoOutputChannel().show(true);
getTodoOutputChannel().appendLine('Searching for TODOs and FIXMEs in workspace .pug and .jade files...');

const pugFiles = await vscode.workspace.findFiles('**/*.pug', '**/node_modules/**');
const jadeFiles = await vscode.workspace.findFiles('**/*.jade', '**/node_modules/**');
const allPugJadeFiles = [...pugFiles, ...jadeFiles];

if (allPugJadeFiles.length === 0) {
getTodoOutputChannel().appendLine('No .pug or .jade files found in the workspace.');
return;
}


		let totalTodos = 0;
		const todoRegex = /(?:\/\/-\s*(TODO|FIXME)|\/\/\s*(TODO|FIXME)):(.*)/gi;

		for (const fileUri of allPugJadeFiles) {
			try {
				const document = await vscode.workspace.openTextDocument(fileUri);
				const text = document.getText();
				const lines = text.split(/\r?\n/);
				let fileHasTodos = false;

				lines.forEach((line, index) => {
					let match;
					while ((match = todoRegex.exec(line)) !== null) {
						if (!fileHasTodos) {
							getTodoOutputChannel().appendLine(`\n--- ${vscode.workspace.asRelativePath(fileUri)} ---`);
							fileHasTodos = true;
						}
						const todoType = match[1] || match[2]; 
						const todoComment = match[3].trim();
						getTodoOutputChannel().appendLine(`  L${index + 1}: [${todoType.toUpperCase()}] ${todoComment}`);
						totalTodos++;
					}
				});
			} catch (e: any) {
				getTodoOutputChannel().appendLine(`\nError processing file ${vscode.workspace.asRelativePath(fileUri)}: ${e.message}`);
			}
		}

		if (totalTodos === 0) {
			getTodoOutputChannel().appendLine('\nNo TODOs or FIXMEs found.');
		} else {
			getTodoOutputChannel().appendLine(`\nFound ${totalTodos} TODO(s)/FIXME(s) in total.`);
		}
	});

	// --- List File Dependencies Command ---
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

	context.subscriptions.push(definitionProviderDisposable, findTodosCommand, listFileDependenciesCommand);
}

export function deactivate() {
	if (todoOutputChannel) {
		todoOutputChannel.dispose();
	}
	console.log('"pug-support" extension is now deactivated.');
}
