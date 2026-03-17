import sys
import re
import os

def parse_coverage_table(lines):
    # Find start of table
    start = None
    for i, line in enumerate(lines):
        if 'File' in line and '% Stmts' in line:
            start = i
            break
    if start is None:
        return []
    # Skip header and separator
    data_lines = lines[start+2:]
    results = []
    dir_stack = []  # list of (depth, dirname)
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
        # Determine depth based on leading spaces (assuming each level adds 2 spaces)
        depth = leading_spaces // 2
        # If filepath contains a dot, it's a file
        if '.' in filepath:
            # It's a file: build full path from dir_stack
            # Ensure dir_stack length matches depth
            while len(dir_stack) > depth:
                dir_stack.pop()
            full_path = '/'.join(dir_stack + [filepath])
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
            # Adjust dir_stack to depth
            while len(dir_stack) >= depth:
                dir_stack.pop()
            dir_stack.append(filepath)
    return results

def main():
    with open(r'C:\Users\Dika\.local\share\opencode\tool-output\tool_ced953cdf001Fhn45pvSXASmEp', 'r') as f:
        lines = f.readlines()
    results = parse_coverage_table(lines)
    # Sort by min coverage ascending
    results.sort(key=lambda x: x[5])
    # Print all results
    print('All files with coverage <50%:')
    for full_path, stmts, branch, funcs, lines_cov, min_cov in results:
        print(f'{full_path}: Stmts={stmts:.2f}, Branch={branch:.2f}, Funcs={funcs:.2f}, Lines={lines_cov:.2f}, Min={min_cov:.2f}')

if __name__ == '__main__':
    main()
