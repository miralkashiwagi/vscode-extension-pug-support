# Pug Support for VS Code

This extension provides enhanced language support for Pug (formerly Jade) files in Visual Studio Code. It aims to bring features found in other IDEs, such as the JetBrains Pug/Jade plugin, to the VS Code environment.

## Features

Currently, the following features are implemented:

*   **Syntax Highlighting**: Accurate syntax highlighting for both `.pug` and `.jade` files.
*   **Indentation Validation**: Detects and warns about mixed tabs and spaces in indentation, helping maintain consistent code style.
*   **Document Formatting**: Format your Pug/Jade files using Prettier and the `@prettier/plugin-pug` plugin.
    *   To use: Right-click in a Pug/Jade file and select "Format Document" or use the shortcut (e.g., `Shift+Alt+F` on Windows, `Shift+Option+F` on macOS).
*   **Code Completion**:
    *   Basic auto-completion for common Pug keywords (e.g., `if`, `else`, `each`, `mixin`, `block`, `extends`, `include`).
    *   Basic auto-completion for standard HTML tags.
*   **Hover Information**: Get quick information about Pug keywords when you hover over them.
*   **Definition Provider**: Jump to definition for `include` paths, `extends` paths, and `mixin` calls. Supports jumping to mixin definitions within the same file or in files included via the `include` directive.
*   **TODO Indexing**: Finds and lists `TODO`/`FIXME` comments in Pug/Jade files. Use the command `Pug/Jade: Find TODOs in Workspace`.

## Installation

*(Instructions for installation will be added once the extension is ready for packaging or publishing. For now, if running from source, ensure all dependencies are installed by running `npm install` in the `pug-support` directory.)*

## Usage

*   **Formatting**: Open a `.pug` or `.jade` file, right-click and select "Format Document".
*   **Indentation Warnings**: Errors regarding mixed tabs and spaces will appear in the "Problems" panel.
*   **Completion**: Start typing Pug keywords or HTML tags, and suggestions will appear.
*   **Hover**: Mouse over Pug keywords to see a brief description.
*   **Go to Definition**: Place your cursor on an `include` path, `extends` path, or a `mixin` name and press `F12` (or right-click and select "Go to Definition").

## Known Issues & Limitations

*   Mixin definition jumping to mixins in **extended** files (via `extends`) is not yet supported. (Jumping to mixins in files included via the `include` directive is supported).
*   Complex project structures with deeply nested includes/extends might have limitations in path resolution for definition jumping.

## Future Work

The following features are planned for future releases, drawing inspiration from the JetBrains IDE Jade/Pug plugin:

*   **File Dependency Management**: Tracking dependencies between Pug files (e.g., for build tools or advanced navigation).
*   **Template Support**: Enhanced support for working with Pug as a templating engine, potentially including live previews or integration with template data.
*   **More comprehensive code completion**: Including attributes, mixin parameters, etc.

## Contributing

*(Contribution guidelines will be added later.)*

## License

*(License information will be added later.)*