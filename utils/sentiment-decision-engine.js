/**
 * @fileoverview Sentiment-Based Decision Engine (Phase 4)
 * Action-specific gating, fallback suggestions, risk calculation, and engagement decisions
 * @module utils/sentiment-decision-engine
 */

import { createLogger } from './logger.js';
import SentimentData from './sentiment-data.js';

const logger = createLogger('sentiment-decision-engine.js');

export class SentimentDecisionEngine {
    constructor(analyzer, options = {}) {
        this.analyzer = analyzer;
        this.config = {
            replyProbability: options.replyProbability || 0.5,
            quoteProbability: options.quoteProbability || 0.5,
            likeProbability: options.likeProbability || 0.7,
            retweetProbability: options.retweetProbability || 0.3,
            bookmarkProbability: options.bookmarkProbability || 0.4,
            followProbability: options.followProbability || 0.2,
            maxRiskTolerance: options.maxRiskTolerance || 0.6,
            suppressiveMode: options.suppressiveMode || false, // Conservative mode
            ...options
        };
        
        this.stats = {
            decisions: [],
            blockers: {},
            fallbacks: {}
        };
    }
    
    // ========================================================================
    // MAIN DECISION METHOD
    // ========================================================================
    async makeEngagementDecision(text, action, context = {}) {
        try {
            // Analyze sentiment
            const sentimentResult = await this.analyzer.analyze(text, {
                personality: context.personality || 'observer'
            });
            
            // Check action gates
            const canProceed = this.checkActionGates(sentimentResult, action);
            
            if (!canProceed.allowed) {
                logger.debug(`[makeEngagementDecision] Action '${action}' blocked: ${canProceed.reason}`);
                return {
                    allowed: false,
                    action,
                    reason: canProceed.reason,
                    blockType: canProceed.blockType,
                    sentimentAnalysis: sentimentResult,
                    fallback: this.suggestFallbackAction(sentimentResult, action, canProceed.blockType)
                };
            }
            
            // Calculate engagement probability
            const probability = this.getAdaptiveEngagementProbability(sentimentResult, action, context);
            
            // Check risk
            const riskAssessment = this.assessRisk(sentimentResult, action);
            
            if (riskAssessment.risk > this.config.maxRiskTolerance) {
                logger.debug(`[makeEngagementDecision] Action '${action}' too risky: ${riskAssessment.risk.toFixed(2)}`);
                return {
                    allowed: false,
                    action,
                    reason: `Risk too high: ${riskAssessment.risk.toFixed(2)}`,
                    blockType: 'risk',
                    riskFactors: riskAssessment.factors,
                    sentimentAnalysis: sentimentResult,
                    fallback: this.suggestFallbackAction(sentimentResult, action, 'risk')
                };
            }
            
            return {
                allowed: true,
                action,
                probability: Math.min(1, probability * 1.2), // Boost if high sentiment match
                shouldEngage: Math.random() < probability,
                recommendedTone: this.recommendResponseTone(sentimentResult),
                riskLevel: riskAssessment.level,
                riskFactors: riskAssessment.factors,
                sentimentAnalysis: sentimentResult,
                hints: this.generateEngagementHints(sentimentResult, action),
                fallback: null
            };
        } catch (error) {
            logger.error(`[makeEngagementDecision] Error: ${error.message}`);
            throw error;
        }
    }
    
    // ========================================================================
    // ACTION GATES CHECKING
    // ========================================================================
    checkActionGates(sentimentResult, action) {
        const { canReply, canLike, canQuote, canRetweet, canBookmark } = sentimentResult.actionGates;
        
        switch (action) {
            case 'reply':
                if (!canReply) return { allowed: false, reason: 'Reply blocked by gates', blockType: 'gate' };
                break;
            case 'like':
                if (!canLike) return { allowed: false, reason: 'Like blocked by gates', blockType: 'gate' };
                break;
            case 'quote':
                if (!canQuote) return { allowed: false, reason: 'Quote blocked by gates', blockType: 'gate' };
                break;
            case 'retweet':
                if (!canRetweet) return { allowed: false, reason: 'Retweet blocked by gates', blockType: 'gate' };
                break;
            case 'bookmark':
                if (!canBookmark) return { allowed: false, reason: 'Bookmark blocked by gates', blockType: 'gate' };
                break;
        }
        
        // Check actionBlock
        if (sentimentResult.actionBlock) {
            const blockerType = sentimentResult.actionBlock === 'grief' ? 'grief' : 'toxicity';
            return { allowed: false, reason: `Action blocked due to ${sentimentResult.actionBlock}`, blockType: blockerType };
        }
        
        return { allowed: true };
    }
    
    // ========================================================================
    // RISK ASSESSMENT
    // ========================================================================
    assessRisk(sentimentResult, action) {
        const { dimensions, derived } = sentimentResult;
        let riskScore = 0;
        const factors = [];
        
        // High toxicity is risky for all actions
        if (dimensions.toxicity > 0.7) {
            riskScore += 0.3;
            factors.push({ factor: 'toxicity', weight: 0.3, score: dimensions.toxicity });
        }
        
        // Very negative content + reply = risky
        if (action === 'reply' && dimensions.valence < -0.6) {
            riskScore += 0.2;
            factors.push({ factor: 'negativity_for_reply', weight: 0.2, score: Math.abs(dimensions.valence) });
        }
        
        // High sarcasm for quote = risky (might look mocking)
        if (action === 'quote' && dimensions.sarcasm > 0.6) {
            riskScore += 0.15;
            factors.push({ factor: 'sarcasm_for_quote', weight: 0.15, score: dimensions.sarcasm });
        }
        
        // Low credibility + reply = risky
        if (action === 'reply' && derived.credibility < 0.4) {
            riskScore += 0.15;
            factors.push({ factor: 'low_credibility', weight: 0.15, score: derived.credibility });
        }
        
        // Volatile + high arousal = emotional post (risky engagement)
        if (derived.emotionalIntensity > 0.7) {
            riskScore += 0.1;
            factors.push({ factor: 'emotionalIntensity', weight: 0.1, score: derived.emotionalIntensity });
        }
        
        // High urgency content (crisis) requires care
        if (dimensions.urgency > 0.8) {
            riskScore += 0.1;
            factors.push({ factor: 'high_urgency', weight: 0.1, score: dimensions.urgency });
        }
        
        // Suppressive mode increases risk tolerance
        if (this.config.suppressiveMode) {
            riskScore *= 0.7;
        }
        
        const riskLevel = riskScore > 0.6 ? 'high' : riskScore > 0.4 ? 'medium' : 'low';
        
        return {
            risk: Math.min(1, riskScore),
            level: riskLevel,
            factors,
            shouldReviewManually: riskScore > 0.5
        };
    }
    
    // ========================================================================
    // ADAPTIVE ENGAGEMENT PROBABILITY
    // ========================================================================
    getAdaptiveEngagementProbability(sentimentResult, action, context = {}) {
        let probability = this.config[`${action}Probability`] || 0.5;
        
        const { dimensions, derived } = sentimentResult;
        const personality = context.personality || 'observer';
        
        // Adjust based on sentiment match
        switch (action) {
            case 'reply':
                // High credibility + low toxicity = encourage reply
                if (derived.credibility > 0.7 && dimensions.toxicity < 0.3) {
                    probability *= 1.3;
                }
                // Suppress for very negative
                if (dimensions.valence < -0.7 && dimensions.toxicity > 0.5) {
                    probability *= 0.3;
                }
                break;
                
            case 'like':
                // Positive + good credibility = encourage
                if (dimensions.valence > 0.5 && derived.credibility > 0.6) {
                    probability *= 1.4;
                }
                // Suppress for toxic
                if (dimensions.toxicity > 0.4) {
                    probability *= 0.2;
                }
                break;
                
            case 'quote':
                // Most conservative - requires high credibility + authenticity
                if (derived.credibility > 0.8 && dimensions.sarcasm < 0.3) {
                    probability *= 1.2;
                } else if (derived.credibility < 0.5) {
                    probability *= 0.4;
                }
                break;
                
            case 'retweet':
                // Good engagement risk + positive = encourage
                if (derived.engagementRisk < 0.3 && dimensions.valence > 0.3) {
                    probability *= 1.3;
                }
                // Suppress for risky high-arousal content
                if (derived.engagementRisk > 0.6) {
                    probability *= 0.2;
                }
                break;
                
            case 'bookmark':
                // Based on complexity and credibility
                if (derived.complexity > 0.6 && derived.credibility > 0.5) {
                    probability *= 1.2;
                }
                break;
        }
        
        // Personality modifiers
        if (sentimentResult.personalityFit) {
            const fit = sentimentResult.personalityFit.fit;
            probability *= (0.7 + fit * 0.6); // Range: 0.7 to 1.3
        }
        
        return Math.max(0, Math.min(1, probability));
    }
    
    // ========================================================================
    // TONE RECOMMENDATIONS
    // ========================================================================
    recommendResponseTone(sentimentResult) {
        const { dimensions, patterns } = sentimentResult;
        const recommendations = [];
        
        // Sarcasm detection
        if (dimensions.sarcasm > 0.6) {
            recommendations.push('sarcastic_or_witty');
        }
        
        // Crisis/grief handling
        if (patterns.includes('restrainedGrief') || sentimentResult.actionBlock === 'grief') {
            recommendations.push('empathetic_supportive');
        }
        
        // Passionate advocacy
        if (patterns.includes('passionateAdvocacy')) {
            recommendations.push('thoughtful_engaged');
        }
        
        // Intellectual debate
        if (patterns.includes('intellectualDebate')) {
            recommendations.push('analytical_respectful');
        }
        
        // High arousal celebration
        if (patterns.includes('celebration')) {
            recommendations.push('enthusiastic_positive');
        }
        
        // Default: neutral
        if (recommendations.length === 0) {
            recommendations.push('conversational_neutral');
        }
        
        return recommendations;
    }
    
    // ========================================================================
    // ENGAGEMENT HINTS
    // ========================================================================
    generateEngagementHints(sentimentResult, action) {
        const hints = [];
        const { dimensions, patterns, derived } = sentimentResult;
        
        // Hint on tone
        if (dimensions.sarcasm > 0.5) {
            hints.push('Content has sarcastic tone - respond carefully');
        }
        
        // Hint on arousal
        if (dimensions.arousal > 0.7) {
            hints.push('Author is highly emotional - keep response grounded');
        }
        
        // Hint on credibility
        if (derived.credibility < 0.5) {
            hints.push('Content has mixed signals - verify before engaging');
        }
        
        // Pattern-specific hints
        if (patterns.includes('passionateAdvocacy')) {
            hints.push('Author is passionate about this topic - respect their position');
        }
        
        if (patterns.includes('toxicRanting')) {
            hints.push('Content shows signs of toxic rant - avoid escalation');
        }
        
        // Action-specific hints
        if (action === 'reply' && dimensions.dominance > 0.7) {
            hints.push('Author is assertive - keep your response confident or humble, not weak');
        }
        
        if (action === 'quote' && dimensions.sarcasm > 0.4) {
            hints.push('Quote action with sarcasm present - might be misinterpreted as mockery');
        }
        
        return hints;
    }
    
    // ========================================================================
    // FALLBACK SUGGESTIONS
    // ========================================================================
    suggestFallbackAction(sentimentResult, originalAction, blockType) {
        const blockReasons = {
            grief: { actions: ['like', 'bookmark'], reason: 'Grief content detected' },
            toxicity: { actions: ['like', 'bookmark'], reason: 'Toxic content detected' },
            risk: { actions: ['like', 'bookmark'], reason: 'High risk content' },
            gate: { actions: ['like', 'bookmark'], reason: 'Action blocked' }
        };
        
        const fallbacks = blockReasons[blockType];
        if (!fallbacks) return null;
        
        // Suggest safest fallback
        const safestAction = fallbacks.actions[0];
        
        // But check if even fallback is allowed
        const testGates = sentimentResult.actionGates;
        
        if (safestAction === 'like' && testGates.canLike) {
            return {
                action: 'like',
                reason: `${fallbacks.reason} - suggesting like instead`,
                confidence: 'medium'
            };
        } else if (safestAction === 'bookmark' && testGates.canBookmark) {
            return {
                action: 'bookmark',
                reason: `${fallbacks.reason} - suggesting bookmark instead`,
                confidence: 'medium'
            };
        }
        
        // No safe fallback
        return {
            action: 'skip',
            reason: `${fallbacks.reason} - no safe engagement recommended`,
            confidence: 'high'
        };
    }
    
    // ========================================================================
    // UTILITIES & STATS
    // ========================================================================
    getStats() {
        return {
            totalDecisions: this.stats.decisions.length,
            blockers: this.stats.blockers,
            fallbacks: this.stats.fallbacks,
            config: this.config
        };
    }
    
    explainDecision(decision) {
        const explanation = {
            action: decision.action,
            allowed: decision.allowed,
            reason: decision.reason,
            riskLevel: decision.riskLevel || 'N/A',
            probability: decision.probability || 'N/A',
            tone: decision.recommendedTone || [],
            hints: decision.hints || [],
            blockType: decision.blockType || 'N/A'
        };
        
        if (decision.fallback) {
            explanation.fallback = {
                action: decision.fallback.action,
                reason: decision.fallback.reason
            };
        }
        
        return explanation;
    }
}

export default SentimentDecisionEngine;
