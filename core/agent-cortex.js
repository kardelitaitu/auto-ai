/**
 * @fileoverview Agent Cortex - The "Brain" of the autonomous agent.
 * Manages state, history, "Stuck" detection, and decision making.
 * @module core/agent-cortex
 */

import { createLogger } from '../utils/logger.js';
import VisionInterpreter from './vision-interpreter.js';
import LocalClient from './local-client.js';
import crypto from 'crypto';

const logger = createLogger('agent-cortex.js');

// Configuration Constants
const STUCK_THRESHOLD = 3;           // Number of identical screens before "stuck"
const FAILURE_THRESHOLD = 2;         // Consecutive failures before warning
const HISTORY_WINDOW = 5;            // Number of recent actions to keep in context
const MAX_HISTORY_SIZE = 50;         // Maximum total history entries

class AgentCortex {
    constructor(sessionId, goal, steps = []) {
        this.sessionId = sessionId;
        this.goal = goal;
        this.steps = steps;              // Methodology checklist

        this.history = [];               // Array of { action, result, summary }
        this.consecutiveFailures = 0;
        this.lastVisionHash = null;
        this.stuckCounter = 0;

        // Step Tracking State
        this.currentStep = steps.length > 0 ? 1 : 0;  // Track actual current step
        this.stepAttempts = 0;            // How many turns on current step
        this.maxStepAttempts = 5;         // Max attempts per step before forcing advance

        // Dependencies
        this.interpreter = new VisionInterpreter();
        this.llmClient = new LocalClient(); // Connects to Ollama

        logger.debug(`[${this.sessionId}] [Cortex] Initialized with goal: "${goal}"`);
        if (steps.length > 0) {
            logger.debug(`[${this.sessionId}] [Cortex] Loaded ${steps.length} methodology steps`);
            logger.info(`[${this.sessionId}] [Cortex] 📋 Starting at Step 1: ${steps[0]}`);
        }
    }

    /**
     * The Main "Think" Step.
     * Takes current vision/dom and returns the next Action.
     */
    async planNextStep(visionPacket, semanticTree) {
        // 0. EARLY TERMINATION CHECK: If all steps completed, terminate immediately
        // This MUST happen before building the prompt to avoid undefined step content
        if (this.steps.length > 0 && this.currentStep > this.steps.length) {
            logger.success(`[${this.sessionId}] [Cortex] 🎉 All ${this.steps.length} steps completed!`);
            return {
                type: 'terminate',
                reason: `Successfully completed all ${this.steps.length} steps`,
                actions: [{
                    type: 'terminate',
                    reason: `Goal "${this.goal}" achieved - all steps completed`
                }]
            };
        }

        // 0b. CHECK FOR TERMINATION STEP: If current step is a "DONE" marker, terminate
        if (this.steps.length > 0 && this.currentStep <= this.steps.length) {
            const currentStepText = this.steps[this.currentStep - 1].toLowerCase();
            const terminationKeywords = ['done', 'complete', 'finish', 'end', 'terminate'];
            const isTerminationStep = terminationKeywords.some(kw => currentStepText.includes(kw));

            if (isTerminationStep) {
                logger.success(`[${this.sessionId}] [Cortex] 🏁 Reached termination step: "${this.steps[this.currentStep - 1]}"`);
                return {
                    type: 'terminate',
                    reason: `Reached termination step (${this.currentStep}/${this.steps.length})`,
                    actions: [{
                        type: 'terminate',
                        reason: `Goal "${this.goal}" achieved - ${this.steps[this.currentStep - 1]}`
                    }]
                };
            }
        }

        // 1. Check for Stuck State
        this._checkStuckState(visionPacket);

        // 2. Build History Context (Pruned)
        const historyStr = this._formatHistory();

        // 3. Construct Prompt
        const prompt = this._buildPrompt(historyStr, semanticTree, visionPacket);

        // 4. Query LLM
        logger.info(`[${this.sessionId}] [Cortex] Thinking...`);
        const response = await this.llmClient.sendRequest({
            prompt: prompt,
            vision: visionPacket.base64,
            maxTokens: 2048,
            temperature: 0.1 // Low temperature for consistent, deterministic actions
        });

        if (!response.success) {
            throw new Error(`Cortex Brain Freeze: ${response.error}`);
        }

        // 5. Parse
        logger.debug(`[${this.sessionId}] [Cortex] Raw LLM Response: ${response.content.substring(0, 500)}...`);
        const plan = this.interpreter.parseResponse(response.content);

        if (!plan.success) {
            logger.warn(`[${this.sessionId}] [Cortex] Invalid thought format: ${plan.error}`);
            logger.debug(`[${this.sessionId}] [Cortex] Full response: ${response.content}`);
            // Return recovery action with context
            return {
                type: 'wait',
                duration: 2000,
                description: `Parse Error: ${plan.error || 'Invalid JSON'}`
            };
        }

        // Log the "Thought"
        if (plan.data.thought) {
            logger.info(`[${this.sessionId}] 🧠 THOUGHT: ${plan.data.thought}`);
        }

        // 6. STEP VALIDATION & ENFORCEMENT
        if (this.steps.length > 0) {
            this._validateAndEnforceStep(plan.data);

            // 7. AUTO-TERMINATE IF ALL STEPS COMPLETED
            if (this.currentStep > this.steps.length) {
                logger.success(`[${this.sessionId}] [Cortex] 🎉 All ${this.steps.length} steps completed!`);
                return {
                    type: 'terminate',
                    reason: `Successfully completed all ${this.steps.length} steps`,
                    actions: [{
                        type: 'terminate',
                        reason: `Goal "${this.goal}" achieved - all steps completed`
                    }]
                };
            }
        }

        // Return the full plan data (includes all actions)
        return plan.data;
    }

    /**
     * Record the result of an action.
     */
    recordResult(action, success, message) {
        this.history.push({
            type: action.type,
            description: action.description,
            success: success,
            result: message,
            timestamp: Date.now()
        });

        // Prune history if it exceeds max size
        if (this.history.length > MAX_HISTORY_SIZE) {
            this.history = this.history.slice(-MAX_HISTORY_SIZE);
            logger.debug(`[${this.sessionId}] [Cortex] History pruned to ${MAX_HISTORY_SIZE} entries`);
        }

        if (!success) {
            this.consecutiveFailures++;
        } else {
            this.consecutiveFailures = 0;
            // Smart Step Completion Detection
            this._detectStepCompletion(action);
        }
    }

    /**
     * Intelligently detect if the current step is complete based on action patterns.
     */
    _detectStepCompletion(lastAction) {
        if (this.currentStep > this.steps.length) return; // Already past all steps

        const currentStepDesc = this.steps[this.currentStep - 1].toLowerCase();

        // Get recent successful actions (last 5)
        const recentActions = this.history
            .slice(-5)
            .filter(h => h.success)
            .map(h => h.type);

        // Detection patterns for common step types
        let shouldAdvance = false;

        // Pattern 1: Navigation steps (e.g., "navigate to google.com")
        if (currentStepDesc.includes('navigate') && lastAction.type === 'navigate') {
            shouldAdvance = true;
            logger.debug(`[${this.sessionId}] [Cortex] 🔍 Detected navigation completion`);
        }

        // Pattern 2: Search/Type steps (e.g., "search for X")
        if (currentStepDesc.includes('search') && recentActions.includes('press')) {
            // Search typically involves: click → type → press Enter
            if (recentActions.includes('type') && recentActions.includes('click')) {
                shouldAdvance = true;
                logger.debug(`[${this.sessionId}] [Cortex] 🔍 Detected search completion (click→type→press)`);
            }
        }

        // Pattern 3: Wait steps (e.g., "wait for X seconds")
        if (currentStepDesc.includes('wait') && lastAction.type === 'wait') {
            shouldAdvance = true;
            logger.debug(`[${this.sessionId}] [Cortex] 🔍 Detected wait completion`);
        }

        // Pattern 4: Generic action completion - if step mentions specific action
        const actionVerbs = ['click', 'type', 'scroll', 'press'];
        for (const verb of actionVerbs) {
            if (currentStepDesc.includes(verb) && lastAction.type === verb) {
                shouldAdvance = true;
                logger.debug(`[${this.sessionId}] [Cortex] 🔍 Detected ${verb} action completion`);
                break;
            }
        }

        if (shouldAdvance) {
            this.advanceStep();
        }
    }

    /**
     * Validate the LLM's reported step and enforce sequential progression.
     */
    _validateAndEnforceStep(planData) {
        const reportedStep = planData.currentStep || this.currentStep;

        // Always use the system's current step as the source of truth
        planData.currentStep = this.currentStep;

        // Increment step attempts counter
        this.stepAttempts++;

        // Log status
        if (reportedStep !== this.currentStep) {
            logger.warn(`[${this.sessionId}] [Cortex] ⚠️ LLM reported step ${reportedStep}, corrected to ${this.currentStep}`);
        }

        logger.info(`[${this.sessionId}] [Cortex] 📍 Current Step: ${this.currentStep}/${this.steps.length} (Attempt ${this.stepAttempts}/${this.maxStepAttempts})`);

        // Force advancement if stuck too long on same step
        if (this.stepAttempts >= this.maxStepAttempts && this.currentStep <= this.steps.length) {
            logger.warn(`[${this.sessionId}] [Cortex] ⏭️ Max attempts reached. Force advancing from step ${this.currentStep}`);
            this.advanceStep();
            planData.currentStep = this.currentStep;
        }

        // Display current step goal
        if (this.currentStep <= this.steps.length) {
            logger.info(`[${this.sessionId}] [Cortex] 🎯 GOAL: "${this.steps[this.currentStep - 1]}"`);
        } else {
            logger.info(`[${this.sessionId}] [Cortex] 🏁 All steps completed!`);
        }
    }

    /**
     * Advance to the next step (called when current step is deemed complete).
     */
    advanceStep() {
        if (this.currentStep < this.steps.length) {
            this.currentStep++;
            this.stepAttempts = 0; // Reset attempts for new step
            logger.success(`[${this.sessionId}] [Cortex] ✅ Step ${this.currentStep - 1} completed!`);
            logger.info(`[${this.sessionId}] [Cortex] 📋 Moving to Step ${this.currentStep}: ${this.steps[this.currentStep - 1]}`);
        } else if (this.currentStep === this.steps.length) {
            this.currentStep++;
            this.stepAttempts = 0;
            logger.success(`[${this.sessionId}] [Cortex] 🎉 ALL STEPS COMPLETED! Ready to terminate.`);
        }
    }

    /**
     * Check if the agent is stuck (screen unchanged).
     * Uses MD5 hash of vision data for efficient comparison.
     */
    _checkStuckState(visionPacket) {
        // Use a proper hash for vision comparison
        const currentHash = crypto.createHash('md5')
            .update(visionPacket.base64.substring(0, 1000)) // Hash first 1000 chars for speed
            .digest('hex');

        if (this.lastVisionHash === currentHash) {
            this.stuckCounter++;
        } else {
            this.stuckCounter = 0;
        }
        this.lastVisionHash = currentHash;

        if (this.stuckCounter >= STUCK_THRESHOLD) {
            logger.warn(`[${this.sessionId}] [Cortex] STUCK DETECTED (Screen unchanged for ${STUCK_THRESHOLD} steps).`);
        }
    }

    /**
     * Format history for prompt context.
     * Returns last N actions as a readable string.
     */
    _formatHistory() {
        if (this.history.length === 0) return "No previous actions.";

        const recent = this.history.slice(-HISTORY_WINDOW);
        return recent.map((h, i) =>
            `${i + 1}. Action: ${h.type} (${h.description}) → Result: ${h.success ? 'Success' : 'Fail'} [${h.result}]`
        ).join('\n');
    }

    /**
     * Build the LLM prompt with all necessary context.
     */
    _buildPrompt(history, semanticTree, visionPacket) {
        // 1. Context Status (Stuck/Failure Warnings)
        let contextStatus = "";
        if (this.stuckCounter >= STUCK_THRESHOLD) {
            contextStatus += `\nWARNING: You are STUCK. The screen has not changed for ${STUCK_THRESHOLD} turns. You MUST try a different approach or REFRESH.`;
        }
        if (this.consecutiveFailures >= FAILURE_THRESHOLD) {
            contextStatus += `\nWARNING: Last ${FAILURE_THRESHOLD} actions FAILED. Critique your plan and try a different strategy.`;
        }

        // 2. URL Analysis (Anti-Hallucination)
        const currentUrl = visionPacket?.metadata?.url || "unknown";
        logger.debug(`[${this.sessionId}] [Cortex] Current URL: ${currentUrl}`);

        let urlInfo = `CURRENT URL: ${currentUrl}`;
        let blankPageWarning = "";
        let mustNavigate = false;

        // Detect blank states
        if (currentUrl === 'about:blank' || currentUrl.includes('newtab') || currentUrl === 'data:,') {
            urlInfo += " (PAGE IS BLANK)";
            blankPageWarning = "\n━━━ MANDATORY OVERRIDE ━━━\nTHE PAGE IS BLANK. YOU CANNOT SEE ANY CONTENT.\nYOUR FIRST ACTION **MUST** BE 'navigate'.\nIGNORE ANY VISUAL HALLUCINATIONS. THE SCREEN IS EMPTY.\n━━━━━━━━━━━━━━━━━━━━━━━━";
            mustNavigate = true;
        }

        // 3. Methodology (Step-by-Step Guide)
        let methodology = "";
        if (this.steps && this.steps.length > 0) {
            methodology = "METHODOLOGY (Sequence):\n";
            this.steps.forEach((step, i) => {
                methodology += `${i + 1}. ${step}\n`;
            });
            methodology += `\nTotal steps: ${this.steps.length}`;
            methodology += `\nWhen currentStep > ${this.steps.length}, you have completed ALL steps. Output 'terminate' action.`;
            methodology += "\nAnalyze which step you are currently on based on History.";
        }

        // 4. System Rules
        const SYSTEM_RULES = `SYSTEM RULES:
1. You are a VISION-ONLY agent. You see the screen as a human does.
2. BLANK PAGE PROTOCOL: If URL is 'about:blank', your ONLY valid action is 'navigate'.
3. NO URL CRAFTING: Navigate to base URLs only (e.g. "https://google.com"). Use search boxes for queries.
4. COORDINATE-BASED INTERACTION: Analyze the screenshot visually and provide EXACT pixel coordinates (x, y) for where to click or type.
5. VISUAL ANALYSIS: Carefully identify the CENTER of buttons, input boxes, and links. Provide coordinates relative to the top-left of the viewport.
6. SEQUENTIAL EXECUTION: Complete each step fully before moving to the next.
7. TERMINATION: Only terminate when you see clear visual evidence that the GOAL is achieved.`;

        // 5. Example override for blank pages
        // Calculate example coordinates based on actual viewport
        const viewport = visionPacket?.metadata?.viewport || { width: 1280, height: 720 };
        const searchBoxX = Math.round(viewport.width * 0.5);  // Center X
        const searchBoxY = Math.round(viewport.height * 0.35); // Upper-middle Y (typical for Google)

        let responseExample = `{
  "analysis": "I see the Google search page. The viewport is ${viewport.width}x${viewport.height}. The search box appears to be in the center-top area of the screen.",
  "thought": "Based on the ${viewport.width}x${viewport.height} viewport, the search box center should be around x=${searchBoxX}, y=${searchBoxY}. I will click there, type 'blueberry', then press Enter.",
  "actions": [
    { "type": "click", "x": ${searchBoxX}, "y": ${searchBoxY}, "description": "Click search box" },
    { "type": "type", "text": "blueberry", "description": "Type query" },
    { "type": "press", "key": "Enter", "description": "Submit search" }
  ]
}`;

        if (mustNavigate) {
            responseExample = `{
  "analysis": "The page is completely blank (about:blank). I cannot see any content.",
  "thought": "I must navigate to the target URL before I can interact with any elements.",
  "actions": [
    { "type": "navigate", "url": "https://google.com", "description": "Navigate to Google" }
  ]
}`;
        }

        // 6. Construct Prompt with strict step tracking
        // Only show step tracking if currentStep is within bounds (defensive check)
        const stepTracking = (methodology && this.currentStep <= this.steps.length) ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 YOUR CURRENT TASK (Step ${this.currentStep}/${this.steps.length}):
"${this.steps[this.currentStep - 1]}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FOCUS: Complete THIS step only. Don't worry about other steps.
The system will automatically advance you when this step is done.

All steps (for reference):
${this.steps.map((s, i) => `${i + 1}. ${s}${i + 1 === this.currentStep ? ' ← YOU ARE HERE' : ''}`).join('\n')}
` : '';

        // Get actual viewport dimensions for accurate coordinates
        const viewportInfo = `Viewport size: ${viewport.width}x${viewport.height}`;

        return `You are an advanced autonomous agent.
GOAL: "${this.goal}"
${urlInfo}
${blankPageWarning}

${methodology}
${stepTracking}

${SYSTEM_RULES}

HISTORY (Past Actions):
${history}

CURRENT STATE:
[Vision Only Mode - ${viewportInfo}]
${contextStatus}

INSTRUCTIONS:
1. Check the CURRENT URL first. If it's 'about:blank', you MUST navigate before anything else.
2. VISUAL ANALYSIS: Study the screenshot carefully. Identify the pixel coordinates of interactive elements.
3. COORDINATE SYSTEM: The viewport is ${viewport.width}x${viewport.height}. Coordinates start at (0,0) in top-left.
4. For each action, provide EXACT coordinates (x, y) based on what you see in the screenshot.
5. Coordinates should be the CENTER of the element (button, input box, link).
6. Execute ONLY the current step. Complete it fully before moving to the next.

VALID ACTIONS:
- navigate (url required) // Use this FIRST if page is blank
- click (x, y, description) // Click at exact pixel coordinates
- type (text, description) // Type text at current cursor position
- press (key, description) // Press a key (default: "Enter")
- scroll (direction: up/down)
- wait (duration ms)
- terminate (reason)

RESPONSE FORMAT (JSON ONLY):
${responseExample}
`;
    }
}

export default AgentCortex;
