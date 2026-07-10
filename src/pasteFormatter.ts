export interface PipePasteContext {
  textBeforeCursorOnLine: string;
}

export interface IndentOptions {
  tabSize: number;
  insertSpaces: boolean;
}

export interface PipePasteFormatOptions extends PipePasteContext, IndentOptions {
  insertBrBetweenLines?: boolean;
}

export interface PipePasteFormatResult {
  text: string;
  lineCount: number;
}

export function getPipePasteContext(textBeforeCursorOnLine: string): PipePasteContext | undefined {
  return /\| ?$/.test(textBeforeCursorOnLine) ? { textBeforeCursorOnLine } : undefined;
}

export function hasMultipleLogicalLines(text: string): boolean {
  return /\r\n|\r|\n/.test(text);
}

export function formatPipePaste(
  pastedText: string,
  options: PipePasteFormatOptions
): PipePasteFormatResult | undefined {
  const pipeContext = getPipePasteContext(options.textBeforeCursorOnLine);
  if (!pipeContext) {
    return undefined;
  }

  const normalizedLines = normalizePastedLines(pastedText, options);
  const pipeIndex = pipeContext.textBeforeCursorOnLine.lastIndexOf("|");
  const pipeMarkerPrefix = pipeContext.textBeforeCursorOnLine.substring(0, pipeIndex + 1);
  const textPrefix = pipeContext.textBeforeCursorOnLine.endsWith("| ") ? "" : " ";
  const pugIndent = pipeContext.textBeforeCursorOnLine.substring(0, pipeIndex);

  const resultLines: string[] = [];
  normalizedLines.forEach((line, index) => {
    if (index > 0 && options.insertBrBetweenLines) {
      resultLines.push(`${pugIndent}br`);
    }

    if (index === 0) {
      resultLines.push(formatFirstPipeLine(line, textPrefix));
      return;
    }

    if (!options.insertBrBetweenLines || line.trim() !== "") {
      resultLines.push(formatSubsequentPipeLine(line, pipeMarkerPrefix));
    }
  });

  return {
    text: resultLines.join("\n"),
    lineCount: normalizedLines.length,
  };
}

function normalizePastedLines(text: string, options: IndentOptions): string[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length <= 1) {
    return [stripLeadingIndent(lines[0] ?? "")];
  }

  const minIndentLength = getCommonIndentLength(lines, options.tabSize);
  return lines.map(line => stripIndentColumns(line, minIndentLength, options));
}

function getCommonIndentLength(lines: string[], tabSize: number): number {
  let minIndentLength = Infinity;

  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }

    minIndentLength = Math.min(minIndentLength, getIndentLength(line, tabSize));
  }

  return minIndentLength === Infinity ? 0 : minIndentLength;
}

function getIndentLength(line: string, tabSize: number): number {
  let indentLength = 0;
  for (const char of line) {
    if (char === " ") {
      indentLength++;
    } else if (char === "\t") {
      indentLength += tabSize;
    } else {
      break;
    }
  }
  return indentLength;
}

function stripIndentColumns(line: string, columnsToStrip: number, options: IndentOptions): string {
  if (line.trim() === "") {
    return "";
  }

  let strippedColumns = 0;
  let contentStart = 0;
  for (let index = 0; index < line.length && strippedColumns < columnsToStrip; index++) {
    const char = line[index];
    if (char === " ") {
      strippedColumns++;
      contentStart = index + 1;
    } else if (char === "\t") {
      strippedColumns += options.tabSize;
      contentStart = index + 1;
    } else {
      break;
    }
  }

  const overshotColumns = Math.max(0, strippedColumns - columnsToStrip);
  return makeIndent(overshotColumns, options) + line.substring(contentStart);
}

function stripLeadingIndent(line: string): string {
  return line.replace(/^[\t ]+/, "");
}

function makeIndent(columns: number, options: IndentOptions): string {
  if (columns <= 0) {
    return "";
  }

  if (options.insertSpaces) {
    return " ".repeat(columns);
  }

  return "\t".repeat(Math.floor(columns / options.tabSize)) + " ".repeat(columns % options.tabSize);
}

function formatFirstPipeLine(line: string, textPrefix: string): string {
  return line === "" ? "" : `${textPrefix}${line}`;
}

function formatSubsequentPipeLine(line: string, pipeMarkerPrefix: string): string {
  return line === "" ? pipeMarkerPrefix : `${pipeMarkerPrefix} ${line}`;
}
