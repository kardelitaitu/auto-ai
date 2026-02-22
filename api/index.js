/**
 * @fileoverview Unified Browser Tool API — Central Export
 * Assembles all modules into a composable `api` object.
 * 
 * Usage:
 *   import { api } from './api/index.js';
 *   api.setPage(page);
 *   await api.click('.btn');
 *   await api.type('.input', 'hello');
 *   await api.scroll.focus('.element');
 *   await api.scroll(300);
 * 
 * @module api
 */

import { setPage, clearContext } from './context.js';
import { click, type, hover, rightClick } from './actions.js';
import { focus, scroll, toTop, toBottom, read, back as scrollBack } from './scroll.js';
import { move, up, down, setPathStyle, getPathStyle } from './cursor.js';
import { text, attr, visible, count, exists } from './queries.js';
import { wait, waitFor, waitVisible, waitHidden } from './wait.js';
import { goto, reload, back, forward, beforeNavigate, randomMouse, fakeRead, pause as warmupPause } from './navigation.js';
import { think, delay, gaussian, randomInRange } from './timing.js';
import { setPersona, getPersona, getPersonaName, listPersonas } from './persona.js';
import { recover, goBack, findElement, smartClick, undo } from './recover.js';
import { gaze, attention, distraction, beforeLeave, focusShift, maybeDistract, setDistractionChance, getDistractionChance } from './attention.js';
import { start as idleStart, stop as idleStop, isRunning as idleIsRunning, wiggle, idleScroll } from './idle.js';
import { apply as patchApply, stripCDPMarkers, check as patchCheck } from './patch.js';

// Build the scroll dual-callable: api.scroll(300) + api.scroll.focus('.el')
const scrollFn = Object.assign(scroll, {
    focus,
    toTop,
    toBottom,
    read,
    back: scrollBack,
});

// Build cursor with path style
const cursorFn = Object.assign(
    (selector) => move(selector),
    { move, up, down, setPathStyle, getPathStyle }
);

export const api = {
    // ── Context ──────────────────────────────────────────────────
    setPage,
    clearContext,

    // ── Actions (top-level for ergonomics) ───────────────────────
    click,
    type,
    hover,
    rightClick,

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

    // ── Wait (synchronization) ───────────────────────────────────
    wait,
    waitFor,
    waitVisible,
    waitHidden,

    // ── Navigation ───────────────────────────────────────────────
    goto,
    reload,
    back,
    forward,

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
    },

    // ── Patch ────────────────────────────────────────────────────
    patch: {
        apply: patchApply,
        stripCDPMarkers,
        check: patchCheck,
    },
};

export default api;
