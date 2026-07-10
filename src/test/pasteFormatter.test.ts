import * as assert from "assert";
import { formatPipePaste, getPipePasteContext, hasMultipleLogicalLines } from "../pasteFormatter";

describe("pasteFormatter", () => {
  it("formats multiline pipe paste after a bare pipe", () => {
    const result = formatPipePaste("AAA\nBBB\nCCC", {
      textBeforeCursorOnLine: "  |",
      tabSize: 4,
      insertSpaces: true,
    });

    assert.strictEqual(result?.text, " AAA\n  | BBB\n  | CCC");
  });

  it("formats multiline pipe paste after a pipe and space", () => {
    const result = formatPipePaste("AAA\nBBB\nCCC", {
      textBeforeCursorOnLine: "  | ",
      tabSize: 4,
      insertSpaces: true,
    });

    assert.strictEqual(result?.text, "AAA\n  | BBB\n  | CCC");
  });

  it("keeps blank lines as empty pipe lines", () => {
    const result = formatPipePaste("AAA\n\nCCC", {
      textBeforeCursorOnLine: "  | ",
      tabSize: 4,
      insertSpaces: true,
    });

    assert.strictEqual(result?.text, "AAA\n  |\n  | CCC");
  });

  it("normalizes CRLF and CR line endings", () => {
    const crlfResult = formatPipePaste("AAA\r\nBBB", {
      textBeforeCursorOnLine: "  | ",
      tabSize: 4,
      insertSpaces: true,
    });
    const crResult = formatPipePaste("AAA\rBBB", {
      textBeforeCursorOnLine: "  | ",
      tabSize: 4,
      insertSpaces: true,
    });

    assert.strictEqual(crlfResult?.text, "AAA\n  | BBB");
    assert.strictEqual(crResult?.text, "AAA\n  | BBB");
  });

  it("removes common source indentation while preserving relative indentation", () => {
    const result = formatPipePaste("    AAA\n      BBB\n    CCC", {
      textBeforeCursorOnLine: "  | ",
      tabSize: 4,
      insertSpaces: true,
    });

    assert.strictEqual(result?.text, "AAA\n  |   BBB\n  | CCC");
  });

  it("can insert br lines between pasted lines", () => {
    const result = formatPipePaste("AAA\n\nCCC", {
      textBeforeCursorOnLine: "  | ",
      tabSize: 4,
      insertSpaces: true,
      insertBrBetweenLines: true,
    });

    assert.strictEqual(result?.text, "AAA\n  br\n  br\n  | CCC");
  });

  it("does not format outside pipe context", () => {
    assert.strictEqual(getPipePasteContext("  p text"), undefined);
    assert.strictEqual(formatPipePaste("AAA\nBBB", {
      textBeforeCursorOnLine: "  p text",
      tabSize: 4,
      insertSpaces: true,
    }), undefined);
  });

  it("detects multiple logical lines across line ending styles", () => {
    assert.strictEqual(hasMultipleLogicalLines("AAA"), false);
    assert.strictEqual(hasMultipleLogicalLines("AAA\nBBB"), true);
    assert.strictEqual(hasMultipleLogicalLines("AAA\r\nBBB"), true);
    assert.strictEqual(hasMultipleLogicalLines("AAA\rBBB"), true);
  });
});
