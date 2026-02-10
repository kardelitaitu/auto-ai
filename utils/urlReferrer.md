# Anti-Detect Referrer Engine 🛡️

The `utils/urlReferrer.js` module is a sophisticated navigation engine designed to mimic natural user traffic. Unlike simple bots that visit pages directly (referrer: empty), this engine mathematically simulates traffic from Search Engines, Social Media, and Messaging Apps while adhering to modern privacy standards to avoid "impossible traversal" flags.

## 🧠 Architecture

### 1. Referrer Engine (`ReferrerEngine`)
The core orchestrator.
- **Strategy Selection**: Probabilistically chooses where the user "came from" (30% Google, 30% Social, 10% Direct, etc.).
- **Smart Constraints**: Prevents logical errors (e.g., never using a `t.co` referrer if the target is already internal to Twitter).
- **Smart Context Awareness**: Analyzes the Target URL to generate hyper-specific search queries.
    - Target: `x.com/elonmusk` -> Referrer: `google.com/?q=who+is+elonmusk+twitter`
    - Target: `x.com/user/status/123` -> Referrer: `google.com/?q=what+did+user+tweet`

### 2. Privacy Engine (`PrivacyEngine`)
Simulates the **"Natural Filter"** of modern browsers (`strict-origin-when-cross-origin`).
- **Realism**: Anti-fraud systems know that Chrome/Safari truncates referrers. A bot sending a full Reddit thread URL to a 3rd party site is highly suspicious.
- **Logic**: It automatically strips paths from sensitive sources (Discord, Reddit, Telegram) while keeping them for trusted ones (Google, t.co) where appropriate.

### 3. Header Engine (`HeaderEngine`)
Calculates correct Fetch Metadata headers (`Sec-Fetch-Site`, `Sec-Fetch-Mode`) based on the relationship between the referrer and the target.

### 4. Trampoline Navigation (`trampolineNavigate`)
The "Gold Standard" for spoofing.
Instead of just setting a header (which some advanced fingerprinting scripts can detect via `performance.navigation.type`), this technique:
1.  Intercepts the request to the *fake* referrer (e.g., `reddit.com`).
2.  Serves a local dummy page ("Trampoline") on that domain.
3.  Actually **clicks a link** on that dummy page to navigate to the target.
This produces a 100% genuine navigation event, `referer` header, and history stack.

---

## 🌊 Logic Flow Diagram

```text
                                [Start Navigation]
                                        |
                                        v
                                [Select Strategy]
                   (Direct, Google, Reddit, t.co, WhatsApp)
                                        |
                                        v
                            [Generate Raw Referrer URL]
                  (e.g., "reddit.com/r/tech/comments/xyz/...")
                                        |
                                        +<--- [Inject Real VEDs] (if Google)
                                        |
                                        v
                              [Privacy Engine Filter]
                         (Simulate Browser Privacy Policy)
                       /                                 \
           [Truncate Path]                             [Keep Path]
      (Reddit, Discord -> Origin)                 (Google, t.co -> Full)
                       \                                 /
                        \                               /
                         v                             v
                        [Header Engine Context Analysis]
                   (Calc Sec-Fetch-Site: cross-site/same-site)
                                        |
                                        v
                              [Navigation Method]
                               /               \
                       (Simple)                 (Complex/Trampoline)
                          |                            |
                          v                            v
               [Set Headers & Goto]        [Intercept Request to Referrer]
                                                       |
                                                       v
                                            [Serve Fake "Trampoline" Page]
                                                       |
                                                       v
                                            [Auto-Click Link on Page]
                                                       |
                                                       v
                                            [Real Browser Navigation]
                                       (Correct "Link Click" Metadata)
```

---

## 🛠️ Usage

```javascript
import { ReferrerEngine } from './utils/urlReferrer.js';

// 1. Initialize
const engine = new ReferrerEngine({ addUTM: true });

// 2. Execute Navigation
await engine.navigate(page, 'https://target-site.com');
```

## 📋 Supported Strategies

| Strategy | Probability | Description | Example URL (Approx) |
| :--- | :--- | :--- | :--- |
| **Direct** | 10% | Empty referrer, mimics bookmarks. | ` ` (empty string) |
| **Search** | 30% | Google, Bing, DDG. **Context-Aware**. | `google.com/search?q=elonmusk+twitter+status...` |
| **Social** | 30% | Twitter (t.co), Reddit, Discord. | `https://t.co/Xy9Z12` or `https://www.reddit.com/` |
| **Messaging** | 25% | WhatsApp, Telegram. Web/API interfaces. | `https://web.whatsapp.com/` |
| **Long Tail** | 5% | Medium, Substack, Hacker News. | `https://news.ycombinator.com/item?id=38192` |
