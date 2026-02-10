# AI Twitter Activity - Anti-Detection Plan

## Objective

Create a Twitter automation task that simulates authentic human behavior using the existing anti-detect browser infrastructure and behavioral profile system.
on each module, configure the settings at the top of the file, or use settings in the config/settings.json file (if its important).

---

## Current Implementation Status

### ✅ COMPLETED (Already Implemented)
- [x] Basic `ai-twitterActivity.js` task structure
- [x] ProfileManager integration for behavioral profiles
- [x] AITwitterAgent with AI reply capability
- [x] Humanization patch application
- [x] GhostCursor for mouse movements
- [x] Bookmark-style navigation (x.com)
- [x] Login state checking
- [x] Multi-API cloud fallback (9 providers)
- [x] Reply extraction engine (5 strategies)
- [x] Session metrics collection

### ⚠️ NEEDS FIX (Issues Identified)
- [ ] `REPLY_PROBABILITY = 1.0` (100%) → should be 0.10 (10%)
- [ ] Session duration 10-15 min → should be 5-10 min
- [ ] Random profile selection not fully integrated
- [ ] No session phase detection (warmup/active/cooldown)
- [ ] No human timing (Gaussian distribution)
- [ ] No engagement limits enforcement
- [ ] No scroll humanizer implementation

---

## Guiding Principles

1. **Anti-detect browser** handles fingerprinting + proxy (already configured)
2. **generateProfiles.js** provides behavioral simulation (timings, probabilities)
3. **Session duration:** 5-10 minutes
4. **Focus:** Behavior realism, timing variability, session phases

---

## Existing Components

### generateProfiles.js

Generates behavioral profiles with Gaussian-distributed values:

| Profile | Behavior | Count |
|---------|----------|-------|
| Skimmer | Quick scroll, minimal engagement | 4 |
| Balanced | Moderate reading, varied actions | 26 |
| DeepDiver | Long reads, high engagement | 4 |
| Lurker | Mostly reading, rare actions | 4 |
| DoomScroller | Fast scrolling, low engagement | 4 |
| NewsJunkie | Refresh-heavy, current events | 4 |
| Stalker | Profile-heavy, follows users | 4 |

Each profile includes:
- Reading phase timing (mean + deviation)
- Scroll pause timing
- Input methods (mouse/keyboard preferences)
- Action probabilities (refresh, dive, like, bookmark, follow)
- Per-action specific timings

### Core Components Available

- `utils/ghostCursor.js` - Human-like mouse movement
- `utils/randomScrolling.js` - Natural scroll patterns
- `utils/humanization/` - Comprehensive humanization engine
- `core/idle-ghosting.js` - Background mouse movements
- `core/automator.js` - CDP browser connections

---

## Architecture

```
main.js
  ↓
aiTwitterActivityTask()
  ├─ Anti-detect browser (external)
  ├─ ProfileManager.random()
  ├─ SessionPhases.getCurrent()
  ├─ HumanTiming.gaussian()
  ├─ AITwitterAgent.runSession()
  │   ├─ ScrollPatterns.execute()
  │   ├─ ContentAnalyzer.evaluate()
  │   ├─ AI Reply Generator
  │   └─ ActionExecutor.applyLimits()
  └─ IdleGhosting.start()
```

---

## Core Features

### 1. Random Profile Selection

Each session uses a randomly selected behavioral profile from generateProfiles.js.

```javascript
const profiles = profileManager.getAll();
const profile = mathUtils.sample(profiles);
```

Benefits:
- Session diversity (not same behavior pattern)
- Natural variation (timings, probabilities)
- Blends with real user population

### 2. Session Phase Simulation

Real sessions progress through natural phases:

| Phase | Duration | Multiplier | Behavior |
|-------|----------|------------|----------|
| Warmup | 0-10% | 0.5-0.7 | Slower actions, more reading |
| Active | 10-80% | 1.0 | Peak engagement, all actions |
| Cooldown | 80-100% | 0.3-0.5 | Slowing down, reading |

Implementation:
```javascript
function getSessionPhase(elapsed, total) {
    const progress = elapsed / total;
    if (progress < 0.10) return 'warmup';
    if (progress < 0.80) return 'active';
    return 'cooldown';
}
```

### 3. Human Timing (Gaussian + Jitter)

Replace linear randomness with natural distribution:

```javascript
// Gaussian (bell curve around mean)
function gaussianRandom(mean, stdev) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z * stdev;
}

// Humanized delay
function humanDelay(base, options = {}) {
    let delay = gaussianRandom(base, base * 0.15);  // ±15% jitter

    // Occasional pause (distraction)
    if (Math.random() < 0.08) delay *= 3;

    // Occasional quick response
    if (Math.random() < 0.05) delay *= 0.3;

    return Math.max(50, delay);
}
```

### 4. Engagement Limits

Real users have daily/hourly limits. Track per-session:

| Action | Max Per Session | Rationale |
|--------|----------------|----------|
| Replies | 15 | Writing takes effort |
| Retweets | 10 | Curation behavior |
| Quotes | 5 | Thoughtful sharing |
| Likes | 30 | Quick engagement |
| Follows | 3 | Major commitment |
| Bookmarks | 10 | Saving for later |

Implementation:
```javascript
const sessionLimits = {
    replies: 0,
    retweets: 0,
    quotes: 0,
    likes: 0,
    follows: 0,
    bookmarks: 0
};

function canPerform(action) {
    return sessionLimits[action] < LIMITS[action];
}
```

### 5. AI-Powered Replies

Keep existing high-quality AI reply system with enhancements:

```javascript
const replyConfig = {
    minChars: 10,
    maxChars: 200,
    emojiChance: 0.3,
    questionChance: 0.2,
    probability: 0.15  // 15% of viewed content
};

// Usage
if (canPerform('replies') && Math.random() < replyConfig.probability) {
    await generateAIReply(context);
}
```

### 6. Idle Ghosting

Background micro-movements when "reading":

```javascript
idleGhosting.start(page, {
    interval: gaussianRandom(3000, 1000),  // 2-4 seconds
    magnitude: gaussianRandom(10, 5),        // 5-15 pixels
    enabled: true
});
```

---

## Configuration

### Current Values (ai-twitterActivity.js - AS-IS)

```javascript
// ⚠️ NEEDS FIX - Session
TARGET_URL = 'https://x.com'
DEFAULT_CYCLES = 10
DEFAULT_MIN_DURATION = 600    // 10 minutes ⚠️ TOO LONG
DEFAULT_MAX_DURATION = 900    // 15 minutes ⚠️ TOO LONG
REPLY_PROBABILITY = 1.0      // 100% ⚠️ RED FLAG - BOT DETECTION

// Warm-up: Initial pause after navigation before activity starts
WARMUP_MIN = 2000
WARMUP_MAX = 15000

// Scroll: Speed of vertical scrolling through feed
SCROLL_MIN = 300
SCROLL_MAX = 700

// Scroll Pause: How long to stop and "read" between scrolls
SCROLL_PAUSE_MIN = 1500
SCROLL_PAUSE_MAX = 4000

// Reading: Time spent "reading" content before actions
READ_MIN = 5000
READ_MAX = 15000
```

### Proposed Settings (ai-twitterActivity.js - TO IMPLEMENT)

```javascript
// Session - CONSERVATIVE
SESSION_MIN_SECONDS = 300   // 5 minutes
SESSION_MAX_SECONDS = 540   // 9 minutes
USE_RANDOM_PROFILE = true   // Random profile each session

// Engagement Limits - CONSERVATIVE
ENGAGEMENT_LIMITS = {
    maxReplies: 3,
    maxRetweets: 1,
    maxQuotes: 1,
    maxLikes: 5,
    maxFollows: 2,
    maxBookmarks: 2
}

// Reply Settings
REPLY_PROBABILITY = 0.10   // 10% max (FIX THE 1.0!)

REPLY_QUALITY = {
    // Remove trailing '.' from tweets (human behavior)
    minChars: 10,
    maxChars: 200,
    emojiChance: 0.3,
    questionChance: 0.2
}

// Human Timing
HUMAN_TIMING = {
    jitter: 0.15,           // ±15% variation
    pauseChance: 0.08,      // 8% distraction
    burstChance: 0.05,      // 5% quick response
    idleInterval: { min: 2000, max: 5000 }
}

// Session Phases
SESSION_PHASES = {
    warmupPercent: 0.10,    // First 10%
    activePercent: 0.70,     // Middle 70%
    cooldownPercent: 0.20   // Last 20%
}
```

### Config File Integration (config/settings.json)

Add Twitter-specific settings:

```json
{
  "twitter": {
    "session": {
      "minSeconds": 300,
      "maxSeconds": 540,
      "randomProfile": true
    },
    "engagement": {
      "maxReplies": 3,
      "maxRetweets": 1,
      "maxQuotes": 1,
      "maxLikes": 5,
      "maxFollows": 2,
      "maxBookmarks": 2
    },
    "reply": {
      "probability": 0.10,
      "minChars": 10,
      "maxChars": 200,
      "emojiChance": 0.3,
      "questionChance": 0.2
    },
    "timing": {
      "warmupMin": 2000,
      "warmupMax": 15000,
      "scrollMin": 300,
      "scrollMax": 700,
      "scrollPauseMin": 1500,
      "scrollPauseMax": 4000,
      "readMin": 5000,
      "readMax": 15000
    }
  }
}
```

---

## Action Probability Model

### Base Probabilities (from generateProfiles.js)

| Action | Skimmer | Balanced | DeepDiver | Lurker | DoomScroller | NewsJunkie | Stalker |
|--------|---------|----------|------------|---------|--------------|-------------|----------|
| Refresh | 20% | 10% | 5% | 5% | 10% | 60% | 10% |
| Dive | 20% | 30% | 60% | 10% | 5% | 10% | 90% |
| TweetDive | 5% | 10% | 20% | 15% | 2% | 30% | 5% |
| Like | 1% | 1.5% | 1.8% | 0.5% | 0.5% | 1% | 1% |
| Bookmark | 0.2% | 0.5% | 2% | 3% | 0.1% | 2.5% | 0.5% |
| Follow | 0.1% | 0.3% | 0.5% | 0.1% | 0.05% | 1% | 2% |

### Session Phase Modifiers

| Phase | Reply | Like | Dive | Overall |
|-------|-------|------|------|---------|
| Warmup | 0.5x | 0.4x | 0.7x | 0.6x slower |
| Active | 1.0x | 1.0x | 1.0x | Normal |
| Cooldown | 0.6x | 0.7x | 0.8x | 0.4x slower |

### Final Probability Calculation

```javascript
function getAdjustedProbability(action, profile, phase) {
    const baseProb = profile.probabilities[action];
    const phaseMod = getPhaseModifier(action, phase);
    return baseProb * phaseMod;
}
```

---

## Timing Model

### Scroll Timing

```javascript
// Profile-based scroll timing
const scrollTiming = {
    mean: profile.timings.scrollPause.mean,      // e.g., 2000ms
    deviation: profile.timings.scrollPause.deviation  // e.g., 800ms
};

// Humanized execution
await humanScroll(page, {
    distance: gaussianRandom(400, 100),
    duration: gaussianRandom(scrollTiming.mean, scrollTiming.deviation),
    pause: humanDelay(1500, { jitter: 0.2 })
});
```

### Reading Timing

```javascript
// Content-aware reading time
const contentType = await analyzer.detectContentType();
const readTime = {
    textOnly: { mean: 5000, deviation: 2000 },
    image: { mean: 8000, deviation: 3000 },
    video: { mean: 15000, deviation: 5000 },
    thread: { mean: 30000, deviation: 10000 }
}[contentType];

await page.waitForTimeout(gaussianRandom(readTime.mean, readTime.deviation));
```

### Action Delays

```javascript
// "Thinking" time before actions
const actionDelay = {
    reply: { mean: 1500, deviation: 500 },   // Writing takes time
    like: { mean: 500, deviation: 200 },     // Quick decision
    retweet: { mean: 2000, deviation: 800 }, // Consideration
    follow: { mean: 5000, deviation: 2000 }  // Major decision
}[action];
```

---

## Session Flow

```
Session Start (5-10 min)
│
├─ Load Random Profile
│
├─ Warmup Phase (0-10%)
│  • Slower scrolling
│  • Minimal actions
│  • "Warming up" behavior
│
├─ Active Phase (10-80%)
│  • Peak engagement
│  • All actions available
│  • AI replies enabled
│  • Scroll patterns active
│
├─ Cooldown Phase (80-100%)
│  • Slowing down
│  • More reading
│  • Fewer actions
│
└─ Session End
   • Report statistics
   • Log profile used
   • Cleanup
```

---

## Detection Vectors Mitigated

| Vector | Risk | Mitigation |
|--------|------|------------|
| Robotic timing | High | Gaussian + jitter |
| Fixed behavior | Medium | Random profiles |
| Continuous action | Medium | Session phases |
| Same reply style | Medium | AI quality + limits |
| Over-engagement | High | Per-session limits |
| Idle freeze | Low | Idle ghosting |
| Fingerprinting | Low | Anti-detect browser |

---

## Phase 2: Hyper-Realism Features (Imperfection & Context)

To reach "indistinguishable" levels, we must introduce human limitations and consistency.

### 1. Mistake Engine (Imperfection)
Real humans are not perfect. We will inject recoverable errors:
- **Micro-misclicks**: 
    - *Logic*: `Math.random() < 0.05` -> Target `x + offset, y + offset` (miss by 3-5px) -> hover -> Wait 500-1000ms -> Correct to target.
- **Navigation Errors**: 1-2% of the time
    - *Logic*: Intend to click "Home" -> Click "Profile" instead -> Wait 1.5s (realization) -> Click "Back" or "Home".
- **Abandonment**: maybe 5-10% of the time
    - *Logic*: Hover "Like" -> Wait 500-2000ms -> Move cursor away (change of mind) -> Scroll down.
    - *Logic*: Hover "Follow" -> Wait 500-2000ms -> Move cursor away (change of mind) -> Scroll down.
    - *Logic*: Hover "Share" -> Wait 500-2000ms -> Move cursor away (change of mind) -> Scroll down.
    - *Logic*: Hover "Bookmark" -> Wait 500-2000ms -> Move cursor away (change of mind) -> Scroll down.

- **Typing Corrections**: 
    - *Logic*: In `humanTyping`, occasionally type wrong neighbor key -> Wait -> Backspace -> Type correct key.

### 2. Consistent Traits (Profile Personality)
Enforce device/user consistency throughout the session. Stored in `profile.traits`.
- **Input Method**: 
    - `Mouse User`: Uses wheel (90%), clicks swaybar (10%). Vertical moves are slightly arced.
    - `Trackpad User`: Smooth continuous scrolling (high frequency wheel events). Vertical moves are straight.
    - `Keyboard User`: Uses Space (page down), `J`/`K` (twee-by-tweet), and Arrow keys. Mouse is parked often.
- **Attention Span**: 
    - `Skimmer`: Read times are -30% of mean. Fast scrolls.
    - `Reader`: Read times are +30% of mean. Text tracing (horizontal mouse drift).

### 3. Visual Saliency (Eye Tracking)
Simulate gaze by moving cursor to high-contrast elements during pauses.
- **Saliency Detection**: Identify images, avatars, and bold text using CSS selectors.
- **Cursor Magnetism**: During "reading" pause -> Move cursor to nearest image center + random offset -> Hover 1-2s.

### 4. External Interruptions
Simulate behavior outside the browser tab.
- **Tab Switching**: 
    - *Action*: `document.visibilityState` becomes `hidden`.
    - *Duration*: Gaussian(30s, 10s).
    - *Trigger*: 5% chance after "reading" a long tweet.
- **AfK (Away from Keyboard)**: 
    - *Action*: Move cursor to viewport edge (0,0) or (max, max). Stop all input.
    - *Duration*: 1-5 minutes.
    - *Trigger*: 2% chance per session.

---

## Phase 3: Cognitive & Navigation Layers

Simulate understanding and curiosity, not just consumption.

### 5. Contextual Sentiment Guard
Prevent "bot-like" inappropriate interactions.
- **Sentiment Analysis**: Simple keyword/regex match on Tweet Text.
- **Negative Keywords**: `/(died|rip|killed|murder|scam|hacked|stolen|grief|sadness|devastated)/i`
- **Action**: 
    - If Match: Disable "Like", "Retweet", "Happy Reply".
    - Allowed: "Expand" (reading bad news is human), "Sad Reply" (advanced only).

### 6. Navigation Diversity (The "Rabbit Hole")
Humans don't just stay on the "For You" feed. Implement a State Machine:
- **States**: `FEED`, `PROFILE`, `THREAD`, `SEARCH`.
- **Transitions**:
    - `FEED` -> click Avatar -> `PROFILE`.
    - `PROFILE` -> scroll -> click Pinned Tweet -> `THREAD`.
    - `THREAD` -> click Back -> `PROFILE` -> click Home -> `FEED`.
- **Logic**: 5% chance per scroll to enter a Rabbit Hole.

### 7. Fidgeting & "Micro-Interactions"
Non-functional interactions that humans do subconsciously.
- **Text Highlighting**:
    - *Action*: `mouse.down()` -> `mouse.move(50px)` -> `mouse.up()` -> Click away (deselect).
    - *Context*: Only on `<article>` text elements.
- **Random Right-Click**: 
    - *Action*: `click({ button: 'right' })` -> Wait 1s -> `click({ button: 'left', x: -50 })` (close menu).
- **Logo Click**: 
    - *Action*: Click Twitter/X logo to refresh instead of `Command+R` or pull-down.
- **Whitespace Click**: Random click on empty space (focus regain).

### 8. Robust Motor Control (Phase 4)
Reduce "failed click" ratio and native fallback usage.
1.  **Continuous Target Tracking**:
    - *Problem*: Elements move during load (layout shift).
    - *Solution*: Re-query `boundingBox` every 50ms *during* the mouse movement.
    - *Threshold*: If target shifts >5px, recalculate Bezier curve endpoint.
2.  **Visual Overlap Protection**:
    - *Check*: `document.elementFromPoint(x, y)` before `mouse.down()`.
    - *Logic*: If top element !== target, scroll `y + 200` or adjust `x/y` to find uncovered area.
3.  **Micro-Correction & Spiraling**:
    - *Trigger*: Click fired but no navigation/Action within 500ms.
    - *Recovery*: 
        1. "Wiggle" cursor (human frustration).
        2. Spiral search: Try (x, y-5), (x, y+5), (x-5, y).
4.  **Smart Selectors**:
    - *Fallback*: If primary selector fails, try `xpath=..` (parent) or `text="Reply"`.

### 9. Temporal & Environmental Awareness (Phase 5)
Humans exist in time and space; bots often ignore this.
- **Circadian Rhythm**: 
    - *Logic*: Get Proxy Timezone via IP-API or System. 
    - *Schedule*: 
        - 02:00 - 06:00: 95% chance to SKIP session (Sleep).
        - 08:00 - 18:00: Normal activity.
        - 18:00 - 23:00: High "Doomscroll" probability.
- **Network Simulation**: 
    - *Logic*: Measure `page.goto` latency.
    - *Reaction*:
        - Slow (>5s): Increase "Frustration" (start clicking while loading).
        - Fast (<1s): "Surprise" (hesitate before acting).

### 10. Content Interaction Depth (Phase 6)
Beyond just "Like" and "Retweet".
- **Video Engagement**: 
    - *Sequence*: Hover video container -> Click "Unmute" -> Wait 10-30s (watching) -> Click "Mute" -> Scroll.
    - *Probability*: 40% for tweets with video.
- **Poll Participation**: 
    - *Logic*: Identify Poll options selector `[data-testid="pills"]`. Select Random. Click "Vote".
- **Link Hoarding**: 
    - *Action*: Click Share Button (specific SVG) -> Wait -> Click "Copy Link".
    - *Selectors*: `button[aria-label="Share post"]` -> `text="Copy link"`.
    - *Purpose*: Simulates "Shadow sharing" (sharing to DM/Discord without tracking).
- **Image Expansion**: 
    - *Action*: Click Image -> Wait 2s -> Click "X" or "Back".
    - *Complex*: 30% chance to "Copy Link" *while* image is open.

### 11. Session Memory (Within-Session Only)
Humans remember what they just did. Bots forget.
Since we use randomized browser profiles, no cross-session persistence.

- **Recent Actions Awareness**:
    - *Within-Session*: Track last 5 actions to avoid repetition.
    - *Logic*: If just liked tweet from @user, skip next @user tweet (variety).
- **Reply Continuity**:
    - *Within-Session*: If replied to a thread, continue reading that thread.
    - *Logic*: Track `currentThreadId`. Don't dive same thread twice.
- **Topic Drift**:
    - *Within-Session*: Notice when content type changes.
    - *Behavior*: If switched from News → Memes → More Memes (adjust pace).

### 12. Strategic Survival (Phase 8)
Defensive behaviors to avoid shadowbans.
- **Trap Detection**: 
    - *Logic*: Inspect element styles before click.
    - *Condition*: `window.getComputedStyle(el).opacity < 0.1` OR `display === 'none'`.
    - *Action*: Add to `ignoreList` for session.
- **Ban Check**: 
    - *Logic*: Check `page.title()` / `h1` for "Account suspended" or "Caution".
    - *Action*: If found, update `profiles.json` status to `DEAD` and `process.exit()`.

### 13. Creative & Reactive Dynamics (Phase 9)
Behaviors driven by internal "mood" or curiosity.
- **Drafts & Ghosts**: 
    - *Sequence*: Click Composer -> Type "WAGMI" or "Gm" -> Wait 2s -> Delete chars -> Click Close -> Discard.
    - *Probability*: 2% per session. "I have nothing to say" syndrome.
- **Notification Pruning**: 
    - *Sequence*: Click Notifications -> Scroll 1000px -> Click "Mentions" tab -> Scroll -> Back to Home.
- **Ego Surfing**: 
    - *Sequence*: Click Own Avatar -> Scroll own timeline -> Un-retweet old RT (clean up) -> Home.
- **Tag Exploration**: 
    - *Sequence*: Click `#Hashtag` -> Scroll 2-3 tweets -> Click Back.

### 14. Power User Patterns (Phase 10)
Simulate "Pro" behavior (Desktop focus).
- **Multi-Tab Simulation**: 
    - *Action*: `ctrl` + click tweet (Open in new tab).
    - *Flow*: `browser.waitForTarget` -> Switch to new page -> Read -> Close page -> Switch back.
- **Clipboard Usage**: 
    - *Action*: Click "Share" -> "Copy Link" -> `page.evaluate(navigator.clipboard.readText())`.
    - *Alt-Tab*: `page.evaluate(() => window.dispatchEvent(new Event('blur')))` -> Wait 5s (paste external) -> `focus`.
- **Keyboard Navigation**: 
    - *Action*: Use `page.keyboard.press('j')` / `k` for 10 consecutive tweets.

### 15. Community & Lists (Phase 11)
Escaping the "For You" algorithm.
- **List Checking**: 
    - *URL*: `twitter.com/i/lists/[id]`.
    - *Behavior*: High "Like" rate (curated content), Low "Reply" rate.
- **Community Lurking**: 
    - *Action*: Navigate to Community Page -> Sort by "Top" -> Scroll.
- **Pinned Tweet Checking**: 
    - *Logic*: Always check pinned tweets when visiting a profile (high saliency).

## Files Modified

| File | Changes |
|------|---------|
| `ai-twitteractivity-plan.md` | Updated with current status + implementation plan |
| `tasks/ai-twitterActivity.js` | ⚠️ REPLY_PROBABILITY = 1.0 needs fix (should be 0.10) |
| `config/settings.json` | ⚠️ Twitter settings not yet added |

## Files to Create (Phase 1)

| File | Purpose | Status |
|------|---------|--------|
| `utils/session-phases.js` | Session phase detection | ⏳ Pending |
| `utils/human-timing.js` | Gaussian timing + jitter | ⏳ Pending |
| `utils/scroll-humanizer.js` | Scroll pattern humanization | ⏳ Pending |

## Existing Components Available

| File | Purpose |
|------|---------|
| `utils/profileManager.js` | Behavioral profile selection |
| `utils/mathUtils.js` | Random utilities |
| `utils/ghostCursor.js` | Human-like mouse movement |
| `utils/ai-twitterAgent.js` | AI reply generation |
| `utils/ai-reply-engine.js` | Reply extraction (5 strategies) |
| `utils/browserPatch.js` | Humanization patch |
| `core/idle-ghosting.js` | Background mouse movements |

---

## Testing Checklist

### Pre-Implementation (Current State)
- [x] Basic task structure exists
- [x] ProfileManager integration works
- [x] Multi-API fallback configured (9 providers)
- [x] Reply extraction engine functional

### Post-Implementation (After Changes)
- [ ] Session duration varies 5-10 minutes
- [ ] Profile description logged at start
- [ ] REPLY_PROBABILITY is 0.10 (NOT 1.0)
- [ ] Phase transitions logged
- [ ] Engagement limits enforced
- [ ] Timing shows Gaussian distribution
- [ ] No linear/rigid patterns
- [ ] Idle ghosting active during reads
- [ ] AI replies are contextual
- [ ] No over-engagement (check stats)

---

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Reply probability | 10% | 100% | 🚩 CRITICAL |
| Session duration | 5-10 min | 10-15 min | ⚠️ High |
| Engagement limits | Conservative | Not enforced | ⏳ Pending |
| Phase detection | Implemented | Not implemented | ⏳ Pending |
| Human timing | Gaussian | Linear | ⏳ Pending |
| Detection rate | 0% | Unknown | TBD |

---

## 🚨 CRITICAL ISSUES TO FIX

### 1. REPLY_PROBABILITY = 1.0 (Line 16)
```javascript
const REPLY_PROBABILITY = 1.0;  // 🚩 RED FLAG - 100% reply rate = BOT
```

**Impact**: Bot detection guaranteed. Real users reply to ~10-15% of viewed content.

**Fix**:
```javascript
const REPLY_PROBABILITY = 0.10;  // 10% max
```

### 2. Session Duration Too Long (Lines 14-15)
```javascript
DEFAULT_MIN_DURATION = 600;  // 10 minutes
DEFAULT_MAX_DURATION = 900;  // 15 minutes
```

**Impact**: Long sessions increase detection risk. Real users typically browse 5-10 min.

**Fix**:
```javascript
DEFAULT_MIN_DURATION = 300;  // 5 minutes
DEFAULT_MAX_DURATION = 540;   // 9 minutes
```

### 3. No Engagement Limits Enforced

The `ENGAGEMENT_LIMITS` constant is defined but not used:
```javascript
const ENGAGEMENT_LIMITS = {
    maxReplies: 3,
    maxRetweets: 1,
    maxLikes: 5,
    maxFollows: 2
}
```

**Impact**: Bot can unlimitedly engage, triggering rate limits.

**Fix**: Integrate into AITwitterAgent state tracking.

---

## Next Steps (Phase 1 - Core Features)

### Priority 1: Fix Critical Issues

1. **Fix REPLY_PROBABILITY** in `tasks/ai-twitterActivity.js`:
   ```javascript
   REPLY_PROBABILITY = 1.0 → 0.10  // 100% → 10%
   ```

2. **Fix Session Duration** in `tasks/ai-twitterActivity.js`:
   ```javascript
   DEFAULT_MIN_DURATION = 600 → 300  // 10 min → 5 min
   DEFAULT_MAX_DURATION = 900 → 540  // 15 min → 9 min
   ```

### Priority 2: Create Utility Modules

3. **Create `utils/session-phases.js`**:
   - `getSessionPhase(elapsed, total)` returns 'warmup'/'active'/'cooldown'
   - `getPhaseModifier(action, phase)` returns multiplier (0.5x-1.0x)

4. **Create `utils/human-timing.js`**:
   - `gaussianRandom(mean, stdev)` - bell curve timing
   - `humanDelay(base, options)` - with jitter/pause/burst
   - Content-aware reading times

5. **Create `utils/scroll-humanizer.js`**:
   - Natural scroll patterns with easing
   - Variable distance/speed
   - Profile-based timing

### Priority 3: Integrate into Task

6. **Enforce Engagement Limits** in `AITwitterAgent`:
   - Track `sessionStats` per session
   - Check limits before each action

7. **Integrate Random Profile Selection**:
   ```javascript
   const profile = mathUtils.sample(profileManager.getAll());
   ```

8. **Update config/settings.json** with Twitter settings

### Priority 4: Testing

9. Test with conservative settings
10. Tune based on results

---

## Files to Create/Modify

| File | Action | Priority |
|------|--------|----------|
| `utils/session-phases.js` | Create | High |
| `utils/human-timing.js` | Create | High |
| `utils/scroll-humanizer.js` | Create | High |
| `tasks/ai-twitterActivity.js` | Modify | High |
| `config/settings.json` | Modify | Medium |
| `utils/ai-twitterAgent.js` | Modify | Medium |

---

## Appendix: Profile Descriptions

Generated by `generateProfiles.js` with format:

```
{id}-{Type} | Input: {Mouse|Keys} ({percentage}%) | Dive: {dive}% | T-Dive: {t-dive}% Like: {like}% Bkmk: {bookmark}% Follow: {follow}%
```

Example:
```
01-Balanced | Input: Mouse (85%) | Dive: 28% | T-Dive: 9.2% Like: 1.8% Bkmk: 0.5% Follow: 0.3%
```

---

## Phase 2: Hyper-Realism Features (COMPLETED)

### ✅ Session Phase Integration
Added to `utils/ai-twitterAgent.js`:
- `updateSessionPhase()` - tracks warmup/active/cooldown
- `getPhaseModifiedProbability()` - applies modifiers to actions
- `isInCooldown()` / `isInWarmup()` - phase queries

### ✅ Sentiment Guard
Created `utils/sentiment-guard.js`:
- Blocks likes/retweets on negative content (death, tragedy, grief)
- Analyzes keywords and patterns
- Allows expanding negative content (human behavior)

### ✅ Mistake Engine
Created `utils/mistake-engine.js`:
- Misclick simulation (5% chance)
- Abandonment simulation (8% chance)
- Typing error simulation
- Recovery behavior

### ✅ Navigation Diversity
Created `utils/navigation-diversity.js`:
- State machine (FEED → PROFILE → THREAD → SEARCH)
- Rabbit hole transitions
- Return-to-feed pathing

---

## Phase 3: Cognitive & Navigation Layers (PENDING)

### ⏳ Contextual Sentiment Guard
Already implemented in Phase 2 ✅

### ⏳ Navigation Diversity (The "Rabbit Hole")
Already implemented in Phase 2 ✅

### ⏳ Fidgeting & Micro-Interactions
**Planned:**
- Text highlighting
- Random right-click
- Logo clicks
- Whitespace clicks

### ⏳ Robust Motor Control
**Planned:**
- Continuous target tracking
- Visual overlap protection
- Micro-correction & spiraling
- Smart selectors

### ⏳ Temporal Awareness
**Planned:**
- Circadian rhythm (skip night sessions)
- Network simulation (frustration detection)

### ⏳ Content Interaction Depth
**Planned:**
- Video engagement (unmute/watch)
- Poll participation
- Image expansion

---

## Files Created (Phase 2)

| File | Purpose |
|------|---------|
| `utils/sentiment-guard.js` | Skip negative content for likes/retweets |
| `utils/mistake-engine.js` | Human imperfections simulation |
| `utils/navigation-diversity.js` | Rabbit hole state machine |

## Files Modified (Phase 2)

| File | Changes |
|------|---------|
| `utils/ai-twitterAgent.js` | Added session phase tracking, sentiment integration |
| `utils/entropyController.js` | Added sessionId for parallel safety |
| `utils/actionOrchestrator.js` | Added sessionId for parallel safety |

---

## Testing Checklist

### Phase 1 Completed ✅
- [x] Session duration varies 5-10 minutes
- [x] Profile description logged at start
- [x] REPLY_PROBABILITY is 0.10 (NOT 1.0)
- [x] Engagement limits enforced
- [x] Timing shows Gaussian distribution

### Phase 2 Completed ✅
- [x] Session phases logged (warmup/active/cooldown)
- [x] Sentiment guard blocks likes on negative content
- [x] Mistake engine available (misclick, abandonment)
- [x] Navigation state machine available
- [x] Parallel safety verified

### Phase 3 Pending ⏳
- [ ] Fidgeting behaviors implemented
- [ ] Robust motor control implemented
- [ ] Temporal awareness implemented
- [ ] Video engagement implemented

---

## 🔄 Parallel Browser Safety

### Issue Summary

When running multiple parallel browser sessions, certain singleton modules share mutable state:

| Module | Issue | Status |
|--------|-------|--------|
| `utils/entropyController.js` | Shared sessionStart, fatigue, entropy | ✅ Fixed |
| `utils/actionOrchestrator.js` | Shared action history | ✅ Fixed |
| `utils/profileManager.js` | Module-level PROFILES array | ✅ Safe (read-only) |
| `utils/apiHandler.js` | No mutable state | ✅ Safe |

### Fix Applied

Both `EntropyController` and `ActionOrchestrator` now:
1. Accept `sessionId` in constructor for tracking
2. Include `sessionId` in all log messages
3. Export the CLASS for new instance creation
4. Keep singleton for backward compatibility with warnings

### Usage Patterns

#### ❌ UNSAFE (shared state across browsers)

```javascript
import { entropy } from '../utils/entropyController.js';
import { actionOrchestrator } from '../utils/actionOrchestrator.js';

// All browsers share the same entropy/fatigue state
entropy.retryDelay();
actionOrchestrator.getNextRoutine();
```

#### ✅ SAFE (isolated per browser)

```javascript
import { EntropyController } from '../utils/entropyController.js';
import { ActionOrchestrator } from '../utils/actionOrchestrator.js';

// Create NEW INSTANCE per browser
const entropy = new EntropyController({ 
    sessionId: `browser-${browserIndex}` 
});
const orchestrator = new ActionOrchestrator({ 
    sessionId: `browser-${browserIndex}` 
});

// Use isolated instances
entropy.retryDelay();
orchestrator.getNextRoutine();
```

### Our New Modules (Already Parallel-Safe)

| Module | Reason |
|--------|--------|
| `utils/session-phases.js` | Pure functions, no state |
| `utils/human-timing.js` | Pure functions, no state |
| `utils/scroll-humanizer.js` | Uses passed `page` parameter |
| `utils/engagement-limits.js` | Creates new tracker per instance |
| `utils/ai-twitterAgent.js` | Instance-based state (engagementTracker) |
| `tasks/ai-twitterActivity.js` | Creates new agent per run |
