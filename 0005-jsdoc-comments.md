# Plan 0005: Code Quality - JSDoc Documentation

## Objective
Add JSDoc comments to undocumented functions across the codebase.

## Current State
- Some files have comprehensive JSDoc
- Many utility functions lack documentation
- Consistency varies across modules

## Implementation Strategy

### Phase 1: Identify Targets
Search for undocumented exports:
```bash
# Find functions without JSDoc
grep -r "export function" api/ | head -50
```

### Phase 2: Prioritize
Focus on:
1. Public API functions (api/index.js exports)
2. Core orchestrator functions
3. Task module functions
4. Utility functions used widely

### Phase 3: Document
Add JSDoc for each function:
```javascript
/**
 * Short description.
 * @param {string} paramName - Parameter description.
 * @returns {Promise<Object>} Return description.
 * @throws {Error} When something fails.
 */
async function myFunction(paramName) { }
```

## Target Modules
| Module | Functions | Priority |
|--------|-----------|----------|
| api/core/ | Orchestrator, SessionManager | High |
| api/utils/ | Various utilities | Medium |
| api/actions/ | Action functions | Medium |
| tasks/ | Task entry points | Low |
| api/agent/ | AI agent methods | Medium |

## JSDoc Best Practices
- Start with verb (e.g., "Creates", "Retrieves")
- Document all parameters with types
- Document return value
- Document thrown errors
- Use @example when helpful

## Files to Modify
- All files with undocumented functions

## Success Criteria
- All public API functions documented
- Consistent JSDoc style
- Docs generate without errors

## Estimated Effort
- Medium (~3-5 hours)
- Can be done incrementally

## Dependencies
- JSDoc (already in package.json)
- Documentation generation: `pnpm docs`

## Notes
- Don't over-document private/internal functions
- Keep descriptions concise
- Focus on "why" not "what"
