/**
 * @fileoverview Semantic Parser - Extracts accessibility tree and interactive elements.
 * Part of the Distributed Agentic Orchestration (DAO) architecture.
 * @module core/semantic-parser
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('semantic-parser.js');

/**
 * @typedef {object} SemanticElement
 * @property {string} role - ARIA role
 * @property {string} name - Accessible name
 * @property {string} [selector] - CSS selector
 * @property {object} [coordinates] - {x, y} coordinates
 * @property {boolean} visible - Whether element is visible
 * @property {boolean} enabled - Whether element is enabled
 */

/**
 * @typedef {object} SemanticTree
 * @property {Array<SemanticElement>} interactiveElements - Clickable/typeable elements
 * @property {Array<SemanticElement>} landmarks - Page landmarks (main, nav, etc.)
 * @property {string} pageTitle - Page title
 * @property {object} metadata - Additional metadata
 */

/**
 * @class SemanticParser
 * @description Extracts high-fidelity accessibility tree from DOM for LLM consumption.
 */
class SemanticParser {
    constructor() {
        /** @type {Array<string>} Interactive roles to extract */
        this.interactiveRoles = [
            'button',
            'link',
            'textbox',
            'searchbox',
            'combobox',
            'checkbox',
            'radio',
            'menuitem',
            'tab',
            'switch'
        ];

        /** @type {Array<string>} Landmark roles */
        this.landmarkRoles = [
            'main',
            'navigation',
            'search',
            'banner',
            'contentinfo',
            'complementary',
            'form'
        ];

        logger.info('SemanticParser initialized');
    }

    /**
     * Extract semantic tree from a Playwright page.
     * @param {playwright.Page} page - The Playwright page.
     * @returns {Promise<SemanticTree>} The semantic tree.
     */
    async extractSemanticTree(page) {
        try {
            logger.debug('[SemanticParser] Extracting semantic tree...');

            // Get page title
            const pageTitle = await page.title();

            // Extract interactive elements
            const interactiveElements = await this._extractInteractiveElements(page);

            // Extract landmarks
            const landmarks = await this._extractLandmarks(page);

            logger.info(`[SemanticParser] Extracted ${interactiveElements.length} interactive elements, ${landmarks.length} landmarks`);

            return {
                interactiveElements,
                landmarks,
                pageTitle,
                metadata: {
                    timestamp: Date.now(),
                    url: await page.url(),
                    totalElements: interactiveElements.length + landmarks.length
                }
            };

        } catch (error) {
            logger.error('[SemanticParser] Semantic tree extraction failed:', error.message);
            throw error;
        }
    }

    /**
     * Extract interactive elements.
     * @param {playwright.Page} page - The Playwright page.
     * @returns {Promise<Array<SemanticElement>>} Array of interactive elements.
     * @private
     */
    async _extractInteractiveElements(page) {
        try {
            // Build selector for interactive elements
            const roleSelectors = this.interactiveRoles.map(role => `[role="${role}"]`);
            const tagSelectors = ['button', 'a', 'input', 'select', 'textarea'];
            const attrSelectors = ['[contenteditable]', '[tabindex="0"]'];
            const allSelectors = [...roleSelectors, ...tagSelectors, ...attrSelectors].join(', ');

            // Evaluate in page context
            const elements = await page.$$eval(allSelectors, (nodes) => {
                return nodes.map(node => {
                    // Get bounding box
                    const rect = node.getBoundingClientRect();

                    // Get computed style
                    const style = window.getComputedStyle(node);
                    const visible = style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        rect.width > 0 &&
                        rect.height > 0;

                    // Get ARIA properties
                    const role = node.getAttribute('role') || node.tagName.toLowerCase();
                    const ariaLabel = node.getAttribute('aria-label');
                    const ariaLabelledBy = node.getAttribute('aria-labelledby');

                    // Determine accessible name
                    let name = ariaLabel || node.innerText?.trim() || node.value || node.placeholder || '';

                    if (ariaLabelledBy) {
                        const labelElement = document.getElementById(ariaLabelledBy);
                        if (labelElement) {
                            name = labelElement.innerText?.trim() || name;
                        }
                    }

                    // For links, get href
                    const href = node.getAttribute('href');
                    if (href && !name) {
                        name = href;
                    }

                    // Truncate long names
                    if (name.length > 100) {
                        name = name.substring(0, 97) + '...';
                    }

                    return {
                        role,
                        name,
                        coordinates: {
                            x: Math.round(rect.x + rect.width / 2),
                            y: Math.round(rect.y + rect.height / 2)
                        },
                        visible,
                        enabled: !node.disabled,
                        tag: node.tagName.toLowerCase()
                    };
                });
            });

            // Filter to visible and enabled elements - check enabled first for short-circuit
            return elements.filter(el => el.enabled && el.visible);

        } catch (error) {
            logger.error('[SemanticParser] Interactive element extraction failed:', error.message);
            return [];
        }
    }

    /**
     * Extract landmark elements.
     * @param {playwright.Page} page - The Playwright page.
     * @returns {Promise<Array<SemanticElement>>} Array of landmark elements.
     * @private
     */
    async _extractLandmarks(page) {
        try {
            const roleSelectors = this.landmarkRoles.map(role => `[role="${role}"]`);
            const tagSelectors = ['main', 'nav', 'header', 'footer', 'aside', 'form'];
            const allSelectors = [...roleSelectors, ...tagSelectors].join(', ');

            const landmarks = await page.$$eval(allSelectors, (nodes) => {
                return nodes.map(node => {
                    const rect = node.getBoundingClientRect();
                    const style = window.getComputedStyle(node);
                    const visible = style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        rect.width > 0 &&
                        rect.height > 0;

                    const role = node.getAttribute('role') || node.tagName.toLowerCase();
                    const ariaLabel = node.getAttribute('aria-label');
                    const name = ariaLabel || role;

                    return {
                        role,
                        name,
                        coordinates: {
                            x: Math.round(rect.x + rect.width / 2),
                            y: Math.round(rect.y + rect.height / 2)
                        },
                        visible
                    };
                });
            });

            return landmarks.filter(el => el.visible);

        } catch (error) {
            logger.error('[SemanticParser] Landmark extraction failed:', error.message);
            return [];
        }
    }

    /**
     * Generate compact text representation of semantic tree.
     * Suitable for LLM context injection.
     * @param {SemanticTree} tree - The semantic tree.
     * @param {number} [maxElements=50] - Maximum elements to include.
     * @returns {string} Text representation.
     */
    generateCompactRepresentation(tree, maxElements = 50) {
        if (!tree) {
            return 'Page: undefined\nURL: undefined\n\n\n';
        }

        const pageTitle = tree.pageTitle || 'undefined';
        const url = tree.metadata && tree.metadata.url ? tree.metadata.url : 'undefined';
        const landmarks = tree.landmarks || [];
        const interactiveElements = tree.interactiveElements || [];

        let output = `Page: ${pageTitle}\nURL: ${url}\n\n`;

        // Add landmarks
        if (landmarks.length > 0) {
            output += `Landmarks:\n`;
            landmarks.slice(0, 10).forEach((landmark, idx) => {
                output += `  ${idx + 1}. ${landmark.role}: "${landmark.name}"\n`;
            });
            output += '\n';
        }

        // Add interactive elements
        if (interactiveElements.length > 0) {
            output += `Interactive Elements (${interactiveElements.length} total, showing ${Math.min(maxElements, interactiveElements.length)}):\n`;
            interactiveElements.slice(0, maxElements).forEach((element, idx) => {
                output += `  [${idx + 1}] ${element.role}: "${element.name}" @ (${element.coordinates.x}, ${element.coordinates.y})\n`;
            });
        }

        return output;
    }

    /**
     * Find element by partial name match.
     * @param {SemanticTree} tree - The semantic tree.
     * @param {string} searchName - Partial name to search for (case-insensitive).
     * @returns {SemanticElement|null} Matching element or null.
     */
    findElementByName(tree, searchName) {
        if (!tree) {
            return null;
        }

        const normalized = searchName.toLowerCase();

        const match = tree.interactiveElements && tree.interactiveElements.find(el =>
            el.name && el.name.toLowerCase().includes(normalized)
        );

        return match || null;
    }

    /**
     * Get statistics.
     * @param {SemanticTree} tree - The semantic tree.
     * @returns {object} Statistics object.
     */
    getTreeStats(tree) {
        if (!tree) {
            return {
                pageTitle: undefined,
                url: undefined,
                totalElements: undefined,
                interactiveElements: undefined,
                landmarks: undefined,
                roleBreakdown: {}
            };
        }

        return {
            pageTitle: tree.pageTitle,
            url: tree.metadata && tree.metadata.url,
            totalElements: tree.metadata && tree.metadata.totalElements,
            interactiveElements: tree.interactiveElements && tree.interactiveElements.length,
            landmarks: tree.landmarks && tree.landmarks.length,
            roleBreakdown: this._getRoleBreakdown(tree.interactiveElements || [])
        };
    }

    /**
     * Get role breakdown.
     * @param {Array<SemanticElement>} elements - Array of elements.
     * @returns {object} Role counts.
     * @private
     */
    _getRoleBreakdown(elements) {
        const breakdown = {};

        elements.forEach(el => {
            breakdown[el.role] = (breakdown[el.role] || 0) + 1;
        });

        return breakdown;
    }
}

export default SemanticParser;
