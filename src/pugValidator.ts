// Simple Pug validator without external dependencies
export interface PugValidationDiagnostic {
    line: number;
    column: number;
    length: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
}

export class PugValidator {
    public validateDocument(text: string): PugValidationDiagnostic[] {
        const diagnostics: PugValidationDiagnostic[] = [];
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for mixed indentation
            this.checkIndentation(line, i, diagnostics);
            
            // Check for common syntax issues
            this.checkSyntax(line, i, diagnostics);
            
            // Check for unused mixins (basic)
            this.checkMixins(line, i, diagnostics);
        }

        return diagnostics;
    }

    private checkIndentation(line: string, lineNumber: number, diagnostics: PugValidationDiagnostic[]): void {
        const leadingWhitespace = line.match(/^[\s]*/)?.[0] || '';
        
        if (leadingWhitespace.includes(' ') && leadingWhitespace.includes('\t')) {
            diagnostics.push({
                line: lineNumber,
                column: 0,
                length: leadingWhitespace.length,
                message: 'Mixed tabs and spaces in indentation',
                severity: 'error'
            });
        }
    }

    private checkSyntax(line: string, lineNumber: number, diagnostics: PugValidationDiagnostic[]): void {
        // Check for missing closing parentheses
        const openParens = (line.match(/\(/g) || []).length;
        const closeParens = (line.match(/\)/g) || []).length;
        
        if (openParens > closeParens) {
            diagnostics.push({
                line: lineNumber,
                column: line.length - 1,
                length: 1,
                message: 'Missing closing parenthesis',
                severity: 'error'
            });
        }

        // Check for unquoted attribute values (suggestion)
        const unquotedAttr = line.match(/\w+\s*=\s*[^"'\s)]+(?=[\s)])/);
        if (unquotedAttr) {
            const index = line.indexOf(unquotedAttr[0]);
            diagnostics.push({
                line: lineNumber,
                column: index,
                length: unquotedAttr[0].length,
                message: 'Consider using quoted attribute values',
                severity: 'info'
            });
        }
    }

    private checkMixins(line: string, lineNumber: number, diagnostics: PugValidationDiagnostic[]): void {
        // Check for mixin call syntax
        const mixinCall = line.match(/^\s*\+(\w+)/);
        if (mixinCall) {
            // This is a basic check - in a full implementation, 
            // you'd track mixin definitions across the entire file
            const mixinName = mixinCall[1];
            if (mixinName.length < 2) {
                diagnostics.push({
                    line: lineNumber,
                    column: line.indexOf('+'),
                    length: mixinName.length + 1,
                    message: 'Mixin name too short',
                    severity: 'warning'
                });
            }
        }
    }
} 