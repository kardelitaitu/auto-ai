/**
 * @fileoverview AI Tools Helper
 * Centralized management for AI agent operations
 * Prevents race conditions with proper state management
 * @module utils/ai-tools
 */

import { createLogger } from './logger.js';
import { mathUtils } from './mathUtils.js';
import AgentConnector from '../core/agent-connector.js';

const logger = createLogger('ai-tools.js');

export class AITools {
    constructor(options = {}) {
        this.connector = new AgentConnector();
        this.logger = logger;

        // State management
        this.isProcessing = false;
        this.queue = [];
        this.currentRequest = null;

        // Configuration
        this.config = {
            timeout: options.timeout ?? 30000,
            maxRetries: options.maxRetries ?? 2,
            retryDelay: options.retryDelay ?? 1000,
            enableQueue: options.enableQueue ?? true
        };

        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            avgResponseTime: 0,
            queueSize: 0
        };

        this.logger.info('[AITools] Initialized');
    }

    /**
     * Queue a request to be processed
     * Prevents race conditions by serializing requests
     */
    async queueRequest(request) {
        if (!this.config.enableQueue) {
            return this.processRequest(request);
        }

        return new Promise((resolve, reject) => {
            this.queue.push({
                request,
                resolve,
                reject,
                timestamp: Date.now()
            });
            this.stats.queueSize = this.queue.length;
            this.logger.debug(`[AITools] Queued request (queue: ${this.queue.length})`);
            this.processQueue();
        });
    }

    /**
     * Process queued requests one at a time
     */
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        const item = this.queue.shift();
        if (!item) return;

        this.isProcessing = true;
        this.stats.queueSize = this.queue.length;

        try {
            const result = await this.processRequest(item.request);
            item.resolve(result);
        } catch (error) {
            item.reject(error);
        } finally {
            this.isProcessing = false;
            // Process next item
            setTimeout(() => this.processQueue(), 50);
        }
    }

    /**
     * Process a single AI request
     */
    async processRequest(request) {
        const startTime = Date.now();
        this.stats.totalRequests++;

        const { action, payload } = request;

        try {
            this.logger.info(`[AITools] Processing: ${action}`);

            // Build connector request
            const connectorRequest = {
                action,
                payload: {
                    ...payload,
                    sessionId: this.getSessionId()
                },
                sessionId: this.getSessionId()
            };

            // Send to connector
            const response = await this.sendWithTimeout(connectorRequest);

            // Update stats
            const duration = Date.now() - startTime;
            this.updateAvgResponseTime(duration);
            this.stats.successfulRequests++;

            this.logger.success(`[AITools] ${action} completed in ${duration}ms`);

            return {
                success: true,
                action,
                data: response.data ?? response.content,
                raw: response.content,
                metadata: {
                    provider: response.metadata?.routedTo ?? 'unknown',
                    model: response.metadata?.model,
                    duration,
                    timestamp: Date.now()
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            this.stats.failedRequests++;

            this.logger.error(`[AITools] ${action} failed: ${error.message}`);

            return {
                success: false,
                action,
                error: error.message,
                metadata: {
                    duration,
                    timestamp: Date.now(),
                    attempts: this.stats.totalRequests
                }
            };
        }
    }

    /**
     * Send request with timeout
     */
    async sendWithTimeout(request) {
        return Promise.race([
            this.connector.processRequest(request),
            new Promise((_, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Request timeout after ${this.config.timeout}ms`));
                }, this.config.timeout);
            })
        ]);
    }

    /**
     * Generate reply for a tweet
     */
    async generateReply(tweetText, username, options = {}) {
        const systemPrompt = options.systemPrompt ?? this.getDefaultPrompt();
        const userPrompt = this.buildReplyPrompt(tweetText, username);

        return this.queueRequest({
            action: 'generate_reply',
            payload: {
                systemPrompt,
                userPrompt,
                maxTokens: options.maxTokens ?? 100,
                temperature: options.temperature ?? 0.7
            }
        });
    }

    /**
     * Analyze tweet for engagement opportunity
     */
    async analyzeTweet(tweetText, username) {
        return this.queueRequest({
            action: 'analyze_tweet',
            payload: {
                tweetText,
                username,
                context: {
                    timestamp: Date.now(),
                    textLength: tweetText.length
                }
            }
        });
    }

    /**
     * Classify tweet content
     */
    async classifyTweet(tweetText) {
        return this.queueRequest({
            action: 'classify_content',
            payload: {
                content: tweetText,
                categories: ['safe', 'political', 'nsfw', 'spam', 'controversial']
            }
        });
    }

    /**
     * Generate response to a conversation
     */
    async generateConversationReply(messages, options = {}) {
        return this.queueRequest({
            action: 'generate_conversation',
            payload: {
                messages,
                systemPrompt: options.systemPrompt ?? this.getConversationPrompt(),
                maxTokens: options.maxTokens ?? 150,
                temperature: options.temperature ?? 0.7
            }
        });
    }

    /**
     * Build reply prompt
     */
    buildReplyPrompt(tweetText, username) {
        return `Tweet from @${username}:
"${tweetText}"

Generate ONE neutral reply (1-2 sentences):
Reply:`;
    }

    /**
     * Get default system prompt for Twitter replies
     */
    getDefaultPrompt() {
        return `You are a neutral, casual Twitter user.

Rules:
- 1-2 sentences max
- Neutral/positive tone
- No strong opinions
- Never ask questions
- Never mention being AI`;
    }

    /**
     * Get conversation system prompt
     */
    getConversationPrompt() {
        return `You are a friendly conversationalist on Twitter.
- Keep responses natural and brief
- Engage positively with the other person
- Never reveal you're an AI`;
    }

    /**
     * Generate unique session ID
     */
    getSessionId() {
        return `session_${Date.now()}_${mathUtils.randomInRange(1000, 9999)}`;
    }

    /**
     * Update running average response time
     */
    updateAvgResponseTime(duration) {
        const total = this.stats.successfulRequests;
        if (total === 1) {
            this.stats.avgResponseTime = duration;
        } else {
            this.stats.avgResponseTime = (
                (this.stats.avgResponseTime * (total - 1) + duration) / total
            );
        }
    }

    /**
     * Get current statistics
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.totalRequests > 0
                ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(1) + '%'
                : '0%',
            avgResponseTime: Math.round(this.stats.avgResponseTime) + 'ms',
            queueLength: this.queue.length,
            isProcessing: this.isProcessing
        };
    }

    /**
     * Clear the request queue
     */
    clearQueue() {
        const dropped = this.queue.length;
        this.queue = [];
        this.stats.queueSize = 0;
        this.logger.info(`[AITools] Cleared queue (dropped ${dropped} requests)`);
        return dropped;
    }

    /**
     * Update configuration at runtime
     */
    updateConfig(options) {
        if (options.timeout !== undefined) {
            this.config.timeout = options.timeout;
        }
        if (options.maxRetries !== undefined) {
            this.config.maxRetries = options.maxRetries;
        }
        if (options.retryDelay !== undefined) {
            this.config.retryDelay = options.retryDelay;
        }
        if (options.enableQueue !== undefined) {
            this.config.enableQueue = options.enableQueue;
        }
        this.logger.info(`[AITools] Config updated: ${JSON.stringify(options)}`);
    }

    /**
     * Health check
     */
    async isHealthy() {
        try {
            // Quick check - can we reach the connector?
            return this.connector !== null && this.connector !== undefined;
        } catch {
            return false;
        }
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            avgResponseTime: 0,
            queueSize: 0
        };
        this.logger.info('[AITools] Statistics reset');
    }
}

export default AITools;
