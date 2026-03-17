import sys
import os
import glob
import re

project_root = r'C:\My Script\auto-ai'
coverage_file = r'C:\Users\Dika\.local\share\opencode\tool-output\tool_ced953cdf001Fhn45pvSXASmEp'

def parse_coverage(lines):
    start = None
    for i, line in enumerate(lines):
        if 'File' in line and '% Stmts' in line:
            start = i
            break
    if start is None:
        return []
    data_lines = lines[start+2:]
    entries = []
    current_dir = None
    for line in data_lines:
        if not line.strip():
            continue
        parts = line.split('|')
        if len(parts) < 5:
            continue
        first = parts[0]
        stripped = first.lstrip()
        leading = len(first) - len(stripped)
        filepath = stripped.strip()
        # Determine if directory (no dot) or file (has dot)
        if '.' in filepath:
            # file
            # Determine full path
            if current_dir is None:
                full = filepath
            else:
                full = current_dir + '/' + filepath
            # Resolve ellipsis
            full = resolve_truncated(full)
            try:
                stmts = float(parts[1].strip())
                branch = float(parts[2].strip())
                funcs = float(parts[3].strip())
                lines_cov = float(parts[4].strip())
            except ValueError:
                continue
            min_cov = min(stmts, branch, funcs, lines_cov)
            entries.append((full, stmts, branch, funcs, lines_cov, min_cov))
        else:
            # directory
            current_dir = resolve_truncated(filepath)
    return entries

def resolve_truncated(path):
    # If no ellipsis, return as is
    if '...' not in path:
        return path
    # Split into components
    components = path.split('/')
    resolved = []
    for comp in components:
        if '...' in comp:
            suffix = comp.split('...', 1)[1]
            # Search for matching file/dir in project root
            # We'll search for directories/files ending with suffix
            # Use glob pattern **/*suffix
            pattern = os.path.join(project_root, '**', '*' + suffix)
            matches = glob.glob(pattern, recursive=True)
            # Filter to only directories if comp has no dot? but we don't know
            # For simplicity, pick first match that is a directory (if comp has no dot) or file (if has dot)
            # We'll just pick first match
            if matches:
                # Convert to relative path
                match = matches[0]
                rel = os.path.relpath(match, project_root).replace(os.sep, '/')
                # If comp had no dot and match is a file, maybe not ideal but okay
                resolved.append(rel)
            else:
                # keep original
                resolved.append(comp)
        else:
            resolved.append(comp)
    return '/'.join(resolved)

def is_barrel_export(file_path):
    if not file_path.endswith('index.js'):
        return False
    full = os.path.join(project_root, file_path.replace('/', os.sep))
    if not os.path.exists(full):
        return False
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    lines = [line.strip() for line in content.split('\n') if line.strip() and not line.strip().startswith('//')]
    # Count lines that are not export/import
    non_export = []
    for line in lines:
        if line.startswith('export') or line.startswith('import'):
            continue
        non_export.append(line)
    # If there are very few non-export lines, treat as barrel
    if len(non_export) <= 2:
        if any(line.startswith('export') for line in lines):
            return True
    return False

def is_browser_context(file_path):
    full = os.path.join(project_root, file_path.replace('/', os.sep))
    if not os.path.exists(full):
        return False
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'addInitScript' in content:
        return True
    return False

with open(coverage_file, 'r') as f:
    lines = f.readlines()
entries = parse_coverage(lines)
# Filter
filtered = []
for full, stmts, branch, funcs, lines_cov, min_cov in entries:
    if min_cov >= 50:
        continue
    if is_barrel_export(full):
        print(f'Barrel export: {full}')
        continue
    if is_browser_context(full):
        print(f'Browser context: {full}')
        continue
    filtered.append((full, stmts, branch, funcs, lines_cov, min_cov))
# Sort by min_cov
filtered.sort(key=lambda x: x[5])
print(f'\nTotal low coverage files after filtering: {len(filtered)}')
print('\nTop 10 files to improve:')
for i, (full, stmts, branch, funcs, lines_cov, min_cov) in enumerate(filtered[:10], 1):
    print(f'{i}. {full}')
    print(f'   Stmts: {stmts:.2f}%, Branch: {branch:.2f}%, Funcs: {funcs:.2f}%, Lines: {lines_cov:.2f}%')
