/**
 * @fileoverview Behavioral Persona System
 * 16 pre-defined profiles controlling speed, typo rate, hover, hesitation, etc.
 * Uses context-aware state for session isolation.
 * 
 * @module api/persona
 */

import { PERSONAS } from './persona-defs.js';
import { 
  getStatePersona, 
  getStatePersonaName, 
  setStatePersona,
  getStateSection
} from '../core/context-state.js';

export { PERSONAS };

/**
 * Get current session duration in ms.
 * @returns {number}
 */
export function getSessionDuration() {
    const sessionStartTime = getStateSection('persona').sessionStartTime;
    return Date.now() - sessionStartTime;
}

/**
 * Set the active persona.
 * @param {string} name - Persona name (e.g. 'casual', 'efficient', 'power')
 * @param {object} [overrides] - Optional parameter overrides merged on top
 */
export function setPersona(name, overrides = {}) {
    setStatePersona(name, overrides);
}

/**
 * Get the full active persona config.
 * @returns {object} Active persona parameters
 */
export function getPersona() {
    return getStatePersona();
}

/**
 * Get a single persona parameter.
 * @param {string} key - Parameter name (e.g. 'speed', 'typoRate')
 * @returns {*} Parameter value
 */
export function getPersonaParam(key) {
    return getStatePersona()[key];
}

/**
 * Get the active persona name.
 * @returns {string}
 */
export function getPersonaName() {
    return getStatePersonaName();
}

/**
 * List all available persona names.
 * @returns {string[]}
 */
export function listPersonas() {
    return Object.keys(PERSONAS);
}
