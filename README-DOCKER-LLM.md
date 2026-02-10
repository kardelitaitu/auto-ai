# Docker LLM Setup - Quick Start

## Running the Local LLM

The framework is configured to use **Qwen3-VL 4B** model via Docker on port **12434**.

### Start the Model

```bash
docker model run ai/qwen3-vl:4B-UD-Q4_K_XL
```

The model will be available at: `http://localhost:12434`

### Configuration

The framework is pre-configured to use this model. If you need to change settings:

**Environment Variables** (`.env`):
```env
LOCAL_LLM_ENDPOINT=http://localhost:12434/api/generate
LOCAL_LLM_MODEL=ai/qwen3-vl:4B-UD-Q4_K_XL
```

### Testing Local LLM Connection

Run the core modules test to verify the local client can connect:

```bash
node tests/test-core-modules.js
```

Look for:
```
[Local] Testing local LLM connectivity...
[Local] Connection test successful
```

### Routing Behavior

The `intent-classifier.js` will automatically route tasks based on complexity:

- **Simple tasks** (navigate, click, scroll) → Local LLM (faster, free)
- **Complex tasks** (captcha, error recovery) → Cloud (OpenRouter)

You can force routing in tasks:

```javascript
// Force local
await agentConnector.processRequest({
  action: 'navigate',
  payload: { url: 'https://example.com' },
  sessionId: 'test',
  forceLocal: true
});

// Force cloud
await agentConnector.processRequest({
  action: 'complex_analysis',
  payload: { ... },
  sessionId: 'test',
  forceCloud: true
});
```

### Troubleshooting

**Model not responding:**
```bash
# Check if Docker is running
docker ps

# Check model logs
docker logs <container_id>
```

**Wrong port:**
- Ensure the model is running on port **12434**
- Check `.env` file has correct `LOCAL_LLM_ENDPOINT`

**Still using cloud:**
- Check task complexity - simple tasks route to local automatically
- Use `forceLocal: true` to override routing logic
- Check `agent-connector.js` logs for routing decisions

### Model Information

**Model:** Qwen3-VL 4B (Quantized: Q4_K_XL)
- **Size:** ~2.5GB RAM
- **Speed:** Fast (4B parameters)
- **Vision:** Supports image inputs
- **Use case:** Routine automation tasks, simple reasoning

For complex reasoning, the system will automatically fall back to cloud models (Claude 3.5 Sonnet).
