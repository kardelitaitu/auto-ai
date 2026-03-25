# Code Skill - Examples

> **Practical examples for code analysis, generation, and refactoring.**

## Table of Contents

- [Code Structure Analysis](#code-structure-analysis)
- [Code Generation](#code-generation)
- [Pattern Detection](#pattern-detection)
- [Code Metrics](#code-metrics)
- [Refactoring](#refactoring)
- [Documentation Generation](#documentation-generation)

---

## Code Structure Analysis

### JavaScript Structure Extraction

```javascript
// Example: Extract JavaScript code structure
async function analyzeJavaScriptStructure(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    const lines = content.split('\n');
    
    const structure = {
        file: filePath,
        imports: [],
        exports: [],
        functions: [],
        classes: [],
        constants: [],
        variables: [],
        comments: []
    };
    
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        const lineNum = index + 1;
        
        // Import statements
        if (trimmed.startsWith('import ')) {
            const match = trimmed.match(/import\s+(?:(.+?)\s+from\s+)?['"](.+)['"]/);
            if (match) {
                structure.imports.push({
                    specifier: match[1] || 'default',
                    module: match[2],
                    line: lineNum
                });
            }
        }
        
        // Export statements
        if (trimmed.startsWith('export ')) {
            structure.exports.push({
                type: trimmed.includes('default') ? 'default' : 'named',
                declaration: trimmed.substring(7, 60),
                line: lineNum
            });
        }
        
        // Function declarations
        if (trimmed.match(/^(async\s+)?function\s+\w+/)) {
            const match = trimmed.match(/^(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
            structure.functions.push({
                name: match[2],
                async: !!match[1],
                params: match[3].split(',').map(p => p.trim()).filter(p => p),
                line: lineNum
            });
        }
        
        // Arrow functions (const name = async () =>)
        if (trimmed.match(/^(const|let|var)\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*=>/)) {
            const match = trimmed.match(/^(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*=>/);
            structure.functions.push({
                name: match[2],
                async: !!match[3],
                type: 'arrow',
                params: match[4].split(',').map(p => p.trim()).filter(p => p),
                line: lineNum
            });
        }
        
        // Class declarations
        if (trimmed.match(/^class\s+\w+/)) {
            const match = trimmed.match(/^class\s+(\w+)(?:\s+extends\s+(\w+))?/);
            structure.classes.push({
                name: match[1],
                extends: match[2] || null,
                line: lineNum
            });
        }
        
        // Constants (UPPER_CASE)
        if (trimmed.match(/^export\s+)?const\s+[A-Z_]+/)) {
            const match = trimmed.match(/const\s+([A-Z_]+)/);
            if (match) {
                structure.constants.push({
                    name: match[1],
                    line: lineNum
                });
            }
        }
    });
    
    return {
        ...structure,
        summary: {
            imports: structure.imports.length,
            exports: structure.exports.length,
            functions: structure.functions.length,
            classes: structure.classes.length,
            constants: structure.constants.length,
            totalLines: lines.length
        }
    };
}

// Usage
const jsStructure = await analyzeJavaScriptStructure('/project/src/index.js');
console.log('Summary:', jsStructure.summary);
```

---

## Code Generation

### Function Generator

```javascript
// Example: Generate function from specification
function generateFunction(spec) {
    const {
        name,
        params = [],
        returnType = 'void',
        body = [],
        async = false,
        exportType = null,
        jsdoc = true
    } = spec;
    
    const lines = [];
    
    // JSDoc
    if (jsdoc) {
        lines.push('/**');
        lines.push(` * ${name} function`);
        params.forEach(p => {
            const [paramName, paramType = 'any'] = p.split(':');
            lines.push(` * @param {${paramType}} ${paramName.trim()}`);
        });
        if (returnType !== 'void') {
            lines.push(` * @returns {${returnType}}`);
        }
        lines.push(' */');
    }
    
    // Export modifier
    let prefix = '';
    if (exportType === 'default') prefix = 'export default ';
    else if (exportType === 'named') prefix = 'export ';
    
    // Function signature
    const asyncPrefix = async ? 'async ' : '';
    const paramsStr = params.map(p => p.split(':')[0].trim()).join(', ');
    
    lines.push(`${prefix}${asyncPrefix}function ${name}(${paramsStr}) {`);
    
    // Body
    body.forEach(line => {
        lines.push(`    ${line}`);
    });
    
    // Default return
    if (returnType !== 'void' && body.length === 0) {
        lines.push('    // TODO: Implement function');
        lines.push(`    return null;`);
    }
    
    lines.push('}');
    
    return lines.join('\n');
}

// Usage
const func = generateFunction({
    name: 'calculateTotal',
    params: ['items: Item[]', 'taxRate: number'],
    returnType: 'number',
    body: [
        'const subtotal = items.reduce((sum, item) => sum + item.price, 0);',
        'const tax = subtotal * taxRate;',
        'return subtotal + tax;'
    ],
    async: false,
    exportType: 'named',
    jsdoc: true
});

console.log(func);
```

### Class Generator

```javascript
// Example: Generate class from specification
function generateClass(spec) {
    const {
        name,
        extends: parent = null,
        implements: interfaces = [],
        properties = [],
        methods = [],
        exportType = 'named'
    } = spec;
    
    const lines = [];
    
    // Export
    let classLine = exportType === 'default' ? 'export default class ' : 'export class ';
    classLine += name;
    
    if (parent) classLine += ` extends ${parent}`;
    if (interfaces.length > 0) classLine += ` implements ${interfaces.join(', ')}`;
    
    lines.push(classLine + ' {');
    
    // Properties
    properties.forEach(prop => {
        const visibility = prop.private ? 'private' : prop.protected ? 'protected' : 'public';
        const staticStr = prop.static ? 'static ' : '';
        const readonly = prop.readonly ? 'readonly ' : '';
        const type = prop.type ? `: ${prop.type}` : '';
        const defaultVal = prop.default !== undefined ? ` = ${JSON.stringify(prop.default)}` : '';
        
        lines.push(`    ${visibility} ${staticStr}${readonly}${prop.name}${type}${defaultVal};`);
    });
    
    // Constructor
    const constructorProps = properties.filter(p => p.constructor);
    if (constructorProps.length > 0 || methods.some(m => m.name === 'constructor')) {
        const ctor = methods.find(m => m.name === 'constructor');
        const params = constructorProps.map(p => {
            const vis = p.private ? 'private' : 'public';
            return `${vis} ${p.name}: ${p.type || 'any'}`;
        });
        
        lines.push('');
        lines.push(`    constructor(${params.join(', ')}) {`);
        if (parent) lines.push('        super();');
        constructorProps.forEach(p => {
            lines.push(`        this.${p.name} = ${p.name};`);
        });
        lines.push('    }');
    }
    
    // Methods
    methods.filter(m => m.name !== 'constructor').forEach(method => {
        const visibility = method.private ? 'private' : method.protected ? 'protected' : 'public';
        const staticStr = method.static ? 'static ' : '';
        const asyncStr = method.async ? 'async ' : '';
        const returnType = method.returnType ? `: ${method.returnType}` : '';
        const params = (method.params || []).join(', ');
        
        lines.push('');
        lines.push(`    ${visibility} ${staticStr}${asyncStr}${method.name}(${params})${returnType} {`);
        lines.push('        // TODO: Implement method');
        if (method.returnType && method.returnType !== 'void') {
            lines.push('        return null;');
        }
        lines.push('    }');
    });
    
    lines.push('}');
    
    return lines.join('\n');
}

// Usage
const classCode = generateClass({
    name: 'UserService',
    extends: 'BaseService',
    properties: [
        { name: 'repository', type: 'Repository', private: true },
        { name: 'cache', type: 'Cache', private: true }
    ],
    methods: [
        { name: 'findById', params: ['id: string'], returnType: 'User', async: true },
        { name: 'create', params: ['data: CreateUserDto'], returnType: 'User', async: true }
    ]
});

console.log(classCode);
```

---

## Pattern Detection

### Anti-Pattern Detection

```javascript
// Example: Detect code anti-patterns
async function detectAntiPatterns(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    const lines = content.split('\n');
    
    const patterns = [
        {
            name: 'God Function',
            description: 'Function that does too many things',
            detect: (line, index, allLines) => {
                if (line.match(/^(async\s+)?function\s+\w+/)) {
                    // Count lines until next function or end
                    let count = 0;
                    let braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
                    for (let i = index + 1; i < allLines.length && braceCount > 0; i++) {
                        braceCount += (allLines[i].match(/{/g) || []).length - (allLines[i].match(/}/g) || []).length;
                        count++;
                    }
                    return count > 50;
                }
                return false;
            }
        },
        {
            name: 'Deep Nesting',
            description: 'Code nested more than 4 levels deep',
            detect: (line) => {
                const indent = line.search(/\S/);
                return indent > 16; // 4 levels * 4 spaces
            }
        },
        {
            name: 'Magic Number',
            description: 'Hardcoded numeric literals',
            detect: (line) => {
                return line.match(/[^a-zA-Z_]\d{2,}[^a-zA-Z_]/) && 
                       !line.match(/const|let|var.*=\s*\d/) &&
                       !line.match(/\/\/.*\d/);
            }
        },
        {
            name: 'Long Parameter List',
            description: 'Function with more than 4 parameters',
            detect: (line) => {
                const match = line.match(/function\s+\w+\s*\(([^)]+)\)/);
                if (match && match[1]) {
                    return match[1].split(',').length > 4;
                }
                return false;
            }
        },
        {
            name: 'Empty Catch',
            description: 'Catch block that ignores errors',
            detect: (line, index, allLines) => {
                if (line.includes('catch')) {
                    const nextLine = allLines[index + 1]?.trim();
                    return nextLine === '{}' || nextLine === '{ }';
                }
                return false;
            }
        },
        {
            name: 'Console.log',
            description: 'Debug console statements',
            detect: (line) => {
                return line.match(/console\.(log|debug|info)\(/);
            }
        },
        {
            name: 'TODO/FIXME',
            description: 'Unfinished TODO comments',
            detect: (line) => {
                return line.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/i);
            }
        }
    ];
    
    const findings = [];
    
    lines.forEach((line, index) => {
        for (const pattern of patterns) {
            if (pattern.detect(line, index, lines)) {
                findings.push({
                    pattern: pattern.name,
                    description: pattern.description,
                    line: index + 1,
                    content: line.trim()
                });
            }
        }
    });
    
    return {
        file: filePath,
        totalFindings: findings.length,
        byPattern: findings.reduce((acc, f) => {
            acc[f.pattern] = (acc[f.pattern] || 0) + 1;
            return acc;
        }, {}),
        findings
    };
}

// Usage
const antiPatterns = await detectAntiPatterns('/project/src/app.js');
console.log('Anti-patterns found:', antiPatterns.byPattern);
```

---

## Code Metrics

### Complexity Calculator

```javascript
// Example: Calculate code complexity metrics
async function calculateCodeMetrics(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    const lines = content.split('\n');
    
    const metrics = {
        file: filePath,
        lines: {
            total: lines.length,
            code: 0,
            comments: 0,
            blank: 0
        },
        functions: [],
        classes: [],
        complexity: 0
    };
    
    let currentFunction = null;
    let braceCount = 0;
    let functionStart = 0;
    
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Line classification
        if (!trimmed || trimmed === '') {
            metrics.lines.blank++;
        } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            metrics.lines.comments++;
        } else {
            metrics.lines.code++;
        }
        
        // Track braces
        braceCount += (trimmed.match(/{/g) || []).length;
        braceCount -= (trimmed.match(/}/g) || []).length;
        
        // Function detection
        const funcMatch = trimmed.match(/^(async\s+)?function\s+(\w+)/);
        if (funcMatch) {
            if (currentFunction) {
                currentFunction.lines = index - functionStart;
                metrics.functions.push(currentFunction);
            }
            currentFunction = {
                name: funcMatch[2],
                async: !!funcMatch[1],
                startLine: index + 1,
                lines: 0,
                complexity: 1
            };
            functionStart = index;
        }
        
        // Track complexity in current function
        if (currentFunction) {
            // Count decision points
            if (trimmed.match(/\b(if|else if|while|for|switch|case|\?|&&|\|\|)\b/)) {
                currentFunction.complexity++;
                metrics.complexity++;
            }
        }
        
        // End of function
        if (currentFunction && braceCount === 0 && trimmed === '}') {
            currentFunction.lines = index - functionStart + 1;
            metrics.functions.push(currentFunction);
            currentFunction = null;
        }
    });
    
    // Summary
    metrics.summary = {
        linesOfCode: metrics.lines.code,
        commentRatio: ((metrics.lines.comments / metrics.lines.total) * 100).toFixed(1) + '%',
        functionCount: metrics.functions.length,
        averageFunctionLength: metrics.functions.length > 0
            ? Math.round(metrics.functions.reduce((sum, f) => sum + f.lines, 0) / metrics.functions.length)
            : 0,
        averageComplexity: metrics.functions.length > 0
            ? (metrics.functions.reduce((sum, f) => sum + f.complexity, 0) / metrics.functions.length).toFixed(1)
            : 0,
        maxComplexity: Math.max(...metrics.functions.map(f => f.complexity), 0)
    };
    
    return metrics;
}

// Usage
const metrics = await calculateCodeMetrics('/project/src/app.js');
console.log('Metrics:', metrics.summary);
```

---

## Refactoring

### Extract Function

```javascript
// Example: Extract code into a function
async function extractFunction(filePath, startLine, endLine, newFunctionName) {
    const content = await Desktop_Commander_read_file(filePath);
    const lines = content.split('\n');
    
    // Get the code block
    const codeBlock = lines.slice(startLine - 1, endLine);
    const indent = codeBlock[0].search(/\S/);
    const dedentedCode = codeBlock.map(line => line.substring(indent));
    
    // Analyze variables used in the block
    const variables = analyzeVariables(dedentedCode.join('\n'));
    
    // Generate new function
    const params = variables.used.filter(v => !variables.declared.includes(v));
    const newFunction = `function ${newFunctionName}(${params.join(', ')}) {\n    ${dedentedCode.join('\n    ')}\n}`;
    
    // Replace original code with function call
    const functionCall = `    ${newFunctionName}(${params.join(', ')});`;
    
    // Build new file content
    const before = lines.slice(0, startLine - 1);
    const after = lines.slice(endLine);
    
    // Find where to insert new function (before last export or at end)
    let insertIndex = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('export')) {
            insertIndex = i + 1;
            break;
        }
    }
    
    const newLines = [
        ...before,
        functionCall,
        ...after.slice(0, insertIndex - endLine),
        '',
        newFunction,
        ...after.slice(insertIndex - endLine)
    ];
    
    return {
        original: codeBlock.join('\n'),
        extracted: newFunction,
        call: functionCall,
        newContent: newLines.join('\n')
    };
}

function analyzeVariables(code) {
    // Simplified variable analysis
    const used = (code.match(/\b[a-zA-Z_]\w*\b/g) || [])
        .filter(v => !['if', 'else', 'for', 'while', 'return', 'const', 'let', 'var', 'function', 'true', 'false', 'null', 'undefined'].includes(v));
    const declared = (code.match(/(?:const|let|var)\s+(\w+)/g) || [])
        .map(m => m.split(/\s+/)[1]);
    
    return { used: [...new Set(used)], declared: [...new Set(declared)] };
}

// Usage
const result = await extractFunction('/project/src/app.js', 10, 25, 'processUserData');
console.log('Extracted function:', result.extracted);
```

---

## Documentation Generation

### JSDoc Generator

```javascript
// Example: Generate JSDoc documentation
async function generateJSDoc(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    const lines = content.split('\n');
    
    const docs = [];
    
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Function detection
        const funcMatch = trimmed.match(/^(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
        if (funcMatch) {
            const [, exported, async, name, params] = funcMatch;
            const paramList = params.split(',').map(p => p.trim()).filter(p => p);
            
            docs.push({
                type: 'function',
                name,
                async: !!async,
                exported: !!exported,
                params: paramList,
                line: index + 1,
                signature: trimmed
            });
        }
        
        // Class detection
        const classMatch = trimmed.match(/^export\s+)?class\s+(\w+)/);
        if (classMatch) {
            docs.push({
                type: 'class',
                name: classMatch[1],
                line: index + 1,
                signature: trimmed
            });
        }
    });
    
    // Generate markdown
    const markdown = ['# API Documentation', '', `Generated from: ${filePath}`, ''];
    
    docs.forEach(doc => {
        if (doc.type === 'function') {
            markdown.push(`## ${doc.name}`);
            markdown.push('');
            markdown.push(`\`\`\`javascript`);
            markdown.push(doc.signature);
            markdown.push(`\`\`\``);
            markdown.push('');
            if (doc.params.length > 0) {
                markdown.push('**Parameters:**');
                doc.params.forEach(p => {
                    markdown.push(`- \`${p}\``);
                });
                markdown.push('');
            }
            markdown.push('---');
            markdown.push('');
        }
    });
    
    return {
        documentation: markdown.join('\n'),
        items: docs
    };
}

// Usage
const docs = await generateJSDoc('/project/src/utils.js');
console.log(docs.documentation);
```

---

## Best Practices

1. **Analyze before modifying** - Understand the code structure first
2. **Use meaningful names** - Generate descriptive variable and function names
3. **Keep functions small** - Aim for single responsibility
4. **Document as you go** - Generate documentation alongside code
5. **Follow conventions** - Match existing code style
6. **Test generated code** - Verify generated code works correctly

---

## Related Documentation

- [SKILL.md](./SKILL.md) - Main skill documentation
- [README.md](./README.md) - Skill overview and API reference
