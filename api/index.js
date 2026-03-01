/**
 * @fileoverview Unified Browser Tool API — Central Export
 * Assembles all modules into a composable `api` object.
 * 
 * Usage:
 *   import { api } from './api/index.js';
 * 
 *   // Async context isolation (required for all API methods)
 *   await api.withPage(page, async () => {
 *       await api.init(page, { persona: 'casual' });
 *       await api.click('.btn');
 *       await api.type('.input', 'hello');
 *       await api.scroll.focus('.element');
 *   });
 * 
 *   // File Utilities
 *   const line = await api.file.readline('data.txt'); // Read random line
 *   const consumed = await api.file.consumeline('data.txt'); // Read and remove random line
 * 
 *   // Puter AI
 *   const resp = await api.puter('Hello');
 * 
 * @module api
 */

// ─── Type Definitions ─────────────────────────────────────────────

/**
 * @typedef {Object} ApiOptions
 * @property {string} [persona] - Persona name (casual, focused, etc.)
 * @property {Object} [personaOverrides] - Persona overrides
 * @property {boolean} [patch] - Enable detection patching
 * @property {boolean} [humanizationPatch] - Enable humanization
 * @property {boolean} [autoInitNewPages] - Auto-init new pages
 * @property {string} [colorScheme] - 'light' or 'dark'
 * @property {Object} [logger] - Custom logger instance
 * @property {boolean} [sensors] - Enable sensor simulation
 */

/**
 * @typedef {Object} ClickOptions
 * @property {boolean} [recovery] - Enable auto-recovery on failure
 * @property {number} [maxRetries] - Max retry attempts
 * @property {boolean} [hoverBeforeClick] - Hover before clicking
 * @property {string} [precision] - Precision mode: 'exact', 'safe', 'rough'
 * @property {string} [button] - Mouse button: 'left', 'right', 'middle'
 * @property {boolean} [force] - Force click even if obscured
 */

/**
 * @typedef {Object} TypeOptions
 * @property {number} [delay] - Delay between keystrokes in ms
 * @property {boolean} [noClear] - Don't clear field before typing
 * @property {boolean} [humanize] - Apply human-like keystroke timing
 */

/**
 * @typedef {Object} ScrollOptions
 * @property {number} [pauses] - Number of scroll+pause cycles
 * @property {number} [scrollAmount] - Pixels per scroll
 * @property {boolean} [variableSpeed] - Vary scroll speed
 * @property {boolean} [backScroll] - Occasional back-scroll
 */

/**
 * @typedef {Object} WaitOptions
 * @property {number} [timeout] - Timeout in ms
 * @property {string} [state] - Wait state: 'visible', 'hidden', 'attached'
 * @property {boolean} [throwOnTimeout] - Throw on timeout vs return false
 */

/**
 * @typedef {Object} NavigationOptions
 * @property {number} [timeout] - Navigation timeout in ms
 * @property {string} [waitUntil] - Wait until: 'load', 'domcontentloaded', 'networkidle'
 * @property {Object} [headers] - Extra HTTP headers
 */

/**
 * @typedef {Object} GotoResult
 * @property {boolean} success - Whether navigation succeeded
 * @property {string} url - Final URL after navigation
 * @property {number} duration - Time taken in ms
 */

/**
 * @typedef {Object} ElementResult
 * @property {boolean} success - Whether operation succeeded
 * @property {string} [selector] - The selector used
 * @property {*} [result] - Operation result if any
 */

/**
 * @typedef {Object} QueryResult
 * @property {string|number|boolean} value - The queried value
 * @property {boolean} success - Whether query succeeded
 */

// ─── Core Context ─────────────────────────────────────────────────
import { withPage, clearContext, isSessionActive, checkSession, getPage, getCursor, evalPage, getEvents, getPlugins } from './core/context.js';
import { getContextState, setContextState, getStateSection, updateStateSection } from './core/context-state.js';
import {
    AutomationError,
    SessionError,
    SessionDisconnectedError,
    SessionNotFoundError,
    SessionTimeoutError,
    ContextError,
    ContextNotInitializedError,
    PageClosedError,
    ElementError,
    ElementNotFoundError,
    ElementDetachedError,
    ElementObscuredError,
    ElementTimeoutError,
    ActionError,
    ActionFailedError,
    NavigationError,
    ConfigError,
    ConfigNotFoundError,
    LLMError,
    LLMTimeoutError,
    LLMRateLimitError,
    LLMCircuitOpenError,
    ValidationError,
    isErrorCode,
    withErrorHandling,
} from './core/errors.js';

// ─── Actions ──────────────────────────────────────────────────────
import { click, type, hover, rightClick } from './interactions/actions.js';
import { quoteWithAI } from './actions/quote.js';
import { replyWithAI } from './actions/reply.js';
import { likeWithAPI } from './actions/like.js';
import { bookmarkWithAPI } from './actions/bookmark.js';
import { retweetWithAPI } from './actions/retweet.js';
import { followWithAPI } from './actions/follow.js';

// ─── Scroll ───────────────────────────────────────────────────────
import { focus, scroll, toTop, toBottom, read, back as scrollBack } from './interactions/scroll.js';

// ─── Cursor ───────────────────────────────────────────────────────
import { move, up, down, setPathStyle, getPathStyle, startFidgeting, stopFidgeting } from './interactions/cursor.js';

// ─── Queries ──────────────────────────────────────────────────────
import { text, attr, visible, count, exists, currentUrl } from './interactions/queries.js';

// ─── Wait ────────────────────────────────────────────────────────
import { wait, waitFor, waitVisible, waitHidden, waitForLoadState, waitForURL } from './interactions/wait.js';

// ─── Navigation ─────────────────────────────────────────────────
import { goto, reload, back, forward, beforeNavigate, randomMouse, fakeRead, pause as warmupPause, setExtraHTTPHeaders } from './interactions/navigation.js';

// ─── Banners ──────────────────────────────────────────────────
import { handleBanners } from './interactions/banners.js';

// ─── Timing ─────────────────────────────────────────────────────
import { think, delay, gaussian, randomInRange } from './behaviors/timing.js';

// ─── Persona ────────────────────────────────────────────────────
import { setPersona, getPersona, getPersonaName, listPersonas, getSessionDuration } from './behaviors/persona.js';

// ─── Recovery ───────────────────────────────────────────────────
import { recover, goBack, findElement, smartClick, undo, urlChanged } from './behaviors/recover.js';

// ─── Attention ─────────────────────────────────────────────────
import { gaze, attention, distraction, beforeLeave, focusShift, maybeDistract, setDistractionChance, getDistractionChance } from './behaviors/attention.js';

// ─── Idle ───────────────────────────────────────────────────────
import { start as idleStart, stop as idleStop, isRunning as idleIsRunning, wiggle, idleScroll, startHeartbeat } from './behaviors/idle.js';

// ─── Patch ─────────────────────────────────────────────────────
import { apply as patchApply, stripCDPMarkers, check as patchCheck } from './utils/patch.js';

// ─── File I/O ──────────────────────────────────────────────────
import { readline } from './utils/file.readline.js';
import { consumeline } from './utils/file.consumeline.js';


// ─── Agent ─────────────────────────────────────────────────────
import { see } from './agent/observer.js';
import { doAction } from './agent/executor.js';
import { find as agentFind } from './agent/finder.js';
import * as visionModule from './agent/vision.js';
const agentVision = visionModule.default;
import {
    actionEngine,
    llmClient,
    agentRunner,
    captureAXTree,
    captureState
} from './agent/index.js';

// ─── Init ───────────────────────────────────────────────────────
import { initPage, diagnosePage } from './core/init.js';

// ─── Config ─────────────────────────────────────────────────────
import { configManager } from './core/config.js';

// ─── Events & Plugins ─────────────────────────────────────────
import { getAvailableHooks, getHookDescription } from './core/events.js';
import { createHookWrapper, withErrorHook } from './core/hooks.js';
import { loadBuiltinPlugins, registerPlugin, unregisterPlugin, enablePlugin, disablePlugin, listPlugins, listEnabledPlugins, getPluginManager } from './core/plugins/index.js';

// ─── Middleware ────────────────────────────────────────────────
import { createPipeline, createSyncPipeline, loggingMiddleware, validationMiddleware, retryMiddleware, recoveryMiddleware, metricsMiddleware, rateLimitMiddleware } from './core/middleware.js';

// ─── Memory ─────────────────────────────────────────────────────
import { memory } from './utils/memory-profiler.js';


// ─── Build Dual-Callable APIs ──────────────────────────────────

// Scroll: api.scroll(300) + api.scroll.focus('.el')
const scrollFn = Object.assign(scroll, {
    focus,
    toTop,
    toBottom,
    read,
    back: scrollBack,
});

// Cursor: api.cursor(selector) + api.cursor.move() + api.cursor.up()
const cursorFn = Object.assign(
    (selector) => move(selector),
    { move, up, down, setPathStyle, getPathStyle, startFidgeting, stopFidgeting }
);


async function init(page, options = {}) {
    return initPage(page, options);
}

async function diagnose(page) {
    return diagnosePage(page);
}

async function emulateMedia(options = {}) {
    const page = getPage();
    return page.emulateMedia(options);
}

/**
 * Unified API Object
 * Provides ergonomic access to all modules.
 */
export const api = {
    // ── Context ──────────────────────────────────────────────────
    // Note: Use api.withPage(page, fn) for context isolation
    withPage,
    clearContext,
    isSessionActive,
    checkSession,
    getPage,
    getCursor,
    eval: evalPage,
    init,
    diagnose,
    emulateMedia,
    config: configManager,

    // ── Actions (top-level for ergonomics) ───────────────────────
    click,
    type,
    hover,
    rightClick,
    quoteWithAI,
    replyWithAI,
    likeWithAPI,
    bookmarkWithAPI,
    retweetWithAPI,
    followWithAPI,

    // ── Scroll (dual: api.scroll(300) + api.scroll.focus('.el')) ─
    scroll: scrollFn,

    // ── Cursor (low-level) ───────────────────────────────────────
    cursor: cursorFn,

    // ── Queries (read-only) ──────────────────────────────────────
    text,
    attr,
    visible,
    count,
    exists,
    getCurrentUrl: currentUrl,

    // ── Wait (synchronization) ───────────────────────────────────
    wait,
    waitFor,
    waitVisible,
    waitHidden,
    waitForLoadState,
    waitForURL,

    // ── Navigation ───────────────────────────────────────────────
    goto,
    reload,
    back,
    forward,
    setExtraHTTPHeaders,

    // ── Banners ──────────────────────────────────────────────────
    handleBanners,

    // ── Warmup ───────────────────────────────────────────────────
    beforeNavigate,
    randomMouse,
    fakeRead,
    warmupPause,

    // ── Timing ───────────────────────────────────────────────────
    think,
    delay,
    gaussian,
    randomInRange,

    // ── Persona ──────────────────────────────────────────────────
    setPersona,
    getPersona,
    getPersonaName,
    listPersonas,

    // ── Recovery ─────────────────────────────────────────────────
    recover,
    goBack,
    findElement,
    smartClick,
    undo,

    // ── Attention ────────────────────────────────────────────────
    gaze,
    attention,
    distraction,
    beforeLeave,
    focusShift,
    maybeDistract,
    setDistractionChance,
    getDistractionChance,

    // ── Idle ────────────────────────────────────────────────────
    idle: {
        start: idleStart,
        stop: idleStop,
        isRunning: idleIsRunning,
        wiggle,
        scroll: idleScroll,
        heartbeat: startHeartbeat,
    },

    // ── Patch ────────────────────────────────────────────────────
    patch: {
        apply: patchApply,
        stripCDPMarkers,
        check: patchCheck,
    },

    // ── File I/O ─────────────────────────────────────────────────
    /**
     * File I/O Utilities
     * @example
     * const line = await api.file.readline('data.txt');
     * const consumed = await api.file.consumeline('data.txt');
     */
    file: {
        readline,
        consumeline,
    },



    // ── Agent ────────────────────────────────────────────────────
    /**
     * Agent Interaction Layer (LLM-friendly)
     * @example
     * const view = await api.agent.see(); // Get semantic map
     * await api.agent.do('click', 'Login'); // Click by label
     * await api.agent.do('type', 1, 'username'); // Type by ID
     */
    agent: {
        see,
        do: doAction,
        find: agentFind,
        vision: agentVision,
        screenshot: agentVision.screenshot,
        captureAXTree,
        captureState,
        // LLM-driven agent
        run: (goal, config) => agentRunner.run(goal, config),
        stop: () => agentRunner.stop(),
        isRunning: () => agentRunner.isRunning,
        engine: actionEngine,
        llm: llmClient,
        getStats: () => agentRunner.getUsageStats(),
    },

    // ── Events & Plugins ────────────────────────────────────────
    get events() { return getEvents(); },
    plugins: {
        register: registerPlugin,
        unregister: unregisterPlugin,
        enable: enablePlugin,
        disable: disablePlugin,
        list: listPlugins,
        listEnabled: listEnabledPlugins,
        getManager: getPluginManager,
    },

    // ── Middleware ───────────────────────────────────────────────
    middleware: {
        createPipeline,
        createSyncPipeline,
        logging: loggingMiddleware,
        validation: validationMiddleware,
        retry: retryMiddleware,
        recovery: recoveryMiddleware,
        metrics: metricsMiddleware,
        rateLimit: rateLimitMiddleware,
    },

    // ── Memory ─────────────────────────────────────────────────────
    memory,
};

export default api;

// Re-export all named exports
export {
    // Note: setPage is deprecated - use withPage instead
    withPage, clearContext, isSessionActive, checkSession, getPage, getCursor, evalPage as eval,
    getContextState, setContextState, getStateSection, updateStateSection,
    click, type, hover, rightClick, quoteWithAI, replyWithAI, likeWithAPI, bookmarkWithAPI, retweetWithAPI, followWithAPI,
    focus, scroll, toTop, toBottom, read, scrollBack,
    move, up, down, setPathStyle, getPathStyle, startFidgeting, stopFidgeting,
    text, attr, visible, count, exists, currentUrl,
    wait, waitFor, waitVisible, waitHidden, waitForLoadState, waitForURL,
    goto, reload, back, forward, beforeNavigate, randomMouse, fakeRead, warmupPause, setExtraHTTPHeaders,
    handleBanners,
    think, delay, gaussian, randomInRange,
    setPersona, getPersona, getPersonaName, listPersonas, getSessionDuration,
    recover, goBack, findElement, smartClick, undo, urlChanged,
    gaze, attention, distraction, beforeLeave, focusShift, maybeDistract, setDistractionChance, getDistractionChance,
    idleStart, idleStop, idleIsRunning, wiggle, idleScroll, startHeartbeat,
    patchApply, stripCDPMarkers, patchCheck,
    initPage, diagnosePage,
    readline, consumeline,
    see, doAction as do, agentFind as find, agentVision as vision,
    getAvailableHooks, getHookDescription, createHookWrapper, withErrorHook, getEvents, getPlugins,
    loadBuiltinPlugins, registerPlugin, unregisterPlugin, enablePlugin, disablePlugin, listPlugins, listEnabledPlugins, getPluginManager,
    createPipeline, createSyncPipeline, loggingMiddleware, validationMiddleware, retryMiddleware, recoveryMiddleware, metricsMiddleware, rateLimitMiddleware,
    // Errors
    AutomationError, SessionError, SessionDisconnectedError, SessionNotFoundError, SessionTimeoutError,
    ContextError, ContextNotInitializedError, PageClosedError,
    ElementError, ElementNotFoundError, ElementDetachedError, ElementObscuredError, ElementTimeoutError,
    ActionError, ActionFailedError, NavigationError,
    ConfigError, ConfigNotFoundError,
    LLMError, LLMTimeoutError, LLMRateLimitError, LLMCircuitOpenError,
    ValidationError,
    isErrorCode, withErrorHandling,
};

