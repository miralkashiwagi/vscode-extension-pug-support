import * as vscode from "vscode";
import { formatPipePaste, hasMultipleLogicalLines } from "./pasteFormatter";

export class PugPasteProvider implements vscode.DocumentPasteEditProvider {

  async provideDocumentPasteEdits(
    document: vscode.TextDocument,
    ranges: readonly vscode.Range[],
    dataTransfer: vscode.DataTransfer,
    _context: vscode.DocumentPasteEditContext,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentPasteEdit[] | undefined> {
    const pastedText = await dataTransfer.get("text/plain")?.asString();
    if (!pastedText || token.isCancellationRequested || !hasMultipleLogicalLines(pastedText)) {
      return undefined;
    }

    if (ranges.length !== 1) {
      return undefined;
    }

    const range = ranges[0];
    if (!range.isEmpty) {
      return undefined;
    }

    const lineAtCursor = document.lineAt(range.start.line);
    const textBeforeCursorOnLine = lineAtCursor.text.substring(0, range.start.character);
    const indentOptions = getIndentOptions(document);
    const formatted = formatPipePaste(pastedText, {
      textBeforeCursorOnLine,
      ...indentOptions,
    });

    if (!formatted) {
      return undefined;
    }

    const edits = [
      new vscode.DocumentPasteEdit(
        formatted.text,
        "Paste with Pug Pipe Formatting",
        vscode.DocumentDropOrPasteEditKind.Text
      ),
    ];

    const formattedWithBr = formatPipePaste(pastedText, {
      textBeforeCursorOnLine,
      ...indentOptions,
      insertBrBetweenLines: true,
    });
    if (formattedWithBr) {
      edits.push(new vscode.DocumentPasteEdit(
        formattedWithBr.text,
        "Paste with Pug Pipe and br",
        vscode.DocumentDropOrPasteEditKind.Text.append("pug.br")
      ));
    }

    return edits;
  }

}

export function getIndentOptions(document: vscode.TextDocument) {
  const editorConfig = vscode.workspace.getConfiguration("editor", document.uri);
  return {
    tabSize: editorConfig.get<number>("tabSize", 4),
    insertSpaces: editorConfig.get<boolean>("insertSpaces", true),
  };
}
