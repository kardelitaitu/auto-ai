import os
import re

# =================CONFIGURATION=================
# Files/Folders to strictly ignore (add your own)
IGNORE_DIRS = {
    'node_modules', '.git', 'dist', 'build', 'coverage', 
    '.next', '.vscode', '__pycache__', '.aider.tags.cache.v4', '.qodo'
}
IGNORE_FILES = {
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 
    '.DS_Store', '.env', '.env.local', '.aider.chat.history.md', '.aider.input.history', '.gitignore', '.llmignore'
}

# Extensions to analyze
CODE_EXTENSIONS = {'.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'}

# Max signatures to list per file (prevent context explosion)
MAX_SIGNATURES = 10 
# ===============================================

def get_signatures(file_path):
    """
    Scans a JS/TS file and extracts broad signatures.
    """
    sigs = []
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
            # 1. Class Definitions
            # Matches: class MyClass, class MyClass extends Parent
            classes = re.findall(r'class\s+(\w+)', content)
            for c in classes:
                sigs.append(f"Class: {c}")

            # 2. Standard Functions (including async)
            # Matches: function myFunc, async function myFunc
            funcs = re.findall(r'(?:async\s+)?function\s+(\w+)\s*\(', content)
            for f in funcs:
                sigs.append(f"ƒ: {f}")

            # 3. Arrow Functions & Consts
            # Matches: const myFunc = (...) =>, const myFunc = async (...) =>
            arrows = re.findall(r'(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(.*?\)\s*=>', content)
            for a in arrows:
                sigs.append(f"ƒ: {a}")

            # 4. CommonJS Exports (Node.js specific)
            # Matches: exports.myFunc =, module.exports.myFunc =
            exports = re.findall(r'(?:module\.)?exports\.(\w+)\s*=', content)
            for e in exports:
                sigs.append(f"Export: {e}")

            # 5. Interfaces (TypeScript)
            interfaces = re.findall(r'interface\s+(\w+)', content)
            for i in interfaces:
                sigs.append(f"Interface: {i}")

    except Exception:
        return []
    
    # Remove duplicates while preserving order
    unique_sigs = list(dict.fromkeys(sigs))
    
    if len(unique_sigs) > MAX_SIGNATURES:
        return unique_sigs[:MAX_SIGNATURES] + [f"...(+{len(unique_sigs)-MAX_SIGNATURES} more)"]
    
    return unique_sigs

def generate_map(start_path):
    output_lines = []
    
    for root, dirs, files in os.walk(start_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        
        level = root.replace(start_path, '').count(os.sep)
        indent = ' ' * 4 * level
        folder_name = os.path.basename(root)
        
        # Add folder to map
        if level == 0:
            output_lines.append(f"📁 PROJECT_ROOT/")
        else:
            output_lines.append(f"{indent}📁 {folder_name}/")
        
        subindent = ' ' * 4 * (level + 1)
        
        for f in files:
            if f in IGNORE_FILES:
                continue
            
            ext = os.path.splitext(f)[1]
            file_path = os.path.join(root, f)
            
            if ext in CODE_EXTENSIONS:
                sigs = get_signatures(file_path)
                if sigs:
                    # Join nicely: "file.ts [Class: User, ƒ: login, ƒ: logout]"
                    sig_str = ", ".join(sigs)
                    output_lines.append(f"{subindent}📄 {f}  [{sig_str}]")
                else:
                    output_lines.append(f"{subindent}📄 {f}")
            else:
                output_lines.append(f"{subindent}📄 {f}")

    return "\n".join(output_lines)

if __name__ == "__main__":
    current_dir = os.getcwd()
    print(f"Scanning: {current_dir}")
    print("Generating extended map (v2)...")
    
    codebase_map = generate_map(current_dir)
    
    with open("codebase_map_v2.txt", "w", encoding="utf-8") as f:
        f.write(codebase_map)
        
    print("✅ Done! Map saved to 'codebase_map_v2.txt'")
    print(f"Total tokens (est): {len(codebase_map)//4}")