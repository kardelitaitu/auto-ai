/**
 * @fileoverview Integration Layer - Connecting Multi-Dimensional Sentiment to AITwitterAgent (Phase 5)
 * This module provides integration helpers and examples for connecting the new sentiment system
 * to the existing AITwitterAgent, AIReplyEngine, and AIQuoteEngine
 * @module utils/sentiment-integration
 */

import { createLogger } from './logger.js';
import MultiDimensionalSentimentAnalyzer from './sentiment-analyzer-multi.js';
import SentimentDecisionEngine from './sentiment-decision-engine.js';

const logger = createLogger('sentiment-integration.js');

/**
 * SentimentIntegration - Singleton for coordinating sentiment analysis across the system
 */
export class SentimentIntegration {
    constructor(options = {}) {
        this.analyzer = new MultiDimensionalSentimentAnalyzer(options.analyzerOptions || {});
        this.engine = new SentimentDecisionEngine(this.analyzer, options.engineOptions || {});
        this.enabled = options.enabled !== false;
        this.personality = options.personality || 'observer';
        
        logger.info('[SentimentIntegration] Initialized with personality: ' + this.personality);
    }
    
    // ========================================================================
    // INTEGRATION METHOD FOR AIReplyEngine.shouldReply()
    // ========================================================================
    /**
     * Check if should reply based on multi-dimensional sentiment analysis
     * @param {string} tweetContent - The tweet text to analyze
     * @param {object} context - Additional context (personality, engagement limits, etc)
     * @returns {Promise<{shouldReply: boolean, reason: string, confidence: string}>}
     * 
     * Integration Point: Replace existing sentiment-guard check in AIReplyEngine.shouldReply()
     * OLD: const sentimentCheck = await SentimentGuard.isEngagementSafe(tweetContent);
     * NEW: const result = await sentimentIntegration.shouldReplyCheck(tweetContent, context);
     */
    async shouldReplyCheck(tweetContent, context = {}) {
        if (!this.enabled) {
            return { shouldReply: true, reason: 'Sentiment integration disabled', confidence: 'unknown' };
        }
        
        try {
            const decision = await this.engine.makeEngagementDecision(
                tweetContent,
                'reply',
                { personality: context.personality || this.personality }
            );
            
            return {
                shouldReply: decision.allowed && decision.shouldEngage,
                reason: decision.reason || 'Approved by multi-dimensional sentiment analysis',
                confidence: decision.sentimentAnalysis.raw.valence.confidence,
                probability: decision.probability || null,
                hints: decision.hints || [],
                recommendedTone: decision.recommendedTone || [],
                blockType: decision.blockType || null,
                fallback: decision.fallback
            };
        } catch (error) {
            logger.error(`[shouldReplyCheck] Error: ${error.message}`);
            // Fail safe: allow if error
            return {
                shouldReply: true,
                reason: `Error in sentiment analysis (failed safe): ${error.message}`,
                confidence: 'low'
            };
        }
    }
    
    // ========================================================================
    // INTEGRATION METHOD FOR AIReplyEngine reply generation
    // ========================================================================
    /**
     * Get tone recommendation for reply generation
     * Integration Point: Use result to influence reply prompt construction
     * 
     * OLD: Generate generic reply
     * NEW: Generate reply adapted to detected tone
     */
    async getReplyToneAdaptation(tweetContent, authorPersonality = null) {
        try {
            const result = await this.analyzer.analyze(tweetContent, {
                personality: authorPersonality || this.personality
            });
            
            return {
                tones: this.engine.recommendResponseTone(result),
                patterns: result.patterns,
                arousal: result.dimensions.arousal,
                sarcasm: result.dimensions.sarcasm,
                toxicity: result.dimensions.toxicity,
                urgency: result.dimensions.urgency,
                hints: this.engine.generateEngagementHints(result, 'reply')
            };
        } catch (error) {
            logger.error(`[getReplyToneAdaptation] Error: ${error.message}`);
            return {
                tones: ['conversational_neutral'],
                patterns: [],
                hints: []
            };
        }
    }
    
    // ========================================================================
    // INTEGRATION METHOD FOR AIQuoteEngine
    // ========================================================================
    /**
     * Check if tweet is safe to quote
     * Quote is most conservative action - higher standards
     * 
     * Integration Point: Replace generic safety check in AIQuoteEngine
     */
    async shouldQuoteCheck(tweetContent, context = {}) {
        if (!this.enabled) {
            return { shouldQuote: true, reason: 'Sentiment integration disabled', confidence: 'unknown' };
        }
        
        try {
            const decision = await this.engine.makeEngagementDecision(
                tweetContent,
                'quote',
                { personality: context.personality || this.personality }
            );
            
            return {
                shouldQuote: decision.allowed && decision.shouldEngage,
                reason: decision.reason || 'Approved for quoting',
                confidence: decision.sentimentAnalysis.raw.valence.confidence,
                probability: decision.probability || null,
                riskLevel: decision.riskLevel || 'unknown',
                hints: decision.hints || [],
                blockType: decision.blockType || null
            };
        } catch (error) {
            logger.error(`[shouldQuoteCheck] Error: ${error.message}`);
            return {
                shouldQuote: true,
                reason: `Error in sentiment analysis (failed safe): ${error.message}`,
                confidence: 'low'
            };
        }
    }
    
    // ========================================================================
    // INTEGRATION METHOD FOR Like/Retweet/Bookmark/Follow
    // ========================================================================
    /**
     * General purpose check for any engagement action
     */
    async checkEngagementAction(content, action, context = {}) {
        if (!this.enabled) {
            return { allowed: true, reason: 'Sentiment integration disabled' };
        }
        
        try {
            const decision = await this.engine.makeEngagementDecision(
                content,
                action,
                { personality: context.personality || this.personality }
            );
            
            return {
                allowed: decision.allowed && decision.shouldEngage,
                reason: decision.reason || 'Approved by multi-dimensional sentiment analysis',
                probability: decision.probability,
                riskLevel: decision.riskLevel,
                fallback: decision.fallback,
                hints: decision.hints
            };
        } catch (error) {
            logger.error(`[checkEngagementAction] Error for action ${action}: ${error.message}`);
            return { allowed: true, reason: 'Failed safe', probability: 0.5 };
        }
    }
    
    // ========================================================================
    // INTEGRATION METHOD FOR Context Extraction
    // ========================================================================
    /**
     * Provide sentiment context for AIContextEngine.extractEnhancedContext()
     * Returns sentiment metadata to augment existing context
     */
    async enrichContext(tweetContent) {
        if (!this.enabled) {
            return {};
        }
        
        try {
            const result = await this.analyzer.analyze(tweetContent);
            
            return {
                sentimentDimensions: result.dimensions,
                patterns: result.patterns,
                derived: result.derived,
                actionGates: result.actionGates,
                personalityFit: result.personalityFit
            };
        } catch (error) {
            logger.error(`[enrichContext] Error: ${error.message}`);
            return {};
        }
    }
    
    // ========================================================================
    // CONFIGURATION & MANAGEMENT
    // ========================================================================
    /**
     * Set personality for this session
     */
    setPersonality(personality) {
        this.personality = personality;
        logger.info(`[setPersonality] Set to ${personality}`);
    }
    
    /**
     * Enable/disable sentiment analysis
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        logger.info(`[setEnabled] Sentiment analysis ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Get current statistics
     */
    getStats() {
        return {
            analyzer: this.analyzer.getStats(),
            engine: this.engine.getStats(),
            enabled: this.enabled,
            personality: this.personality
        };
    }
    
    /**
     * Export logs/learning data
     */
    export() {
        return {
            timestamp: new Date().toISOString(),
            analyzer: this.analyzer.export(),
            engine: this.engine.getStats()
        };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let instance = null;

export function getSentimentIntegration(options = {}) {
    if (!instance) {
        instance = new SentimentIntegration(options);
    }
    return instance;
}

export function initializeSentimentIntegration(options = {}) {
    instance = new SentimentIntegration(options);
    return instance;
}

export default SentimentIntegration;
