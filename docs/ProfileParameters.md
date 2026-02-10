# Twitter Activity Profile Parameters (`twitterActivityProfiles.json`)

This file contains an array of profile objects that define the behavioral "personality" of the automated agent.

## Top-Level Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Unique identifier for the profile (e.g., "PROF_DEBUG_01"). Used in logs. |
| `description` | String | Human-readable summary of the profile's stats. Generated automatically by the helper scripts. |
| `theme` | String | **"dark"** or **"light"**. Enforces the browser color scheme for the session. Defaults to "dark". |
| `timings` | Object | Defines time duration ranges for various activities. |
| `probabilities` | Object | Defines the % chance of performing specific actions after a reading phase. |
| `inputMethods` | Object | Defines the % distribution of scrolling methods used. |
| `engagement` | Object | Defines the % chance of interacting with content. |

## Detailed Breakdown

### 1. `timings`
Controls the pacing of the agent.

*   **`readingPhase`**: How long the agent scrolls/reads before considering a new major action (refresh, profile dive, idle).
    *   `min`: Minimum duration in milliseconds.
    *   `max`: Maximum duration in milliseconds.
*   **`scrollPause`**: The pause between individual scroll actions (mimics human reading speed).
*   **`space`**: Probability of hitting the Spacebar (page jump).
*   **`keysDown`**: Probability of using Arrow Down.
*   **`keysUp`**: Probability of using Arrow Up (backtracking).

### 4. `engagement`
Passive interactions during the reading phase.

*   **`like`**: (0.0 - 1.0) Probability of liking a tweet *specifically during a scroll pause*.
    *   *Note:* The agent checks this probability repeatedly while reading. A value of `0.01` means a 1% chance *every time it pauses to read*, not per session.
    *   **Workflow:** Inspect Tweet in viewport -> Click Timestamp -> Read -> Like -> Return Home.

---

## Example (Debug Profile)
```json
{
  "id": "PROF_DEBUG_01",
  "theme": "dark",
  "engagement": { "like": 0.8 }, // 80% chance to like when pausing
  "probabilities": { "profileDive": 0.8 } // 80% chance to visit profiles
}
```
