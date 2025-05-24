// src/pug-parser.d.ts
declare module 'pug-parser' {
    export interface PugLocation {
        line: number; // 1-based
        column: number; // 1-based
    }

    export interface PugBaseNode {
        type: string;
        line: number; 
        column: number;
        filename?: string;
    }

    // Forward declaration for the PugNode union type
    export type PugNode = 
        | PugBlockNode 
        | PugMixinNode 
        | PugTagNode 
        | PugTextNode 
        | PugCommentNode 
        | PugConditionalNode 
        | PugEachNode
        | PugCaseNode
        // | PugWhenNode // Usually nested inside CaseNode's block
        | PugCodeNode
        | PugFilterNode
        | PugDoctypeNode
        | PugIncludeNode
        | PugExtendsNode
        | PugAttributeNode;
        // Add other specific node types as needed for comprehensive typing.

    export interface PugBlockNode extends PugBaseNode {
        type: 'Block';
        nodes: PugNode[];
    }

    export interface PugMixinNode extends PugBaseNode {
        type: 'Mixin';
        name: string;
        call: boolean; // true if a mixin call, false if a definition
        args: string | null;
        block: PugBlockNode; // Mixin definitions usually have a block
        attrs: PugAttributeNode[]; // Mixins can have attributes
    }

    export interface PugTagNode extends PugBaseNode {
        type: 'Tag';
        name: string;
        selfClosing: boolean;
        block: PugBlockNode;
        attrs: PugAttributeNode[];
        attributeBlocks: PugNode[]; // For :attributes syntax
        isInline: boolean;
    }

    export interface PugTextNode extends PugBaseNode {
        type: 'Text' | 'PipelessText'; // PipelessText for text under a tag without | 
        val: string;
    }

    export interface PugCommentNode extends PugBaseNode {
        type: 'Comment';
        val: string;
        buffer: boolean; // true for buffered comments (e.g., //)
    }

    export interface PugConditionalNode extends PugBaseNode {
        type: 'Conditional';
        test: string;
        consequent: PugBlockNode | null;
        alternate: PugBlockNode | null;
    }

    export interface PugEachNode extends PugBaseNode {
        type: 'Each' | 'EachOf'; // 'EachOf' for 'for..of' loops
        obj: string;
        val: string;
        key: string | null;
        block: PugBlockNode;
        alternate?: PugBlockNode | null; // Pug >2.0 specific
    }

    export interface PugCaseNode extends PugBaseNode {
        type: 'Case';
        expr: string;
        block: PugBlockNode; // This block contains WhenNodes
    }

    export interface PugWhenNode extends PugBaseNode { // Not directly in PugNode union as it's nested
        type: 'When';
        expr: string; // 'default' for default case
        block: PugBlockNode;
    }

    export interface PugCodeNode extends PugBaseNode {
        type: 'Code';
        val: string;
        buffer: boolean; // Output the result of evaluation
        mustEscape: boolean;
    }
    
    export interface PugFilterNode extends PugBaseNode {
        type: 'Filter';
        name: string;
        block: PugBlockNode; // Contains TextNode(s)
        attrs: PugAttributeNode[];
    }

    export interface PugDoctypeNode extends PugBaseNode {
        type: 'Doctype';
        val: string | null;
    }

    export interface PugFileReference {
        type: 'FileReference';
        path: string;
        line: number;
        column: number;
    }

    export interface PugIncludeNode extends PugBaseNode {
        type: 'Include';
        file: PugFileReference;
        block: PugBlockNode; // For filters on includes, etc.
    }

    export interface PugExtendsNode extends PugBaseNode {
        type: 'Extends';
        file: PugFileReference;
    }

    export interface PugAttributeNode extends PugBaseNode { // Simplified, can be more complex
        type: 'Attribute'; // This type might not exist; attributes are often directly on TagNode
        name: string;
        val: string | boolean; // e.g. checked or name='value'
        mustEscape: boolean;
    }

    export interface ParserOptions {
        filename?: string;
        src?: string; 
        [key: string]: any;
    }

    export interface Token {
        type: string;
        loc: {
            start: { line: number; column: number };
            end: { line: number; column: number };
        };
        val?: any;
        mustEscape?: boolean;
    }

    export function parse(tokens: Token[], options?: ParserOptions): PugBlockNode;

    // Export top-level types with original casing for compatibility if needed
    export type Node = PugNode;
    export type Mixin = PugMixinNode;
    export type Block = PugBlockNode;
}
