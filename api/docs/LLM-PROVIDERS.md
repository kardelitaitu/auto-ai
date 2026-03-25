# LLM Provider Setup

This guide covers setting up LLM providers for the Auto-AI agent system.

## Supported Providers

| Provider       | Type  | Use Case                               |
| -------------- | ----- | -------------------------------------- |
| **Ollama**     | Local | Fast, free, privacy-focused            |
| **OpenRouter** | Cloud | More powerful models, API key required |

---

## Environment Variables

Create or update your `.env` file in the project root:

### Ollama (Local)

```bash
# Required
LOCAL_LLM_ENDPOINT=http://localhost:11434/api/generate
LOCAL_LLM_MODEL=llama3.2:latest

# Optional - fallback to cloud if local fails
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
```

### OpenRouter (Cloud)

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional - defaults
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_API_BASE_URL=https://openrouter.ai/api/v1
```

---

## Starting Ollama

### Docker Method (Recommended)

```bash
# Pull and run Ollama
docker run -d -p 11434:11434 --name ollama ollama/ollama:latest

# Pull a model
docker exec ollama ollama pull llama3.2:latest

# Or use a vision model for page analysis
docker exec ollama ollama pull llava:latest
```

### Direct Installation

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start server
ollama serve

# Pull a model (in another terminal)
ollama pull llama3.2:latest
```

---

## Model Recommendations

### For Browser Automation

| Model              | Strengths                      | VRAM |
| ------------------ | ------------------------------ | ---- |
| `llama3.2:latest`  | Good all-rounder               | ~4GB |
| `llava:latest`     | Vision support for screenshots | ~8GB |
| `qwen2.5vl:latest` | Vision + multilingual          | ~5GB |

### For Complex Tasks

Use **OpenRouter** with models like:

- `anthropic/claude-3.5-sonnet` - Best for complex reasoning
- `openai/gpt-4o` - Good vision understanding
- `google/gemini-2.0-flash` - Fast and capable

---

## Testing Your Setup

### Test Local Ollama

```bash
# Check if Ollama is running
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2:latest",
  "prompt": "Hello",
  "stream": false
}'
```

### Test in Auto-AI

```bash
# Run a simple task
node main.js simpleNavigate targetUrl=https://example.com

# Check logs for:
# [Local] Sending request to local LLM...
# [Local] Request completed in 245ms
```

---

## Routing Logic

The system automatically routes requests:

```javascript
// Simple tasks → Local LLM (fast, free)
// - Navigation
// - Simple clicks
// - Text extraction
// - Routine interactions

// Complex tasks → Cloud LLM (powerful)
// - Captcha solving
// - Error recovery
// - Complex page analysis
// - Decision making
```

### Manual Override

```javascript
// Force local
await api.agent.run('task', { forceLocal: true });

// Force cloud
await api.agent.run('task', { forceCloud: true });
```

---

## Troubleshooting

### Ollama not connecting

```bash
# Check if Docker is running
docker ps

# Check logs
docker logs ollama

# Restart
docker restart ollama
```

### All requests go to cloud

- Check task complexity (simple tasks route locally by default)
- Verify `LOCAL_LLM_ENDPOINT` is correct
- Try `forceLocal: true` in agent config

### Port conflict

```bash
# Check what's using port 11434
netstat -ano | findstr :11434
```
