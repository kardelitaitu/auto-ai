/**
 * @fileoverview Behavioral Persona System
 * 16 pre-defined profiles controlling speed, typo rate, hover, hesitation, etc.
 * Persona-aware modules read from getPersona() to calibrate their behavior.
 * 
 * @module api/persona
 */

const PERSONAS = {
    casual: { speed: 0.8, hoverMin: 1000, hoverMax: 3000, typoRate: 0.08, correctionRate: 0.85, hesitation: 0.15, hesitationDelay: 400, scrollSpeed: 1.0, clickHold: 120, pathStyle: 'bezier' },
    efficient: { speed: 1.5, hoverMin: 100, hoverMax: 300, typoRate: 0.02, correctionRate: 0.95, hesitation: 0.03, hesitationDelay: 100, scrollSpeed: 1.3, clickHold: 60, pathStyle: 'bezier' },
    researcher: { speed: 0.7, hoverMin: 2000, hoverMax: 4000, typoRate: 0.05, correctionRate: 0.90, hesitation: 0.10, hesitationDelay: 500, scrollSpeed: 0.7, clickHold: 150, pathStyle: 'bezier' },
    power: { speed: 2.0, hoverMin: 50, hoverMax: 100, typoRate: 0.01, correctionRate: 0.98, hesitation: 0.01, hesitationDelay: 50, scrollSpeed: 1.5, clickHold: 50, pathStyle: 'bezier' },
    glitchy: { speed: 1.0, hoverMin: 200, hoverMax: 3000, typoRate: 0.15, correctionRate: 0.60, hesitation: 0.20, hesitationDelay: 600, scrollSpeed: 1.0, clickHold: 100, pathStyle: 'zigzag' },
    elderly: { speed: 0.4, hoverMin: 3000, hoverMax: 5000, typoRate: 0.12, correctionRate: 0.70, hesitation: 0.25, hesitationDelay: 800, scrollSpeed: 0.5, clickHold: 250, pathStyle: 'arc' },
    teen: { speed: 1.3, hoverMin: 100, hoverMax: 500, typoRate: 0.10, correctionRate: 0.75, hesitation: 0.05, hesitationDelay: 150, scrollSpeed: 1.4, clickHold: 70, pathStyle: 'bezier' },
    professional: { speed: 1.2, hoverMin: 500, hoverMax: 1000, typoRate: 0.03, correctionRate: 0.95, hesitation: 0.05, hesitationDelay: 200, scrollSpeed: 1.1, clickHold: 80, pathStyle: 'bezier' },
    gamer: { speed: 1.8, hoverMin: 50, hoverMax: 150, typoRate: 0.04, correctionRate: 0.90, hesitation: 0.02, hesitationDelay: 80, scrollSpeed: 1.4, clickHold: 50, pathStyle: 'bezier' },
    typer: { speed: 1.0, hoverMin: 200, hoverMax: 400, typoRate: 0.03, correctionRate: 0.95, hesitation: 0.03, hesitationDelay: 100, scrollSpeed: 1.0, clickHold: 80, pathStyle: 'bezier' },
    hesitant: { speed: 0.6, hoverMin: 3000, hoverMax: 6000, typoRate: 0.10, correctionRate: 0.80, hesitation: 0.30, hesitationDelay: 1000, scrollSpeed: 0.8, clickHold: 200, pathStyle: 'arc' },
    impulsive: { speed: 1.6, hoverMin: 50, hoverMax: 150, typoRate: 0.12, correctionRate: 0.65, hesitation: 0.02, hesitationDelay: 50, scrollSpeed: 1.3, clickHold: 50, pathStyle: 'bezier' },
    distracted: { speed: 0.9, hoverMin: 500, hoverMax: 4000, typoRate: 0.07, correctionRate: 0.80, hesitation: 0.20, hesitationDelay: 700, scrollSpeed: 0.9, clickHold: 100, pathStyle: 'bezier' },
    focused: { speed: 1.1, hoverMin: 800, hoverMax: 1500, typoRate: 0.02, correctionRate: 0.95, hesitation: 0.03, hesitationDelay: 150, scrollSpeed: 1.0, clickHold: 90, pathStyle: 'bezier' },
    newbie: { speed: 0.5, hoverMin: 2000, hoverMax: 4000, typoRate: 0.18, correctionRate: 0.60, hesitation: 0.25, hesitationDelay: 900, scrollSpeed: 0.5, clickHold: 300, pathStyle: 'arc' },
    expert: { speed: 1.4, hoverMin: 150, hoverMax: 400, typoRate: 0.01, correctionRate: 0.99, hesitation: 0.01, hesitationDelay: 50, scrollSpeed: 1.2, clickHold: 60, pathStyle: 'bezier' },
};

/** @type {string} */
let activePersonaName = 'casual';

/** @type {object} */
let activePersona = { ...PERSONAS.casual };

/**
 * Set the active persona.
 * @param {string} name - Persona name (e.g. 'casual', 'efficient', 'power')
 * @param {object} [overrides] - Optional parameter overrides merged on top
 */
export function setPersona(name, overrides = {}) {
    const base = PERSONAS[name];
    if (!base && name !== 'custom') {
        throw new Error(`Unknown persona "${name}". Available: ${Object.keys(PERSONAS).join(', ')}`);
    }
    activePersonaName = name;
    activePersona = { ...(base || PERSONAS.casual), ...overrides };
}

/**
 * Get the full active persona config.
 * @returns {object} Active persona parameters
 */
export function getPersona() {
    return activePersona;
}

/**
 * Get a single persona parameter.
 * @param {string} key - Parameter name (e.g. 'speed', 'typoRate')
 * @returns {*} Parameter value
 */
export function getPersonaParam(key) {
    return activePersona[key];
}

/**
 * Get the active persona name.
 * @returns {string}
 */
export function getPersonaName() {
    return activePersonaName;
}

/**
 * List all available persona names.
 * @returns {string[]}
 */
export function listPersonas() {
    return Object.keys(PERSONAS);
}
