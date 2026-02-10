# Multi-Line Tweet Composition Guide

## Overview

You can now compose tweets with line breaks while maintaining the simple one-line-per-tweet format in `twitterTweet.txt`.

---

## Method 1: Manual Editing (Quick & Simple)

Edit `tasks/twitterTweet.txt` directly and use `\\n` (backslash + n) for line breaks:

**Example:**
```
Just shipped a new feature!\\n\\nCheck it out at example.com\\n\\n#coding #javascript
```

**Will be posted as:**
```
Just shipped a new feature!

Check it out at example.com

#coding #javascript
```

---

## Method 2: Composer Tool (Recommended)

Use the interactive composer for a better experience:

```bash
node tools/composeTweet.js
```

### Features:
- ✅ **Natural Input**: Press Enter freely for line breaks
- ✅ **Live Character Count**: Shows remaining characters (max 280)
- ✅ **Preview**: See exactly how your tweet will look
- ✅ **Queue Position**: Add to top (prepend) or bottom (append)
- ✅ **Validation**: Prevents tweets over 280 characters
- ✅ **Queue Status**: Shows current queue size

### Example Session:
```
╔════════════════════════════════════════════════════════════╗
║          Twitter Tweet Composer (Multi-Line)              ║
╚════════════════════════════════════════════════════════════╝

Current queue: 5 tweet(s)

Options:
  1 - Compose new tweet (append to end)
  2 - Compose new tweet (prepend to top)
  3 - View queue
  0 - Exit

Choose option: 1

─────────────────────────────────────────────────────────────
COMPOSE TWEET (add to end)
─────────────────────────────────────────────────────────────

Type your tweet below. Press Enter for line breaks.
Type :done on a new line to finish.
Type :cancel to abort.

Just shipped a new feature!
(266 chars remaining)

Check it out at example.com
(234 chars remaining)

#coding #javascript
(214 chars remaining)
:done

─────────────────────────────────────────────────────────────
PREVIEW (66 chars)
─────────────────────────────────────────────────────────────

Just shipped a new feature!

Check it out at example.com

#coding #javascript

─────────────────────────────────────────────────────────────
Encoded: Just shipped a new feature!\\nCheck it out at exam...

Add to queue? (y/n): y

✅ Tweet added to queue!
Position: 6 (bottom)
Total in queue: 6
```

---

## Viewing Your Queue

Use the composer tool to preview all tweets:

```bash
node tools/composeTweet.js
# Choose option 3
```

This shows all tweets with their decoded content (with actual line breaks).

---

## Technical Details

- **Storage Format**: Single line per tweet in `twitterTweet.txt`
- **Encoding**: Line breaks are stored as `\\n` (two characters: backslash + n)
- **Decoding**: Happens automatically when `twitterTweet.js` reads the file
- **Compatibility**: Existing single-line tweets work without changes

---

## Tips

1. **Don't overuse line breaks**: Too many can make tweets hard to read
2. **Preview first**: Use the composer tool to see how it looks
3. **Character count**: Remember line breaks count toward the 280 limit
4. **Edit safely**: If editing manually, use `\\n` (not `\n` or just a newline)

---

## Example Tweets

### Single-line (still works):
```
This is a simple tweet without any line breaks
```

### Multi-line with manual encoding:
```
Breaking news!\\n\\nWe just launched version 2.0\\n\\nKey features:\\n- Speed improvements\\n- New UI\\n- Bug fixes
```

### Result when posted:
```
Breaking news!

We just launched version 2.0

Key features:
- Speed improvements
- New UI
- Bug fixes
```
