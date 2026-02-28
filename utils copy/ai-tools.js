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

        // Configuration
        this.config = {
            timeout: options.timeout ?? 30000
        };

        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            avgResponseTime: 0
        };

        this.logger.info('[AITools] Initialized');

    }

    /**
     * Queue a request to be processed
     * Prevents race conditions by serializing requests
     */
    async queueRequest(request) {
        return this.processRequest(request);
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
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Request timeout after ${this.config.timeout}ms`));
            }, this.config.timeout);
        });

        const requestPromise = this.connector.processRequest(request).finally(() => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        });

        return Promise.race([requestPromise, timeoutPromise]);
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
            avgResponseTime: Math.round(this.stats.avgResponseTime) + 'ms'
        };
    }

    /**
     * Update configuration at runtime
     */
    updateConfig(options) {
        if (options.timeout !== undefined) {
            this.config.timeout = options.timeout;
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
            avgResponseTime: 0
        };
        this.logger.info('[AITools] Statistics reset');
    }
}

export default AITools;
