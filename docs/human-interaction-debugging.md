# Human-Like Reply/Quote Mechanism - Debugging Guide

## Overview

The system uses 8 methods (4 for reply, 4 for quote) with weighted random selection to appear human-like.

## Enable Debug Mode

```bash
HUMAN_DEBUG=true node main.js
```

Or set in code:
```javascript
process.env.HUMAN_DEBUG = 'true';
```

---

## Reply Methods Debugging

### Method A: Keyboard Shortcut (40%)
```
Sequence: ESC → R → [type] → Ctrl+Enter
```

**Debug Steps:**
```
[STEP] KEYBOARD_SHORTCUT: Starting
[STEP] ESCAPE: Closing open menus
[STEP] R_KEY: Opening reply composer
[VERIFY] Composer open with: [data-testid="tweetTextarea_0"]
[TYPE] Starting to type (73 chars)...
[POST] Attempting to post...
[VERIFY] Composer closed: confirmed
```

**Common Issues:**
1. `composer_not_open` - R key didn't open composer
   - Check: Is page focused?
   - Fix: Click page first before pressing R

2. `post_failed` - Ctrl+Enter didn't work
   - Check: Is composer still open?
   - Fix: Button click fallback should trigger

---

### Method B: Button Click (35%)
```
Sequence: Find button → Scroll → Fixation → Click → [type] → Ctrl+Enter
```

**Debug Steps:**
```
[STEP] BUTTON_CLICK: Starting
[Hesitation] Waiting 847ms before action...
[FIND_BUTTON] Locating reply button
[FIND_BUTTON] Selector "[data-testid='reply']": 3 elements
[FIND_BUTTON] Found visible element at index 0
[SCROLL] Making button visible
[Fixation] Fixating for 512ms...
[MicroMove] Mouse: 12, -5
[CLICK] Clicking with [data-testid='reply']
[VERIFY] Composer open with: [contenteditable="true"][role="textbox"]
```

**Common Issues:**
1. `button_not_found` - Selector failed
   - Check: `[data-testid="reply"]` exists?
   - Try alternative selectors in order

2. `composer_not_open` - Click didn't open
   - Check: Is button actually visible?
   - Fix: Scroll into view first

---

### Method C: Tab Navigation (15%)
```
Sequence: Tab × N → Find reply → Enter → [type] → Ctrl+Enter
```

**Debug Steps:**
```
[STEP] TAB_NAVIGATION: Starting
[TAB] Tabbing to find reply button
[TAB] Found reply button at tab 7
[Fixation] Fixating for 234ms...
[ENTER] Pressing Enter
[VERIFY] Composer open with: [data-testid="tweetTextarea_0"]
```

**Common Issues:**
1. `composer_not_open` - Wrong element focused
   - Check: `document.activeElement` in console
   - Verify focused element is reply button

2. `tabCount` - Too many tabs
   - Normal: 5-15 tabs
   - High (>30): Page not fully loaded

---

### Method D: Right-Click Context (10%)
```
Sequence: Hover → Right-click → Move → Click → [type] → Ctrl+Enter
```

**Debug Steps:**
```
[STEP] RIGHT_CLICK: Starting
[FIND_BUTTON] Locating reply button
[MOVE] Moving to reply button (x: 450, y: 230)
[RIGHT_CLICK] Right-clicking reply button
[CONTEXT_MENU] Opened
[MENU_CLICK] Clicking Reply from menu
[VERIFY] Composer open with: [data-testid="tweetTextarea_0"]
```

**Common Issues:**
1. `button_not_found` - Can't locate reply button
   - Check: Button selector exists
   - Fallback to button click method

2. `composer_not_open` - Context menu didn't have Reply
   - Check: Menu contents in DOM
   - Fallback to left click

---

## Quote Methods Debugging

### Method A: Keyboard Compose + Quote (40%)
```
Sequence: ESC → T → Down → Down → Enter → [type] → Ctrl+Enter
```

**Debug Steps:**
```
[STEP] KEYBOARD_COMPOSE: Starting
[ESCAPE] Closing menus
[T_KEY] Opening compose
[NAVIGATE] Pressing Down to find quote option
[ENTER] Selecting quote option
[QUOTE_PREVIEW] Present
[TYPE] Starting to type (142 chars)...
[POST] Attempting to post...
[VERIFY] Post sent: toast notification
```

**Common Issues:**
1. `composer_not_open` - T key didn't work
   - Check: Is page focused?
   - Fix: Click page first

2. `quote_preview_not_found` - Didn't enter quote mode
   - Check: Down arrow navigated correctly?
   - Fallback: Use retweet menu method

---

### Method B: Retweet Menu (35%)
```
Sequence: Click Retweet → Find Quote → Click → [type] → Ctrl+Enter
```

**Debug Steps:**
```
[STEP] RETWEET_MENU: Starting
[FIND_RETWEET] Locating retweet button
[CLICK] Clicking retweet
[FIND_QUOTE] Looking for Quote option
[QUOTE_FOUND] text=Quote
[QUOTE_CLICK] Selecting Quote
[QUOTE_PREVIEW] Present
[VERIFY] Composer open
```

**Common Issues:**
1. `retweet_button_not_found` - Can't find retweet button
   - Check: `[data-testid="retweet"]` selector
   - Fallback to keyboard method

2. `quote_option_not_found` - Quote not in menu
   - Check: Menu DOM structure
   - Fix: Use keyboard fallback

---

### Method C: Direct Quote URL (15%)
```
Sequence: Extract tweet ID → Navigate to quote URL → [type] → Ctrl+Enter
```

**Debug Steps:**
```
[STEP] QUOTE_URL: Starting
[CURRENT_URL] https://x.com/username/status/1234567890
[EXTRACT] Tweet ID: 1234567890
[NAVIGATE] Opening quote URL
[VERIFY] Composer open
[PRE_FILLED] Quote text already in composer
[POST] Attempting to post...
```

**Common Issues:**
1. `tweet_id_not_found` - Can't extract ID from URL
   - Check: URL format
   - Fix: Use alternate URL parsing

2. `composer_not_open` - URL navigation failed
   - Check: Network errors
   - Fallback to other methods

---

### Method D: Copy-Paste Manual (10%)
```
Sequence: Copy tweet → T → Paste → Add comment → Ctrl+Enter
```

**Debug Steps:**
```
[STEP] COPY_PASTE: Starting
[COPY] Selecting tweet text
[T_KEY] Opening compose
[PASTE] Pasting tweet
[COMMENT] Adding quote comment
[TYPE] Starting to type (89 chars)...
[POST] Attempting to post...
```

**Common Issues:**
1. `composer_not_open` - T key failed
   - Check: Page focus
   - Fix: Click page first

2. `paste_failed` - Ctrl+V didn't work
   - Check: Element allows paste
   - Fix: Manual typing fallback

---

## Debugging Checklist

### Step 1: Enable Debug Mode
```bash
HUMAN_DEBUG=true node test-ai-reply-engine.js
```

### Step 2: Check Method Selection
```
[MethodSelect] Selected: button_click (roll: 35.2, threshold: 40.0)
```

### Step 3: Verify Each Step
- Check step timing (hesitation, fixation)
- Verify element selectors found
- Confirm composer opened
- Check post verification

### Step 4: Common Fixes

| Issue | Fix |
|-------|-----|
| Selectors not found | Update selectors in `human-interaction.js` |
| Composer won't open | Add page.click() before keyboard |
| Post fails | Increase wait time after Ctrl+Enter |
| Too bot-like | Increase random delays |

---

## Test Commands

```bash
# Reply with debug
HUMAN_DEBUG=true node -e "
const { AIReplyEngine } = require('./utils/ai-reply-engine.js');
const { HumanInteraction } = require('./utils/human-interaction.js');
// Test reply execution...
"

# Quote with debug
HUMAN_DEBUG=true node -e "
const { AIQuoteEngine } = require('./utils/ai-quote-engine.js');
// Test quote execution...
"
```

---

## Log Analysis

Each method logs:
1. Step name and details
2. Selector attempts and results
3. Timing of each action
4. Success/failure with reasons

**Example failure analysis:**
```
[AI] Reply failed: composer_not_open (method: keyboard_shortcut)
→ R key pressed but composer didn't open
→ Check: Is page focused?
→ Fix: Add page.click() before keyboard.press('r')
```
