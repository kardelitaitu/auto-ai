# AGENT JOURNAL - 01 March 2026

01-03-2026--22-47
Removed `goto` fallback from follow pre-navigation for stealth (both `tasks/follow-test.js` by user and `utils/ai-twitterAgent.js`):
- `tasks/follow-test.js`: user removed goto, kept only `api.click()` with failure log.
- `utils/ai-twitterAgent.js`: removed `count()` pre-check and `goto` fallback; now calls `humanClick(authorLink)` directly. On click failure → `selectedAction = null` (skip follow, no direct URL navigation).
- Selector tightened: `a[href*="/${username}"]` → exact `a[href="/${username}"]` matching confirmed DOM structure.
- Syntax: `node -c` → OK.

01-03-2026--22-35
Created `tasks/follow-test.js` — live tester for the follow flow, mirroring `tasks/reply-test.js`:
- Navigates to a tweet URL (default: GraceGym_ tweet), extracts profile URL via regex.
- Clicks `[data-testid="User-Name"] a[href*="/{username}"]` to navigate to profile (goto fallback).
- Calls `api.followWithAPI({ username })` and logs pass/fail with reason.
- Usage: `node main.js follow-test` or `node main.js follow-test --url https://x.com/SomeUser/status/123`.
- Syntax: `node -c` → OK.

01-03-2026--22-33
Implemented follow profile pre-navigation in `utils/ai-twitterAgent.js`:
- **Where**: Added `else if (selectedAction === 'follow')` block after the reply/quote context pre-fetch (line ~1288).
- **Logic**: Extract `profileUrl` from `tweetUrl` via `tweetUrl.replace(/\/status\/\d+.*/, '')`. E.g. `https://x.com/GraceGym_/status/xxx` → `https://x.com/GraceGym_`.
- **Navigation**: Clicks `[data-testid="User-Name"] a[href*="/{username}"]` (human-like). Falls back to `pageOps.goto(profileUrl)` if link not found. Skips follow entirely if navigation fails or username is unknown.
- **Context**: `profileUrl` now passed into the `context` object for `followWithAPI`.
- **Metrics**: Already wired — `makeApiExecutor` calls `diveQueue.recordEngagement('follows')` and `stats.successes++` on success.
- Syntax: `node -c` → OK.

01-03-2026--21-53
Wired `follow` action slot into `AITwitterAgent` so `followWithAPI` can fire:
- **Root cause**: `agent.actions.follow` was `undefined`; the `makeApiExecutor` loop in `api-twitterActivity.js` silently skipped it.
- **New file**: `utils/actions/ai-twitter-follow.js` — `FollowAction` class mirroring `LikeAction` structure. `execute()` is a stub overridden at runtime by `makeApiExecutor`.
- **Updated** `utils/actions/index.js`: exported `FollowAction`; added `follow` to `ActionRunner.loadConfig()`, `getEngagementType()` map, and `calculateSmartProbabilities()` `baseActions` array.
- **Updated** `utils/ai-twitterAgent.js`: imported `FollowAction`, added `follow: new FollowAction(this)` to `actionInstances`.
- **Updated** `config/settings.json`: added `twitter.actions.follow` with `probability: 0.1, enabled: true`.
- Verified syntax: `node -c` on all 3 modified/new JS files — ALL OK.

01-03-2026--21-40
Unified Twitter action helpers in `tasks/api-twitterActivity.js`:
- **Root cause**: The task manually monkey-patched only `reply` and `quote` action executors (~80 lines of boilerplate per action), while `like`, `bookmark`, `retweet` used a different class-based system through `AITwitterAgent`. `follow` had no api/ wrapper at all.
- **New files** (all syntax-verified with `node -c`):
  - `api/actions/like.js` → `likeWithAPI()` — like button with already-liked guard + toast verification
  - `api/actions/bookmark.js` → `bookmarkWithAPI()` — bookmark with state guard + toast verification
  - `api/actions/retweet.js` → `retweetWithAPI()` — retweet menu flow with already-retweeted guard
  - `api/actions/follow.js` → `followWithAPI()` — follow with polling verification + retry
- **Updated** `api/index.js`: imported and exported all 4 new functions on the `api` object.
- **Refactored** `tasks/api-twitterActivity.js`:
  - Removed the ~80-line manual duplicate override block.
  - Added `makeApiExecutor` factory (~20 lines) encapsulating stats, `canEngage()` guard, `api.withPage()` wrap, and uniform return shape.
  - Added `ACTION_API_MAP` data-driven loop covering all 6 actions: reply, quote, retweet, like, bookmark, follow.
  - Net: **−40 lines**, all 6 actions now handled identically through the same codepath.
- Verified syntax: `node -c` on all modified/new files — ALL OK.

01-03-2026--12-42
Cleaned up `config/settings.json`:
- Removed unused `twitter.actions.reply` and `twitter.actions.quote` entries.
- These were dead duplicates — `task-config-loader.js` reads reply/quote probabilities from `twitter.reply.probability` and `twitter.quote.probability` respectively, never from `twitter.actions.*`.
- `twitter.actions.like`, `twitter.actions.bookmark`, and `twitter.actions.retweet` remain as they are the canonical source for those probabilities.

01-03-2026--13-33
Fixed `cookiebot` and `pageview` to prevent session corruption and ensure tab closure:
- **Major Fix**: Re-added `page.close()` to both `tasks/cookiebot.js` and `tasks/pageview.js` after user feedback that tabs were not closing. Although previously removed to prevent "session corruption", it was determined that the `SessionManager`'s page pooling was keeping tabs open indefinitely.
- **Root Cause Re-eval**: The actual cause of the "corrupted context" was likely the undefined `api.withErrorHandling` in `cookiebot.js`, which has now been fixed. Re-adding `page.close()` is now safe as `orchestrator.js` correctly re-acquires a new page if the old one is closed.
- **Optimization**: Reduced `loopCount` in `cookiebot.js` from `20-30` to `5-10`.
- Verified syntax with `node -c` on both files.


Fixed quote probability and max limit not being respected in `tasks/api-twitterActivity.js`:
- **Root cause (probability)**: `ActionRunner.loadConfig()` and `AIQuoteAction/AIReplyAction.loadConfig()` read `twitterConfig.actions.quote.probability` but `taskConfig` (passed as `twitterConfig`) had no `.actions` key — always fell back to hardcoded defaults (reply=0.6, quote=0.2) regardless of `settings.json`.
- **Fix**: Injected a properly structured `.actions` object into the config passed to `AITwitterAgent`, derived from `taskConfig.engagement.probabilities` (which correctly reads `settings.json` values). Now `ActionRunner` and action classes see the live probabilities from `settings.json`.
- **Root cause (max limit)**: Confirmed from previous fix session — `recordEngagement()` is correctly called in the execute overrides.
- Verified syntax with `node -c`.


Changed `twitter.reply.probability` in `config/settings.json` from `0.6` (60%) to `0.5` (50%).


Fixed engagement limits not being enforced (quote/reply could fire more than maxQuotes/maxReplies):
- **Root cause**: `AIQuoteAction.execute()` and `AIReplyAction.execute()` both checked `diveQueue.canEngage()` in `canExecute()` but **never called `diveQueue.recordEngagement()`** on success, so the counter was always 0 and the limit was never hit.
- Additionally, the `agent.actions.quote.execute` and `agent.actions.reply.execute` overrides in `api-twitterActivity.js` completely bypassed `canExecute()`, so there was no limit check at all.
- **Fix** (3 files):
  - `utils/actions/ai-twitter-quote.js`: Added `this.agent.diveQueue?.recordEngagement('quotes')` after successful post.
  - `utils/actions/ai-twitter-reply.js`: Added `this.agent.diveQueue?.recordEngagement('replies')` after successful post.
  - `tasks/api-twitterActivity.js`: Added `canEngage()` guard at start of each execute override + `recordEngagement()` on success.
- Verified syntax with `node -c` on all 3 files.


Fixed engagement limits not being read from `config/settings.json` in `utils/config-service.js`:
- **Root cause**: `getEngagementLimits()` was reading `twitter.activity.engagementLimits` — a path that does not exist in `settings.json`. It always fell back to hardcoded defaults (replies:3, retweets:1, etc.) regardless of what `settings.json` said.
- **Where limits actually live**: `settings.json` → `twitter.engagement.maxReplies`, `maxRetweets`, `maxQuotes`, `maxLikes`, `maxFollows`, `maxBookmarks`.
- **Fix**: Rewrote `getEngagementLimits()` to read `this._settings.twitter.engagement` directly and remap `maxX` → `x` keys to match the internal format expected by `DiveQueue` and `AITwitterAgent`.
- Full chain: `settings.json` → `config-service.getEngagementLimits()` → `task-config-loader.buildConfig()` → `taskConfig.engagement.limits` → `AITwitterAgent` constructor → `DiveQueue` — all now live.
- Verified syntax with `node -c utils/config-service.js`.


Fixed `api.replyWithAI()` and `api.quoteWithAI()` silently failing in `tasks/api-twitterActivity.js`:
- **Root cause**: Both `agent.actions.reply.execute` and `agent.actions.quote.execute` overrides called `api.replyWithAI()` / `api.quoteWithAI()` from an async branch with no `AsyncLocalStorage` context. The API uses `getPage()` → `checkSession()` → `contextStore.getStore()` which returns `null` if the call isn't running inside an `api.withPage()` callback, causing a `ContextNotInitializedError`.
- **Why `reply-test.js` works**: It wraps everything in `api.withPage(page, ...)` before calling `api.replyWithAI()`, binding the page to the execution context.
- **Fix**: Wrapped both calls with `api.withPage(page, () => api.replyWithAI())` and `api.withPage(page, () => api.quoteWithAI())` inside the execute overrides in `tasks/api-twitterActivity.js` (lines ~224 and ~254).
- Verified syntax with `node -c tasks/api-twitterActivity.js`.



01-03-2026--12-20
Updated Roxybrowser API key:
- Changed `ROXYBROWSER_API_KEY` to `c6ae203adfe0327a63ccc9174c178dec` in `config/browserAPI.json`.
- Updated hardcoded default in `connectors/discovery/roxybrowser.js`.
- Added `ROXYBROWSER_API_KEY` to `.env` file.
- Verified syntax with `node -c`.

# AGENT JOURNAL - 28 February 2026

28-02-2026--20-40
Fixed "media could not be played" errors on X.com in `api/utils/browserPatch.js`:
- Removed H.264 (MP4) codec spoofing from `HTMLMediaElement.prototype.canPlayType` and `MediaSource.isTypeSupported` that was accidentally left behind after previous removal in `utils/browserPatch.js`.
- This allows X.com's video player to correctly fallback to serving natively supported formats instead of failing to decode spoofed MP4s.

## Integrated `api.replyWithAI()` (Engagement Macro)
- **Goal**: Create a high-level API to automate AI-driven replies with a single call.
- **Workflow**:
    - Created [reply.js](file:///c:/My%20Script/auto-ai/api/actions/reply.js) with integrated extraction, generation, and execution logic.
    - Exported from core API in [index.js](file:///c:/My%20Script/auto-ai/api/index.js).
    - Refactored [reply-test.js](file:///c:/My%20Script/auto-ai/tasks/reply-test.js) to consume the new `api.replyWithAI()` function.
- **Verification**: Ran `node main.js reply-test` - confirmed successful context collection, AI reply generation, and post success via toast verification.

## Integrated `api.quoteWithAI()` (Engagement Macro)
pi/actions/quote.js` containing the high-level logic for context extraction, AI generation, and execution.
- Optimized scrolling and extraction: merged into a single downward pass, eliminating jarring upward jumps.
- Exported from `api/index.js` as `quoteWithAI`, making it available throughout the codebase.
- Refactored `tasks/quote-test.js` to use the new high-level API, reducing task code by 60%.
- Verified via `main.js quote-test`.

## [2026-02-28] Implementing Quote Test Task
- Created `tasks/quote-test.js` to test quote tweet functionality.
- Implemented `quoteB` strategy (Retweet Menu) using `AIQuoteEngine`.
- Integrated context extraction (tweet text + replies) for AI quote generation.
- Verified task completion via `main.js` orchestrator.

## [2026-02-28] Fix Reply Test Strict Mode Violations in `reply-test.js` and `api` layer:
- Updated `api/interactions/wait.js` to use `.first()` on locators in `waitVisible` and `waitHidden`, preventing crashes when multiple elements (like tweets) are found.
- Hardened `tasks/reply-test.js` by explicitly using `page.locator(tweetSelector).first()` for the main tweet target and scroll focus.
- Verified syntax with `node -c`.

28-02-2026--17-45
Hardened `AIQuoteEngine.quoteMethodB_Retweet` to fix "double click" and quote failures:
- Increased retweet menu wait time from 2s to 4s (8x500ms) to accommodate slow DOM transitions.
- Improved `retweetBtnSelectors` by adding `:not([aria-label*="metrics"])` and `:not([aria-label*="stats"])` to avoid accidental clicks on metric labels (e.g., Like button labels).
- Added logic to log the exact selector found by `findElement` for better traceability.
- Refined retry logic to check if the menu is already visible before re-clicking, preventing redundant clicks.
- Enhanced `quotePreviewSelectors` and added a robust wait mechanism (1s fast check + 6s `waitVisible`) to handle lazy-loading of the composer preview.
- Verified syntax with `node -c utils/ai-quote-engine.js`.

28-02-2026--17-27
Fixed scroll directions in `utils/twitterAgent.js`:
- Removed invalid `this.page` arguments from `scrollDown` and `scrollRandom` calls to conform to the new `scroll-helper.js` API.
- Replaced positive values with negative values for `scrollRandom` when simulating `WHEEL_UP`, return from replies, and `OVERSHOOT` corrections to ensure upward scrolling works correctly.

28-02-2026--16-40
Repaired `prompt-test.js` non-thinking model crash and CPU-bound issues:
- Fixed an endpoint mapping issue where `think: true` was hardcoded causing 400 errors for non-reasoning models like `hermes3:8b`. The parameter is now conditionally bound based on model name detection.
- Discovered `local-ollama-manager.js` was automatically spawning a headless `ollama serve` backend if it couldn't detect the system tray app, which in Windows runs entirely over the CPU instead of the GPU. Killed the headless process.
- Added explicit `/api/generate` preload commands directly into `prompt-test.js` to force Ollama to instantly load the model into VRAM immediately at test startup.

28-02-2026--17-05
Upgraded `prompt-test.js`:
- Added 3 new test thread variants (Gaming, Crypto, Fitness).
- Added logic to randomize the selected test so it parses one thread per run.

28-02-2026--16-35
Hardened `REPLY_SYSTEM_PROMPT` for small models:
- Updated `utils/twitter-reply-prompt.js` to enforce a strictly opinionated internet persona.
- Applied explicit negative constraints (`NEVER write "Okay" or "Yes"`) directly to the system prompt and all strategy injects.
- Fixed terminal text mangling in `prompt-test.js` by aggressively stripping `\r` carriage returns.
- Validated output against `deepseek-r1:1.5b` ensuring diverse, rule-abiding responses.

## 2026-02-28 16:30 - Repaired prompt-test.js for DeepSeek-R1 (Thinking Models)
- **Problem:** User reported `prompt-test.js` hung or outputted strange text when running against "thinking" models (e.g. `deepseek-r1` or `lfm2.5-thinking:1.2b`), and asked to pass `stream: false` and `think: true`.
- **Solution:** 
  - Adjusted internal `ollamaFetch()` to dynamically detect whether the request was to the OpenAI-compatible `/v1/chat/completions` endpoint and, if so, map the payload to Ollama's native `/api/chat` format (passing `"think": true` and capturing `options: { num_predict, temperature }`).
  - Implemented programmatic extraction of `<think>...</think>` tags using RegExp in case the reasoning was embedded within standard `message.content` (e.g., from OpenRouter API responses vs Ollama).
  - Sanitized `\r\n` carriage returns dynamically inside `console.log()` statements to prevent cursor-wrapping glitches from polluting the local CLI window outputs.
- **Outcome:** Script now cleanly runs local Ollama API tests with `deepseek-r1`, natively isolating reasoning into `🤔 REASONING:` block and printing cleanly formatted terminal logs.

28-02-2026--16-20
Refactored `prompt-test.js` to fully support thinking models:
- Increased `max_tokens` from 256 to 2048 to prevent early truncation during the reasoning phase.
- Added extraction and raw console logging for `reasoning` / `reasoning_content` to accurately map local Ollama and DeepSeek model thought structures.
- Verified successful completion utilizing `lfm2.5-thinking:1.2b`.

28-02-2026--16-15
Repaired `prompt-test.js`:
- Replaced non-existent `ollama-manager.js` import with `local-ollama-manager.js`.
- Implemented internal `ollamaFetch` utility to handle API requests.
- Integrated `ensureOllama()` to automatically manage local service status.

28-02-2026--16- [x] Analyze `prompt-test.js` and `local-ollama-manager.js`
- [x] Create implementation plan
- [x] Modify `prompt-test.js` to use `local-ollama-manager.js`
- [/] Validate syntax with `node -c prompt-test.js`
- [ ] Update `AGENT-JOURNAL.md`
- [ ] Update `patchnotes.md` (if applicable)

28-02-2026--16-08
Switched `prompt-test.js` back to Local Ollama:
- Enabled `llm.local` in `config/settings.json`.
- Created `utils/ollama-manager.js` for lightweight `ollamaFetch` utility.
- Reverted `prompt-test.js` to use `ollamaFetch` with chat completions format.
- Verified successful execution: received "same dun, but ai code aight be a game changer for shipping quick af" response.

28-02-2026--15-45
Updated `prompt-test.js` to use ApiFreeLLM:
- Switched provider from OpenRouter to ApiFreeLLM.
- Updated `callLLM` to concatenate system and user prompts into a single `message` field.
- Verified successful execution: received "bro this is wild" response from the new endpoint.

28-02-2026--15-42
Integrated ApiFreeLLM Provider:
- Added configuration to `config/settings.json`.
- Created `utils/apifreellm-manager.js` with `apifreellmFetch` utility.
- Created `apifreellm-test.js` and verified successful communication with the endpoint.
- Confirmed "unlimited" features and tier.

28-02-2026--15-35
Integrated DeepSeek LLM Provider:
- Added DeepSeek configuration (apiKey, endpoint, model) to `config/settings.json`.
- Created `utils/deepseek-manager.js` providing a `deepseekFetch` utility consistent with the existing `fetch`-based architecture.
- Created `deepseek-test.js` for verification.
- Verified connectivity: API responded with `402 Payment Required`, confirming the key is active but currently has zero balance.

28-02-2026--15-08
Implemented Reasoning Token Exclusion for OpenRouter:
- Added `"reasoning": { "exclude": true }` configuration to `config/settings.json`.
- Updated `utils/openrouter-key-manager.js` to automatically pick up and inject these reasoning settings into the API request body.
- This prevents the "thinking" process of models like StepFun or Llama Thinking from being returned in the response content, though they still count towards the `max_tokens` budget.

28-02-2026--14-55
Added raw JSON response debugging to `prompt-test.js`. 
- Modified `callLLM` to return the complete response `data` as `raw`.
- If the parsed `content` comes back empty or incorrectly parsed, the script will now print `⚠️ RAW JSON RESPONSE:` followed by the raw JSON for easier debugging of blank replies.

28-02-2026--14-49
Fixed `utils/openrouter-key-manager.js` prematurely crashing on 401 errors:
- Added `401 Unauthorized`, `402 Payment Required`, and `5xx Server Error` statuses to the retry block (previously it only caught `429 Rate Limit`).
- Invalid or empty keys (401/402) will now be marked with a 24-hour cooldown so the script skips them and keeps rotating through the remaining healthy keys in the pool without crashing the process.

28-02-2026--14-46
Fixed duplicate reading duration capping in `tasks/pageview.js`:
- Narrowed the Gaussian deviation bound and reduced max ceiling from 50000 → 45000.
- With the previous boundaries (`50000` cap but deviation `15000 / 2`), multiple threads were frequently hitting the high end of the right tail which was pushed past 45s, and then aggressively truncated back down to exactly `45` by `Math.min(..., 45)`, resulting in identical 45.00s cycle counts.

28-02-2026--14-45
Fixed "media could not be played" errors on X.com in `utils/browserPatch.js`:
- Removed H.264 (MP4) codec spoofing from `HTMLMediaElement.prototype.canPlayType` and `MediaSource.isTypeSupported`.
- This allows X.com's video player to correctly fallback to serving natively supported WebM (VP9) video streams instead of failing to decode spoofed MP4s.

28-02-2026--14-40
Repaired reading simulation logic in `tasks/pageview.js`:
- Switched from linear `Math.random` to `api.gaussian` for more natural reading durations.
- Corrected 15-45s range math (30s mean ± 15s).
- Adjusted cycle estimation from 1.5s → 2.2s to better align with `api.scroll.read` behavior, ensuring final durations match targets.

28-02-2026--14- [x] [PLANNING] Research and design the fix for reading simulation logic <!-- id: 0 -->
    - [x] Analyze `tasks/pageview.js` logic vs humanization utilities <!-- id: 1 -->
    - [x] Create implementation plan <!-- id: 2 -->
- [x] [EXECUTION] Implement the fix <!-- id: 3 -->
    - [x] Update `tasks/pageview.js` with corrected math and utilities <!-- id: 4 -->
    - [x] Update `AGENT-JOURNAL.md` <!-- id: 5 -->

28-02-2026--11-35
Implemented 4 API fixes from the audit report:
- Extracted domain-specific click profiles out of ghostCursor to `api/profiles/click-profiles.js`.
- Fixed swallowed exceptions in `api/utils/patch.js`, `api/core/init.js`, and `api/interactions/actions.js` by emitting console warnings and safeEmitErrors.
- Implemented robust semantic hashing in `api/agent/runner.js` to prevent flawed loop detection.
- Added `expectsNavigation` flag to `smartClick` in `api/behaviors/recover.js` to prevent auto-recovery on deliberate navigation.

28-02-2026--14-30
Fixed all ESLint errors and warnings (2 errors, 65 warnings)

28-02-2026--14-45
Implemented Stage 2 and 3 architectural enhancements from the API audit:
- Added `ConfigurationManager` to `api/core/config.js` and exported it via `api/index.js`.
- Implemented `matches(url)` on `BasePlugin` and `evaluateUrl(url)` on `PluginManager` to enable dynamic URL-based plugin activation, hooked into `api/interactions/navigation.js`.
- Standardized kinetic actions (`click`, `type`, `hover`) in `api/interactions/actions.js` to use `middleware.js` pipelines instead of custom `executeWithRecovery`.
- Added strict `ElementObscuredError` throwing to `actions.js` visual guard logic to enforce rigorous positional semantics.
- Enhanced the `Agent Runner` (`api/agent/runner.js`) with generic adaptive delays, tying back to `api.config`, and added `_dumpDiagnostics` logic capturing LLM histories when fatal thresholds are breached.
- Fixed residual syntax and ESLint warnings in touched files.
- Corrected `_entropy` export mismatch in `utils/humanization/` and `utils/human-interaction.js`.
- Updated `.ai-playground-prompt` with the official `REPLY_SYSTEM_PROMPT` for playground testing.

28-02-2026--15-00
- Resolved `_entropy` export mismatch error in `api-twitteractivity` and `utils/humanization/` scripts by updating module imports to definitively use `entropy`.

28-02-2026--21-10
Fixed reply post button click in `utils/human-interaction.js`:
- Root cause: ghost cursor moves the mouse from the textarea to the Post button, triggering a `blur` on the textarea. Twitter's React state sees the composer as unfocused and ignores the click.
- Fix: Try `el.click()` via `evaluate()` first — fires a click event without moving the mouse, so the textarea stays focused and React processes the submit. Ghost click and force click are now fallbacks only.

28-02-2026--21-03
Fixed 44s idle in `utils/ai-twitterAgent.js` after successful dive: the tweetDive branch was calling `simulateReading()` a second time after `diveTweet()` completed (line 1881). The dive already navigates home and the main loop's own `simulateReading()` at the start of the next iteration handles scrolling — the extra call was redundant and caused a full reading phase delay before `--- Loop N ---` was logged. Removed it.

28-02-2026--21-00
Fixed `tasks/pageview.js` reading duration bug: `Math.min(..., 20)` was clamping all randomised values to exactly 20.0s because `profileReadingMs` (mean=30s ±7.5s) always exceeded the 20s cap. Changed ceiling from 20 → 45 to match the intended 10–45s range.

28-02-2026--20-51
Updated `utils/openrouter-key-manager.js` to read from `config/settings.json`:
- Keys sourced from `open_router_free_api.api_keys` (11 keys already configured).
- Primary model sourced from `open_router_free_api.models.primary`.
- Env vars `OR_API_KEYS` / `OR_API_KEY` / `OR_MODEL` still work as override.
- Updated `prompt-test.js` to import `loadPrimaryModel` and use whatever model is set in settings.
- No changes to settings.json — all keys were already there.

28-02-2026--20-49
Created `utils/openrouter-key-manager.js` — OpenRouter multi-key rotation manager:
- Round-robin across all keys on every request.
- On 429: marks key on cooldown (respects `retry-after` header, defaults to 60s), retries immediately with next key.
- Logs key slot + last 4 chars on each request (e.g. `[KeyManager] Using key ...7f2a (slot 1/3)`).
- Config: `OR_API_KEYS=key1,key2,key3` (comma-separated), falls back to `OR_API_KEY`.
- Updated `prompt-test.js` to import `openrouterFetch` from the new manager (removed manual fetch + hardcoded key).

28-02-2026--20-43
Increased reply cap from 3 → 20 in `utils/twitter-reply-prompt.js` (`buildReplyPrompt`, `buildEnhancedPrompt`) and `utils/ai-reply-engine/index.js`. Each reply still capped at 80 chars; 20 replies × 80 chars ≈ 400 tokens, total still under 1000.

28-02-2026--20-41
Removed emoji-producing strategies from `utils/twitter-reply-prompt.js`:
- Removed `TEXT_EMOJI` and `EMOJI_ONLY` from `STRATEGY_POOL` (now 20 strategies).
- Removed their boost entries from `CONTEXT_BOOSTS` (humorous, entertainment, viral).
- Repurposed both strategy definitions as text-only variants: `TEXT_EMOJI` → punchy short sentence, `EMOJI_ONLY` → very short 1-2 word reaction (no emoji).

28-02-2026--20-34
Strategy engine randomization in `utils/twitter-reply-prompt.js`:
- Expanded strategies from 11 → 22 (added: HYPEMAN, LOWKEY, CALLOUT, AGREE_HARD, HOT_TAKE, REACTION, DOUBT, RELATE_STORY, HYPE_REPLY, DRY_WIT, CLOUT).
- Replaced biased if-chain waterfall with a weighted random picker (`STRATEGY_POOL` + `CONTEXT_BOOSTS` maps). All 22 strategies can fire in any context; relevant ones get 2–3× weight boost. Verified via 2200-sample simulation — flat ~100/ea in default, proper thematic skew in each context type.

28-02-2026--20-09
Reply engine token optimization — reduced total tokens per LLM call from ~1200 to ~465:
- `utils/twitter-reply-prompt.js`: Slimmed `REPLY_SYSTEM_PROMPT` from ~600 tokens to ~220 tokens (removed thread-type sections, approach examples, example conversations, length table). Restored `strategies` object with correct backtick template literals. Rewrote `buildReplyPrompt` with hard limits: tweet ≤500 chars, each reply ≤80 chars, max 3 replies. Rewrote `buildEnhancedPrompt` to lean user-prompt-only version (no system prompt prepend, same limits).
- `utils/ai-reply-engine/index.js`: Rewrote `buildEnhancedPrompt` method to remove double system-prompt send (it was prepending `REPLY_SYSTEM_PROMPT` into the user prompt while `generateReply` already sends it as `systemPrompt`). New version sends only: strategy instruction + tweet (≤500 chars) + up to 3 replies (≤80 chars each) + `Reply:` footer.

28-02-2026--21-12
Fixed media playback issues permanently and created v0.4.8:
- Diagnosed 403 Forbidden issues on X.com video streams via custom header interception scripts.
- Discovered video requests were actually hitting 200 OK, but decoding was failing silently in `ixbrowser` custom binaries.
- Removed explicit MP4/H.264 capability denial in `api/utils/browserPatch.js` and `utils/browserPatch.js` which was breaking X.com's internal player negotiations.
- Restoring native negotiation allows the video player to automatically fallback appropriately and play videos correctly in WebM/HLS as needed.

28-02-2026--21-25
Fixed redundant context extraction during `api.replyWithAI()` and `api.quoteWithAI()`:
- **Issue**: The agent was scrolling for context twice. Once sequentially in `AITwitterAgent` (legacy preparation), and again inside the new `api.replyWithAI()` macro.
- **Fix**: Added `needsContext = false` flag to `agent.actions.reply` and `agent.actions.quote` within `tasks/api-twitterActivity.js`. Updated `ai-twitterAgent.js` line ~1272 to respect `needsContext` if present, skipping the heavy pre-fetch entirely when API macros are used.
2026-03-01: Updated ixbrowser-proxies-pasang-tok.js - Added CLI support for profile IDs/ranges, implemented 3x retry mechanism, and 200ms stability delay.

### Twitter Actions Unification Pass (2026-03-01)
- Refactored all 6 core actions (`like.js`, `bookmark.js`, `retweet.js`, `follow.js`, `reply.js`, `quote.js`) to use the unified `api.click()` and `api.type()` helpers.
- Ensured **Ghost Cursor Visibility** is enabled for all browser interactions.
- Standardized logging format with `[actionWithAPI] Clicking ... (ghost cursor)...` prefix.
- Maintained existing guards and verification polling logic for reliability.
- Refactored `AIQuoteEngine` methods (`quoteMethodA`, `quoteMethodB`, `quoteMethodC`) for consistent interaction behavior.
- Verified syntax for all modified files using `node -c`.
