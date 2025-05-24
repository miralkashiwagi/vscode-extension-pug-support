# Pug Support - Advanced for VS Code

This extension provides comprehensive, professional-grade language support for Pug (formerly Jade) files in Visual Studio Code. Inspired by JetBrains IDE features, it brings advanced functionality to VS Code for Pug/Jade development.

## ✨ Key Features

### 🎨 **Enhanced Language Support**
*   **Advanced Syntax Highlighting**: Comprehensive highlighting for both `.pug` and `.jade` files with proper interpolation support
*   **Intelligent Code Completion**: Auto-completion for Pug keywords, HTML tags, CSS classes, and mixins
*   **Rich Hover Information**: Detailed documentation and examples for Pug constructs
*   **Smart Snippets**: 15+ built-in code snippets for rapid development

### 🧭 **Navigation & Structure**
*   **Document Outline**: Browse file structure with Ctrl+Shift+O - see all mixins, blocks, includes
*   **Workspace Symbol Search**: Find symbols across entire project with Ctrl+T
*   **Go to Definition**: Jump to mixin definitions, includes, and extends with F12
*   **Find All References**: Locate all usages of mixins and files with Shift+F12
*   **Document Highlights**: Automatic highlighting of related symbols
*   **Code Folding**: Collapse/expand mixins, blocks, conditionals, and HTML structures

### 💡 **Intelligent Assistance**
*   **Signature Help**: Parameter hints for mixin calls - see parameters while typing
*   **Code Actions**: Quick fixes and refactoring suggestions
*   **Real-time Validation**: Advanced syntax checking with pug-lexer and pug-parser
*   **Smart Refactoring**: Extract to mixin, inline mixin, extract to file

### 🔧 **Advanced Validation & Diagnostics**
*   **Syntax Checking**: Leverages official Pug parser for accurate validation
*   **Indentation Validation**: Detects and warns about mixed tabs and spaces
*   **Mixin Analysis**: Detects undefined mixins and unused mixin definitions
*   **Path Validation**: Validates include/extends file paths
*   **Deprecated Syntax Warnings**: Alerts for outdated patterns
*   **Quick Fixes**: Automatic fixes for common issues

### 🔄 **Professional Refactoring Tools**
*   **Symbol Renaming**: Intelligent rename for mixins across your entire workspace
*   **File Path Updates**: Automatic path updates when files are moved or renamed
*   **Broken Reference Detection**: Warns about broken includes/extends after file deletions
*   **Cross-file Analysis**: Tracks dependencies and relationships between Pug files

### 📁 **Workspace Management**
*   **File Watcher**: Monitors file changes and automatically updates references
*   **Dependency Tracking**: Analyze and visualize file dependencies
*   **Template Creation**: Create new files from predefined templates
*   **TODO Indexing**: Find and list TODO/FIXME comments across your project

### 🎯 **Developer Experience**
*   **Document Formatting**: Integration with Prettier for consistent code style
*   **Context Menus**: Right-click actions for common tasks
*   **Command Palette**: All features accessible via Command Palette

## 🚀 Installation

*(Instructions for installation will be added once the extension is published to the VS Code Marketplace)*

For development/testing:
1. Clone this repository
2. Run `npm install` to install dependencies
3. Open in VS Code and press F5 to launch Extension Development Host

## 📖 Usage Guide

### Navigation & Structure
- **Outline View**: `Ctrl+Shift+O` to see file structure (mixins, blocks, includes)
- **Workspace Symbols**: `Ctrl+T` to search symbols across entire project
- **Go to Definition**: `F12` on include paths, extends paths, or mixin calls
- **Find References**: `Shift+F12` to find all usages of a symbol
- **Code Folding**: Click arrows next to mixins/blocks to collapse content

### Intelligent Assistance
- **Parameter Help**: Type `(` after mixin name to see parameter information
- **Quick Fixes**: Yellow lightbulb icon for automatic fixes
- **Code Actions**: Right-click for refactoring options
- **Symbol Highlighting**: Click on symbol to highlight all related occurrences

### Basic Editing
- Open any `.pug` or `.jade` file to activate the extension
- Enjoy syntax highlighting and IntelliSense automatically
- Type snippets like `html5`, `mixin`, `each`, etc. for quick code generation

### Formatting
- **Format Document**: Right-click → "Format Document" or `Shift+Alt+F` (Windows) / `Shift+Option+F` (macOS)
- Integrates with Prettier and `@prettier/plugin-pug`

### Refactoring
- **Rename Symbol**: Place cursor on a mixin name and press `F2` to rename across all files
- **Extract to Mixin**: Select code and use Quick Actions to extract reusable components
- **Inline Mixin**: Replace mixin calls with their content

### Project Management
- **Create from Template**: Right-click folder → "Create Pug File from Template"
- **Find TODOs**: Command Palette → "Pug: Find TODOs in Workspace"
- **List Dependencies**: Command Palette → "Pug: List File Dependencies"
- **Compile to HTML**: Right-click in editor → "Compile Pug to HTML"

### Advanced Features
- File renaming automatically updates all references
- Broken references are detected and reported
- Real-time validation with detailed error messages
- Comprehensive hover documentation with examples

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+O` | Document Outline/Symbol List |
| `Ctrl+T` | Workspace Symbol Search |
| `F12` | Go to Definition |
| `Shift+F12` | Find All References |
| `F2` | Rename Symbol |
| `Ctrl+.` | Quick Fix/Code Actions |
| `Shift+Alt+F` | Format Document |

## 🎛️ Available Commands

| Command | Description |
|---------|-------------|
| `Pug: Find TODOs in Workspace` | Scans all Pug files for TODO/FIXME comments |
| `Pug: List File Dependencies` | Shows includes/extends for current file |
| `Pug: Create Pug File from Template` | Creates new file from template |
| `Pug: Compile Pug to HTML` | Compiles current file (preview feature) |

## 🔧 Configuration

The extension respects your editor configuration:
- **Tab Size**: Uses your editor's tab size setting
- **Insert Spaces**: Respects your indentation preference
- **Prettier Config**: Uses your project's Prettier configuration

## 📋 Code Snippets

### Template Snippets
- `html5` - Complete HTML5 document structure
- `doctype` - HTML5 doctype declaration
- `form` - Basic form structure
- `table` - Table with headers and body

### Control Flow
- `if` / `ifelse` - Conditional statements
- `each` - Loop iteration
- `case` - Switch/case statements

### Pug Constructs
- `mixin` - Mixin definition with call example
- `include` - File inclusion
- `extends` - Template inheritance
- `block` - Content blocks

### HTML Elements
- `a` - Anchor link
- `img` - Image element
- `script` - Script tag
- `css` - CSS link tag

## 🐛 Known Issues & Limitations

- Some TypeScript configuration issues may appear in development mode
- Complex project structures with deeply nested includes may have path resolution edge cases
- HTML compilation feature is currently a preview (shows compilation status only)

## 🛣️ Roadmap

- **Live Preview**: Real-time HTML preview pane
- **Enhanced IntelliSense**: Variable and function completion from data
- **Project-wide Analysis**: Advanced dependency graphs and circular dependency detection
- **Template Gallery**: More built-in templates and customizable templates
- **Integration**: Better integration with build tools (Webpack, Gulp, etc.)
- **Performance**: Optimizations for large projects with many files

## 🏗️ Architecture

This extension is built with:
- **pug-lexer**: Official Pug lexical analyzer for token parsing
- **pug-parser**: Official Pug parser for AST generation and analysis
- **TypeScript**: Type-safe development with comprehensive VS Code API usage
- **VS Code API**: Native integration with all editor features

## 🤝 Contributing

Contributions are welcome! Please see our contributing guidelines for details on:
- Setting up the development environment
- Code style and conventions
- Testing procedures
- Pull request process

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by JetBrains IDE Pug/Jade plugin functionality
- Built on the official Pug lexer and parser libraries
- Thanks to the VS Code team for excellent extension APIs
- Special thanks to the Pug.js team for maintaining the language