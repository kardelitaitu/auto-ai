/**
 * @fileoverview PromptBuilder utility for AgentCortex.
 * Centralizes prompt engineering logic and templates.
 * @module core/prompt-builder
 */

class PromptBuilder {
    /**
     * @param {string} goal - The overall goal of the agent.
     * @param {string[]} steps - The methodology steps.
     */
    constructor(goal, steps = []) {
        this.goal = goal;
        this.steps = steps;
    }

    /**
     * Build the LLM prompt.
     * @param {object} params - Prompt parameters.
     * @returns {string} The formatted prompt.
     */
    build(params) {
        const {
            history,
            visionPacket,
            currentStep,
            stuckCounter,
            consecutiveFailures,
            stuckThreshold = 3,
            failureThreshold = 2
        } = params;

        const viewport = visionPacket?.metadata?.viewport || { width: 1280, height: 720 };
        const currentUrl = visionPacket?.metadata?.url || "unknown";
        const isBlank = this._isBlank(currentUrl);

        // 1. Context Warnings
        let warnings = "";
        if (stuckCounter >= stuckThreshold) {
            warnings += `\nWARNING: You are STUCK. The screen has not changed for ${stuckThreshold} turns. You MUST try a different approach or REFRESH.`;
        }
        if (consecutiveFailures >= failureThreshold) {
            warnings += `\nWARNING: Last ${consecutiveFailures} actions FAILED. Critique your plan and try a different strategy.`;
        }

        // 2. Methodology & Step Tracking
        let methodology = "";
        if (this.steps.length > 0) {
            methodology = "METHODOLOGY (Sequence):\n" +
                this.steps.map((s, i) => `${i + 1}. ${s}${i + 1 === currentStep ? ' ← YOU ARE HERE' : ''}`).join('\n') +
                `\n\n🎯 CURRENT TASK (Step ${currentStep}/${this.steps.length}): "${this.steps[currentStep - 1] || 'ALL DONE'}"`;
        }

        // 3. Examples
        const responseExample = isBlank ? this._getBlankPageExample() : this._getNormalExample(viewport);

        return `You are an advanced autonomous agent.
GOAL: "${this.goal}"
CURRENT URL: ${currentUrl}${isBlank ? " (PAGE IS BLANK)" : ""}
${isBlank ? "\n━━━ MANDATORY OVERRIDE ━━━\nTHE PAGE IS BLANK. YOUR FIRST ACTION **MUST** BE 'navigate'.\n━━━━━━━━━━━━━━━━━━━━━━━━" : ""}

${methodology}

SYSTEM RULES:
1. VISION-ONLY: You see coordinates on a ${viewport.width}x${viewport.height} viewport.
2. BLANK PAGE: If about:blank, ONLY 'navigate' is valid.
3. CONTEXT: coordinates are centered on elements.
4. TERMINATION: Finish when you have visual evidence of success.

HISTORY:
${history}

STATE:
[Vision Mode - ${viewport.width}x${viewport.height}]${warnings}

VALID ACTIONS:
- navigate(url)
- click(x, y, description)
- type(text, description)
- press(key, description)
- scroll(direction)
- wait(ms)
- terminate(reason)

RESPONSE FORMAT (JSON ONLY):
${responseExample}`;
    }

    _isBlank(url) {
        return url === 'about:blank' || url.includes('newtab') || url === 'data:,';
    }

    _getNormalExample(viewport) {
        const x = Math.round(viewport.width * 0.5);
        const y = Math.round(viewport.height * 0.35);
        return `{
  "analysis": "I see the page. Box at ${x},${y}.",
  "thought": "I will click there.",
  "actions": [
    { "type": "click", "x": ${x}, "y": ${y}, "description": "Click element" }
  ]
}`;
    }

    _getBlankPageExample() {
        return `{
  "analysis": "Blank page.",
  "thought": "I must navigate.",
  "actions": [
    { "type": "navigate", "url": "https://google.com", "description": "Start" }
  ]
}`;
    }
}

export default PromptBuilder;
