# MCP Tools Usage Guidelines

Quick reference for all available MCP tools when working on the Auto-AI codebase.

> **Project Context**: Auto-AI is a browser automation framework using Playwright CDP, with API modules in `api/`, agent logic in `api/agent/`, and configuration in `config/`.

## Quick Reference by Use Case

| Task | Primary Tools |
|------|---------------|
| Find a file | `code-index_find_files` or `filesystem_list_directory` |
| Search code patterns | `code-index_search_code_advanced` |
| Read file contents | `filesystem_read_text_file` or `filesystem_read_multiple_files` |
| Edit source files | `filesystem_edit_file` (surgical) or `filesystem_write_file` (full rewrite) |
| Run tests/commands | `bash` for quick commands, `Desktop_Commander_start_process` for REPLs |
| Research documentation | `Tavily_tavily-search` + `Tavily_tavily-extract` |
| Quick URL lookup | `DuckDuckGo_Search_Server_search` |
| Understand file structure | `File_Context_Server_generate_outline` or `code-index_get_file_summary` |
| Complex problem solving | `Sequential_Thinking_sequentialthinking` |
| Learn SDK patterns | `context7_resolve-library-id` + `context7_query-docs` |

---

## Tool Categories

### Code Exploration

**code-index** - Fast codebase search and analysis:

- `code-index_find_files` - Find files by glob pattern (e.g., `*.test.js`, `agent*.js`)
- `code-index_search_code_advanced` - Search code with regex, fuzzy matching, file filtering
- `code-index_get_file_summary` - Get line count, functions, imports, complexity metrics

**filesystem** - Direct file operations:

- `filesystem_read_text_file` - Read file with optional head/tail for large files
- `filesystem_read_multiple_files` - Read several files in parallel
- `filesystem_list_directory` - List directory contents with depth control
- `filesystem_directory_tree` - Get recursive JSON tree view
- `filesystem_get_file_info` - Metadata: size, dates, permissions, line count

**File Context Server** - Advanced context management:

- `File_Context_Server_read_context` - Read files with chunking for large codebases
- `File_Context_Server_generate_outline` - Extract classes, functions, imports from files

> **Project Tip**: For `api/` modules, use `code-index_search_code_advanced` with pattern `api\.` to find all API method usages.

---

### Editing & Writing

**filesystem_edit_file** - Surgical line-based edits (preferred for code changes):

```javascript
// Replace a specific function
filesystem_edit_file(path: "api/agent/gameRunner.js", 
  oldString: "async run() { ... }",
  newString: "async run() { /* improved */ }")
```

**filesystem_write_file** - Full file write/rewrite:

- Use for new files or complete rewrites
- Supports append mode
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

**context7** (Upstash) - SDK documentation lookup:

- `context7_resolve-library-id` - Resolve package name to ID (e.g., "playwright", "vitest")
- `context7_query-docs` - Get code examples and docs for libraries

**Tavily** - Deep research (complex queries):

- `Tavily_tavily-search` - AI-powered comprehensive search
- `Tavily_tavily-extract` - Parse content from specific URLs

**DuckDuckGo** - Quick fact checking:

- `DuckDuckGo_Search_Server_search` - Quick URL lookups
- `DuckDuckGo_Search_Server_fetch_content` - Read webpage content

**Fetch** - Direct URL content:

- `Fetch_fetch` - Get URL as markdown/text/html

> **Project Tip**: For Playwright API docs, use context7. For debugging MCP tool issues, use DuckDuckGo.

---

### System Operations

**Desktop Commander** - OS-level operations (use with caution):

| Category | Key Tools |
|----------|-----------|
| **File I/O** | `read_file`, `write_file`, `read_multiple_files`, `edit_block` |
| **Directory** | `list_directory`, `create_directory`, `move_file`, `get_file_info` |
| **Process** | `start_process`, `interact_with_process`, `read_process_output`, `kill_process` |
| **Search** | `start_search`, `get_more_search_results`, `stop_search`, `list_searches` |
| **Sessions** | `list_sessions`, `list_processes`, `force_terminate` |
| **Config** | `get_config`, `set_config_value`, `get_usage_stats`, `get_recent_tool_calls` |

> **Project Tip**: Use `start_process` with Python REPL for data analysis tasks. Use `bash` for simple shell commands.

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

> **Project Tip**: For long-running processes, use `Desktop_Commander_start_process` instead to enable interaction.

---

## Common Workflows

### Debugging a Module

1. Find files: `code-index_find_files pattern: "gameRunner*"`
2. Read summary: `code-index_get_file_summary` 
3. Search usage: `code-index_search_code_advanced pattern: "gameRunner\."`
4. Read code: `filesystem_read_text_file` with appropriate path

### Making Code Changes

1. Understand context: `code-index_get_file_summary` for the file
2. Make edit: `filesystem_edit_file` with oldString/newString
3. Verify: `bash` with `npx eslint .`
4. Test: `bash` with `npx vitest run`

### Researching External APIs

1. Resolve library: `context7_resolve-library-id query: "playwright"`
2. Query docs: `context7_query-docs libraryId, query: "page.click"`
3. Alternative: `Tavily_tavily-search query: "playwright click API"`
