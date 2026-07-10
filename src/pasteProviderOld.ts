import * as vscode from "vscode";
import { formatPipePaste } from "./pasteFormatter";
import { getIndentOptions } from "./pasteProvider";

/* Cursor用のフォールバック */

export class PugPasteHandler {
  private disposables: vscode.Disposable[] = [];

  constructor() {
    const commandFormatting = vscode.commands.registerTextEditorCommand(
      "pug.pasteWithFormatting",
      textEditor => this.handlePasteWithFormatting(textEditor, false)
    );
    this.disposables.push(commandFormatting);

    const commandBr = vscode.commands.registerTextEditorCommand(
      "pug.pasteWithBr",
      textEditor => this.handlePasteWithFormatting(textEditor, true)
    );
    this.disposables.push(commandBr);
  }

  private async handlePasteWithFormatting(
    textEditor: vscode.TextEditor,
    insertBrBetweenLines: boolean
  ) {
    let clipboardText = "";
    try {
      clipboardText = await vscode.env.clipboard.readText();
      if (!clipboardText) {
        return;
      }

      const selection = textEditor.selection;
      const document = textEditor.document;
      const formatted = this.isPugFile(document)
        ? this.formatClipboardForSelection(document, selection, clipboardText, insertBrBetweenLines)
        : undefined;

      await this.replaceSelection(document, selection, formatted ?? clipboardText);
    } catch (error) {
      console.error("Error in Pug paste formatting:", error);
      if (clipboardText) {
        await this.replaceSelection(textEditor.document, textEditor.selection, clipboardText);
      }
    }
  }

  private formatClipboardForSelection(
    document: vscode.TextDocument,
    selection: vscode.Selection,
    clipboardText: string,
    insertBrBetweenLines: boolean
  ): string | undefined {
    if (!selection.isSingleLine) {
      return undefined;
    }

    const lineAtCursor = document.lineAt(selection.start.line);
    const textBeforeCursorOnLine = lineAtCursor.text.substring(0, selection.start.character);

    return formatPipePaste(clipboardText, {
      textBeforeCursorOnLine,
      ...getIndentOptions(document),
      insertBrBetweenLines,
    })?.text;
  }

  private async replaceSelection(
    document: vscode.TextDocument,
    selection: vscode.Selection,
    text: string
  ): Promise<void> {
    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.replace(document.uri, selection, text);
    await vscode.workspace.applyEdit(workspaceEdit);
  }

  private isPugFile(document: vscode.TextDocument): boolean {
    return document.languageId === "pug" || document.fileName.endsWith(".pug");
  }

  dispose() {
    this.disposables.forEach(d => d.dispose());
  }
}
