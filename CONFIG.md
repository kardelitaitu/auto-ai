# Configuration Guide

All system configuration is managed via JSON files in the `config/` directory.  
**No `.env` files needed!**

## Configuration Files

### `config/settings.json` - Main Configuration

This is the primary configuration file for the DAO framework.

#### LLM Configuration

```json
{
  "llm": {
    "local": {
      "endpoint": "http://localhost:12434/api/generate",
      "model": "ai/qwen3-vl:4B-UD-Q4_K_XL",
      "timeout": 30000,
      "enabled": true
    },
    "cloud": {
      "provider": "openrouter",
      "apiKey": "YOUR_API_KEY_HERE",
      "endpoint": "https://openrouter.ai/api/v1/chat/completions",
      "defaultModel": "anthropic/claude-3.5-sonnet",
      "timeout": 60000,
      "enabled": true
    }
  }
}
```

**To configure:**
1. Open `/config/settings.json`
2. Set `llm.cloud.apiKey` to your OpenRouter API key
3. Adjust `llm.local.enabled` to `true/false` based on whether Docker LLM is running

#### Humanization Parameters

```json
{
  "humanization": {
    "mouse": {
      "minDuration": 300,
      "maxDuration": 1500,
      "baseSpeed": 2.0,
      "jitterRange": 3
    },
    "keystroke": {
      "baseDelay": 100,
      "stdDev": 30
    },
    "idle": {
      "wiggleFrequency": 2000,
      "wiggleMagnitude": 5,
      "enabled": true
    }
  }
}
```

#### Verification & State

```json
{
  "verification": {
    "auditTimeout": 5000,
    "preFlightEnabled": true,
    "postFlightEnabled": true
  },
  "state": {
    "maxBreadcrumbs": 50,
    "compactionThreshold": 20
  }
}
```

### `config/browserAPI.json` - Browser Connections

Manages anti-detect browser API endpoints:

```json
{
  "default": "roxybrowser",
  "profiles": {
    "ixbrowser": {
      "type": "ixbrowser",
      "apiBaseUrl": "http://127.0.0.1:53200",
      "apiKey": ""
    },
    "roxybrowser": {
      "type": "roxybrowser",
      "apiBaseUrl": "http://127.0.0.1:50000",
      "apiKey": "YOUR_ROXY_KEY"
    }
  }
}
```

### `config/timeouts.json` - System Timeouts

Pre-configured timeouts for various operations (usually doesn't need changes).

---

## Quick Start Configuration

### 1. Set Your Cloud API Key

Edit `config/settings.json`:
```json
{
  "llm": {
    "cloud": {
      "apiKey": "sk-or-v1-YOUR_KEY_HERE"
    }
  }
}
```

### 2. Enable/Disable Local LLM

```json
{
  "llm": {
    "local": {
      "enabled": true  // Set to false to disable local routing
    }
  }
}
```

### 3. Adjust Humanization (Optional)

```json
{
  "humanization": {
    "mouse": {
      "minDuration": 200,  // Faster movements
      "maxDuration": 1000
    }
  }
}
```

---

## Configuration Loading

The framework uses `utils/configLoader.js` to load configurations:

```javascript
import { getSettings } from './utils/configLoader.js';

const settings = await getSettings();
const cloudApiKey = settings.llm?.cloud?.apiKey;
```

**Benefits:**
- ✅ All configuration in one place
- ✅ Easy to version control (just don't commit API keys!)
- ✅ No environment variable juggling
- ✅ Hot-reload support (clear cache to reload)

---

## Migration from .env

If you have an existing `.env` file, here's the mapping:

| Old (.env) | New (config/settings.json) |
|------------|----------------------------|
| `OPENROUTER_API_KEY` | `llm.cloud.apiKey` |
| `OPENROUTER_DEFAULT_MODEL` | `llm.cloud.defaultModel` |
| `LOCAL_LLM_ENDPOINT` | `llm.local.endpoint` |
| `LOCAL_LLM_MODEL` | `llm.local.model` |
| `HUMANIZER_MIN_DURATION` | `humanization.mouse.minDuration` |
| `AUDIT_TIMEOUT` | `verification.auditTimeout` |

**.env files are no longer needed or used.**

---

## Best Practices

1. **Don't commit API keys**: Add `config/settings.json` to `.gitignore` if it contains secrets
2. **Use separate configs for dev/prod**: Create `settings.dev.json` and `settings.prod.json`
3. **Document changes**: When changing defaults, update this guide
4. **Validate after edits**: Run `node tests/test-core-modules.js` to ensure config is valid

---

## Troubleshooting

**"Cloud client will not function":**
- Check `config/settings.json` → `llm.cloud.apiKey` is set
- Ensure it's not the placeholder value

**"Local client is DISABLED":**
- Set `llm.local.enabled: true` in `config/settings.json`
- Start Docker LLM: `docker model run ai/qwen3-vl:4B-UD-Q4_K_XL`

**Changes not taking effect:**
- Restart the application (config is loaded on startup)
- Check for JSON syntax errors in `settings.json`
