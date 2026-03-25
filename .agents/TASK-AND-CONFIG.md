# Task System & Configuration

Task execution system, configuration management, supported browsers, and humanization features.

## Supported Browsers

| Browser                         | API Port | Type              |
| ------------------------------- | -------- | ----------------- |
| ixBrowser                       | 53200    | Anti-detect       |
| MoreLogin                       | 6699     | Anti-detect       |
| AdsPower                        | 50325    | Anti-detect       |
| RoxyBrowser                     | Env vars | Anti-detect       |
| Dolphin Anty                    | 5050     | Anti-detect       |
| Undetectable                    | 25325    | Anti-detect       |
| MultiLogin                      | 35000    | Anti-detect       |
| GoLogin                         | 36912    | Anti-detect       |
| Incogniton                      | 35000    | Anti-detect       |
| Kameleo                         | 5050     | Anti-detect       |
| OctoBrowser                     | 58888    | Anti-detect       |
| NSTBrowser                      | 60080    | Anti-detect       |
| HideMyAcc                       | 8888     | Anti-detect       |
| AntBrowser                      | 40000    | Anti-detect       |
| Local Chrome/Brave/Edge/Vivaldi | Various  | Standard browsers |

## Humanization Features

- **Mouse Movement**: Variable speed, jitter, Bezier curves (`api/utils/ghostCursor.js`)
- **Keystroke Dynamics**: Randomized delays, punctuation pauses via `typeText`
- **Scrolling Patterns**: Natural reading rhythm via `api.scroll.read()`
- **Idle Behavior**: Periodic micro-fidgeting when waiting (`api/behaviors/idle.js`)
- **PID Muscle Model**: Individualized movement acceleration per session.
- **Sensor Noise**: Dynamic battery/network/orientation spoofing.

## Task System

Tasks are dynamically loaded from `tasks/` directory:

- Files export a default async function: `async function(page, payload)`
- Tasks receive a Playwright Page object directly
- Payload contains task-specific parameters + browserInfo
- All tasks follow the template pattern with try/finally blocks

**Example Task Command:**

```bash
node main.js pageview=https://example.com
node main.js pageview=www.example.com
```

## Configuration Management

Configuration hierarchy:

1. `config/settings.json` - Main settings (LLM, humanization, vision)
2. `config/browserAPI.json` - Browser API endpoints
3. `config/timeouts.json` - Timeout values
4. `.env` file - Environment variables
