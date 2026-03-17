import sys
import os
import glob

def parse_coverage_table(lines):
    start = None
    for i, line in enumerate(lines):
        if 'File' in line and '% Stmts' in line:
            start = i
            break
    if start is None:
        return []
    data_lines = lines[start+2:]
    results = []
    current_dir = None
    for line in data_lines:
        if not line.strip():
            continue
        parts = line.split('|')
        if len(parts) < 5:
            continue
        first = parts[0]
        # Count leading spaces
        stripped = first.lstrip()
        leading_spaces = len(first) - len(stripped)
        filepath = stripped.strip()
        # Determine if file or directory: contains dot?
        if '.' in filepath:
            # It's a file
            # If leading_spaces == 2, it's under current_dir
            if leading_spaces != 2:
                # maybe deeper, but we assume 2
                pass
            # Build full path relative to project root
            if current_dir is None:
                full_path = filepath
            else:
                full_path = current_dir + '/' + filepath
            # Extract percentages
            try:
                stmts = float(parts[1].strip())
                branch = float(parts[2].strip())
                funcs = float(parts[3].strip())
                lines_cov = float(parts[4].strip())
            except ValueError:
                continue
            min_cov = min(stmts, branch, funcs, lines_cov)
            if min_cov < 50:
                results.append((full_path, stmts, branch, funcs, lines_cov, min_cov))
        else:
            # It's a directory
            current_dir = filepath
            # Reset current_dir if it's root? We'll keep as is.
    return results

def resolve_truncated(full_path, project_root):
    # If full_path contains ellipsis, we need to find the actual file
    # Example: api/agent/...ply-engine.js -> api/agent/ai-reply-engine.js
    # Split into directory and filename
    dir_part, filename = os.path.split(full_path)
    if '...' in filename:
        # Find suffix after ellipsis
        suffix = filename.split('...', 1)[1]
        # Search in that directory for files ending with suffix
        search_dir = os.path.join(project_root, dir_part.replace('/', os.sep))
        matches = glob.glob(os.path.join(search_dir, '*' + suffix))
        if matches:
            # Pick first match, get relative path
            match = matches[0]
            rel = os.path.relpath(match, project_root).replace(os.sep, '/')
            return rel
        else:
            # Not found, return original
            return full_path
    else:
        return full_path

def is_barrel_export(file_path, project_root):
    # Check if file is an index.js that only re-exports
    if not file_path.endswith('index.js'):
        return False
    full = os.path.join(project_root, file_path.replace('/', os.sep))
    if not os.path.exists(full):
        return False
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    # Simple heuristic: if file contains only export statements and maybe imports
    lines = [line.strip() for line in content.split('\n') if line.strip() and not line.strip().startswith('//')]
    # Count lines that are not export/import
    non_export = []
    for line in lines:
        if line.startswith('export') or line.startswith('import'):
            continue
        non_export.append(line)
    # If there are very few non-export lines (maybe just a comment), treat as barrel
    # Also check if there are any function/class definitions
    if len(non_export) <= 2:  # allow maybe a 'use strict' or something
        # Also ensure there is at least one export
        if any(line.startswith('export') for line in lines):
            return True
    return False

def is_browser_context(file_path, project_root):
    # Check if file contains addInitScript callback pattern
    full = os.path.join(project_root, file_path.replace('/', os.sep))
    if not os.path.exists(full):
        return False
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    # Look for addInitScript usage
    if 'addInitScript' in content:
        # Could be a callback, but might also be the caller.
        # We'll consider it browser context if the file is small and likely a utility.
        # For simplicity, we'll assume any file that mentions addInitScript is browser context.
        return True
    return False

def main():
    project_root = r'C:\My Script\auto-ai'
    with open(r'C:\Users\Dika\.local\share\opencode\tool-output\tool_ced953cdf001Fhn45pvSXASmEp', 'r') as f:
        lines = f.readlines()
    raw_results = parse_coverage_table(lines)
    # Resolve truncated names
    resolved = []
    for full_path, stmts, branch, funcs, lines_cov, min_cov in raw_results:
        resolved_path = resolve_truncated(full_path, project_root)
        resolved.append((resolved_path, stmts, branch, funcs, lines_cov, min_cov))
    # Filter out barrel exports and browser context
    filtered = []
    for full_path, stmts, branch, funcs, lines_cov, min_cov in resolved:
        if is_barrel_export(full_path, project_root):
            print(f'Barrel export skipped: {full_path}')
            continue
        if is_browser_context(full_path, project_root):
            print(f'Browser context skipped: {full_path}')
            continue
        filtered.append((full_path, stmts, branch, funcs, lines_cov, min_cov))
    # Sort by min coverage ascending
    filtered.sort(key=lambda x: x[5])
    # Print top 10
    print('\nTop 10 files to improve (excluding barrel exports and browser context):')
    for i, (full_path, stmts, branch, funcs, lines_cov, min_cov) in enumerate(filtered[:10], 1):
        print(f'{i}. {full_path}')
        print(f'   Stmts: {stmts:.2f}%, Branch: {branch:.2f}%, Funcs: {funcs:.2f}%, Lines: {lines_cov:.2f}%')
    # Also print total count
    print(f'\nTotal candidate files: {len(filtered)}')

if __name__ == '__main__':
    main()
