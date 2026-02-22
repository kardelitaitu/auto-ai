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
import { focus, scroll, toTop, toBottom } from './scroll.js';
import { move, up, down } from './cursor.js';
import { text, attr, visible, count, exists } from './queries.js';
import { wait, waitFor, waitVisible, waitHidden } from './wait.js';
import { goto, reload, back, forward } from './navigation.js';
import { think, delay, gaussian, randomInRange } from './timing.js';
import { setPersona, getPersona, getPersonaName, listPersonas } from './persona.js';

// Build the scroll dual-callable: api.scroll(300) + api.scroll.focus('.el')
const scrollFn = Object.assign(scroll, {
    focus,
    toTop,
    toBottom,
});

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
    cursor: { move, up, down },

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
};

export default api;
