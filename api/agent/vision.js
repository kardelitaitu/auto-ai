/**
 * @fileoverview Agent Vision (Screenshots & Interpretation)
 * Provides visual context for LLMs, including ROI detection, compression, and prompt building.
 * Returns Base64 data by default to avoid filesystem clutter.
 * @module api/agent/vision
 */

import { getPage } from '../core/context.js';
import { getStateAgentElementMap } from '../core/context-state.js';
import { createLogger } from '../core/logger.js';
import { identifyROI } from '../utils/roi-detector.js';
import sharp from 'sharp';

const logger = createLogger('api/agent/vision.js');

/**
 * Inject annotations into the page.
 * @param {Document} doc - Document object
 * @param {object[]} map - Element map
 */
export function injectAnnotations(doc, map) {
    const container = doc.createElement('div');
    container.id = 'agent-vision-annotations';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '999999';
    doc.body.appendChild(container);

    map.forEach(el => {
        const target = doc.querySelector(`[data-agent-id="${el.id}"]`);
        if (!target) return;

        const rect = target.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const box = doc.createElement('div');
        box.style.position = 'absolute';
        box.style.top = `${rect.top + doc.defaultView.scrollY}px`;
        box.style.left = `${rect.left + doc.defaultView.scrollX}px`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        box.style.border = '2px solid red';
        box.style.boxSizing = 'border-box';

        const label = doc.createElement('div');
        label.innerText = el.id;
        label.style.position = 'absolute';
        label.style.top = '-20px';
        label.style.left = '0';
        label.style.backgroundColor = 'red';
        label.style.color = 'white';
        label.style.fontSize = '12px';
        label.style.padding = '2px 4px';
        label.style.fontWeight = 'bold';
        label.style.borderRadius = '2px';

        box.appendChild(label);
        container.appendChild(box);
    });
}

/**
 * Remove annotations from the page.
 */
export function removeAnnotations(doc) {
    const container = doc.getElementById('agent-vision-annotations');
    if (container) container.remove();
}

/**
 * Build a structured prompt for the Vision LLM.
 * @param {object} context - Goal and semantic context.
 * @returns {string} The formatted prompt.
 */
export function buildPrompt(context) {
    const { goal, semanticTree } = context;
    const elements = (semanticTree || []).slice(0, 30);

    let elementsList = elements.length === 0
        ? "No interactive elements detected (Blind Mode)."
        : elements.map((el, i) => {
            const name = el.name || el.text || el.accessibilityId || 'Unknown';
            const role = el.role || 'element';
            const coords = el.coordinates ? `(${el.coordinates.x},${el.coordinates.y})` : '(0,0)';
            return `${el.id || i}. [${role}] "${name}" @ ${coords}`;
        }).join('\n');

    return `You are an intelligent browser automation agent.
Analyze the image and the elements to achieve the Goal: "${goal}"

Interactive Elements:
${elementsList}

Instructions:
1. Identify the target element (by ID).
2. Plan: Decide if you need to CLICK, TYPE, SCROLL, MOVE, or WAIT.
3. Strict JSON: Output ONLY a valid JSON object:
{
  "thought": "Reasoning...",
  "actions": [{ "type": "click", "elementId": 5, "description": "..." }]
}

Now, generate the JSON plan.`;
}

/**
 * Parse LLM vision response.
 */
export function parseResponse(rawText) {
    if (!rawText) return { success: false, error: "Empty response" };

    const jsonRegex = /\{[\s\S]*\}/;
    const match = rawText.match(jsonRegex);

    if (!match) return { success: false, error: "No JSON found", raw: rawText };

    try {
        const data = JSON.parse(match[0]);
        if (!Array.isArray(data.actions)) throw new Error("Missing 'actions' array");
        return { success: true, data };
    } catch (e) {
        return { success: false, error: "JSON parse error: " + e.message, raw: rawText };
    }
}

/**
 * Capture a screenshot with optional ROI, annotations, and compression.
 * @param {object} [options]
 * @returns {Promise<string|null>} Base64 image string.
 */
export async function screenshot(options = {}) {
    const { annotate = false, fullPage = false, useROI = true, quality = 60, targetSizeKB: _targetSizeKB = 50, path } = options;
    const page = getPage();
    const elementMap = getStateAgentElementMap();

    try {
        if (annotate && elementMap.length > 0) {
            await page.evaluate((map) => {
                injectAnnotations(document, map);
            }, elementMap);
        }

        const roi = useROI ? await identifyROI(page) : null;
        const screenshotOptions = { type: 'jpeg', quality: 100, fullPage, path };
        if (roi) screenshotOptions.clip = roi;

        const buffer = await page.screenshot(screenshotOptions);

        // Cleanup annotations
        if (annotate) {
            await page.evaluate(() => {
                const container = document.getElementById('agent-vision-annotations');
                if (container) container.remove();
            });
        }

        // Apply sharp compression
        let compressed = sharp(buffer);

        // Auto-scale if needed
        const metadata = await compressed.metadata();
        if (metadata.width > 1280) {
            compressed = compressed.resize(1280, null, { fit: 'inside' });
        }

        const finalBuffer = await compressed
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();

        const sizeKB = finalBuffer.length / 1024;
        logger.info(`Screenshot captured. ROI: ${roi ? 'Yes' : 'No'}, Final Size: ${sizeKB.toFixed(2)}KB`);

        return finalBuffer.toString('base64');

    } catch (error) {
        logger.error(`Vision capture failed: ${error.message}`);
        return null;
    }
}

export default {
    screenshot,
    buildPrompt,
    parseResponse,
    injectAnnotations,
    removeAnnotations,
    captureAXTree,
    captureState
};

/**
 * Capture accessibility tree snapshot
 * @param {object} [options] - Options for AXTree capture
 * @returns {Promise<string>} JSON string of accessibility tree
 */
export async function captureAXTree(options = {}) {
    const page = getPage();
    const { simplified = true } = options;
    
    try {
        const tree = await page.accessibility.snapshot();
        
        if (simplified && tree) {
            return JSON.stringify(_simplifyAXTree(tree), null, 2);
        }
        
        return JSON.stringify(tree, null, 2);
    } catch (error) {
        logger.error(`AXTree capture failed: ${error.message}`);
        return '';
    }
}

/**
 * Simplify AXTree for LLM consumption
 * @private
 */
function _simplifyAXTree(node, depth = 0) {
    if (!node) return null;
    if (depth > 5) return { role: node.role, name: node.name };
    
    const simplified = {
        role: node.role,
        name: node.name
    };
    
    if (node.children) {
        simplified.children = node.children
            .slice(0, 10)
            .map(child => _simplifyAXTree(child, depth + 1))
            .filter(Boolean);
    }
    
    return simplified;
}

/**
 * Capture full page state for LLM agent
 * @param {object} [options] - Options for capture
 * @returns {Promise<object>} State object with screenshot, axTree, and url
 */
export async function captureState(options = {}) {
    const page = getPage();
    const { screenshot: doScreenshot = true, axTree: doAXTree = true, quality = 40 } = options;
    
    const state = {
        screenshot: '',
        axTree: '',
        url: page.url()
    };
    
    if (doScreenshot) {
        try {
            const buffer = await page.screenshot({
                type: 'jpeg',
                quality,
                scale: 'css',
                timeout: 10000,
                animations: 'disabled',
                caret: 'hide'
            });
            state.screenshot = buffer.toString('base64');
        } catch (e) {
            logger.warn('Screenshot capture failed:', e.message);
        }
    }
    
    if (doAXTree) {
        state.axTree = await captureAXTree();
    }
    
    return state;
}
