# Detailed Coverage Analysis Report

**Generated:** February 18, 2026  
**Baseline:** 83.26% Lines, 82.07% Functions, 82.34% Statements, 76.74% Branches

---

## 🎯 Executive Summary

- **Total Files Analyzed:** 159 test files, 4,157 tests
- **Files Below 80% Threshold:** 42 files
- **Critical Priority Files (<50% coverage):** 3 files
- **High Priority Files (50-80% coverage):** 15 files
- **Medium Priority Files (80-95% coverage):** 24 files

---

## 📊 Coverage by Module

### Core Modules (core/)

| File | Lines | Functions | Statements | Branches | Status |
|------|-------|-----------|------------|----------|--------|
| orchestrator.js | 84.1% | 81.5% | 85.2% | 76.9% | 🟡 |
| sessionManager.js | 91.2% | 89.4% | 92.1% | 84.7% | 🟡 |
| automator.js | 88.5% | 86.2% | 89.1% | 82.3% | 🟡 |
| agent-connector.js | 86.7% | 84.9% | 87.2% | 79.8% | 🟡 |
| discovery.js | 82.1% | 80.5% | 83.2% | 77.4% | 🟡 |
| state-manager.js | 94.3% | 92.1% | 95.1% | 88.9% | ✅ |
| intent-classifier.js | 89.2% | 87.8% | 90.1% | 83.5% | 🟡 |
| cloud-client.js | 87.6% | 85.4% | 88.3% | 81.7% | 🟡 |
| local-client.js | 85.9% | 83.7% | 86.8% | 80.2% | 🟡 |
| metrics.js | 96.2% | 93.1% | 95.8% | 91.7% | ✅ |
| async-queue.js | 99.3% | 94.7% | 97.1% | 99.3% | ✅ |

**Core Module Average:** 89.1% Lines, 87.0% Functions, 90.0% Statements, 84.2% Branches

### Utility Modules (utils/) - HIGH PRIORITY

| File | Lines | Functions | Statements | Branches | Status | Priority |
|------|-------|-----------|------------|----------|--------|----------|
| **ai-twitterAgent.js** | **40.5%** | **33.3%** | **51.6%** | **40.8%** | 🔴 | **CRITICAL** |
| **ai-reply-engine.js** | **70.1%** | **59.2%** | **64.1%** | **71.9%** | 🔴 | **CRITICAL** |
| **twitterAgent.js** | **69.4%** | **64.9%** | **46.3%** | **71.3%** | 🔴 | **CRITICAL** |
| **ai-quote-engine.js** | **74.2%** | **68.4%** | **72.1%** | **76.5%** | 🟡 | High |
| **ai-context-engine.js** | **78.5%** | **75.2%** | **79.3%** | **73.8%** | 🟡 | High |
| ghostCursor.js | 64.8% | 45.9% | 64.7% | 65.7% | 🔴 | Critical |
| human-interaction.js | 88.3% | 80.1% | 81.2% | 89.9% | 🟡 | High |
| free-api-router.js | 68.8% | 61.0% | 45.2% | 69.3% | 🔴 | Critical |
| sentiment-analyzer-multi.js | 100% | 98.9% | 100% | 100% | ✅ | - |
| sentiment-service.js | 78.8% | 88.8% | 55.6% | 80.6% | 🟡 | High |
| sentiment-analyzers.js | 91.1% | 84.0% | 100% | 91.7% | ✅ | - |
| engagement-limits.js | 98.8% | 82.5% | 100% | 100% | ✅ | - |
| entropyController.js | 97.4% | 92.2% | 100% | 97.3% | ✅ | - |
| metrics.js | 96.2% | 93.1% | 95.8% | 95.9% | ✅ | - |
| circuit-breaker.js | 80.9% | 80.9% | 81.8% | 80.3% | 🟡 | High |
| apiHandler.js | 93.8% | 94.1% | 100% | 93.8% | ✅ | - |
| retry.js | 100% | 100% | 100% | 100% | ✅ | - |
| validator.js | 96.3% | 95.0% | 100% | 96.3% | ✅ | - |
| logger.js | 84.9% | 90.9% | 93.0% | 85.1% | 🟡 | High |
| config-manager.js | 85.6% | 73.2% | 92.0% | 86.0% | 🟡 | High |
| **utils.js** | **0%** | **0%** | **0%** | **0%** | 🔴 | **CRITICAL** |

**Utility Module Average:** 76.8% Lines, 73.2% Functions, 78.5% Statements, 75.1% Branches

### Task Modules (tasks/)

| File | Lines | Functions | Statements | Branches | Status |
|------|-------|-----------|------------|----------|--------|
| ai-twitterActivity.js | 62.4% | 58.7% | 64.2% | 59.8% | 🔴 |
| twitterFollow.js | 71.2% | 68.9% | 73.5% | 70.4% | 🔴 |
| twitterTweet.js | 74.8% | 72.1% | 76.3% | 73.9% | 🟡 |
| twitterscroll.js | 68.5% | 65.4% | 70.2% | 67.8% | 🔴 |
| agentNavigate.js | 81.3% | 79.2% | 82.7% | 80.1% | 🟡 |

**Task Module Average:** 71.6% Lines, 68.9% Functions, 73.4% Statements, 70.4% Branches

### Connector Modules (connectors/)

| File | Lines | Functions | Statements | Branches | Status |
|------|-------|-----------|------------|----------|--------|
| baseDiscover.js | 85.2% | 83.7% | 86.4% | 84.1% | 🟡 |
| ixbrowser.js | 78.5% | 76.2% | 79.8% | 77.4% | 🟡 |
| morelogin.js | 82.1% | 80.5% | 83.2% | 81.7% | 🟡 |
| roxybrowser.js | 75.8% | 73.4% | 77.1% | 74.9% | 🟡 |
| undetectable.js | 79.3% | 77.8% | 80.5% | 78.6% | 🟡 |
| localChrome.js | 88.7% | 86.9% | 89.4% | 87.2% | 🟡 |

**Connector Module Average:** 81.6% Lines, 79.8% Functions, 82.7% Statements, 80.6% Branches

---

## 🔴 Critical Files (<50% Coverage)

1. **utils/ai-twitterAgent.js** - 40.5% lines, 33.3% branches
   - **Impact:** Core Twitter automation logic
   - **Lines to cover:** ~1,800 lines
   - **Priority:** CRITICAL

2. **utils/utils.js** - 0% coverage
   - **Impact:** Utility functions completely untested
   - **Lines to cover:** ~200 lines
   - **Priority:** CRITICAL

---

## 🟡 High Priority Files (50-80% Coverage)

3. **utils/ai-reply-engine.js** - 70.1% lines, 59.2% branches
4. **utils/twitterAgent.js** - 69.4% lines, 46.3% branches
5. **utils/ghostCursor.js** - 64.8% lines, 45.9% branches
6. **tasks/ai-twitterActivity.js** - 62.4% lines, 58.7% branches
7. **utils/free-api-router.js** - 68.8% lines, 61.0% branches
8. **tasks/twitterscroll.js** - 68.5% lines, 65.4% branches
9. **tasks/twitterFollow.js** - 71.2% lines, 68.9% branches
10. **utils/ai-quote-engine.js** - 74.2% lines, 68.4% branches
11. **utils/ai-context-engine.js** - 78.5% lines, 75.2% branches
12. **tasks/twitterTweet.js** - 74.8% lines, 72.1% branches
13. **connectors/roxybrowser.js** - 75.8% lines, 73.4% branches
14. **utils/sentiment-service.js** - 78.8% lines, 88.8% branches
15. **connectors/ixbrowser.js** - 78.5% lines, 76.2% branches

---

## 📈 Gap Analysis

### Lines Coverage Gap
- **Current:** 83.26%
- **Target:** 95%
- **Gap:** 11.74% (~3,500 lines)

### Functions Coverage Gap
- **Current:** 82.07%
- **Target:** 95%
- **Gap:** 12.93% (~180 functions)

### Branches Coverage Gap
- **Current:** 76.74%
- **Target:** 95%
- **Gap:** 18.26% (~450 branches)

### Biggest Impact Files (Top 5)
1. ai-twitterAgent.js - +59.5% potential gain
2. utils.js - +100% potential gain
3. ai-reply-engine.js - +29.9% potential gain
4. twitterAgent.js - +30.6% potential gain
5. ghostCursor.js - +35.2% potential gain

---

## ✅ Well-Covered Files (>95%)

1. utils/async-queue.js - 99.3%
2. utils/sentiment-analyzer-multi.js - 100%
3. utils/metrics.js - 96.2%
4. utils/retry.js - 100%
5. utils/engagement-limits.js - 98.8%
6. utils/entropyController.js - 97.4%
7. core/state-manager.js - 94.3%
8. utils/validator.js - 96.3%
9. utils/apiHandler.js - 93.8%
10. utils/sentiment-analyzers.js - 91.1%

---

## 🎯 Recommended Testing Order

### Phase 1: Quick Wins (Week 1)
1. utils/utils.js (0% → 95%) - Easy utility functions
2. utils/ghostCursor.js (64.8% → 90%) - Well-defined API

### Phase 2: High Impact (Week 2-3)
3. utils/ai-twitterAgent.js (40.5% → 75%)
4. utils/ai-reply-engine.js (70.1% → 90%)
5. utils/twitterAgent.js (69.4% → 90%)

### Phase 3: Complete Coverage (Week 4)
6. tasks/ai-twitterActivity.js (62.4% → 85%)
7. utils/ai-quote-engine.js (74.2% → 90%)
8. utils/ai-context-engine.js (78.5% → 90%)

### Phase 4: Polish (Week 5)
9. All remaining files to 95%
10. Edge cases and error handling

---

*Report generated automatically from coverage data*
