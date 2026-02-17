# Quick Start Guide - Running Auto-AI with Docker LLM

## Prerequisites
- Docker installed and running
- Node.js 18+ installed
- Browser (ixBrowser, Brave, etc.) running

## Step 1: Start the Local LLM

```bash
docker model run ai/qwen3-vl:4B-UD-Q4_K_XL
```

The model will start on port **12434**. You should see output like:
```
✔ Model ai/qwen3-vl:4B-UD-Q4_K_XL is ready
Server listening on http://localhost:12434
```

## Step 2: Configure Environment

The `.env` file is already configured for Docker LLM. Verify these settings:

```env
LOCAL_LLM_ENDPOINT=http://localhost:12434/api/generate
LOCAL_LLM_MODEL=ai/qwen3-vl:4B-UD-Q4_K_XL
OPENROUTER_API_KEY=your_key_here
```

## Step 3: Run Example Task

```bash
# Start a browser first (e.g., ixBrowser with profiles)

# Run the example navigation task
node main.js simpleNavigate targetUrl=https://example.com
```

The system will:
1. Discover running browsers
2. Route simple tasks to local LLM (fast, free)
3. Route complex tasks to cloud (OpenRouter)
4. Execute with human-like movements

## Step 4: Monitor Routing

Check the logs for routing decisions:

```
[agent-connector.js] Classification: local (confidence: 80%, complexity: 2/10)
[Local] Sending request to local LLM...
[Local] Request completed in 245ms
```

## What Gets Routed Where?

### Local LLM (Fast & Free)
- Navigation tasks
- Simple clicks
- Scrolling
- Text extraction
- Routine interactions

### Cloud LLM (Powerful)
- Captcha solving
- Error recovery
- Complex page analysis
- Decision making
- Form filling with logic

## Troubleshooting

**Local LLM not connecting:**
```bash
# Check if Docker is running
docker ps

# Check logs
docker logs <container_id>

# Restart model
docker model stop ai/qwen3-vl:4B-UD-Q4_K_XL
docker model run ai/qwen3-vl:4B-UD-Q4_K_XL
```

**All requests going to cloud:**
- Check task complexity - simple tasks route to local automatically
- Use `forceLocal: true` to override routing
- Verify `.env` has correct `LOCAL_LLM_ENDPOINT`

**Port conflict:**
```bash
# Check what's using port 12434
netstat -ano | findstr :12434

# Kill the process or use different port in .env
```

## Configuration Reference

**Environment Variables:**
```env
# Required for cloud fallback
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet

# Local LLM (already configured)
LOCAL_LLM_ENDPOINT=http://localhost:12434/api/generate
LOCAL_LLM_MODEL=ai/qwen3-vl:4B-UD-Q4_K_XL
```

**settings.json:**
```json
{
  "orchestration": {
    "taskDispatchMode": "broadcast",
    "reuseSharedContext": false,
    "pagePoolMaxPerSession": 2
  }
}
```

**taskDispatchMode options:**
- broadcast: send full task list to every session (default)
- centralized: share a single task list across sessions

**reuseSharedContext options:**
- false: create and close a shared context per checklist (default)
- true: reuse a shared context across checklists

**pagePoolMaxPerSession options:**
- number: maximum pooled pages per session (defaults to concurrencyPerBrowser)

## Testing the Setup

```bash
# Test all core modules
node tests/test-core-modules.js

# You should see:
# - StateManager: ✓
# - IntentClassifier: ✓
# - CloudClient: ✓
# - LocalClient: ✓
# - All tests passed
```

## Next Steps

1. Set your OpenRouter API key in `.env`
2. Start your preferred browser(s)
3. Run example task: `node main.js simpleNavigate targetUrl=https://google.com`
4. Build custom tasks in `tasks/` directory

For detailed architecture information, see `walkthrough.md`.
