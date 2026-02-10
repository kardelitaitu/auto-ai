/**
 * @fileoverview Ollama Client - Native integration with Ollama API.
 * Handles text and vision requests to standard Ollama endpoints.
 * @module core/ollama-client
 */

import { createLogger } from '../utils/logger.js';
import { getSettings } from '../utils/configLoader.js';

const logger = createLogger('ollama-client.js');

/**
 * @class OllamaClient
 * @description Native client for interacting with Ollama API (local or remote).
 */
class OllamaClient {
    constructor() {
        this.baseUrl = 'http://localhost:11434';
        this.model = 'llava:latest'; // Default fallback
        this.timeout = 180000;  // Increased to 3 minutes for vision
        this.config = null;
    }

    /**
     * Initialize client with configuration
     */
    async initialize() {
        if (this.config) return;

        try {
            const settings = await getSettings();
            const localConfig = settings.llm?.local || {};

            // Allow override of endpoint and model
            this.baseUrl = localConfig.endpoint || 'http://localhost:11434';
            // Clean up endpoint if it has /api/generate
            this.baseUrl = this.baseUrl.replace(/\/api\/generate$/, '').replace(/\/api\/chat$/, '');

            this.model = localConfig.model || 'llama3.2-vision';
            this.timeout = localConfig.timeout || 60000;

            logger.info(`[Ollama] Initialized: ${this.baseUrl} (Model: ${this.model})`);
            this.config = localConfig;
        } catch (error) {
            logger.warn('[Ollama] Failed to load config, using defaults:', error.message);
        }
    }

    /**
      * Send a generation request to Ollama
      * @param {object} request - Request parameters
      * @returns {Promise<object>} - Response data
      */
    async generate(request) {
        await this.initialize();

        const startTime = Date.now();

        // Check if this is a vision request - use chat endpoint for LLaVA
        const isVision = !!request.vision || !!request.images;

        // Warmup model on first vision request
        if (isVision && !this._warmedUp) {
            logger.info(`[Ollama] Warming up ${this.model}...`);
            try {
                await this._warmupModel();
                this._warmedUp = true;
            } catch (e) {
                logger.warn(`[Ollama] Warmup failed: ${e.message}`);
            }
        }

        // For vision models like llava, we MUST use /api/chat
        if (isVision) {
            return this._chatRequest(request, startTime);
        }

        // For text-only, try generate endpoint first (faster for text)
        return this._generateRequest(request, startTime);
    }

    /**
      * Warmup the model by making a simple request
      */
    async _warmupModel() {
        const endpoint = `${this.baseUrl}/api/generate`;
        const payload = {
            model: this.model,
            prompt: 'Hello',
            stream: false,
            options: {
                num_predict: 5
            }
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                logger.info(`[Ollama] Model warmup complete`);
            }
        } catch (e) {
            clearTimeout(timeoutId);
            throw e;
        }
    }

    /**
      * Use /api/chat endpoint (required for LLaVA vision models)
      */
    async _chatRequest(request, startTime) {
        const endpoint = `${this.baseUrl}/api/chat`;

        // Convert image to base64 if needed
        let base64Image = null;
        if (request.vision) {
            if (Buffer.isBuffer(request.vision)) {
                base64Image = request.vision.toString('base64');
            } else if (typeof request.vision === 'string') {
                base64Image = request.vision;
            } else {
                base64Image = Buffer.from(request.vision).toString('base64');
            }
        }

        // Build chat messages array - this is what LLaVA expects
        const messages = [];

        // Add system message if present
        if (request.systemPrompt) {
            messages.push({
                role: 'system',
                content: request.systemPrompt
            });
        }

        // For Ollama LLaVA, use the format: [INST] text [/INST]
        // Images can be passed as base64 in the prompt for older versions
        // or using the images array for newer versions
        let promptText = request.prompt;

        // Format for LLaVA's instruction template
        if (base64Image) {
            // Include image reference in the prompt for LLaVA
            promptText = `<image>\n${request.prompt}`;
        }

        messages.push({
            role: 'user',
            content: promptText
        });

        // Build payload
        const payload = {
            model: this.model,
            messages,
            stream: false,
            options: {
                temperature: request.temperature || 0.7,
                num_predict: request.maxTokens || 2048
            }
        };

        // Add images array for Ollama 0.15+
        if (base64Image) {
            payload.images = [base64Image];
        }

        logger.debug(`[Ollama] Using chat endpoint for ${this.model}...`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama API error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const duration = Date.now() - startTime;

            logger.success(`[Ollama] Chat request completed in ${duration}ms`);

            return {
                success: true,
                content: data.message?.content || data.response || '',
                model: data.model,
                duration: data.total_duration,
                metadata: {
                    eval_count: data.eval_count,
                    eval_duration: data.eval_duration
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            if (error.name === 'AbortError') {
                logger.error(`[Ollama] Chat request timed out after ${this.timeout}ms`);
                return { success: false, error: 'Request timeout', duration };
            }

            logger.error(`[Ollama] Chat request failed: ${error.message}`);
            return { success: false, error: error.message, duration };
        }
    }

    /**
      * Use /api/generate endpoint (for text-only models)
      */
    async _generateRequest(request, startTime) {
        const endpoint = `${this.baseUrl}/api/generate`;

        // For LLaVA, we need to use the instruction format
        // Template: [INST] {{ if .System }}{{ .System }} {{ end }}{{ .Prompt }} [/INST]
        let promptText = request.prompt;

        // Check if this is LLaVA model
        if (this.model.toLowerCase().includes('llava')) {
            // Add system prompt if present
            if (request.systemPrompt) {
                promptText = `${request.systemPrompt}\n\n${request.prompt}`;
            }
            // Wrap in instruction format for LLaVA
            promptText = `[INST] ${promptText} [/INST]`;
            logger.debug(`[Ollama] Using LLaVA instruction format`);
        }

        const payload = {
            model: this.model,
            prompt: promptText,
            stream: false,
            options: {
                temperature: request.temperature || 0.7,
                num_predict: request.maxTokens || 2048
            }
        };

        try {
            logger.debug(`[Ollama] Using generate endpoint for ${this.model}...`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama API error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const duration = Date.now() - startTime;

            logger.success(`[Ollama] Generate request completed in ${duration}ms`);

            return {
                success: true,
                content: data.response,
                model: data.model,
                duration: data.total_duration,
                metadata: {
                    eval_count: data.eval_count,
                    eval_duration: data.eval_duration
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            if (error.name === 'AbortError') {
                logger.error(`[Ollama] Generate request timed out after ${this.timeout}ms`);
                return { success: false, error: 'Request timeout', duration };
            }

            logger.error(`[Ollama] Generate request failed: ${error.message}`);
            return { success: false, error: error.message, duration };
        }
    }

    /**
     * Check if Ollama is accessible
     * @returns {Promise<boolean>}
     */
    async isReady() {
        await this.initialize();
        try {
            // fast check tags endpoint
            const res = await fetch(`${this.baseUrl}/api/tags`, {
                signal: AbortSignal.timeout(2000)
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    }
}

export default OllamaClient;
