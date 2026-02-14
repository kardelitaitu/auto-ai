/**
 * @fileoverview Perception Layer (Vision & AXTree)
 * @module local-agent/core/vision
 */

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('vision.js');

class Vision {

    /**
     * Captures the current page state as a base64 image and AXTree
     * @param {object} page - The Playwright page instance. 
     * @returns {Promise<string>} Base64 image
     */
    async captureState(page) {
        try {
            const screenshot = await page.screenshot({
                type: 'jpeg',
                quality: 40,
                scale: 'css',
                timeout: 10000,
                animations: 'disabled',
                caret: 'hide'
            });
            return screenshot.toString('base64');
        } catch (e) {
            logger.error('Screenshot failed:', e);
            return '';
        }
    }

    /**
     * Captures a simplified Accessibility Tree
     * @param {object} page - The Playwright page instance.
     * @returns {Promise<string>} Text representation of AXTree
     */
    async captureAXTree(page, sessionId) {
        try {
            const snapshot = await page.accessibility.snapshot({ interestingOnly: true });
            if (!snapshot) return "No accessible content found.";

            const treeString = this.serializeTree(snapshot);
            const sessionTag = sessionId ? `[${sessionId}] ` : '';
            logger.debug(`${sessionTag}Captured AXTree (Length: ${treeString.length})`);
            return treeString;
        } catch (e) {
            logger.error(`${sessionId ? `[${sessionId}] ` : ''}AXTree capture failed:`, e);
            return "Error capturing accessibility tree.";
        }
    }

    serializeTree(root) {
        // Flatten the tree to a readable list with indentation
        const nodes = [];

        function traverse(node, depth = 0) {
            nodes.push({ node, depth });
            if (node.children) {
                node.children.forEach(child => traverse(child, depth + 1));
            }
        }

        // Handle array of roots or single root
        if (Array.isArray(root)) {
            root.forEach(r => traverse(r));
        } else {
            traverse(root);
        }

        function formatNode({ node, depth }) {
            const indent = " ".repeat(depth);

            // Format as Playwright-style selector: role=foo, name="bar"
            // This guides the model to output valid selectors naturally.
            const parts = [];

            // 1. Role
            parts.push(`role=${node.role}`);

            // 2. Name
            if (node.name) parts.push(`name="${node.name}"`);

            // 3. Value
            if (node.value) parts.push(`value="${node.value}"`);

            let content = parts.join(', ');

            // Add state metadata (not part of selector)
            const states = [];
            if (node.checked) states.push('checked');
            if (node.disabled) states.push('disabled');
            if (states.length > 0) content += ` [${states.join(', ')}]`;

            // return `${indent}- ${content}`; // REMOVED EARLY RETURN

            // ===== INTERACTIVITY FILTER =====
            // Heuristic: specific roles are interesting
            const interactiveRoles = [
                'button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
                'textbox', 'combobox', 'searchbox', 'spinbutton', 'slider',
                'checkbox', 'radio', 'switch', 'listbox', 'option',
                'WebArea', 'main', 'navigation', 'search', 'form', 'heading',
                'article' // Added article for content reading
            ];

            // If it's NOT in the whitelist, AND has no Name, AND has no Value -> Skip
            if (!interactiveRoles.includes(node.role) && !node.name && !node.value) return null;

            // Explicit blacklist for noisy structural roles
            const skipRoles = ['StaticText', 'image', 'paragraph', 'group', 'generic', 'LineBreak', 'div', 'span'];
            if (skipRoles.includes(node.role) && !node.name) return null;

            return `${indent}- ${content}`;
        }

        const treeString = nodes.map(formatNode).filter(n => n !== null).join('\n');

        // Optimized Limit: 2000 chars (approx 500 tokens)
        const MAX_LENGTH = 2000;
        if (treeString.length > MAX_LENGTH) {
            return treeString.substring(0, MAX_LENGTH) + `...`;
        }
        return treeString;
    }
}

export default new Vision();
