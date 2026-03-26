# vLLM Integration Plan for prompt-test.js

## Overview

Modify `prompt-test.js` to use vLLM with `qwen3.5:2b` model and thinking enabled. Configuration will be hardcoded directly in the file (not read from settings.json).

---

## Prerequisites: Start vLLM Server

The vLLM server must be started before running the test script.

### vLLM Server Startup Command

```bash
# Install vLLM (if not already installed)
pip install vllm

# Start vLLM server with Qwen model and thinking enabled
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-1.5B-Instruct \
    --host 0.0.0.0 \
    --port 8000 \
    --enable-thinking \
    --max-model-len 8192
```

**Note:** The model name `qwen3.5:2b` appears to be in Ollama format. For vLLM, use the HuggingFace model ID:

- `Qwen/Qwen2.5-0.5B-Instruct` (0.5B params)
- `Qwen/Qwen2.5-1.5B-Instruct` (1.5B params)
- `Qwen/Qwen2.5-3B-Instruct` (3B params)

If using a GGUF model file, vLLM can load it with `--model /path/to/model.gguf` (vLLM >= 0.4.0).

### Verify Server is Running

```bash
curl http://localhost:8000/health
# Should return: {"status": "ok"}
```

---

## Implementation Plan: prompt-test.js Modifications

### File Location

`C:\My Script\auto-ai\prompt-test.js`

### Change 1: Add vLLM Fetch Utility (After line 97)

Add new function `vllmFetch` after the existing `ollamaFetch` function:

```javascript
// ─── Internal vLLM Fetch Utility ──────────────────────────────────────────
async function vllmFetch(path, body, endpoint) {
    const url = `${endpoint.replace(/\/$/, '')}${path}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`vLLM error (${response.status}): ${errText}`);
    }

    const json = await response.json();

    // Normalize vLLM response to expected format
    const message = json.choices?.[0]?.message;
    const content = message?.content || '';

    // vLLM with --enable-thinking returns thinking in reasoning_content field
    // Qwen models may also use <thinking> tags within content
    let reasoning = message?.reasoning_content || null;

    return {
        choices: [
            {
                message: {
                    content: content,
                    reasoning: reasoning,
                },
            },
        ],
        usage: {
            prompt_tokens: json.usage?.prompt_tokens || 0,
            completion_tokens: json.usage?.completion_tokens || 0,
            total_tokens: json.usage?.total_tokens || 0,
        },
        _raw: json,
    };
}
```

### Change 2: Update getActiveLLM() (Lines 98-132)

Replace the entire function with hardcoded vLLM configuration:

```javascript
async function getActiveLLM() {
    // ─── HARDCODED vLLM CONFIGURATION ──────────────────────────────────
    const endpoint = 'http://localhost:8000/v1';
    const model = 'Qwen/Qwen2.5-1.5B-Instruct';

    return {
        name: 'vLLM',
        model: model,
        endpoint: endpoint,
        thinkingEnabled: true,
        fetch: async (path, body) => vllmFetch(path, body, endpoint),
    };
}
```

### Change 3: Update callLLM() Thinking Parameters (Around line 1001)

Add `chat_template_kwargs` for thinking support:

```javascript
async function callLLM(systemPrompt, userPrompt) {
    const startMs = Date.now();

    const requestBody = {
        model: LLM_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 4096,
        stream: false,
    };

    // Add thinking parameter for vLLM with thinking enabled
    if (activeLLM.thinkingEnabled) {
        requestBody.chat_template_kwargs = {
            enable_thinking: true,
        };
    }

    const data = await activeLLM.fetch('/v1/chat/completions', requestBody);
    // ... rest remains the same
```

### Change 4: Update Thinking Extraction (Around lines 1017-1034)

Add `<thinking>` tag extraction (Qwen format):

```javascript
// Support multiple field names for reasoning output
let reasoning =
    messageObj?.reasoning ||
    messageObj?.thinking ||
    messageObj?.thought ||
    messageObj?.reasoning_content ||
    '';

// Robust <think> extraction (for models that don't use dedicated reasoning field)
if (content.includes('<think>')) {
    const closedMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (closedMatch) {
        reasoning = closedMatch[1] + (reasoning ? '\n' + reasoning : '');
        content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
    } else {
        const openMatch = content.match(/<think>([\s\S]*)/);
        if (openMatch) {
            reasoning = openMatch[1] + (reasoning ? '\n' + reasoning : '');
            content = content.replace(/<think>[\s\S]*/g, '');
        }
    }
}

// Qwen </think> extraction (uses <thinking> tags)
if (content.includes('<thinking>')) {
    const thinkMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
    if (thinkMatch) {
        reasoning = thinkMatch[1] + (reasoning ? '\n' + reasoning : '');
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '');
    }
}
```

### Change 5: Add vLLM Warmup (Around lines 1117-1134)

Replace provider detection for vLLM:

```javascript
console.log(`\nPrompt Test — Provider: ${LLM_PROVIDER || 'unknown'}\n`);

if (LLM_PROVIDER === 'vLLM') {
    const baseUrl = (LLM_ENDPOINT || 'http://localhost:8000/v1')
        .replace(/\/v1$/, '')
        .replace(/\/$/, '');
    console.log(`⏳ Preloading model '${LLM_MODEL}' into VRAM...`);
    try {
        // vLLM warmup - send a simple request to load model
        const warmupResponse = await fetch(`${LLM_ENDPOINT}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: LLM_MODEL,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1,
                temperature: 0,
            }),
        });
        if (warmupResponse.ok) {
            console.log(`✅ Model loaded.`);
        } else {
            console.log(`⚠️ Warmup returned ${warmupResponse.status}`);
        }
    } catch (e) {
        console.error(`⚠️ Failed to preload model: ${e.message}`);
    }
}
```

---

## Changes Summary

| #   | Section             | Location         | Modification                          |
| --- | ------------------- | ---------------- | ------------------------------------- |
| 1   | vllmFetch           | After line 97    | Add new vLLM fetch utility            |
| 2   | getActiveLLM        | Lines 98-132     | Replace with hardcoded vLLM config    |
| 3   | callLLM             | Around line 1001 | Add chat_template_kwargs for thinking |
| 4   | Thinking extraction | Lines 1021-1034  | Add `<thinking>` tag support          |
| 5   | Warmup              | Lines 1119-1134  | Add vLLM provider detection           |

---

## Expected Output Format

When running `node prompt-test.js`:

```
Prompt Test — Provider: vLLM

⏳ Preloading model 'Qwen/Qwen2.5-1.5B-Instruct' into VRAM...
✅ Model loaded.

══════════════════════════════════════════════════════════════════════
  TEST: Tech Thread
══════════════════════════════════════════════════════════════════════

📤 SYSTEM PROMPT:
──────────────────────────────────────────────────────────────────────
[system prompt content]
──────────────────────────────────────────────────────────────────────
   ~500 tokens

📤 USER PROMPT:
──────────────────────────────────────────────────────────────────────
[user prompt content]
──────────────────────────────────────────────────────────────────────
   ~800 tokens

📊 TOTAL SENT: ~1300 tokens

⏳ Calling LLM...

📥 RECEIVED:
──────────────────────────────────────────────────────────────────────
🤔 REASONING:
[thinking content from model]
──────────────────────────────────────────────────────────────────────
[main reply content]
──────────────────────────────────────────────────────────────────────
   Time: 1523ms
   Tokens — prompt: 1300, completion: 150, total: 1450
```

---

## Testing Checklist

- [ ] vLLM server running with `--enable-thinking`
- [ ] `node prompt-test.js` executes without errors
- [ ] Provider shows "vLLM"
- [ ] Thinking output appears in "🤔 REASONING" section
- [ ] Main reply appears after thinking
- [ ] Token counts display correctly
