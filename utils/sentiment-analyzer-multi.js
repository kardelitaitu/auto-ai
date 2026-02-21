/**
 * @fileoverview Multi-Dimensional Sentiment Analyzer Orchestrator (Phase 3)
 * Coordinates 6 individual analyzers with caching, learning, and contextual patterns
 * @module utils/sentiment-analyzer-multi
 */

import { createLogger } from './logger.js';
import {
    ValenceAnalyzer,
    ArousalAnalyzer,
    DominanceAnalyzer,
    SarcasmAnalyzer,
    UrgencyAnalyzer,
    ToxicityAnalyzer
} from './sentiment-analyzers.js';
import SentimentData from './sentiment-data.js';

const logger = createLogger('sentiment-analyzer-multi.js');

export class MultiDimensionalSentimentAnalyzer {
    constructor(options = {}) {
        // Initialize individual analyzers
        this.valence = new ValenceAnalyzer();
        this.arousal = new ArousalAnalyzer();
        this.dominance = new DominanceAnalyzer();
        this.sarcasm = new SarcasmAnalyzer();
        this.urgency = new UrgencyAnalyzer();
        this.toxicity = new ToxicityAnalyzer();
        
        // Cache and learning
        this.cache = new Map();
        this.cacheMaxSize = options.cacheMaxSize || 1000;
        this.learningData = {
            decisions: [],
            successRate: {}
        };
        
        // Metrics
        this.metrics = {
            totalAnalyses: 0,
            cacheHits: 0,
            analyzesPerType: {},
            patterns: {}
        };
    }
    
    // ========================================================================
    // MAIN ANALYSIS METHOD - Parallel execution of all analyzers
    // ========================================================================
    async analyze(text, options = {}) {
        const textHash = this.hashText(text);
        
        // Check cache
        if (this.cache.has(textHash)) {
            this.metrics.cacheHits++;
            return this.cache.get(textHash);
        }
        
        try {
            // Execute all analyzers in parallel
            const [valenceResult, arousalResult, dominanceResult, sarcasmResult, urgencyResult, toxicityResult] = await Promise.all([
                Promise.resolve(this.valence.analyze(text)),
                Promise.resolve(this.arousal.analyze(text)),
                Promise.resolve(this.dominance.analyze(text)),
                Promise.resolve(this.sarcasm.analyze(text)),
                Promise.resolve(this.urgency.analyze(text)),
                Promise.resolve(this.toxicity.analyze(text))
            ]);
            
            // Aggregate results
            const aggregated = {
                text,
                timestamp: new Date().toISOString(),
                dimensions: {
                    valence: valenceResult.valence,
                    arousal: arousalResult.arousal,
                    dominance: dominanceResult.dominance,
                    sarcasm: sarcasmResult.sarcasm,
                    urgency: urgencyResult.urgency,
                    toxicity: toxicityResult.toxicity
                },
                raw: {
                    valence: valenceResult,
                    arousal: arousalResult,
                    dominance: dominanceResult,
                    sarcasm: sarcasmResult,
                    urgency: urgencyResult,
                    toxicity: toxicityResult
                }
            };
            
            // Apply contextual patterns
            aggregated.patterns = this.applyContextualPatterns(aggregated);
            
            // Calculate derived metrics
            aggregated.derived = this.calculateDerivedMetrics(aggregated);
            
            // Add personality recommendations
            if (options.personality) {
                aggregated.personalityFit = this.calculatePersonalityFit(aggregated, options.personality);
            }
            
            // Action gates
            aggregated.actionGates = this.calculateActionGates(aggregated);
            
            // Cache result
            this.cacheResult(textHash, aggregated);
            
            this.metrics.totalAnalyses++;
            return aggregated;
        } catch (error) {
            logger.error(`[analyze] Error analyzing text: ${error.message}`);
            throw error;
        }
    }
    
    // ========================================================================
    // CONTEXTUAL PATTERN APPLICATION
    // ========================================================================
    applyContextualPatterns(aggregated) {
        const matched = [];
        const { valence, arousal, dominance, sarcasm, toxicity, urgency } = aggregated.dimensions;
        
        // Fake Positivity: High valence + high sarcasm + high dominance
        if (valence > 0.6 && sarcasm > 0.6 && dominance > 0.6 && toxicity < 0.3) {
            matched.push('fakePositivity');
            // Reduce trust in the positivity
            aggregated.dimensions.valence *= 0.6;
        }
        
        // Restrained Grief: Low valence + low arousal + low dominance
        if (valence < -0.5 && arousal < 0.3 && dominance < 0.3) {
            matched.push('restrainedGrief');
            // Hard block engagement
            aggregated.actionBlock = 'grief';
        }
        
        // Passionate Advocacy: Medium-high valence + high arousal + high urgency
        if (Math.abs(valence) > 0.4 && arousal > 0.6 && urgency > 0.6) {
            matched.push('passionateAdvocacy');
            // Requires care in responses
            aggregated.requiresContext = true;
        }
        
        // Toxic Ranting: Low valence + high arousal + high toxicity
        if (valence < -0.5 && arousal > 0.6 && toxicity > 0.5) {
            matched.push('toxicRanting');
            // Severe action block
            aggregated.actionBlock = 'toxicity';
        }
        
        // Intellectual Debate: Medium valence + high dominance + low sarcasm
        if (Math.abs(valence) < 0.6 && dominance > 0.6 && sarcasm < 0.3) {
            matched.push('intellectualDebate');
            // Careful response needed
            aggregated.requiresContext = true;
        }
        
        // Sarcastic Commentary: High sarcasm + medium arousal + any valence
        if (sarcasm > 0.5 && arousal > 0.4) {
            matched.push('sarcasticCommentary');
            // Sarcasm back is acceptable
            aggregated.allowSarcasm = true;
        }
        
        // Crisis/Emergency: Very high urgency + low dominance + any toxicity
        if (urgency > 0.8 && dominance < 0.4) {
            matched.push('crisis');
            // Careful, supportive response
            aggregated.requiresEmpathy = true;
        }
        
        // Celebration: High valence + high arousal + low toxicity
        if (valence > 0.6 && arousal > 0.6 && toxicity < 0.2) {
            matched.push('celebration');
            // Easy to engage with
            aggregated.isEasyEngage = true;
        }
        
        return matched;
    }
    
    // ========================================================================
    // DERIVED METRICS CALCULATION
    // ========================================================================
    calculateDerivedMetrics(aggregated) {
        const { valence, arousal, dominance, sarcasm, toxicity, urgency } = aggregated.dimensions;
        
        const derived = {};
        
        // Authenticity Score: How genuine/honest feels the content
        derived.authenticity = this.calculateAuthenticity(valence, sarcasm, toxicity);
        
        // Engagement Risk: Risk of negative interaction
        derived.engagementRisk = toxicity * 0.4 + Math.max(0, -valence) * 0.3 + urgency * 0.2 + (sarcasm * 0.1);
        
        // Content Complexity: How complex/thoughtful
        derived.complexity = dominance * 0.3 + (1 - sarcasm * 0.5) * 0.4 + arousal * 0.2 + urgency * 0.1;
        
        // Emotional Intensity: Overall emotional charge
        derived.emotionalIntensity = (Math.abs(valence) * 0.3 + arousal * 0.4 + urgency * 0.3);
        
        // Sentiment Volatility: How stable/changing the sentiment
        derived.volatility = Math.abs(valence) > 0.6 ? 'volatile' : 'stable';
        
        // Irony Detection: Likelihood of ironic/mocking content
        derived.ironyScore = sarcasm * 0.6 + (Math.abs(valence - dominance) > 0.4 ? 0.3 : 0);
        
        // Credibility: How trustworthy/credible
        derived.credibility = (1 - toxicity * 0.4) * (1 - sarcasm * 0.2) * (dominance > 0.5 ? 0.9 : 0.8);
        
        return derived;
    }
    
    calculateAuthenticity(valence, sarcasm, toxicity) {
        // High sarcasm = low authenticity
        // High toxicity = low authenticity
        // Mixed signals = low authenticity
        
        const sarcasmPenalty = sarcasm * 0.5;
        const toxicityPenalty = toxicity * 0.3;
        
        return Math.max(0, 1 - sarcasmPenalty - toxicityPenalty);
    }
    
    // ========================================================================
    // PERSONALITY FIT CALCULATION
    // ========================================================================
    calculatePersonalityFit(aggregated, personality) {
        const profile = SentimentData.PERSONALITY_PROFILES[personality];
        if (!profile) return null;
        
        const { valence, arousal, dominance, sarcasm, toxicity } = aggregated.dimensions;
        
        let fit = 0;
        
        // Observer: Prefers neutral, low toxicity
        if (personality === 'observer') {
            fit = (1 - Math.abs(valence)) * 0.3 + (1 - toxicity) * 0.4 + (1 - arousal) * 0.3;
        }
        
        // Enthusiast: Loves high arousal, positive
        else if (personality === 'enthusiast') {
            fit = Math.max(0, valence) * 0.4 + arousal * 0.35 + (1 - toxicity) * 0.25;
        }
        
        // Analyst: Prefers complex, low sarcasm, high dominance
        else if (personality === 'analyst') {
            fit = dominance * 0.35 + (1 - sarcasm) * 0.3 + (1 - toxicity) * 0.35;
        }
        
        // Joker: Loves sarcasm, humor, dislikes toxicity
        else if (personality === 'joker') {
            fit = sarcasm * 0.4 + arousal * 0.3 + (1 - toxicity) * 0.3;
        }
        
        // Advocate: Passionate about issues, high urgency/dominance
        else if (personality === 'advocate') {
            fit = dominance * 0.35 + arousal * 0.3 + (1 - Math.max(0, -valence)) * 0.35;
        }
        
        // Empath: Low toxicity, low arousal, high valence or sadness
        else if (personality === 'empath') {
            fit = (1 - toxicity) * 0.4 + (1 - arousal) * 0.3 + (1 - sarcasm) * 0.3;
        }
        
        return {
            personality,
            fit: Math.max(0, Math.min(1, fit)),
            recommendation: fit > 0.6 ? 'engage' : fit > 0.4 ? 'consider' : 'avoid'
        };
    }
    
    // ========================================================================
    // ACTION GATES CALCULATION
    // ========================================================================
    calculateActionGates(aggregated) {
        const gates = {};
        const { toxicity, valence, sarcasm, arousal: _arousal } = aggregated.dimensions;
        const actionGates = SentimentData.ACTION_GATES;
        
        // REPLY gate
        gates.canReply = toxicity < actionGates.reply.maxToxicity &&
                         !aggregated.actionBlock &&
                         aggregated.derived.credibility > 0.5;
        
        // LIKE gate
        gates.canLike = toxicity < actionGates.like.maxToxicity &&
                       Math.max(0, valence) > 0.1 &&
                       !['grief', 'crisis'].includes(aggregated.actionBlock);
        
        // QUOTE gate (most conservative)
        gates.canQuote = toxicity < actionGates.quote.maxToxicity &&
                        aggregated.derived.credibility > 0.7 &&
                        sarcasm < 0.5 &&
                        !aggregated.actionBlock;
        
        // RETWEET gate
        gates.canRetweet = toxicity < actionGates.retweet.maxToxicity &&
                          Math.max(0, valence) > 0.2 &&
                          sarcasm < 0.3 &&
                          !aggregated.actionBlock;
        
        // BOOKMARK gate
        gates.canBookmark = toxicity < 0.6 &&
                           aggregated.derived.complexity > 0.3;
        
        return gates;
    }
    
    // ========================================================================
    // CACHING & LEARNING
    // ========================================================================
    cacheResult(hash, result) {
        if (this.cache.size >= this.cacheMaxSize) {
            // Remove oldest entry (FIFO)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(hash, result);
    }
    
    recordDecision(textHash, dimensions, action, success) {
        this.learningData.decisions.push({
            hash: textHash,
            dimensions,
            action,
            success,
            timestamp: Date.now()
        });
        
        // Update success rate
        if (!this.learningData.successRate[action]) {
            this.learningData.successRate[action] = { success: 0, total: 0 };
        }
        this.learningData.successRate[action].total++;
        if (success) {
            this.learningData.successRate[action].success++;
        }
    }
    
    hashText(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }
    
    // ========================================================================
    // UTILITY METHODS
    // ========================================================================
    getStats() {
        return {
            total: this.metrics.totalAnalyses,
            cacheHits: this.metrics.cacheHits,
            cacheSize: this.cache.size,
            cacheHitRate: this.metrics.totalAnalyses > 0 
                ? (this.metrics.cacheHits / this.metrics.totalAnalyses).toFixed(2)
                : 0,
            successRates: this.learningData.successRate
        };
    }
    
    clearCache() {
        this.cache.clear();
        logger.info('[clearCache] Cache cleared');
    }
    
    export() {
        return {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            learningData: this.learningData,
            stats: this.getStats()
        };
    }
}

export default MultiDimensionalSentimentAnalyzer;
