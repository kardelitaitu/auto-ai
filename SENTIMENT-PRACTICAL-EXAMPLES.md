/**
 * @fileoverview PRACTICAL EXAMPLES - Multi-Dimensional Sentiment Integration
 * Real-world code examples showing how to integrate the sentiment system
 * @module SENTIMENT-PRACTICAL-EXAMPLES.md
 */

# Sentiment System - Practical Implementation Examples

## Example 1: Initialize System in main.js

```javascript
// In main.js, after orchestrator setup

import { initializeSentimentIntegration } from './utils/sentiment-integration.js';

// Initialize the sentiment system
const sentimentIntegration = initializeSentimentIntegration({
    enabled: true,
    personality: 'observer', // Will vary per profile later
    analyzerOptions: {
        cacheMaxSize: 1000
    },
    engineOptions: {
        replyProbability: 0.5,
        quoteProbability: 0.3,
        maxRiskTolerance: 0.6
    }
});

console.log('[main] Sentiment system initialized');

// Later in session setup, adjust personality if needed
if (profileInfo.personality) {
    sentimentIntegration.setPersonality(profileInfo.personality);
}
```

---

## Example 2: Update AIReplyEngine.shouldReply()

### BEFORE (Current Code)
```javascript
async shouldReply(tweet, profile, state) {
    const logger = createLogger('AIReplyEngine');
    
    // Existing checks
    if (!tweet || !tweet.text) return false;
    
    // Excluded keywords
    if (this.contains_excluded_keywords(tweet)) {
        return false;
    }
    
    // Sentiment guard (BINARY - OLD WAY)
    const sentimentCheck = await SentimentGuard.isEngagementSafe(tweet.text);
    if (!sentimentCheck.isSafe) {
        logger.info('[shouldReply] Sentiment unsafe, skipping reply');
        return false;
    }
    
    // Generic response filter
    if (this.is_generic_response(tweet.text)) {
        return false;
    }
    
    return true;
}
```

### AFTER (New Code with Sentiment Integration)
```javascript
import { getSentimentIntegration } from '../utils/sentiment-integration.js';

async shouldReply(tweet, profile, state) {
    const logger = createLogger('AIReplyEngine');
    
    // Existing checks
    if (!tweet || !tweet.text) return false;
    
    // Excluded keywords
    if (this.contains_excluded_keywords(tweet.text)) {
        return false;
    }
    
    // NEW: Multi-dimensional sentiment check
    const sentimentIntegration = getSentimentIntegration();
    const sentimentCheck = await sentimentIntegration.shouldReplyCheck(
        tweet.text,
        { 
            personality: profile.personality || 'observer',
            limits: profile.engagementLimits 
        }
    );
    
    if (!sentimentCheck.shouldReply) {
        logger.info(`[shouldReply] Sentiment blocked: ${sentimentCheck.blockType}`);
        
        // Store for later analysis
        state.sentimentBlockType = sentimentCheck.blockType;
        state.sentimentBlockReason = sentimentCheck.reason;
        
        // Try fallback if suggested
        if (sentimentCheck.fallback && sentimentCheck.fallback.action !== 'skip') {
            logger.debug(`[shouldReply] Fallback: ${sentimentCheck.fallback.action}`);
            state.suggestedFallbackAction = sentimentCheck.fallback.action;
        }
        
        return false;
    }
    
    // Store sentiment hints for reply generation
    state.sentimentHints = sentimentCheck.hints;
    state.recommendedTones = sentimentCheck.recommendedTone;
    state.sentimentProbability = sentimentCheck.probability;
    
    logger.debug(`[shouldReply] Sentiment approved, probability: ${sentimentCheck.probability.toFixed(2)}`);
    
    // Generic response filter
    if (this.is_generic_response(tweet.text)) {
        return false;
    }
    
    return true;
}
```

---

## Example 3: Enhance Reply Generation

### BEFORE (Generic Reply)
```javascript
async generateReply(context, tweet) {
    // Simple prompt building
    const replyPrompt = TwitterReplyPrompt.buildReplyPrompt(context);
    
    const response = await this.agent.cloudApi.generateText({
        prompt: replyPrompt,
        model: 'gpt-4',
        temperature: 0.7
    });
    
    return response.text;
}
```

### AFTER (Tone-Aware Reply)
```javascript
import { getSentimentIntegration } from '../utils/sentiment-integration.js';

async generateReply(context, tweet) {
    // Get sentiment integration
    const sentimentIntegration = getSentimentIntegration();
    
    // Get tone recommendations
    const toneAdapt = await sentimentIntegration.getReplyToneAdaptation(
        tweet.text,
        context.profile?.personality
    );
    
    // Enrich context with sentiment data
    const enrichedContext = {
        ...context,
        sentiment: {
            patterns: toneAdapt.patterns,
            recommendedTones: toneAdapt.tones,
            hints: toneAdapt.hints,
            arousal: toneAdapt.arousal,
            sarcasm: toneAdapt.sarcasm,
            toxicity: toneAdapt.toxicity
        }
    };
    
    // Build adaptive prompt
    const replyPrompt = TwitterReplyPrompt.buildAdaptiveReplyPrompt(enrichedContext);
    
    // Use temperature based on content tone
    let temperature = 0.7;
    if (toneAdapt.tones.includes('sarcastic_or_witty')) {
        temperature = 0.8; // More creative for sarcasm
    } else if (toneAdapt.tones.includes('empathetic_supportive')) {
        temperature = 0.6; // Less random for empathy
    }
    
    const response = await this.agent.cloudApi.generateText({
        prompt: replyPrompt,
        model: 'gpt-4',
        temperature: temperature
    });
    
    // Store sentiment info
    this.lastReplyContext = {
        sentimentPatterns: toneAdapt.patterns,
        recommendedTones: toneAdapt.tones
    };
    
    return response.text;
}
```

---

## Example 4: Safe Quote Checking

### BEFORE (Basic Check)
```javascript
async shouldGenerateQuote(tweet) {
    // Just basic checks
    const hasHashtags = tweet.text.includes('#');
    const hasLinks = tweet.text.includes('http');
    const isShort = tweet.text.length < 50;
    
    return hasHashtags || hasLinks; // Very loose criteria
}
```

### AFTER (Multi-Dimensional Check)
```javascript
import { getSentimentIntegration } from '../utils/sentiment-integration.js';

async shouldGenerateQuote(tweet, profile) {
    const logger = createLogger('AIQuoteEngine');
    
    // Quote is most conservative action
    const sentimentIntegration = getSentimentIntegration();
    const quoteCheck = await sentimentIntegration.shouldQuoteCheck(
        tweet.text,
        { 
            personality: profile.personality,
            limits: profile.engagementLimits 
        }
    );
    
    if (!quoteCheck.shouldQuote) {
        logger.info(`[shouldGenerateQuote] Quote blocked: ${quoteCheck.reason}`);
        logger.debug(`[shouldGenerateQuote] Risk level: ${quoteCheck.riskLevel}`);
        return false;
    }
    
    // Basic content checks still apply
    const hasHashtags = tweet.text.includes('#');
    const hasLinks = tweet.text.includes('http');
    
    if (!hasHashtags && !hasLinks) {
        logger.debug('[shouldGenerateQuote] No hashtags or links, skipping');
        return false;
    }
    
    logger.info('[shouldGenerateQuote] Quote approved');
    return true;
}
```

---

## Example 5: Decision-Based Engagement

### All-In-One Decision Method
```javascript
import { getSentimentIntegration } from '../utils/sentiment-integration.js';

async decideEngagement(content, action, profile, limits) {
    const logger = createLogger('engagement-decision');
    const integration = getSentimentIntegration();
    
    // Make decision
    const decision = await integration.checkEngagementAction(
        content,
        action,
        { personality: profile.personality }
    );
    
    if (!decision.allowed) {
        logger.info(`[${action}] BLOCKED: ${decision.reason}`);
        return {
            action: 'skip',
            reason: decision.reason,
            fallback: decision.fallback
        };
    }
    
    // Probabilistic engagement
    const shouldProceed = Math.random() < decision.probability;
    
    if (!shouldProceed) {
        logger.debug(`[${action}] Probabilistically skipped`);
        return {
            action: 'skip',
            reason: 'Random probability threshold'
        };
    }
    
    logger.info(`[${action}] APPROVED - ${decision.hints.join(', ')}`);
    
    return {
        action: action,
        approved: true,
        hints: decision.hints,
        riskLevel: decision.riskLevel
    };
}

// Usage:
const decision = await decideEngagement(
    tweetText,
    'like',
    profileInfo,
    engagementLimits
);

if (decision.approved) {
    await likePost(tweetId);
}
```

---

## Example 6: Context Enrichment in AIContextEngine

### BEFORE (Basic Context)
```javascript
async extractEnhancedContext(page, targetTweetId) {
    const context = {
        text: tweetText,
        author: authorName,
        likes: likeCount,
        replies: replyCount,
        sentiment: 'positive' // Binary!
    };
    
    return context;
}
```

### AFTER (Enriched Context)
```javascript
import { getSentimentIntegration } from '../utils/sentiment-integration.js';

async extractEnhancedContext(page, targetTweetId) {
    // Basic extraction
    const basicContext = {
        text: tweetText,
        author: authorName,
        likes: likeCount,
        replies: replyCount
    };
    
    // NEW: Enrich with multi-dimensional sentiment
    const integration = getSentimentIntegration();
    const sentimentEnrichment = await integration.enrichContext(tweetText);
    
    const fullContext = {
        ...basicContext,
        sentiment: {
            dimensions: sentimentEnrichment.sentimentDimensions || {},
            patterns: sentimentEnrichment.patterns || [],
            derived: sentimentEnrichment.derived || {},
            actionGates: sentimentEnrichment.actionGates || {},
            personalityFit: sentimentEnrichment.personalityFit || {}
        }
    };
    
    return fullContext;
}
```

---

## Example 7: Real-World Tweet Analysis

```javascript
import { getSentimentIntegration } from './utils/sentiment-integration.js';

// Initialize
const integration = getSentimentIntegration();

// Example tweets
const tweets = [
    // Grief content - SHOULD BLOCK
    {
        id: 1,
        text: 'I just lost my best friend. I don\'t know how to continue without him. RIP 💔',
        expected: 'BLOCK'
    },
    
    // Toxic ranting - SHOULD BLOCK
    {
        id: 2,
        text: 'This is SO STUPID!!! You people are idiots! Complete garbage!!!',
        expected: 'BLOCK'
    },
    
    // Sarcasm - ALLOW WITH HINTS
    {
        id: 3,
        text: 'Oh wow, GREAT idea! Yeah let me just quit my job and become a millionaire. 🙄',
        expected: 'ALLOW_SARCASM'
    },
    
    // Celebration - EASY ENGAGEMENT
    {
        id: 4,
        text: '🎉 I GOT THE JOB!!! This is the best day ever! So excited!!!',
        expected: 'ALLOW_EASY'
    },
    
    // Technical discussion - THOUGHTFUL ENGAGEMENT
    {
        id: 5,
        text: 'The architecture decision here matters. We need to consider performance trade-offs carefully.',
        expected: 'ALLOW_THOUGHTFUL'
    },
    
    // Passionate advocacy - CAREFUL ENGAGEMENT
    {
        id: 6,
        text: 'Climate change is REAL and we MUST act NOW! Our planet is DYING! Please listen!',
        expected: 'ALLOW_CAREFUL'
    },
    
    // Generic content - SKIP
    {
        id: 7, 
        text: 'This is nice.',
        expected: 'SKIP_GENERIC'
    }
];

// Analyze each
for (const tweet of tweets) {
    console.log(`\n=== Tweet ${tweet.id} ===`);
    console.log(`Text: "${tweet.text}"`);
    
    const decision = await integration.shouldReplyCheck(tweet.text);
    
    console.log(`Should Reply: ${decision.shouldReply}`);
    console.log(`Probability: ${(decision.probability * 100).toFixed(1)}%`);
    console.log(`Hints: ${decision.hints.join(', ')}`);
    console.log(`Tones: ${decision.recommendedTone.join(', ')}`);
    
    if (decision.fallback) {
        console.log(`Fallback: ${decision.fallback.action}`);
    }
    
    if (decision.blockType) {
        console.log(`Block Type: ${decision.blockType}`);
    }
    
    console.log(`Expected: ${tweet.expected}`);
}
```

---

## Example 8: Monitoring & Statistics

```javascript
import { getSentimentIntegration } from './utils/sentiment-integration.js';

const integration = getSentimentIntegration();

// Periodically check stats
setInterval(() => {
    const stats = integration.getStats();
    
    console.log(`
    === SENTIMENT SYSTEM STATS ===
    Total Analyses: ${stats.analyzer.total}
    Cache Hits: ${stats.analyzer.cacheHits}
    Hit Rate: ${stats.analyzer.cacheHitRate}
    Cache Size: ${stats.analyzer.cacheSize}/1000
    
    Decision Stats:
    - Total: ${stats.engine.totalDecisions}`);
    
    // Show success rates
    for (const [action, rate] of Object.entries(stats.analyzer.successRates)) {
        const successRate = rate.total > 0 ? ((rate.success / rate.total) * 100).toFixed(1) : 'N/A';
        console.log(`  - ${action}: ${successRate}% (${rate.success}/${rate.total})`);
    }
}, 60000); // Every minute

// Export data at end of session
process.on('exit', () => {
    const exportedData = integration.export();
    console.log(JSON.stringify(exportedData, null, 2));
});
```

---

## Example 9: Error Handling

```javascript
import { getSentimentIntegration } from './utils/sentiment-integration.js';

const integration = getSentimentIntegration();

async function engageWithErrorHandling(tweet) {
    try {
        // Try multi-dimensional check
        const decision = await integration.shouldReplyCheck(tweet.text);
        
        if (!decision.shouldReply) {
            return { action: 'skip', reason: decision.reason };
        }
        
        return { action: 'reply', decision };
        
    } catch (error) {
        console.error('Sentiment analysis error:', error);
        
        // FAIL SAFE: Allow engagement on error
        // Better to engage safely than to get stuck
        return {
            action: 'reply',
            failSafe: true,
            error: error.message
        };
    }
}

// Usage
const result = await engageWithErrorHandling(tweetData);
```

---

## Example 10: Configuration Per Profile

```javascript
import { initializeSentimentIntegration, getSentimentIntegration } 
    from './utils/sentiment-integration.js';

// Per-profile configurations
const profileConfigs = {
    'conservative': {
        personality: 'observer',
        maxRiskTolerance: 0.4,
        replyProbability: 0.3,
        quoteProbability: 0.2
    },
    'active': {
        personality: 'enthusiast',
        maxRiskTolerance: 0.7,
        replyProbability: 0.7,
        quoteProbability: 0.6
    },
    'analyst': {
        personality: 'analyst',
        maxRiskTolerance: 0.6,
        replyProbability: 0.5,
        quoteProbability: 0.4
    }
};

function loadProfileSentimentConfig(profileType) {
    const config = profileConfigs[profileType];
    
    // Reinitialize with profile-specific config
    const integration = initializeSentimentIntegration({
        enabled: true,
        personality: config.personality,
        engineOptions: {
            maxRiskTolerance: config.maxRiskTolerance,
            replyProbability: config.replyProbability,
            quoteProbability: config.quoteProbability
        }
    });
    
    return integration;
}

// In task execution
loadProfileSentimentConfig('conservative'); // For careful profiles
```

---

## Example 11: Logging Integration

```javascript
import { getSentimentIntegration } from './utils/sentiment-integration.js';
import logger from './utils/logger.js';

const integration = getSentimentIntegration();

async function engageWithLogging(tweet, action) {
    try {
        logger.info(`[engagement] Analyzing ${action} for: "${tweet.text.substring(0, 50)}..."`);
        
        const decision = await integration.checkEngagementAction(tweet.text, action);
        
        if (decision.allowed) {
            logger.info(`[engagement] ✓ ${action.toUpperCase()} approved`);
            logger.debug(`  - Probability: ${(decision.probability * 100).toFixed(1)}%`);
            logger.debug(`  - Risk: ${decision.riskLevel}`);
            if (decision.hints.length > 0) {
                logger.debug(`  - Hints: ${decision.hints.join(', ')}`);
            }
        } else {
            logger.warn(`[engagement] ✗ ${action.toUpperCase()} blocked: ${decision.reason}`);
            if (decision.fallback) {
                logger.info(`  - Suggested fallback: ${decision.fallback.action}`);
            }
        }
        
        return decision;
        
    } catch (error) {
        logger.error(`[engagement] Error in ${action}: ${error.message}`);
        throw error;
    }
}
```

---

## Example 12: Testing Your Integration

```javascript
// test-sentiment-integration.js

import { initializeSentimentIntegration } from './utils/sentiment-integration.js';

async function runIntegrationTests() {
    const integration = initializeSentimentIntegration({ enabled: true });
    
    const testCases = [
        // [text, expectedAction, description]
        ['I love this!', 'allow', 'Simple positive'],
        ['This is terrible!', 'block', 'Simple negative'],
        ['My friend died', 'block', 'Grief content'],
        ['This is so great! 🙄', 'allow', 'Sarcasm with emoji'],
        ['URGENT: ACT NOW!!!', 'allow', 'Urgent but safe'],
        ['You\'re an idiot', 'block', 'Insult'],
        ['Great work on the project', 'allow', 'Praise'],
        ['Let\'s discuss this carefully', 'allow', 'Technical discussion'],
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const [text, expected, description] of testCases) {
        const decision = await integration.shouldReplyCheck(text);
        const actual = decision.shouldReply ? 'allow' : 'block';
        
        if (actual === expected) {
            console.log(`✓ ${description}`);
            passed++;
        } else {
            console.log(`✗ ${description} - Expected: ${expected}, Got: ${actual}`);
            failed++;
        }
    }
    
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
}

runIntegrationTests();
```

---

## Key Takeaways

1. **Initialization**: Call `initializeSentimentIntegration()` once in main.js
2. **Usage**: Call `getSentimentIntegration()` to get singleton instance
3. **For Replies**: Use `shouldReplyCheck()` in AIReplyEngine
4. **For Quotes**: Use `shouldQuoteCheck()` in AIQuoteEngine
5. **For Tone**: Use `getReplyToneAdaptation()` for tone suggestions
6. **For Context**: Use `enrichContext()` to augment existing context
7. **Error Handling**: Always have fallback behavior on errors
8. **Logging**: Log decisions for monitoring and debugging
9. **Personality**: Set per-profile personality for better fits
10. **Monitoring**: Periodically check stats and export data

---

**Ready to integrate? Start with example 1 and work through in order.**
