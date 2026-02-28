/**
 * @fileoverview Agent Executor
 * Performs semantic actions on elements discovered via api.agent.see().
 * @module api/agent/executor
 */

import { click, type, hover } from '../interactions/actions.js';
import { getStateAgentElementMap } from '../core/context-state.js';
import { createLogger } from '../core/logger.js';

const logger = createLogger('api/agent/executor.js');

/**
 * Do - Performs a semantic action on an element.
 * 
 * @param {string} action - Action to perform: 'click', 'type', 'hover', 'fill'
 * @param {string|number} target - Element ID (from see()) or Label
 * @param {string} [value] - Value for 'type' or 'fill' actions
 * @returns {Promise<any>} Result of the action
 * @example
 * await api.agent.do('click', 1);
 * await api.agent.do('type', 'Search', 'Playwright');
 */
export async function doAction(action, target, value) {
    const elementMap = getStateAgentElementMap();
    let element;

    if (typeof target === 'number') {
        element = elementMap.find(el => el.id === target);
    } else {
        // Fuzzy search by label
        const search = target.toLowerCase();
        element = elementMap.find(el => el.label.toLowerCase() === search) ||
                  elementMap.find(el => el.label.toLowerCase().includes(search));
    }

    if (!element) {
        throw new Error(`Target element "${target}" not found in current view. Call api.agent.see() first.`);
    }

    logger.info(`Agent action: ${action} on "${element.label}" (${element.id})`);

    switch (action.toLowerCase()) {
        case 'click':
            return await click(element.selector);
        case 'type':
        case 'fill':
            return await type(element.selector, value);
        case 'hover':
            return await hover(element.selector);
        default:
            throw new Error(`Unsupported agent action: ${action}`);
    }
}

export default doAction;
