/**
 * @fileoverview Main Agent Logic (The Brain). Orchestrates the Perception-Action loop.
 * @module local-agent/core/agent
 */

import { createLogger } from '../../utils/logger.js';
import vision from './vision.js';
import llmClient from '../network/llmClient.js';
import actionEngine from './actionEngine.js';
import { estimateConversationTokens } from '../utils/tokenCounter.js';



class Agent {
    constructor(page, goal, config = {}) {
        const sessionId = config.sessionId || 'unknown';
        const taskName = config.taskName || 'agent';
        this.sessionId = sessionId;
        this.logger = createLogger(`local-agent.js [${sessionId}] [${taskName}]`);
        this.page = page;
        this.goal = goal;
        this.history = [];
        this.maxSteps = 20; // Default hard cap
        this.stepDelay = config.stepDelay || 2000;

        // Loop detection state
        this.lastAction = null;
        this.lastState = null;
    }

    async run() {
        const logger = this.logger;
        logger.info(`Starting Agent with goal: "${this.goal}" (Step Delay: ${this.stepDelay}ms)`);

        // 0. Pre-flight Check & Auto-Start Model if Needed
        // MOVED TO main-browser-use.js for global management
        // await llmClient.ensureModelRunning();

        let stepCount = 0;
        this.consecutiveLlmFailures = 0;
        this.stateVisitCounts = {};
        while (stepCount < this.maxSteps) {
            stepCount++;
            logger.info(`--- Step ${stepCount}/${this.maxSteps} ---`);

            // 1. Perceive
            try { await this.page.bringToFront(); } catch (e) { /* ignore */ }
            logger.debug('Capturing state...');

            // OPTIMIZATION: Only take screenshot if Vision is enabled
            let screenshot = '';
            if (llmClient.config.useVision !== false) {
                screenshot = await vision.captureState(this.page);
            }

            const axTree = await vision.captureAXTree(this.page, this.sessionId);
            const currentUrl = this.page.url();

            // 2. Build Prompt
            const messages = this.buildPrompt(screenshot, axTree, currentUrl);

            // 3. Think
            logger.debug('Sending to LLM...');
            let llmResponse;
            try {
                llmResponse = await llmClient.generateCompletion(messages);
                logger.info(`LLM Decision: ${JSON.stringify(llmResponse)}`);
                this.consecutiveLlmFailures = 0;
            } catch (e) {
                logger.error('LLM Failure:', e);

                this.consecutiveLlmFailures = (this.consecutiveLlmFailures || 0) + 1;
                if (this.consecutiveLlmFailures >= 3) {
                    logger.error(`Aborting task after ${this.consecutiveLlmFailures} consecutive LLM failures.`);
                    return;
                }

                await this.page.waitForTimeout(5000);
                continue;
            }

            // 4. Act
            if (!llmResponse || !llmResponse.action) {
                logger.warn('Invalid LLM response (no action). Retrying...');
                await this.page.waitForTimeout(1000);
                continue;
            }

            // --- LOOP DETECTION ---
            // Detection Strategy: Same Action AND Same State = Loop = Done.
            const actionSignature = JSON.stringify(llmResponse);
            const stateSignature = axTree; // Use full tree for robust check? Or hash? 
            // If tree is big, string comparison is cheap enough in JS (V8 optimizes strings). 
            // But we just need a decent signal.

            if (this.lastAction === actionSignature) {
                this.consecutiveActionCount = (this.consecutiveActionCount || 0) + 1;
            } else {
                this.consecutiveActionCount = 1;
            }

            // Loop Detection Strategy:
            // 1. Same Action + Same State = Immediate Stop (Existing)
            // 2. Same Action 3 times in a row = Stop (Existing)
            // 3. Re-visiting identical state > 3 times = Cycle Stop (New)

            const stateHash = stateSignature; // Using raw string since it's truncated
            this.stateVisitCounts[stateHash] = (this.stateVisitCounts[stateHash] || 0) + 1;

            if ((this.lastState === stateSignature && this.consecutiveActionCount >= 2) ||
                this.consecutiveActionCount >= 3 ||
                this.stateVisitCounts[stateHash] >= 5) { // Allow some backtracking, but 5 is a loop
                logger.warn(`Loop detected: Action repeated ${this.consecutiveActionCount} times or State visited ${this.stateVisitCounts[stateHash]} times. Stopping.`);
                return;
            }

            this.lastAction = actionSignature;
            this.lastState = stateSignature;
            // ----------------------

            const result = await actionEngine.execute(this.page, llmResponse, this.sessionId);

            // 5. Update History
            this.history.push({
                role: 'assistant',
                content: JSON.stringify(llmResponse)
            });
            // Optionally summarize key outcome to history to save tokens
            this.history.push({
                role: 'user',
                content: result.success ?
                    `Action succeeded.` :
                    `Action failed: ${result.error}`
            });

            if (result.done) {
                logger.info('Agent completed the task successfully.');
                return;
            }

            // Basic wait to let UI settle
            await this.page.waitForTimeout(this.stepDelay);
        }

        logger.warn(`Agent reached max steps (${this.maxSteps}) without completing.`);
    }

    buildPrompt(base64Image, axTree, currentUrl) {
        // Construct the messages array for the Chat API

        const systemPromptMessage = {
            role: "system",
            content: `You are a browser automation agent. Your goal is: ${this.goal}.
        
        You will receive an Accessibility Tree (JSON/Text structure) of the page.
        Use it to identify elements and their selectors.
        
        Output strictly valid JSON.
        Available actions:
        - { "action": "navigate", "value": "https://..." }
        - { "action": "wait", "value": "5000" } (Wait in milliseconds)
        - { "action": "click", "selector": "..." } 
           - Preferred selector format: "role=button, name=Search" or "text=Search" or "#id"
        - { "action": "type", "selector": "...", "value": "..." }
        - { "action": "press", "key": "Enter" } (Or "Tab", "Escape", etc)
        - { "action": "scroll", "value": "down" }
        - { "action": "screenshot" } (Save a screenshot of the current page)
        - { "action": "done" }

        Analyze the page structure and choose the next best step.
        IMPORTANT: Use the EXACT 'role' shown in the AXTree (e.g. if it says [combobox], use role=combobox, NOT role=textbox).
        Your AXTree 'name' is NOT a CSS name attribute. Use "text=Name" or "role=..., name=..." to target it.
        
        CRITICAL RULES:
        1. If specific URL was requested and you are on it (see Current URL), output { "action": "done" }.
        2. SEQUENTIAL GOALS: If the goal list steps (e.g. "do X, wait, done"), follow them STRICTLY in order. Check your history to see what you just did.
        3. AFTER clicking a submit button (Search, Login) OR pressing 'Enter', YOU MUST use { "action": "wait", "value": "5000" } immediately.
        4. If the goal says "... done" and you have completed the previous steps, IMMEDIATELY output { "action": "done" }.
        5. Do not repeat the same action if the state hasn't changed.
        6. If you typed something and the Value is visible in AXTree, you are done => { "action": "done" }.`
        };

        // Context Window Management: Sliding Window
        // CRITICAL: Prevent "Context size exceeded" errors by strictly limiting history.
        // We keep: System Prompt + Goal + Last 2 messages + Current State.
        // Create explicit copy of recent history to avoid mutation
        // Keep only last 2 messages (user-assistant pair) + current
        const recentHistory = this.history.slice(-2).map(msg => {
            if (Array.isArray(msg.content)) {
                // Keep only text parts, filter out image_url
                const textOnly = msg.content
                    .filter(c => c.type === 'text')
                    .map(c => c.text)
                    .join('\n');
                return { role: msg.role, content: textOnly };
            }
            return msg;
        });


        // Build content array - conditionally include image based on config
        const contentParts = [
            { type: "text", text: `Current URL: ${currentUrl}` },
            { type: "text", text: `Current Page State (Accessibility Tree):\n${axTree}` }
        ];

        // Only add image if vision is enabled in config
        const config = llmClient.config;
        if (config.useVision !== false) {  // Default to true if not specified
            contentParts.push({ type: "text", text: "Look at the screenshot to understand the visual layout and context." });
            contentParts.push({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            });
        } else {
            contentParts.push({ type: "text", text: "Use the accessibility tree to identify elements and their exact selectors." });
        }

        const userMessage = {
            role: "user",
            content: contentParts
        };

        return [systemPromptMessage, ...recentHistory, userMessage];
    }

    /**
     * Get usage statistics for the current agent session.
     * @returns {object} Usage stats including step count and estimated token usage.
     */
    getUsageStats() {
        const estimatedTokens = estimateConversationTokens(this.history);
        return {
            steps: this.stepCount,
            maxSteps: this.maxSteps,
            estimatedTokens: estimatedTokens,
            historySize: this.history.length
        };
    }
}

export default Agent;
