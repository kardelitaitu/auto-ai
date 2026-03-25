# Plan 0001: Log Reduction in Task Files

## Objective
Reduce verbose logging in twitter-related task files to improve signal-to-noise ratio and reduce console clutter.

## Scope
- tasks/twitterFollow.js
- tasks/twitterFollowLikeRetweet.js
- tasks/twitterTweet.js
- tasks/twitterscroll.js
- tasks/twitter-intents-test.js
- (Optional) tasks/api-twitterFollowLikeRetweet.js

## Current State
Analysis shows 77+ `logger.info()` calls across these files. Similar verbose patterns as api-twitterActivity.js:
- Navigation milestones
- Action delegation logs
- Retry/loop logs
- Reading simulation logs
- Login check logs

## Implementation Strategy
1. Analyze each file's logging patterns
2. Identify verbose logs that repeat per action/item
3. Keep milestone/warning/error logs
4. Comment out verbose per-action logs
5. Run lint after each file
6. Update AGENT-JOURNAL.md
7. Commit changes

## Files to Modify
| File | Est. Logs to Remove | Priority |
|------|-------------------|----------|
| twitterFollow.js | ~15 | High |
| twitterFollowLikeRetweet.js | ~25 | High |
| twitterTweet.js | ~15 | High |
| twitterscroll.js | ~8 | Medium |
| twitter-intents-test.js | ~12 | Medium |

## Success Criteria
- Lint passes with 0 errors
- No functional changes
- Reduced console output during task execution
- Journal entries for each file

## Estimated Effort
- Medium (2-3 files per session)
- ~30-45 minutes total

## Dependencies
- None (can proceed immediately)
