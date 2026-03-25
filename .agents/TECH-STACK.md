# Technology Stack & Communication

Technology stack, communication format guidelines, and scroll multiplier configuration.

## Technology Stack

| Category               | Technology                               |
| ---------------------- | ---------------------------------------- |
| **Runtime**            | Node.js 16+ (ES Modules)                 |
| **Browser Automation** | Playwright 1.56.1 (CDP connections)      |
| **Local LLM**          | Ollama, Docker model (ai/qwen3-vl:4B)    |
| **Cloud LLM**          | OpenRouter API (Claude 3.5, GPT-4, etc.) |
| **Configuration**      | JSON files + dotenv                      |
| **Dependencies**       | dotenv, playwright (core only)           |

## Communication Format

When explaining code flows or processes, use **Flowchart** or **Vertical Flow Diagram**:

### Format Specification

- Top-to-bottom direction with ↓ arrows
- Each step is a separate line
- Shows sequential order of operations
- Simple and linear

### Example

```
Read replies (10-15s with scrolling)
    ↓
Scroll to top: window.scrollTo(0, 0)
    ↓
Wait 500-1000ms (settle)
    ↓
Type reply/quote
```

## Global Scroll Multiplier

All scrolling operations support a configurable multiplier in `config/settings.json`:

```json
"twitter": {
  "timing": {
    "globalScrollMultiplier": 1.0
  }
}
```

### Usage Examples

**Multiplier Values:**

- `0.5` = 50% slower scrolling (more careful)
- `1.0` = Normal speed (default)
- `1.5` = 50% faster scrolling
- `2.0` = Double speed (quick runs)

**Implementation:**
All `api.scroll.*` and `utils/scroll-helper.js` functions automatically apply this multiplier to their base distances and timings.
