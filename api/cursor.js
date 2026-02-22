/**
 * @fileoverview Low-Level Cursor Control
 * Thin wrapper around GhostCursor's move() for direct spatial manipulation.
 * 
 * @module api/cursor
 */

import { getPage, getCursor } from './context.js';
import { mathUtils } from '../utils/mathUtils.js';

/**
 * Move cursor to a DOM element using Bezier path.
 * Resolves selector to bounding box, calculates Gaussian target point,
 * and delegates to GhostCursor.move().
 * @param {string} selector - CSS selector to move to
 * @returns {Promise<void>}
 */
export async function move(selector) {
    const page = getPage();
    const cursor = getCursor();

    const locator = page.locator(selector).first();
    const box = await locator.boundingBox();
    if (!box) return;

    const targetX = mathUtils.gaussian(
        box.x + box.width / 2,
        box.width / 6,
        box.x + box.width * 0.15,
        box.x + box.width * 0.85
    );
    const targetY = mathUtils.gaussian(
        box.y + box.height / 2,
        box.height / 6,
        box.y + box.height * 0.15,
        box.y + box.height * 0.85
    );

    await cursor.move(targetX, targetY);
}

/**
 * Move cursor up by relative pixels.
 * @param {number} distance - Pixels to move up
 * @returns {Promise<void>}
 */
export async function up(distance) {
    const page = getPage();
    const cursor = getCursor();
    const currentPos = cursor.previousPos || { x: 0, y: 0 };
    const targetY = Math.max(0, currentPos.y - distance);
    await cursor.move(currentPos.x, targetY);
}

/**
 * Move cursor down by relative pixels.
 * @param {number} distance - Pixels to move down
 * @returns {Promise<void>}
 */
export async function down(distance) {
    const page = getPage();
    const cursor = getCursor();
    const currentPos = cursor.previousPos || { x: 0, y: 0 };
    const targetY = currentPos.y + distance;
    await cursor.move(currentPos.x, targetY);
}
