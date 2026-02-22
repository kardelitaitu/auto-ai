/**
 * @fileoverview Context & Session Hygiene
 * Manages the active Playwright page and its GhostCursor instance.
 * Module-scoped state — one page per execution context.
 * 
 * @module api/context
 */

import { GhostCursor } from '../utils/ghostCursor.js';

let currentPage = null;
let currentCursor = null;

/**
 * Bind a Playwright page to the API context.
 * Creates a GhostCursor instance automatically.
 * @param {import('playwright').Page} page - Playwright page instance
 * @returns {void}
 */
export function setPage(page) {
    if (!page) throw new Error('setPage requires a valid Playwright page instance.');
    currentPage = page;
    currentCursor = new GhostCursor(page);
}

/**
 * Get the active Playwright page.
 * @returns {import('playwright').Page}
 * @throws {Error} If page context is uninitialized
 */
export function getPage() {
    if (!currentPage) {
        throw new Error('Session Hygiene Violation: Page context uninitialized. Call api.setPage(page) first.');
    }
    return currentPage;
}

/**
 * Get the GhostCursor tied to the current page.
 * @returns {GhostCursor}
 * @throws {Error} If page context is uninitialized
 */
export function getCursor() {
    if (!currentCursor) {
        throw new Error('Session Hygiene Violation: Cursor uninitialized. Call api.setPage(page) first.');
    }
    return currentCursor;
}

/**
 * Tear down the current context.
 * Nulls both page and cursor references.
 */
export function clearContext() {
    currentPage = null;
    currentCursor = null;
}
