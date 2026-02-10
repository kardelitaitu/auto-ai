/**
 * @fileoverview Unit Tests - Multi-Dimensional Sentiment System (Phase 6)
 * Comprehensive test suite for all sentiment analysis components
 * @module tests/sentiment-system.test.js
 */

import {
    ValenceAnalyzer,
    ArousalAnalyzer,
    DominanceAnalyzer,
    SarcasmAnalyzer,
    UrgencyAnalyzer,
    ToxicityAnalyzer
} from '../utils/sentiment-analyzers.js';
import MultiDimensionalSentimentAnalyzer from '../utils/sentiment-analyzer-multi.js';
import SentimentDecisionEngine from '../utils/sentiment-decision-engine.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================
function assert(condition, message) {
    if (!condition) {
        throw new Error(`ASSERTION FAILED: ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`ASSERTION FAILED: ${message} (expected: ${expected}, got: ${actual})`);
    }
}

function assertRange(value, min, max, message) {
    if (value < min || value > max) {
        throw new Error(`ASSERTION FAILED: ${message} (expected: ${min}-${max}, got: ${value})`);
    }
}

// ============================================================================
// VALENCE ANALYZER TESTS
// ============================================================================
console.log('\n=== VALENCE ANALYZER TESTS ===');

const valenceAnalyzer = new ValenceAnalyzer();

// Test 1: Strong positive
const result1 = valenceAnalyzer.analyze('I love this! It\'s amazing and wonderful!');
assertRange(result1.valence, 0.5, 1, 'Strong positive should score high');
console.log('✓ Strong positive detection');

// Test 2: Strong negative
const result2 = valenceAnalyzer.analyze('This is terrible, awful, and disgusting!');
assertRange(result2.valence, -1, -0.5, 'Strong negative should score low');
console.log('✓ Strong negative detection');

// Test 3: Neutral/mixed
const result3 = valenceAnalyzer.analyze('The weather is neutral today.');
assertRange(result3.valence, -0.3, 0.3, 'Neutral should score near zero');
console.log('✓ Neutral detection');

// Test 4: Emoji sentiment
const result4 = valenceAnalyzer.analyze('Great news! 😊👍 This is so good! 🎉');
assertRange(result4.valence, 0.6, 1, 'Positive emojis should boost score');
console.log('✓ Emoji sentiment boost');

// ============================================================================
// AROUSAL ANALYZER TESTS
// ============================================================================
console.log('\n=== AROUSAL ANALYZER TESTS ===');

const arousalAnalyzer = new ArousalAnalyzer();

// Test 1: High arousal
const arousal1 = arousalAnalyzer.analyze('OMG!!! THIS IS INCREDIBLE!!! I CAN\'T BELIEVE THIS!!!');
assertRange(arousal1.arousal, 0.6, 1, 'High arousal should score high');
assert(arousal1.exclamations > 5, 'Should detect multiple exclamations');
console.log('✓ High arousal detection');

// Test 2: Low arousal
const arousal2 = arousalAnalyzer.analyze('I am quiet and calm. Everything is peaceful.');
assertRange(arousal2.arousal, 0, 0.4, 'Low arousal should score low');
console.log('✓ Low arousal detection');

// Test 3: Caps words
const arousal3 = arousalAnalyzer.analyze('This is interesting. VERY interesting. EXTREMELY interesting.');
assert(arousal3.capsWords >= 2, 'Should detect caps words');
console.log('✓ Caps word detection');

// ============================================================================
// DOMINANCE ANALYZER TESTS
// ============================================================================
console.log('\n=== DOMINANCE ANALYZER TESTS ===');

const dominanceAnalyzer = new DominanceAnalyzer();

// Test 1: Assertive/dominant
const dom1 = dominanceAnalyzer.analyze('You must do this. I demand action. This will happen.');
assertRange(dom1.dominance, 0.6, 1, 'Assertive language should score high');
console.log('✓ Assertive detection');

// Test 2: Submissive
const dom2 = dominanceAnalyzer.analyze('Would you please? Maybe if you could? I\'m sorry to ask.');
assertRange(dom2.dominance, 0, 0.4, 'Submissive language should score low');
console.log('✓ Submissive detection');

// Test 3: Questions
const dom3 = dominanceAnalyzer.analyze('What do you think? Should we do this? Can you help?');
assert(dom3.questions >= 3, 'Should detect multiple questions');
console.log('✓ Question detection');

// ============================================================================
// SARCASM ANALYZER TESTS
// ============================================================================
console.log('\n=== SARCASM ANALYZER TESTS ===');

const sarcasmAnalyzer = new SarcasmAnalyzer();

// Test 1: Explicit sarcasm
const sarc1 = sarcasmAnalyzer.analyze('Yeah right, sure, obviously this is amazing. 🙄');
assertRange(sarc1.sarcasm, 0.5, 1, 'Explicit sarcasm markers should score high');
assert(sarc1.emojis.length > 0, 'Should detect sarcasm emojis');
console.log('✓ Explicit sarcasm detection');

// Test 2: Contradiction sarcasm
const sarc2 = sarcasmAnalyzer.analyze('This brilliant disaster is fantastic failure.');
assertRange(sarc2.sarcasm, 0.3, 1, 'Contradiction patterns should increase sarcasm');
console.log('✓ Contradiction pattern detection');

// Test 3: Low sarcasm
const sarc3 = sarcasmAnalyzer.analyze('I genuinely think this is a good idea.');
assertRange(sarc3.sarcasm, 0, 0.4, 'Genuine statements should score low');
console.log('✓ Genuine statement detection');

// ============================================================================
// URGENCY ANALYZER TESTS
// ============================================================================
console.log('\n=== URGENCY ANALYZER TESTS ===');

const urgencyAnalyzer = new UrgencyAnalyzer();

// Test 1: High urgency
const urg1 = urgencyAnalyzer.analyze('URGENT! Act now! This is critical! Immediate action required!');
assertRange(urg1.urgency, 0.5, 1, 'Urgent language should score high');
console.log('✓ Urgency detection');

// Test 2: Relaxed
const urg2 = urgencyAnalyzer.analyze('Take your time. No rush. Whenever works for you.');
assertRange(urg2.urgency, 0, 0.4, 'Relaxed language should score low');
console.log('✓ Relaxed detection');

// ============================================================================
// TOXICITY ANALYZER TESTS
// ============================================================================
console.log('\n=== TOXICITY ANALYZER TESTS ===');

const toxicityAnalyzer = new ToxicityAnalyzer();

// Test 1: High toxicity
const tox1 = toxicityAnalyzer.analyze('You\'re an idiot! This is stupid and you\'re worthless!');
assertRange(tox1.toxicity, 0.5, 1, 'Toxic language should score high');
assert(tox1.severityLevel === 'severe' || tox1.severityLevel === 'moderate', 'Should flag as severe/moderate');
console.log('✓ Toxicity detection');

// Test 2: Friendly
const tox2 = toxicityAnalyzer.analyze('Let\'s work together on this. I appreciate your help!');
assertRange(tox2.toxicity, 0, 0.3, 'Friendly language should score low');
console.log('✓ Friendly detection');

// ============================================================================
// MULTI-DIMENSIONAL ANALYZER TESTS
// ============================================================================
console.log('\n=== MULTI-DIMENSIONAL ANALYZER TESTS ===');

const multiAnalyzer = new MultiDimensionalSentimentAnalyzer();

// Test 1: Grief content (should match pattern)
const test1 = await multiAnalyzer.analyze('I\'m so sad right now. My friend passed away. I don\'t know what to do.');
assert(test1.patterns.includes('restrainedGrief'), 'Should detect grief pattern');
assert(test1.actionBlock === 'grief', 'Should block actions for grief content');
console.log('✓ Grief pattern detection');

// Test 2: Fake positivity (high valence + sarcasm + dominance)
const test2 = await multiAnalyzer.analyze('Oh wow, yeah sure, this is AMAZING! 🙄 Obviously the best idea ever!');
assert(test2.patterns.includes('fakePositivity'), 'Should detect fake positivity');
assertRange(test2.dimensions.valence, -0.2, 0.3, 'Fake positivity should reduce valence boost');
console.log('✓ Fake positivity detection');

// Test 3: Celebration
const test3 = await multiAnalyzer.analyze('🎉 YES! I passed the exam! This is AMAZING! So happy!!!');
assert(test3.patterns.includes('celebration'), 'Should detect celebration');
assert(test3.derived.isEasyEngage === true, 'Celebration should be easy to engage');
console.log('✓ Celebration detection');

// Test 4: Cache functionality
const testText = 'This is a test tweet about sentiment analysis.';
const cached1 = await multiAnalyzer.analyze(testText);
const cached2 = await multiAnalyzer.analyze(testText);
assert(multiAnalyzer.metrics.cacheHits > 0, 'Cache should record hits');
assertEqual(cached1.timestamp, cached2.timestamp, 'Cached results should be identical');
console.log('✓ Caching functionality');

// Test 5: Action gates
const test5 = await multiAnalyzer.analyze('This is a wonderful, friendly message!');
assert(test5.actionGates.canReply === true, 'Positive friendly content should allow reply');
assert(test5.actionGates.canLike === true, 'Positive content should allow like');
console.log('✓ Action gates');

// ============================================================================
// DECISION ENGINE TESTS
// ============================================================================
console.log('\n=== DECISION ENGINE TESTS ===');

const engine = new SentimentDecisionEngine(multiAnalyzer, {
    replyProbability: 0.5,
    quoteProbability: 0.3,
    maxRiskTolerance: 0.6
});

// Test 1: Safe engagement
const decision1 = await engine.makeEngagementDecision(
    'Great idea! I love this approach!',
    'reply'
);
assert(decision1.allowed === true, 'Safe positive content should be allowed');
console.log('✓ Safe engagement approval');

// Test 2: Blocked engagement (toxic)
const decision2 = await engine.makeEngagementDecision(
    'You\'re an idiot! This is stupid!',
    'reply'
);
assert(decision2.allowed === false, 'Toxic content should be blocked');
assert(decision2.blockType !== undefined, 'Should specify block type');
console.log('✓ Toxic engagement block');

// Test 3: Grief content block
const decision3 = await engine.makeEngagementDecision(
    'My loved one passed away. I\'m devastated.',
    'like'
);
assert(decision3.allowed === false, 'Grief content should be blocked');
assert(decision3.blockType === 'grief', 'Should identify as grief block');
console.log('✓ Grief content block');

// Test 4: Fallback suggestion
const decision4 = await engine.makeEngagementDecision(
    'My loved one passed away.',
    'reply'
);
assert(decision4.fallback !== null, 'Blocked decision should suggest fallback');
assert(['like', 'bookmark', 'skip'].includes(decision4.fallback.action), 'Fallback should be valid action');
console.log('✓ Fallback suggestion');

// Test 5: Risk assessment
const decision5 = await engine.makeEngagementDecision(
    'This will shock you! MUST READ NOW!!! OMG OMG OMG!!!',
    'quote'
);
assert(decision5.riskLevel !== undefined, 'Should calculate risk level');
console.log('✓ Risk assessment');

// Test 6: Tone recommendations
const decision6 = await engine.makeEngagementDecision(
    'Yeah sure, that\'s totally brilliant idea. 🙄 Obviously.',
    'reply'
);
assert(decision6.recommendedTone.length > 0, 'Should recommend tone');
assert(decision6.recommendedTone.some(t => t.includes('sarcastic') || t.includes('witty')), 'Should recommend witty tone for sarcasm');
console.log('✓ Tone recommendations');

// ============================================================================
// INTEGRATION TESTS
// ============================================================================
console.log('\n=== INTEGRATION TESTS ===');

import { initializeSentimentIntegration } from '../utils/sentiment-integration.js';

const integration = initializeSentimentIntegration({
    enabled: true,
    personality: 'analyst'
});

// Test 1: shouldReplyCheck
const replyCheck = await integration.shouldReplyCheck('This is interesting analysis!', {
    personality: 'analyst'
});
assert(typeof replyCheck.shouldReply === 'boolean', 'Should return boolean decision');
console.log('✓ Reply check integration');

// Test 2: Tone adaptation
const toneAdapt = await integration.getReplyToneAdaptation('Great job! Amazing work!', 'enthusiast');
assert(Array.isArray(toneAdapt.tones), 'Should return tone array');
console.log('✓ Tone adaptation integration');

// Test 3: Quote check
const quoteCheck = await integration.shouldQuoteCheck('This is quote-worthy content!');
assert(typeof quoteCheck.shouldQuote === 'boolean', 'Should return boolean decision');
console.log('✓ Quote check integration');

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  ✓ ALL TESTS PASSED - Sentiment System Ready For Use     ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('\nTest Coverage:');
console.log('  • Valence Analyzer: 4 tests');
console.log('  • Arousal Analyzer: 3 tests');
console.log('  • Dominance Analyzer: 3 tests');
console.log('  • Sarcasm Analyzer: 3 tests');
console.log('  • Urgency Analyzer: 2 tests');
console.log('  • Toxicity Analyzer: 2 tests');
console.log('  • Multi-Dimensional Analyzer: 5 tests');
console.log('  • Decision Engine: 6 tests');
console.log('  • Integration: 3 tests');
console.log('\nTotal: 31 test cases executed successfully');
console.log('\nNext: Proceed to Phase 7 (Migration) and Phase 8 (Tuning)');
