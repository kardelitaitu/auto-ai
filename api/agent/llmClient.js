/**
 * @fileoverview HTTP Client for Local LLM (OpenAI-compatible) with Vision Support.
 * Merged from local-agent/network/llmClient.js
 * @module api/agent/llmClient
 */

import { createLogger } from '../core/logger.js';
import { configManager } from '../core/config.js';

const logger = createLogger('api/agent/llmClient.js');

class LLMClient {
    constructor() {
        this.config = null;
        this.isRestarting = false;
        this.restartPromise = null;
    }

    async init() {
        if (this.config) return;

        try {
            await configManager.init();
            this.config = configManager.get('agent.llm');
        } catch (_e) {
            logger.warn('Failed to load agent config, using defaults');
            this.config = configManager._getDefaults().agent.llm;
        }
    }

    /**
     * Performs a health check on the LLM endpoint.
     * @returns {Promise<boolean>}
     */
    async checkAvailability() {
        await this.init();
        logger.info(`Checking LLM availability at ${this.config.baseUrl}...`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${this.config.baseUrl}/models`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                logger.info(`LLM Service Available. Found ${data.data ? data.data.length : 0} models.`);
                return true;
            } else {
                const text = await response.text();
                logger.error(`LLM Service responded with Error: ${response.status}. Body: ${text}`);
                return false;
            }
        } catch (error) {
            if (this.config.bypassHealthCheck) {
                logger.warn(`Health check failed but bypassHealthCheck is enabled. Proceeding...`);
                return true;
            }
            logger.error(`LLM Connection Failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Ensures the model is running by checking availability.
     * @returns {Promise<void>}
     */
    async ensureModelRunning() {
        await this.init();
        logger.info('Checking if model is running...');

        const isAvailable = await this.checkAvailability();
        if (isAvailable) {
            logger.info('Model is already running.');
            return;
        }

        logger.warn('Model not running. Please start the model server manually.');
    }

    /**
     * Generates a completion via HTTP API with Vision Support.
     * @param {Array<{role: string, content: string|Array}>} messages - Chat history
     * @returns {Promise<object>} The JSON parsed response from the LLM
     */
    async generateCompletion(messages) {
        await this.init();

        if (this.isRestarting && this.restartPromise) {
            await this.restartPromise;
        }

        let url, payload;

        if (this.config.serverType === 'ollama') {
            url = `${this.config.baseUrl}/api/chat`;
            payload = {
                model: this.config.model,
                messages: messages,
                stream: false,
                options: {
                    temperature: this.config.temperature,
                    num_ctx: this.config.contextLength
                }
            };
        } else {
            url = `${this.config.baseUrl}/chat/completions`;
            payload = {
                model: this.config.model,
                messages: messages,
                temperature: this.config.temperature,
                stream: false,
                max_tokens: this.config.maxTokens
            };
        }

        const visionStatus = this.config.useVision ? 'Vision Enabled' : 'Vision Disabled';
        logger.info(`Sending Request to ${this.config.model} [${visionStatus}]...`);
        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const elapsedMs = Date.now() - startTime;

            if (data.usage) {
                const { prompt_tokens, completion_tokens, total_tokens } = data.usage;
                const tokensPerSec = completion_tokens / (elapsedMs / 1000);
                logger.info(`Tokens: ${prompt_tokens} + ${completion_tokens} = ${total_tokens} total | ${tokensPerSec.toFixed(1)} tok/s | ${elapsedMs}ms`);
            } else {
                logger.info(`Response time: ${elapsedMs}ms`);
            }

            let content;
            if (data.choices && data.choices.length > 0) {
                content = data.choices[0].message.content;
            } else if (data.message) {
                content = data.message.content;
            } else {
                throw new Error("Unexpected API response format");
            }

            content = content.trim();
            content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

            const firstBrace = content.indexOf('{');
            if (firstBrace !== -1) {
                content = content.substring(firstBrace);
                const lastBrace = content.lastIndexOf('}');
                if (lastBrace !== -1) {
                    content = content.substring(0, lastBrace + 1);
                }
            }

            const jsonResult = JSON.parse(content);
            return jsonResult;
        } catch (error) {
            logger.error(`LLM Request Failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get usage statistics
     * @returns {object} Config and status
     */
    getUsageStats() {
        return {
            model: this.config?.model,
            baseUrl: this.config?.baseUrl,
            useVision: this.config?.useVision,
            isRestarting: this.isRestarting
        };
    }
}

const llmClient = new LLMClient();

export { llmClient };
export default llmClient;
