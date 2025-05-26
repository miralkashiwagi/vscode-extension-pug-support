# Pug Support - Advanced for VS Code

This extension provides comprehensive, professional-grade language support for Pug (formerly Jade) files in Visual Studio Code. Inspired by the powerful features found in JetBrains IDEs' Pug plugins, this extension aims to bring a similar level of advanced functionality and developer experience to VS Code users working with Pug.

## ✨ Key Features (Currently Implemented)

This extension offers a rich set of features to enhance your Pug development workflow:

### 🎨 Enhanced Language Support
*   **Advanced Syntax Highlighting**: Accurate and detailed syntax highlighting for both `.pug` files, including robust support for interpolations.
*   **Intelligent Code Completion**: Context-aware autocompletion for Pug keywords, HTML tags, CSS class names (based on project files), and defined mixins.
*   **Rich Hover Information**: Display detailed documentation and examples for Pug constructs on hover.
*   **Smart Snippets**: A collection of useful code snippets for common Pug patterns and HTML structures, accelerating development (16 built-in snippets).

### 🧭 Advanced Navigation & Structure
*   **Go to Definition (F12)**:
    *   **Mixins**: Seamlessly jump to mixin definitions, **even if they are located in files included via `include` directives or in parent templates via `extends`**.
    *   **Includes & Extends**: Quickly navigate to included or extended Pug files.
*   **Find All References (Shift+F12)**: Locate all usages of mixins and references to specific Pug files across your workspace.
*   **Document Outline (Ctrl+Shift+O)**: View a structured outline of the current Pug file, showing mixins, blocks, and included files for quick navigation.
*   **Workspace Symbol Search (Ctrl+T)**: Find Pug-specific symbols (like mixins) across your entire project.
*   **Document Highlights**: Automatic highlighting of related symbols (e.g., all instances of a selected mixin).
*   **Code Folding**: Collapse and expand mixins, blocks, conditional statements, and large HTML tag structures for better readability.

### 💡 Intelligent Assistance & Basic Validation
*   **Signature Help**: Displays parameter information for mixin calls, helping you understand the expected arguments.
*   **Indentation Validation**: Detects and warns about inconsistent indentation (e.g., mixed tabs and spaces).

### 🔄 Professional Refactoring Tools
*   **Symbol Renaming (F2)**: Intelligently rename mixins across your entire workspace, updating all call sites.
*   **File Path Updates**: Automatically updates `include` and `extends` paths when Pug files are moved or renamed within the VS Code explorer.

### 📁 Workspace & Project Management
*   **File Watcher**: Monitors Pug files for changes (e.g., new mixin definitions, file renames) and updates its internal understanding of the project to keep features like "Go to Definition" accurate.
*   **Dependency Tracking**: The extension analyzes `include` and `extends` to understand file relationships.

### 💄 Formatting
*   **Document Formatting**: Integrates with Prettier (if installed and configured with `@prettier/plugin-pug`) to format Pug documents according to your Prettier configuration (`Shift+Alt+F` or context menu).

### 🛠️ Advanced Features
*   **Paste Provider**: Enhanced paste functionality with automatic Pug formatting and pipe syntax handling.
*   **Mixin Indexer**: Workspace-wide mixin indexing for fast symbol resolution.

### 📁 Workspace Management Commands
*   **Find TODOs in Workspace**: Scan all Pug files in the current workspace for `TODO`, `FIXME`, or similar comment tags.
*   **List File Dependencies**: Display the files that the current Pug file includes or extends.
*   **Create Pug File from Template**: Quickly scaffold new Pug files using predefined templates.

## 🚧 Planned Features (Future Implementation)

The following features are planned for future releases:

### 💡 Advanced Validation & Analysis
*   **Real-time Validation**: Enhanced syntax checking using official `pug-lexer` and `pug-parser` for more accurate error reporting.
*   **Path Validation**: Validates file paths used in `include` and `extends` directives, warning about non-existent files.
*   **Mixin Analysis**: Identifies undefined mixin calls and potentially unused mixin definitions.
*   **Code Actions & Quick Fixes**: Provides suggestions and automatic fixes for common issues (e.g., undefined mixins, indentation problems).

### 🔄 Enhanced Refactoring
*   **Extract to Mixin/File**: Refactor selected Pug code into a new mixin or a separate file.

## 🚀 Installation

1.  Open Visual Studio Code.
2.  Go to the Extensions view (Ctrl+Shift+X).
3.  Search for "Pug Support - Advanced".
4.  Click "Install".

Alternatively, for development or testing:
1.  Clone this repository: `git clone https://github.com/your-username/vscode-extension-pug.git` (Replace with actual URL if different)
2.  Navigate to the cloned directory: `cd vscode-extension-pug/pug-support`
3.  Install dependencies: `npm install`
4.  Open the `pug-support` folder in VS Code.
5.  Press `F5` to launch the Extension Development Host with the extension loaded.

## 📖 Usage Guide

Once installed, the extension automatically activates when you open a `.pug` file.

*   **Navigation**: Use `F12` (Go to Definition), `Shift+F12` (Find All References), `Ctrl+Shift+O` (Document Outline), and `Ctrl+T` (Workspace Symbols).
*   **Intelligent Assistance**: Autocompletion will trigger as you type. Hover over Pug elements for more information. Signature help appears when you type `(` after a mixin name.
*   **Formatting**: Right-click in a Pug file and select "Format Document" or use the shortcut `Shift+Alt+F`.

## 🎛️ Available Commands

Access these commands via the Command Palette (Ctrl+Shift+P):

*   **Format Document** (`Shift+Alt+F` or right-click menu): Formats the current Pug document using Prettier.
*   **Find TODOs in Workspace**: Scans all Pug files for TODO/FIXME comments.
*   **List File Dependencies**: Shows includes/extends for the current file.
*   **Create Pug File from Template**: Creates a new Pug file from a predefined template.

## 🔧 Configuration

The extension generally respects your global VS Code editor settings for:
*   **Tab Size**
*   **Insert Spaces**

For document formatting, it relies on your project's Prettier configuration if Prettier and `@prettier/plugin-pug` are set up.

## 📋 Code Snippets

The extension includes 16 snippets for common Pug/HTML patterns. Start typing common keywords (e.g., `html5`, `mixin`, `if`, `each`, `include`, `block`, `form`, `table`, `a`, `img`) to see available snippets.

## 🐛 Known Issues & Limitations

*   **Complex Project Structures**: Path resolution for `include`/`extends` in very complex or unusually structured projects might have edge cases.
*   **Performance**: For extremely large projects with thousands of Pug files, some features like workspace-wide symbol searching or reference finding might experience slight delays. Continuous optimizations are planned.
*   **Advanced Validation**: Some advanced validation features (real-time syntax checking, path validation, mixin analysis) are implemented but not yet integrated into the main extension and will be available in future releases.

## 🏗️ Architecture

This extension is built using:
*   **TypeScript**: For type-safe development and leveraging the full VS Code API.
*   **VS Code API**: Native integration with editor features like language services, commands, and UI elements.
*   **`pug-lexer`**: The official Pug lexical analyzer for tokenizing Pug source code.
*   **`pug-parser`**: The official Pug parser for generating Abstract Syntax Trees (AST) and performing structural analysis.

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details (if one exists, otherwise assume MIT).

## 🙏 Acknowledgments

*   Inspired by the excellent Pug support in **JetBrains IDEs** (like WebStorm, IntelliJ IDEA).
*   Relies heavily on the official **`pug-lexer`** and **`pug-parser`** libraries from the Pug.js team.
*   Thanks to the **VS Code team** for their powerful extension APIs and comprehensive documentation.