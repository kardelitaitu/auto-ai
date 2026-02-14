import subprocess
import json
import os
import datetime
import sys

# --- CONFIGURATION ---
LOG_FILE = "logs.txt"
# ---------------------

def write_log(content, mode='a'):
    """Helper to safely write to the log file."""
    try:
        with open(LOG_FILE, mode, encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"❌ CRITICAL: Could not write to logs.txt: {e}")

def main():
    print(f"🚀 Starting Scan... (Writing to {LOG_FILE})")
    
    # 1. Initialize Log
    write_log(f"--- ESLINT DEBUG REPORT ---\n", 'w')
    write_log(f"Generated: {datetime.datetime.now().strftime('%H:%M:%S')}\n")
    write_log(f"---------------------------\n\n")

    try:
        # 2. Check location
        cwd = os.getcwd()
        print(f"📂 Working Directory: {cwd}")
        write_log(f"Run Location: {cwd}\n")

        # 3. Construct Command
        # On Windows, sometimes 'npx' needs 'npx.cmd'
        command = "npx eslint . --quiet --format=json"
        if os.name == 'nt': # Windows check
            command = "npx.cmd eslint . --quiet --format=json"

        print(f"⚡ Executing: {command}")
        write_log(f"Command: {command}\n\n")

        # 4. Run Subprocess (With explicit error catching)
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            encoding='utf-8', # Force UTF-8 to avoid Windows cp1252 errors
            errors='replace'  # Don't crash on emoji/weird characters
        )

        print(f"📋 Return Code: {result.returncode}")
        
        # 5. Analyze Output
        stdout_len = len(result.stdout)
        stderr_len = len(result.stderr)
        print(f"📊 Output Size: {stdout_len} chars")

        if stderr_len > 0:
            print("⚠️ STDERR detected (Check logs.txt)")
            write_log(f"--- STDERR (Errors from ESLint) ---\n{result.stderr}\n\n")

        if stdout_len == 0:
            print("❌ STDOUT is empty. ESLint produced no output.")
            write_log("ERROR: ESLint returned empty output. Is ESLint installed?\n")
            return

        # 6. Parse JSON
        print("🧩 Parsing JSON...")
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            print("❌ JSON Decode Failed.")
            write_log("CRITICAL ERROR: ESLint output was not valid JSON.\n")
            write_log(f"First 500 chars of raw output:\n{result.stdout[:500]}\n")
            return

        # 7. Write Results
        problem_files = [item for item in data if item['errorCount'] > 0]
        problem_files.sort(key=lambda x: x['errorCount'], reverse=True)
        
        print(f"📝 Found {len(problem_files)} broken files. Writing details...")
        
        write_log(f"Found {len(problem_files)} files with errors.\n")

        for entry in problem_files:
            path = entry.get('filePath', 'unknown')
            # Try to make path relative
            try: 
                path = os.path.relpath(path)
            except: 
                pass

            error_count = entry['errorCount']
            write_log(f"\n{'='*40}\n📄 {path} ({error_count} errors)\n{'='*40}\n")
            
            for msg in entry.get('messages', []):
                line = msg.get('line', 0)
                rule = msg.get('ruleId', 'unknown')
                text = msg.get('message', '').replace('\n', ' ')
                write_log(f"  ❌ Line {line}: [{rule}] {text}\n")

        print("✅ DONE. Check logs.txt now.")

    except Exception as e:
        print(f"🔥 PYTHON CRASHED: {e}")
        write_log(f"\n🔥 CRITICAL SCRIPT CRASH: {e}\n")

if __name__ == "__main__":
    main()