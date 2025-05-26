import * as vscode from 'vscode';

export async function findTodosInWorkspace(getTodoOutputChannel: () => vscode.OutputChannel) {
    getTodoOutputChannel().clear();
    getTodoOutputChannel().show(true);
    getTodoOutputChannel().appendLine('Searching for TODOs and FIXMEs in workspace .pug files...');

    const pugFiles = await vscode.workspace.findFiles('**/*.pug', '**/node_modules/**');
    const allPugFiles = [...pugFiles];

    if (allPugFiles.length === 0) {
        getTodoOutputChannel().appendLine('No .pug files found in the workspace.');
        return;
    }

    let totalTodos = 0;
    const todoRegex = /(?:\/\/\-\s*(TODO|FIXME)|\/\/\s*(TODO|FIXME)):(.*)/gi;

    for (const fileUri of allPugFiles) {
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
}
