import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Pugファイルのパスを解決するための共通ユーティリティ
 * @param includePath 解決するパス
 * @param currentFilePath 現在のファイルのパス
 * @returns 解決されたファイルURI（見つからない場合はundefined）
 */
export async function resolvePugPath(includePath: string, currentFilePath: string): Promise<vscode.Uri | undefined> {
    const dirPath = path.dirname(currentFilePath);
    const pathsToTry: string[] = [];
    
    if (includePath.startsWith('/')) {
        // 絶対パス - ワークスペースルートからの解決
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const pathWithoutLeadingSlash = includePath.substring(1);
            pathsToTry.push(
                path.resolve(workspaceRoot, pathWithoutLeadingSlash),
                path.resolve(workspaceRoot, pathWithoutLeadingSlash + '.pug'),
                // 一般的なPugプロジェクト構造のための'app'プレフィックスも試す
                path.resolve(workspaceRoot, 'app', pathWithoutLeadingSlash),
                path.resolve(workspaceRoot, 'app', pathWithoutLeadingSlash + '.pug')
            );
        }
    } else {
        // 相対パス - 現在のディレクトリからの解決
        const resolvedPath = path.resolve(dirPath, includePath);
        pathsToTry.push(
            resolvedPath,
            resolvedPath + '.pug',
            // ワークスペースルートから相対的に試す（利用可能な場合）
            ...(vscode.workspace.workspaceFolders ? [
                path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, includePath),
                path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, includePath + '.pug')
            ] : [])
        );
    }
    
    for (const pathToTry of pathsToTry) {
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(pathToTry));
            if (stat.type === vscode.FileType.File) {
                return vscode.Uri.file(pathToTry);
            }
        } catch {
            // 次のパスへ継続
        }
    }
    
    return undefined;
}

/**
 * 指定されたドキュメント内のincludeディレクティブを解析し、
 * 含まれるすべてのファイルのURIを返します
 */
export async function getIncludedFiles(document: vscode.TextDocument): Promise<vscode.Uri[]> {

    const includedFiles: vscode.Uri[] = [];
    const text = document.getText();
    // 改行やその他の文字が混入しないよう、パス部分のみを正確に抽出するパターンに修正
    const includeRegex = /^\s*include\s+(['"]?)([^'"\r\n]+)\1|^\s*include\s+([^\s\r\n]+)/gm;
    let match: RegExpExecArray | null;
    
    while ((match = includeRegex.exec(text)) !== null) {
        const includePath = match[2] || match[3]; // 引用符付きパスまたは引用符なしパス

        const resolvedUri = await resolvePugPath(includePath, document.uri.fsPath);
        if (resolvedUri) {

            includedFiles.push(resolvedUri);
        } else {

        }
    }
    

    return includedFiles;
}

/**
 * 指定されたドキュメント内のextendsディレクティブを解析し、
 * 継承しているすべてのファイルのURIを返します
 */
export async function getExtendedFiles(document: vscode.TextDocument): Promise<vscode.Uri[]> {

    const extendedFiles: vscode.Uri[] = [];
    const text = document.getText();
    // 改行やその他の文字が混入しないよう、パス部分のみを正確に抽出するパターンに修正
    const extendsRegex = /^\s*extends\s+(['"]?)([^'"\r\n]+)\1|^\s*extends\s+([^\s\r\n]+)/gm;
    let match: RegExpExecArray | null;
    
    while ((match = extendsRegex.exec(text)) !== null) {
        const extendedPath = match[2] || match[3]; // 引用符付きパスまたは引用符なしパス

        const resolvedUri = await resolvePugPath(extendedPath, document.uri.fsPath);
        if (resolvedUri) {

            extendedFiles.push(resolvedUri);
        } else {

        }
    }
    

    return extendedFiles;
}

/**
 * 指定されたドキュメント内のincludeとextendsディレクティブを解析し、
 * 参照されているすべてのファイルのURIを返します
 */
export async function getAllReferencedFiles(document: vscode.TextDocument): Promise<vscode.Uri[]> {

    const includes = await getIncludedFiles(document);
    const extends_ = await getExtendedFiles(document);
    
    // 重複を排除した配列を返す
    const allFiles = [...includes];
    for (const file of extends_) {
        if (!allFiles.some(f => f.fsPath === file.fsPath)) {
            allFiles.push(file);
        }
    }
    


    
    return allFiles;
}
