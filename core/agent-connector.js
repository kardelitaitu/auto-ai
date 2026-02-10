/**
 * @fileoverview Agent Connector - Main entry point for AI services in the DAO architecture.
 * Routes high-level intent to appropriate AI provider (Local or Cloud).
 * @module core/agent-connector
 */

import { createLogger } from '../utils/logger.js';
import LocalClient from './local-client.js';
import CloudClient from './cloud-client.js';
import VisionInterpreter from './vision-interpreter.js';
import { getSettings } from '../utils/configLoader.js';
import RequestQueue from './request-queue.js';
import CircuitBreaker from './circuit-breaker.js';
import { LLMBatcher } from './request-batcher.js';

const logger = createLogger('agent-connector.js');

/**
 * @class AgentConnector
 * @description Orchestrates AI requests, handling failover and context management.
 */
class AgentConnector {
    constructor() {
        this.localClient = new LocalClient();
        this.cloudClient = new CloudClient();
        this.visionInterpreter = new VisionInterpreter();
        this.requestQueue = new RequestQueue({ maxConcurrent: 3, maxRetries: 3 });
        this.circuitBreaker = new CircuitBreaker({ failureThreshold: 5, halfOpenTime: 30000 });
        this.llmBatcher = new LLMBatcher({ batchSize: 5, batchDelay: 50 });
        this.llmBatcher.setClients({ local: this.localClient, cloud: this.cloudClient });
    }

    /**
     * Process a request using the most appropriate AI service.
     * @param {object} request - Request definition.
     * @param {string} request.action - 'analyze_page', 'analyze_page_with_vision', 'generate_reply', etc.
     * @param {object} request.payload - Data for the request (image, text, etc).
     * @param {object} request.context - State context (breadcrumbs, history).
     * @param {string} request.sessionId - Session identifier.
     * @returns {Promise<object>} Response with structured data/actions.
     */
    async processRequest(request) {
        const { action, payload, sessionId } = request;
        logger.info(`[${sessionId}] Processing request: ${action}`);

        const priority = payload.priority || 0;

        return this.requestQueue.enqueue(async () => {
            return this._executeWithCircuitBreaker(request, action);
        }, { priority });
    }

    /**
     * Execute request through circuit breaker
     * @private
     */
    async _executeWithCircuitBreaker(request, action) {
        const { sessionId } = request;
        const modelId = `agent-${action}`;

        return this.circuitBreaker.execute(modelId, async () => {
            return this._routeRequest(request, action);
        }, { retries: 3 });
    }

    /**
     * Route request to appropriate handler
     * @private
     */
    async _routeRequest(request, action) {
        const { payload, sessionId } = request;

        // Route based on action type
        if (action === 'analyze_page_with_vision') {
            return this.handleVisionRequest(request);
        }

        // Use LOCAL for simple text generation (Twitter replies)
        if (action === 'generate_reply') {
            return this.handleGenerateReply(request);
        }

        // Default to cloud for complex logic
        return this._sendToCloud(request, Date.now());
    }

    /**
     * Get queue and circuit breaker statistics
     * @param {string} sessionId
     * @returns {object}
     */
    getStats(sessionId) {
        return {
            queue: this.requestQueue.getStats(),
            circuitBreaker: this.circuitBreaker.getAllStatus(),
            batcher: this.llmBatcher.getStats()
        };
    }

    /**
     * Execute local client request with circuit breaker
     * @private
     */
    async _sendToLocal(llmRequest, sessionId) {
        return this.circuitBreaker.execute('local-model', async () => {
            return this.localClient.sendRequest(llmRequest);
        });
    }

    /**
     * Execute cloud client request with circuit breaker
     * @private
     */
    async _callCloudWithBreaker(cloudRequest, sessionId) {
        return this.circuitBreaker.execute('cloud-model', async () => {
            return this.cloudClient.sendRequest(cloudRequest);
        });
    }

    /**
      * Handle text-only generation requests using local Ollama.
      * Optimized for Twitter reply generation with optional vision support.
      * Falls back to text-only if vision times out.
      * @param {object} request
      */
    async handleGenerateReply(request) {
        const { payload, sessionId } = request;
        const start = Date.now();

        // Check if any local provider is enabled (vLLM or Ollama)
        let localEnabled = false;
        let vllmEnabled = false;
        try {
            const settings = await getSettings();
            localEnabled = settings.llm?.local?.enabled === true;
            vllmEnabled = settings.llm?.vllm?.enabled === true;
        } catch (e) {
            logger.warn(`[${sessionId}] Could not load settings, defaulting to cloud only`);
        }

        // Skip local if both vLLM and Ollama are disabled
        if (!vllmEnabled && !localEnabled) {
            logger.info(`[${sessionId}] All local providers disabled (vllm: ${vllmEnabled}, ollama: ${localEnabled}), using cloud only`);
            return this._sendToCloud(request, start);
        }

        logger.info(`[${sessionId}] Routing to local providers (vllm: ${vllmEnabled}, ollama: ${localEnabled})`);

        const hasVision = payload.vision && payload.context?.hasScreenshot;
        let llmRequest;
        let lastError = null;
        let usedVision = hasVision;

        if (hasVision) {
            // Vision-enabled request with timeout handling
            logger.info(`[${sessionId}] Using vision mode with ${payload.context.replyCount} replies context`);
            llmRequest = {
                prompt: payload.systemPrompt + '\n\n' + payload.userPrompt,
                vision: payload.vision,
                maxTokens: 150,
                temperature: payload.temperature || 0.7
            };

            try {
                const response = await this._sendToLocal(llmRequest, sessionId);

                if (response.success) {
                    const duration = Date.now() - start;
                    logger.success(`[${sessionId}] Vision reply generated in ${duration}ms`);
                    return {
                        success: true,
                        content: response.content,
                        metadata: {
                            routedTo: response.metadata?.routedTo || 'local',
                            duration,
                            model: response.metadata?.model,
                            visionEnabled: true,
                            replyCount: payload.context?.replyCount || 0
                        }
                    };
                }

                lastError = response.error || 'Unknown vision error';
                logger.warn(`[${sessionId}] Vision failed: ${lastError}`);

                // Check if it's a timeout error
                const isTimeout = lastError.toLowerCase().includes('timeout') ||
                                   lastError.toLowerCase().includes('timed out') ||
                                   lastError.toLowerCase().includes('abort') ||
                                   lastError.toLowerCase().includes('cancel');

                if (!isTimeout) {
                    logger.info(`[${sessionId}] Non-timeout error, falling back to text-only...`);
                    usedVision = false;
                } else {
                    logger.warn(`[${sessionId}] Vision timed out, falling back to text-only...`);
                    usedVision = false;
                }

            } catch (error) {
                lastError = error.message;
                logger.warn(`[${sessionId}] Vision exception: ${lastError}`);
                usedVision = false;
            }
        }

        // Text-only request (either originally or as fallback)
        logger.info(`[${sessionId}] Using text-only mode (fallback: ${!hasVision})`);
        llmRequest = {
            prompt: payload.systemPrompt + '\n\n' + payload.userPrompt,
            maxTokens: payload.maxTokens || 100,
            temperature: payload.temperature || 0.7
        };

        try {
            let response = await this._sendToLocal(llmRequest, sessionId);
            const duration = Date.now() - start;

            if (response.success) {
                logger.success(`[${sessionId}] Text-only reply generated in ${duration}ms`);
                return {
                    success: true,
                    content: response.content,
                    metadata: {
                        routedTo: response.metadata?.routedTo || 'local',
                        duration,
                        model: response.metadata?.model,
                        visionEnabled: false,
                        replyCount: payload.context?.replyCount || 0,
                        fallbackFromVision: hasVision
                    }
                };
            }

            lastError = response.error;
            logger.warn(`[${sessionId}] Local text-only failed: ${lastError}`);

        } catch (error) {
            lastError = error.message;
            logger.warn(`[${sessionId}] Local exception: ${lastError}`);
        }

        // Try cloud fallback if local failed
        logger.info(`[${sessionId}] Trying cloud fallback...`);
        try {
            const cloudRequest = {
                ...request,
                payload: {
                    ...payload,
                    vision: null
                }
            };
            const cloudResponse = await this._callCloudWithBreaker(cloudRequest, sessionId);

            if (cloudResponse.success) {
                const duration = Date.now() - start;
                logger.success(`[${sessionId}] Cloud reply generated in ${duration}ms`);
                return {
                    success: true,
                    content: cloudResponse.content,
                    metadata: {
                        routedTo: 'cloud',
                        duration,
                        model: cloudResponse.metadata?.model || 'unknown',
                        visionEnabled: false,
                        fallbackFromLocal: true
                    }
                };
            }

            lastError = cloudResponse.error || 'Unknown cloud error';
            logger.warn(`[${sessionId}] Cloud fallback failed: ${lastError}`);

        } catch (cloudError) {
            logger.warn(`[${sessionId}] Cloud exception: ${cloudError.message}`);
            lastError = cloudError.message;
        }

        // All providers failed
        logger.error(`[${sessionId}] All providers failed. Last error: ${lastError}`);
        return {
            success: false,
            error: lastError,
            metadata: {
                providersTried: ['vllm', 'ollama', 'cloud'].filter(p => p === 'vllm' ? vllmEnabled : p === 'ollama' ? localEnabled : true),
                fallbackFromVision: hasVision && !usedVision
            }
        };
    }

    /**
     * Send request directly to cloud (skips local Ollama).
     * @private
     */
    async _sendToCloud(request, startTime) {
        const { payload, sessionId } = request;

        logger.info(`[${sessionId}] Sending to cloud...`);

        try {
            const cloudRequest = {
                ...request,
                payload: {
                    ...payload,
                    vision: null
                }
            };
            const cloudResponse = await this._callCloudWithBreaker(cloudRequest, sessionId);

            if (cloudResponse.success) {
                const duration = Date.now() - startTime;
                logger.success(`[${sessionId}] Cloud reply generated in ${duration}ms`);
                return {
                    success: true,
                    content: cloudResponse.content,
                    metadata: {
                        routedTo: 'cloud',
                        duration,
                        model: cloudResponse.metadata?.model || 'unknown',
                        visionEnabled: false,
                        fallbackFromLocal: false
                    }
                };
            }

            return {
                success: false,
                error: cloudResponse.error || 'Unknown cloud error',
                metadata: {
                    duration: Date.now() - startTime,
                    providersTried: ['cloud']
                }
            };

        } catch (cloudError) {
            logger.warn(`[${sessionId}] Cloud exception: ${cloudError.message}`);
            return {
                success: false,
                error: cloudError.message,
                metadata: {
                    duration: Date.now() - startTime,
                    providersTried: ['cloud']
                }
            };
        }
    }

    /**
     * Handle vision-specific requests (The Vision Loop).
     * @param {object} request
     */
    async handleVisionRequest(request) {
        const { payload, sessionId } = request;
        const start = Date.now();

        // 1. Construct prompt using VisionInterpreter (The Bridge)
        const prompt = this.visionInterpreter.buildPrompt({
            goal: payload.goal,
            semanticTree: payload.semanticTree
        });

        // 2. Prepare request for Local Client
        const llmRequest = {
            prompt: prompt,
            vision: payload.vision, // Base64 image
            maxTokens: 1024,
            temperature: 0.1 // Low temperature for consistent JSON
        };

        let response = await this._sendToLocal(llmRequest, sessionId);
        let usedProvider = 'local';

        // 3. Fallback to Cloud if local failed (not implemented fully yet, but logic placeholder)
        if (!response.success) {
            logger.warn(`[${sessionId}] Local vision failed: ${response.error}. Fallback to Cloud (not impl).`);
            // return this.cloudClient.sendRequest(request); // Uncomment when cloud has vision
            return response; // Return error for now
        }

        // 4. Parse the raw text response into JSON using VisionInterpreter
        const parsed = this.visionInterpreter.parseResponse(response.content);

        const duration = Date.now() - start;

        // 5. Structure final response
        return {
            success: true,
            content: response.content, // Raw text (thought process)
            data: parsed.success ? parsed.data : null, // Structured actions
            metadata: {
                routedTo: usedProvider,
                duration,
                parsedSuccessfully: parsed.success,
                model: response.metadata?.model
            }
        };
    }
}

export default AgentConnector;
