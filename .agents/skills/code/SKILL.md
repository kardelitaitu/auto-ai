---
name: code
description: |
    Use for codebase inspection, implementation, refactoring, debugging, and test
    updates in Auto-AI. Triggers when the task involves reading, changing, or
    validating repository code.
license: MIT
metadata:
    author: Auto-AI Framework
    version: '1.0.0'
---

# Code Skill

Use this skill when a task requires working directly on code in this repository.
It is optimized for concise inspection, safe edits, and validation.

## When To Use

- Locate or understand code paths before editing.
- Implement a feature or fix a bug.
- Refactor code without changing behavior.
- Add or update tests.
- Verify behavior with linting or test runs.

## Working Rules

- Prefer `rg` for searches and small, targeted reads for context.
- Use `apply_patch` for edits.
- Keep changes scoped to the request.
- Preserve existing repo conventions unless the task requires a change.
- Run lint and relevant tests after code changes when practical.

## Suggested Workflow

1. Identify the entry points and related modules.
2. Inspect the smallest set of files needed.
3. Make the edit with minimal surface area.
4. Validate with lint or tests.
5. Record the change in `AGENT-JOURNAL.md` when applicable.

## Output Standard

State what changed, where it changed, and whether validation passed. Mention any
known follow-up risk if the change is partial or unverified.
