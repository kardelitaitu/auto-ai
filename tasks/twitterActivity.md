# Twitter Activity Task 🐦

This document outlines the **Twitter Activity** automation task, detailing its architecture, logic flow, and configuration. The system is designed to simulate human-like behavior on Twitter (X) using stochastic processes and dynamic profiles.

## 🚀 Quick Start

Run the task on all connected browsers:

```bash
node main.js twitterActivity
```

## 🧠 Architecture & Logic

The automation is built on a few core components that work together to create realistic activity.

### Components

1.  **Entry Point** (`tasks/twitterActivity.js`)
    *   Initializes the logger and `TwitterAgent`.
    *   **Warm-up Jitter**: Waits for a random duration (2-15s) after browser launch to decouple automation signatures.
    *   **Organic Entry**: Randomizes the starting page (50% Home, 50% Explore/Notifications/Bookmarks) to avoid "Bookmarking" detection.
    *   Manages the overall session duration (default: 10-15 mins).

2.  **The Agent** (`utils/twitterAgent.js`)
    *   **Brain**: Maintains state (fatigue, engagement counts).
    *   **Entropy Controller**: Uses localized Gaussian and Log-Normal distributions for all timing (no fixed delays).
    *   **Ghost Cursor**: Simulates human mouse movements (curves, jitters, overshoots 80-300ms).
    *   **Fatigue System**: After 3-8 minutes, the agent gets "tired" and switches to a slower browsing profile ("Hot Swap").
    *   **Decision Engine**: Uses probabilities to decide actions (Scroll, Like, Click, Idle).

3.  **Profile System** (`utils/profileManager.js` & `data/twitterActivityProfiles.json`)
    *   **Personalities**: Profiles have distinct behaviors (e.g., "Skimmer" scrolls fast, "Reader" scrolls slow).
    *   **Input Handling**: Some profiles prefer Mouse Wheel, others prefer Keyboard Arrows/Spacebar.
    *   **Evolution**: The system automatically swaps profiles during a session to simulate changing attention spans.

### 🌊 Logic Flow Diagram

This diagram fully explains the decision-making process of the bot.

```text
[Start Task] --> [Load Profile & Init Agent] --> [Warm-up Jitter]
                         ^
                         |
                 [Select Profile]
             (Manual ID or Random Starter)
                         |
                         v
               [Entropy Check & Pace Init]
                         |
                         v
                       +---------+---------+
                       | Load Organic URL  |
                       | (twitterActivityURL.txt)|
                       +---------+---------+
                                 |
                                 v
                       [Referrer Engine]
                  (Google, Reddit, t.co context)
                                 |
                                 v
                       [Navigate & Read]
                       (10-20s Reading)
                                 |
                                 v
                       [Follow Chance?]   -----> (20% Yes) --> [Strict Verification]
                                 |                                   |
                                 No <--------------------------------+
                                 |
                                 v
                        [Navigate Home]
                         |
                         v
                    [Tweet Probability]
                  (20% Start of Session)
                         |
                         v
                   [Logged In?]
                   /          \
                 No           Yes
                 |             |
              [End]     [Start Loop]
                               |
                               v
                  +------------+-------------+
                  |  Check for Burst Mode?   | <---- (10% Chance if !Fatigued)
                  +------------+-------------+
                               |
                               v
              +--------------------------------+
              |         READING PHASE          |
              | (Entropy Scroll, Mouse Jitter) |
              +---------------+----------------+
                              |
                     [Continue Session?]
                        /           \
                      No            Yes
                      |              |
                    [End]       [Is Fatigued?]
                                 /          \
                               Yes          No
                                |            |
                         [Fatigue Mode]      |
                         (Slower Pace)       |
                                |            |
                                +------+-----+
                                       |
                             [Calculate Probability]
                                       |
                                 [Next Action?]
                                       |
      +----------------------+---------+----------+--------------------------+
      |                      |                    |                          |
 [Refresh]                 [Idle]           [Profile Dive]             [Tweet Dive]
 (10-20%)                 (10-30%)             (15-40%)                   (5-10%)
      |                      |                    |                          |
      +----------------------+----------+---------+--------------------------+
                                        |
                                        v
                                  [Repeat Loop]
```

---

## ⚙️ Configuration details

You can fine-tune the behavior by understanding how "Profiles" work.

### Profile Structure
Each profile in `data/twitterActivityProfiles.json` contains:
*   **Timings**: How long to read, how long to pause between scrolls.
*   **Probabilities**: Chance to Refresh, Dive, Like, or Idle.
*   **Input Methods**: Preference for Mouse Wheel vs. Arrow Keys.

### Session Control
By default, the task runs for **10 to 15 minutes**.
To change this without coding, you can modify the arguments in `main.js` or directly edit the defaults in `tasks/twitterActivity.js`:

```javascript
// tasks/twitterActivity.js
const minDuration = 600; // 10 minutes
const maxDuration = 900; // 15 minutes
```

## 🛠️ Actions Explained

| Action | Description |
| :--- | :--- |
| **Reading Phase** | The main state. Scrolls down the timeline using **Entropy-based** random intervals (Gaussian/Log-Normal). Can be strictly mouse-based or keyboard-based. |
| **Tweet Dive** | Clicks a tweet to expand it. Simulates reading replies. Occasionally Likes (❤️) or Bookmarks (🔖) based on profile probability. **Retweets are disabled.** |
| **Profile Dive** | Clicks a user's avatar to visit their profile. May scroll their posts, check "Media" or "Likes" tabs, and rarely Follow (➕). |
| **Refresh** | Clicks the "Home" icon or "X" logo to refresh the feed, simulating a user checking for new updates. |
| **Fatigue** | A hidden state that triggers after a few minutes. It slows down scrolling and increases the chance of Idling, simulating a user getting bored. |

---

## 🐛 Troubleshooting

*   **Login Issues**: If the logs say `[WARN] Browser appears NOT eligible...`, the bot detected a Login button. Ensure your browser profile is logged in.
*   **Stuck**: If the bot is just idling for > 2 minutes, it might be in "Deep Diver" mode or "Doom Scroller" fatigue. This is usually intentional behavior.