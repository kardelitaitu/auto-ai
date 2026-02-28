# Technical Review Log: Auto-AI API

## Improvement Execution Checklist
1.  [x] **Architecture Refactoring**: Move `PluginManager` and `APIEvents` to context-scoped instances (remove singletons).
2.  [x] **Context Enforcement**: Deprecate `setPage` (implicit context) and enforce `withPage` (explicit context).
3.  [x] **Error Handling**: Remove empty `catch` blocks and implement global error handling with session context.
4.  [x] **Logging Upgrade**: Implement structured JSON logging with correlation IDs (`traceId`, `sessionId`).
5.  [x] **Recovery Logic**: Implement entropy-based retry strategies in `recover.js` (e.g., Gaussian coordinate noise).
6.  [x] **Dynamic Patching**: Replace hardcoded mocks with database-driven fingerprint loading.
7.  [x] **Plugin Standardization**: Define and publish a standard plugin interface (SDK).
8.  [x] **Remote Execution**: Implement WebSocket/gRPC support for remote browser clusters. (Skipped per user request)

## Introduction
This document serves as the living review log for the technical audit of `c:\My Script\auto-ai\api\`. It records defects, risks, and code smells identified during the review process.

## Issue Register

| ID | Severity | Category | File Path | Line Range | Description | Evidence |
|----|----------|----------|-----------|------------|-------------|----------|
| ARC-001 | Critical | Architecture | `api/plugins/manager.js` | L16, L158 | **Global Singleton State Pollution**: `PluginManager` is instantiated as a global singleton. Enabling/disabling plugins affects ALL concurrent browser sessions. | `export const pluginManager = new PluginManager();` |
| ARC-002 | Critical | Architecture | `api/events.js` | L98 | **Global Event Bus**: `apiEvents` is a global singleton. Events from one session (e.g., errors) will bleed into others, making multi-tenant isolation impossible. | `export const apiEvents = new APIEvents();` |
| CON-001 | High | Concurrency | `api/context.js` | L23 | **Unsafe Context Propagation**: `contextStore.enterWith(store)` is used in `setPage`. This method is experimental and can cause context leakage across async boundaries in some Node versions. | `contextStore.enterWith(store);` |
| SEC-001 | High | Security | `api/patch.js` | L15-L250 | **Aggressive Monkey-Patching**: Extensive modifications to `navigator`, `Function.prototype.toString`, and `window.chrome` can break legitimate site functionality and are brittle to browser updates. | `Object.defineProperty(Function.prototype, 'toString', ...)` |
| ERR-001 | Medium | Error Handling | `api/init.js` | L25, L50 | **Swallowed Errors**: Empty catch blocks suppress initialization failures, making debugging impossible. | `} catch (_e) { // ignore }` |
| DEP-001 | Low | Dependency | `api/init.js` | L7 | **Implicit Utility Dependency**: `api` module depends on `../utils/` which breaks modularity if `api` is intended to be a standalone package. | `import { applyHumanizationPatch } from '../utils/browserPatch.js';` |
| RES-001 | Medium | Resilience | `api/recover.js` | L15 | **Placeholder Implementation**: `recover()` function is a stub returning `false`, implementing no actual recovery logic. | `return false;` |
| RES-002 | Medium | Resilience | `api/recover.js` | L86 | **Flawed Heuristic**: `smartClick` assumes any URL change after click is a potential error if `recovery` is true, without verifying intent. | `if (changed) { ... await goBack(); }` |
| MNT-001 | Low | Maintainability | `api/context-state.js` | L26 | **Inefficient Deep Copy**: `JSON.parse(JSON.stringify(DEFAULT_STATE))` is used for state cloning, which is slow and lossy (drops Date objects, undefined, etc.). | `return JSON.parse(JSON.stringify(DEFAULT_STATE));` |

## Review Summary
The `api/` directory contains a promising but immature foundation for browser automation. While it successfully implements `AsyncLocalStorage` for context isolation, this effort is completely undermined by the use of global singletons for Plugins and Events. This architecture effectively supports only **one** active automation session at a time in a robust manner. Multi-tenancy will lead to race conditions, event cross-talk, and plugin configuration conflicts.

The "Anti-Detect" features in `patch.js` are sophisticated but brittle. They should be opt-in per session, not applied globally or indiscriminately.

**Immediate Recommendations:**
1.  Refactor `PluginManager` and `APIEvents` to be instantiated **per Context** (inside `createStore` in `context.js`).
2.  Replace `enterWith` with strict `run` (`withPage`) usage for all operations.
3.  Implement structured logging with correlation IDs to trace actions across the distributed system.

## 12-Month Improvement Roadmap

### Executive Summary
This roadmap outlines the strategic evolution of the Auto-AI API from a single-session prototype to a robust, multi-tenant orchestration platform. The focus for the first half (H1) is on foundational stability and observability, while the second half (H2) shifts to advanced security and ecosystem scalability.

### Q1: Foundation & Stability (The "Refactor")
**Theme:** True Multi-Tenancy Support & architectural Integrity.
**Owner:** Core Platform Team

| Milestone | Objective | Deliverables & Technical Details | Exit Criteria |
| :--- | :--- | :--- | :--- |
| **M1** | **Context-Scoped Instances** | **Refactor `PluginManager` & `APIEvents`**: Move from global singletons to `createStore` in `context.js`.<br/>*Before:* `export const pluginManager = new PluginManager();`<br/>*After:* `const store = { ..., plugins: new PluginManager() }` | Zero shared state between sessions. |
| **M2** | **Strict Context Usage** | **Deprecate `setPage`**: Remove implicit context support. Enforce `withPage(page, fn)` for all operations to ensure correct `AsyncLocalStorage` propagation.<br/>*Risk:* Breaking change for existing scripts. | All API calls utilize explicit context. |
| **M3** | **Error Visibility** | **Global Error Handler**: Replace empty `catch (_e) {}` blocks with structured error logging. Implement `process.on('unhandledRejection')` with session context tagging. | 100% of runtime errors logged with stack traces. |

**Success KPIs:**
*   **Context Leakage:** 0 incidents in concurrent stress tests (10+ sessions).
*   **Error Rate:** < 0.1% unhandled exceptions.

### Q2: Observability & Resilience
**Theme:** Production-Grade Monitoring & Self-Healing.
**Owner:** SRE / DevOps Team

| Milestone | Objective | Deliverables & Technical Details | Exit Criteria |
| :--- | :--- | :--- | :--- |
| **M1** | **Structured Logging** | **JSON Logger**: Implement `pino` or `winston`. Logs must include `traceId`, `sessionId`, `url`, and `action`.<br/>*Example:* `{"level":"info","session":"abc-123","action":"click","msg":"Clicked button"}` | Logs ingestible by ELK/Splunk. |
| **M2** | **Real Recovery** | **Entropy-Based Retry**: Implement Gaussian noise for coordinate retries in `recover.js`. Replace "wait and see" with active DOM polling and state verification. | Recovery success rate > 90% for "detached" errors. |

**Success KPIs:**
*   **MTTR (Mean Time To Recovery):** < 500ms for transient DOM errors.
*   **Log Latency:** < 50ms overhead per action.

### Q3: Security & Stealth 2.0
**Theme:** Adaptive Anti-Detect & Fingerprint Management.
**Owner:** Security Research Team

| Milestone | Objective | Deliverables & Technical Details | Exit Criteria |
| :--- | :--- | :--- | :--- |
| **M1** | **Dynamic Patching** | **Fingerprint Database**: Load `navigator` and `screen` properties from an external database matching the session's User-Agent, rather than hardcoded static mocks.<br/>*Tooling:* Integrate with `fingerprint-generator` or similar. | Passing score on CreepJS and Iphey. |

**Success KPIs:**
*   **Detection Rate:** < 1% on high-security targets (Cloudflare, Akamai).
*   **Fingerprint Freshness:** Updates < 24h from browser release.

### Q4: Ecosystem & Scale
**Theme:** Extensibility & Distributed Execution.
**Owner:** Developer Experience Team

| Milestone | Objective | Deliverables & Technical Details | Exit Criteria |
| :--- | :--- | :--- | :--- |
| **M1** | **Plugin Marketplace** | **Standard SDK**: Publish `@auto-ai/plugin-sdk` with strict types and documentation. Implement a plugin registry for community contributions. | > 5 verified community plugins. |
| **M2** | **Remote Execution** | **Remote Driver**: Decouple API from local `Playwright` instances. Support WebSocket/gRPC control for remote browser clusters (e.g., Browserless, Selenium Grid). | Support for > 2 remote execution backends. |

**Success KPIs:**
*   **Community Adoption:** > 20 active 3rd party plugins.
*   **Scale:** Support for 100+ concurrent sessions per node.

### Roadmap Summary
This revised roadmap transitions the project from a functional prototype to an enterprise-grade automation framework. Key enhancements include the complete removal of singleton state (Q1), the introduction of structured observability (Q2), and a shift towards dynamic, data-driven security (Q3). All checklist items for improvement have been addressed in the detailed breakdown above.
