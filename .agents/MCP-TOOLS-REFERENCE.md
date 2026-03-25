# MCP Tools Usage Guidelines

Quick reference for all available MCP tools when working on the Auto-AI codebase.

> **Project Context**: Auto-AI is a browser automation framework using Playwright CDP, with API modules in `api/`, agent logic in `api/agent/`, and configuration in `config/`.

## Quick Reference by Use Case

| Task | Primary Tools |
|------|---------------|
| Find a file | `filesystem_list_directory`, `filesystem_search_files`, or `glob` |
| Search code patterns | `grep` or `context-mode_ctx_batch_execute` |
| Read file contents | `filesystem_read_text_file` or `filesystem_read_multiple_files` |
| Edit source files | `filesystem_edit_file` (surgical) or `filesystem_write_file` (full rewrite) |
| Run tests/commands | `bash` for quick commands, `context-mode_ctx_execute` for large output |
| Research a topic | `Tavily_tavily-search` or `Tavily_tavily-research` |
| Extract URL content | `Tavily_tavily-extract` or `webfetch` |
| Explore site structure | `Tavily_tavily-map` or `Tavily_tavily-crawl` |
| Quick URL lookup | `webfetch` |
| Store knowledge | `Memory_create_entities`, `Memory_create_relations` |
| Complex problem solving | `Sequential_Thinking_sequentialthinking` |
| Context protection | `context-mode_ctx_batch_execute`, `context-mode_ctx_stats` |
| Code analysis | `tree-sitter` for AST parsing |

---

## Tool Categories

### Context Protection (context-mode)

**context-mode** - Context window protection via indexing and sandbox:

- `context-mode_ctx_execute` - Execute code with automatic indexing
- `context-mode_ctx_batch_execute` - Batch multiple commands, index all output
- `context-mode_ctx_search` - Search indexed content
- `context-mode_ctx_index` - Index documentation/knowledge
- `context-mode_ctx_stats` - Session statistics and context savings
- `context-mode_ctx_doctor` - Diagnostic health check

> **Project Tip**: Use `ctx_batch_execute` for running multiple commands that produce large output. Raw data stays in sandbox - only indexed summaries enter context.

### Code Exploration

**filesystem** - Direct file operations:

- `filesystem_read_text_file` - Read file with optional head/tail for large files
- `filesystem_read_multiple_files` - Read several files in parallel
- `filesystem_list_directory` - List directory contents with depth control
- `filesystem_directory_tree` - Get recursive JSON tree view
- `filesystem_get_file_info` - Metadata: size, dates, permissions, line count
- `filesystem_search_files` - Recursively search for files by pattern
- `filesystem_edit_file` - Surgical line-based edits
- `filesystem_write_file` - Full file write/rewrite
- `filesystem_move_file` - Move or rename files
- `filesystem_create_directory` - Create directories

**Built-in tools** - Quick file operations:

- `glob` - Fast file pattern matching (e.g., `glob(pattern: "**/*.js")`)
- `grep` - Fast content search (e.g., `grep(pattern: "api\\.", path: "src/")`)

> **Project Tip**: Prefer `filesystem_*` tools for file operations. Use `glob` and `grep` for quick searches.

---

### Editing & Writing

**filesystem_edit_file** - Surgical line-based edits (preferred for code changes):

```javascript
// Replace a specific function
filesystem_edit_file(path: "api/agent/gameRunner.js", 
  edits: [{oldText: "async run() { ... }", newText: "async run() { /* improved */ }"}])
```

**filesystem_write_file** - Full file write/rewrite:

- Use for new files or complete rewrites
- Chunk files >30 lines for reliability

> **Project Tip**: After edits, run `npx eslint .` to verify code style. Check AGENTS.md Workflow Reminder for required steps.

---

### Thinking & Memory

**Sequential Thinking** - Multi-step reasoning for complex problems:

- Use for: debugging race conditions, planning architecture, complex refactors
- Note: May be disabled if LLM endpoints are unresponsive

**Memory** - Knowledge graph for persistent context:

- `Memory_create_entities` - Store new facts/entities
- `Memory_create_relations` - Create relationships between entities
- `Memory_add_observations` - Update existing entities with new info
- `Memory_search_nodes` - Find stored knowledge
- `Memory_read_graph` - Read entire knowledge graph
- `Memory_open_nodes` - Open specific entities by name
- `Memory_delete_entities` - Remove entities and relations
- `Memory_delete_observations` - Remove specific observations
- `Memory_delete_relations` - Remove relations

> **Project Tip**: Store key decisions like "persona system uses 16 profiles" or "AsyncLocalStorage required for context isolation".

---

### Documentation & Research

**Tavily** - Deep research (complex queries):

- `Tavily_tavily-search` - AI-powered comprehensive search with ranked results
- `Tavily_tavily-extract` - Parse content from specific URLs
- `Tavily_tavily-crawl` - Deep crawl starting from a URL, exploring related pages
- `Tavily_tavily-map` - Map site structure from a URL, understanding navigation
- `Tavily_tavily-research` - Comprehensive multi-source research for in-depth analysis

**Usage Examples:**
```bash
# Search for information
Tavily_tavily-search(query: "playwright features", search_depth: "advanced", max_results: 5)

# Extract content from specific pages
Tavily_tavily-extract(urls: ["https://playwright.dev/docs"], extract_depth: "advanced")

# Crawl site for related content
Tavily_tavily-crawl(url: "https://example.com/blog", max_depth: 3, limit: 50)

# Map website structure
Tavily_tavily-map(url: "https://example.com", max_depth: 2)

# Deep research on complex topic
Tavily_tavily-research(input: "Compare Playwright vs Puppeteer for browser automation")
```

**Built-in webfetch** - Quick URL content:

- `webfetch` - Get URL as markdown/text/html

> **Project Tip**: Use `Tavily_tavily-search` for most research. Use `Tavily_tavily-research` for comprehensive analysis. For quick URL lookups, use `webfetch`.

---

### Code Analysis

**tree-sitter** - Code structure analysis:

- Parse JavaScript, TypeScript, Python, and other languages
- Extract function definitions, class structures, imports/exports
- Find code patterns using AST queries
- Analyze code complexity and dependencies

**Usage Patterns:**
- **Code refactoring**: Identify all usages of a function before renaming
- **Architecture analysis**: Map module dependencies and exports
- **Code review**: Detect potential issues like deep nesting or large functions
- **Documentation**: Auto-generate API docs from code structure

> **Project Tip**: Use tree-sitter for complex code analysis. For simple content searches, use `grep`. tree-sitter provides language-aware parsing.

---

### Bash Commands

**bash** - Quick shell commands:

```bash
# Run tests
npx vitest run --coverage --silent tests/unit/

# Lint check
npx eslint .

# Run main script
node main.js pageview=https://example.com
```

**context-mode ctx_execute** - Execute with context protection:

```bash
# Execute JavaScript with automatic indexing
ctx_execute(language: "javascript", code: "console.log('hello')")

# Execute shell commands with indexing
ctx_execute(language: "shell", code: "git status")
```

> **Project Tip**: Use `bash` for quick commands. Use `ctx_batch_execute` when running multiple commands that produce large output.

---

## Common Workflows

### Debugging a Module

1. Find files: `glob(pattern: "**/gameRunner*")`
2. Search usage: `grep(pattern: "gameRunner\\.", path: "src/")`
3. Read code: `filesystem_read_text_file(path: "path/to/file.js")`
4. Check logs: `bash` with `tail -100 logs/app.log`

### Making Code Changes

1. Read file: `filesystem_read_text_file(path: "file.js")` 
2. Make edit: `filesystem_edit_file(path: "file.js", edits: [{oldText: "...", newText: "..."}])`
3. Verify: `bash` with `npx eslint .`
4. Test: `bash` with `npx vitest run`

### Researching External APIs

1. Deep research: `Tavily_tavily-search(query: "playwright click API", search_depth: "advanced")`
2. Extract content: `Tavily_tavily-extract(urls: ["https://playwright.dev/docs"])`
3. Quick lookup: `webfetch(url: "https://example.com/docs")`

### Batch Command Execution

1. Run multiple commands: `context-mode_ctx_batch_execute(commands: [...], queries: [...])`
2. Search indexed output: `context-mode_ctx_search(queries: ["error", "warning"])`
3. Check context savings: `context-mode_ctx_stats`
