/**
 * @fileoverview Low-Level Cursor Control
 * Thin wrapper around GhostCursor's move() for direct spatial manipulation.
 * Includes trajectory sophistication for advanced path patterns.
 * 
 * @module api/cursor
 */

import { getPage, getCursor } from './context.js';
import { getPersona } from './persona.js';
import { mathUtils } from '../utils/mathUtils.js';

// Path style configuration
let currentPathStyle = 'bezier';
let pathOptions = {};

/**
 * Set cursor path style for movement.
 * @param {string} style - Path style: 'bezier' | 'arc' | 'zigzag' | 'overshoot' | 'stopped'
 * @param {object} [options] - Style-specific options
 * @param {number} [options.overshootDistance=20] - For overshoot style
 * @param {number} [options.stops=3] - For stopped style
 * @returns {void}
 */
export function setPathStyle(style, options = {}) {
    const validStyles = ['bezier', 'arc', 'zigzag', 'overshoot', 'stopped'];
    if (!validStyles.includes(style)) {
        throw new Error(`Invalid path style: ${style}. Valid: ${validStyles.join(', ')}`);
    }
    currentPathStyle = style;
    pathOptions = options;
}

/**
 * Get current path style.
 * @returns {string}
 */
export function getPathStyle() {
    return currentPathStyle;
}

/**
 * Move cursor to a DOM element using Bezier path.
 * Resolves selector to bounding box, calculates Gaussian target point,
 * and delegates to GhostCursor.move().
 * @param {string} selector - CSS selector to move to
 * @param {object} [options]
 * @param {string} [options.pathStyle] - Override path style for this move
 * @param {boolean} [options.correction=false] - Add correction movement after reaching target
 * @returns {Promise<void>}
 */
export async function move(selector, options = {}) {
    const page = getPage();
    const cursor = getCursor();
    const persona = getPersona();

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

    const style = options.pathStyle || currentPathStyle;
    const useCorrection = options.correction || persona.microMoveChance > 0;

    await _moveWithStyle(cursor, targetX, targetY, style, useCorrection);
}

/**
 * Internal: Move with specified path style.
 */
async function _moveWithStyle(cursor, targetX, targetY, style, useCorrection) {
    const start = cursor.previousPos || { x: 0, y: 0 };
    const distance = Math.sqrt(Math.pow(targetX - start.x, 2) + Math.pow(targetY - start.y, 2));

    switch (style) {
        case 'arc':
            await _moveArc(cursor, start, targetX, targetY, distance);
            break;
        case 'zigzag':
            await _moveZigzag(cursor, start, targetX, targetY, distance);
            break;
        case 'overshoot':
            await _moveOvershoot(cursor, start, targetX, targetY, distance);
            break;
        case 'stopped':
            await _moveStopped(cursor, start, targetX, targetY, distance);
            break;
        case 'bezier':
        default:
            await cursor.move(targetX, targetY);
            break;
    }

    // Optional correction movement after reaching target
    if (useCorrection) {
        const correctionX = targetX + mathUtils.randomInRange(-3, 3);
        const correctionY = targetY + mathUtils.randomInRange(-3, 3);
        await cursor.move(correctionX, correctionY);
    }
}

/**
 * Arc path - curved movement.
 */
async function _moveArc(cursor, start, targetX, targetY, distance) {
    // Calculate arc control point
    const midX = (start.x + targetX) / 2;
    const midY = (start.y + targetY) / 2 - distance * 0.3 * (Math.random() > 0.5 ? 1 : -1);
    
    // Two-step arc via control point
    const midPoint = { x: midX, y: midY };
    await cursor.move(midPoint.x, midPoint.y);
    await cursor.move(targetX, targetY);
}

/**
 * Zigzag path - slight back-and-forth.
 */
async function _moveZigzag(cursor, start, targetX, targetY, distance) {
    const steps = 4;
    const zigzagAmount = distance * 0.1;
    
    for (let i = 1; i < steps; i++) {
        const progress = i / steps;
        const baseX = start.x + (targetX - start.x) * progress;
        const baseY = start.y + (targetY - start.y) * progress;
        
        // Perpendicular offset for zigzag
        const perpX = -(targetY - start.y) / distance * zigzagAmount * (i % 2 === 0 ? 1 : -1);
        const perpY = (targetX - start.x) / distance * zigzagAmount * (i % 2 === 0 ? 1 : -1);
        
        await cursor.move(baseX + perpX, baseY + perpY);
    }
    
    await cursor.move(targetX, targetY);
}

/**
 * Overshoot path - go past target, come back.
 */
async function _moveOvershoot(cursor, start, targetX, targetY, distance) {
    const overshootScale = 1 + (pathOptions.overshootDistance || 20) / 100;
    const overshootX = start.x + (targetX - start.x) * overshootScale;
    const overshootY = start.y + (targetY - start.y) * overshootScale;
    
    // Move to overshoot point
    await cursor.move(overshootX, overshootY);
    
    // Brief pause
    await new Promise(r => setTimeout(r, mathUtils.randomInRange(50, 150)));
    
    // Move back to actual target
    await cursor.move(targetX, targetY);
}

/**
 * Stopped path - micro-stops along the way.
 */
async function _moveStopped(cursor, start, targetX, targetY, distance) {
    const stops = pathOptions.stops || 3;
    
    for (let i = 1; i <= stops; i++) {
        const progress = i / stops;
        const x = start.x + (targetX - start.x) * progress;
        const y = start.y + (targetY - start.y) * progress;
        
        await cursor.move(x, y);
        
        // Brief stop at each point
        if (i < stops) {
            await new Promise(r => setTimeout(r, mathUtils.randomInRange(30, 80)));
        }
    }
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
