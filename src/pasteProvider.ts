import * as vscode from "vscode";

export class PugPasteHandler {
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // カスタムペーストコマンドを登録
    const command = vscode.commands.registerTextEditorCommand(
      'pug.pasteWithFormatting',
      this.handlePasteWithFormatting.bind(this)
    );
    this.disposables.push(command);
  }

  private async handlePasteWithFormatting(
    textEditor: vscode.TextEditor,
    edit: vscode.TextEditorEdit
  ) {
    try {
      // クリップボードからテキストを取得
      const clipboardText = await vscode.env.clipboard.readText();
      
      if (!clipboardText) {
        return;
      }

      const selection = textEditor.selection;
      const document = textEditor.document;
      
      // Pugファイルかどうかチェック
      if (!this.isPugFile(document)) {
        // Pugファイルでない場合は通常のペーストを実行
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.replace(document.uri, selection, clipboardText);
        await vscode.workspace.applyEdit(workspaceEdit);
        return;
      }

      // 現在の行とカーソル位置を取得
      const lineAtCursor = document.lineAt(selection.start.line);
      const textBeforeCursorOnLine = lineAtCursor.text.substring(
        0,
        selection.start.character
      );
      const trimmedTextBeforeCursor = textBeforeCursorOnLine.trimRight();

      // パイプ記法のコンテキストかどうかチェック
      const pipeMatch = /\|\s*$/.exec(trimmedTextBeforeCursor);
      
      // パイプコンテキストでない場合は、通常のテキスト挿入
      if (!pipeMatch) {
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.replace(document.uri, selection, clipboardText);
        await vscode.workspace.applyEdit(workspaceEdit);
        return;
      }

      // パイプコンテキストの場合のみカスタムフォーマットを適用
      // 現在の行の基本インデント（パイプより前の部分）を取得
      const baseIndent = lineAtCursor.text.substring(
        0,
        lineAtCursor.firstNonWhitespaceCharacterIndex
      );

      const prefixForPipedText = " ";

      // テキストのインデントを正規化
      const normalizedPastedText = this.normalizeIndent(
        clipboardText,
        document,
        baseIndent + "|" + prefixForPipedText
      );
      const lines = normalizedPastedText.split(/\r?\n/);

      let resultText = "";
      if (lines.length === 1) {
        resultText = prefixForPipedText + lines[0];
      } else {
        resultText = prefixForPipedText + lines[0];
        for (let i = 1; i < lines.length; i++) {
          resultText += "\n" + baseIndent + "|" + prefixForPipedText + lines[i];
        }
      }

      // WorkspaceEditを使用してフォーマット済みテキストを挿入
      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.replace(document.uri, selection, resultText);
      await vscode.workspace.applyEdit(workspaceEdit);
    } catch (error) {
      console.error('Error in Pug paste formatting:', error);
      // エラーが発生した場合は、クリップボードの内容をそのまま挿入
      const clipboardText = await vscode.env.clipboard.readText();
      if (clipboardText) {
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.replace(textEditor.document.uri, textEditor.selection, clipboardText);
        await vscode.workspace.applyEdit(workspaceEdit);
      }
    }
  }

  private normalizeIndent(
    text: string,
    document: vscode.TextDocument,
    targetBaseIndentForNonPiped: string
  ): string {
    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) {
      return text.trimLeft();
    }

    // エディター設定を取得
    const editorConfig = vscode.workspace.getConfiguration(
      "editor",
      document.uri
    );
    const tabSize = editorConfig.get<number>("tabSize", 4);
    const insertSpaces = editorConfig.get<boolean>("insertSpaces", true);

    let minIndentLength = Infinity;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "" && i === lines.length - 1) {
        continue;
      }
      if (line.trim() === "" && i === 0) {
        continue;
      }

      let currentIndentLength = 0;
      for (const char of line) {
        if (char === " ") {
          currentIndentLength++;
        } else if (char === "\t") {
          currentIndentLength += tabSize;
        } else {
          break;
        }
      }
      minIndentLength = Math.min(minIndentLength, currentIndentLength);
    }

    if (minIndentLength === Infinity) {
      minIndentLength = 0;
    }

    return lines
      .map((line, index) => {
        if (
          line.trim() === "" &&
          index === lines.length - 1 &&
          lines.length > 1
        ) {
          return "";
        }

        let currentIndentLength = 0;
        let contentStart = 0;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === " ") {
            currentIndentLength++;
          } else if (line[i] === "\t") {
            currentIndentLength += tabSize;
          } else {
            contentStart = i;
            break;
          }
          if (i === line.length - 1) {
            contentStart = line.length;
          }
        }

        const relativeIndentLength = Math.max(
          0,
          currentIndentLength - minIndentLength
        );

        let newIndentStr = "";
        if (insertSpaces) {
          newIndentStr = " ".repeat(relativeIndentLength);
        } else {
          newIndentStr =
            "\t".repeat(Math.floor(relativeIndentLength / tabSize)) +
            " ".repeat(relativeIndentLength % tabSize);
        }
        return newIndentStr + line.substring(contentStart);
      })
      .join("\n");
  }

  private isPugFile(document: vscode.TextDocument): boolean {
    return document.languageId === 'pug' || document.fileName.endsWith('.pug');
  }

  dispose() {
    this.disposables.forEach(d => d.dispose());
  }
}
