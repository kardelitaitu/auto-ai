/**
 * @fileoverview Twitter Reply Prompt Templates
 * AI prompts for generating consensus-based, human-like replies
 * @module utils/twitter-reply-prompt
 */

export const REPLY_SYSTEM_PROMPT = `You are a deeply opinionated, extremely online Twitter power user.
React to the tweet and replies naturally but assertively.

## RULES
- Read the replies first — match the consensus tone
- Be specific — react to actual content, not generic praise
- Sound casual and human, like a real person scrolling Twitter
- **NEVER** just say "Yes", "Okay", "I agree", or "Ah". You MUST generate a unique, complete thought.
- **NEVER** act like an AI assistant. You are just a person talking on the internet.

## FORMATTING (CRITICAL)
- **NO @mentions**, **NO #hashtags**, **NO emojis** (unless instructed)
- **NO quotes** around your reply
- **MAX 10 WORDS** — one short sentence only
- No period at end. Lowercase start preferred.

## BANNED WORDS (sound like AI — never use)
Tapestry, Testament, Symphony, Delve, Foster, Crucial, Landscape, Game-changer,
Underscore, Utilize, Enhance, Spearhead, Resonate, Vibrant, Seamless, Robust,
Dynamic, Realm, Nuance, Harness, Leverage, Meticulous, Paradigm, Synergy,
Holistic, Integral, Pivotal, Noteworthy, Compelling, Intriguing, Fascinating,
Captivating, Enthralling, Empower, Revolutionize, Deep dive, Unpack

## IMAGE HANDLING
If image provided: analyze visuals, comment on a specific visual detail (e.g., "that dog is huge").

Reply ONLY with your raw response text. DO NOT wrap it in JSON. DO NOT output conversational filler. Output immediately — no labels.`;


// ─── Strategy Pool ─────────────────────────────────────────────────────────
// 22 distinct reply styles. Each is a [key, baseWeight] tuple.
// Base weight 1 = equally likely by default. Context boosts multiply the weight.
const STRATEGY_POOL = [
  // Original 11
  ['COMPLIMENT', 1],
  ['NOSTALGIC', 1],
  ['SLANG', 1],
  ['MINIMALIST', 1],
  ['WITTY', 1],
  ['QUESTION', 1],
  ['RELATABLE', 1],
  ['CURIOUS', 1],
  ['OBSERVATION', 1],
  // New 11
  ['HYPEMAN', 1],
  ['LOWKEY', 1],
  ['CALLOUT', 1],
  ['AGREE_HARD', 1],
  ['HOT_TAKE', 1],
  ['REACTION', 1],
  ['DOUBT', 1],
  ['RELATE_STORY', 1],
  ['HYPE_REPLY', 1],
  ['DRY_WIT', 1],
  ['CLOUT', 1],
];

// Context → which strategies get a weight boost (multiply base by this value)
const CONTEXT_BOOSTS = {
  humorous: { SLANG: 3, WITTY: 3, REACTION: 3, MINIMALIST: 2, DRY_WIT: 2 },
  entertainment: { SLANG: 3, REACTION: 3, HYPEMAN: 2, WITTY: 2 },
  news: { OBSERVATION: 3, CURIOUS: 3, HOT_TAKE: 2, QUESTION: 2, DOUBT: 2, CALLOUT: 2 },
  politics: { OBSERVATION: 3, DOUBT: 3, QUESTION: 2, DRY_WIT: 2, CALLOUT: 2 },
  finance: { OBSERVATION: 2, HOT_TAKE: 2, DOUBT: 2, CURIOUS: 2, CLOUT: 2 },
  tech: { OBSERVATION: 2, CURIOUS: 3, HOT_TAKE: 2, DOUBT: 2, CLOUT: 2 },
  science: { CURIOUS: 3, OBSERVATION: 2, QUESTION: 2, HOT_TAKE: 2 },
  emotional: { NOSTALGIC: 3, RELATABLE: 3, RELATE_STORY: 2, COMPLIMENT: 2, HYPE_REPLY: 2 },
  personal: { NOSTALGIC: 3, RELATABLE: 3, RELATE_STORY: 2, COMPLIMENT: 2 },
  viral: { MINIMALIST: 3, REACTION: 3, SLANG: 2, WITTY: 2, AGREE_HARD: 2 },
  high: { MINIMALIST: 2, REACTION: 2, SLANG: 2, WITTY: 2, AGREE_HARD: 2 },
  negative: { DOUBT: 3, OBSERVATION: 2, DRY_WIT: 2, MINIMALIST: 2, QUESTION: 2 },
  critical: { DOUBT: 3, CALLOUT: 2, OBSERVATION: 2, DRY_WIT: 2, QUESTION: 2 },
};

const strategies = {
  // ── Original ───────────────────────────────────────────────────────────
  COMPLIMENT: `\n**CRITICAL INSTRUCTION**: You MUST write a ONE-SENTENCE genuine compliment about the tweet. NEVER write "Okay" or "Yes". MAX 10 WORDS. No mentions.`,
  NOSTALGIC: `\n**CRITICAL INSTRUCTION**: You MUST share a brief personal memory related to the tweet (e.g., "I remember when..."). NEVER write "Okay" or "Yes". MAX 15 WORDS. One sentence. No mentions.`,
  SLANG: `\n**CRITICAL INSTRUCTION**: You MUST use extremely casual internet slang (e.g., "this is fire", "no cap"). lowercase ONLY. NEVER write "Okay" or "Yes". MAX 8 WORDS. No mentions.`,
  MINIMALIST: `\n**CRITICAL INSTRUCTION**: React with exactly ONE highly expressive word or extremely short phrase (1-3 words) (e.g., "real", "wild", "big facts"). lowercase. NEVER write "Okay" or "Yes". No mentions.`,
  WITTY: `\n**CRITICAL INSTRUCTION**: You MUST make a witty, playful, or sarcastic observation about the tweet. NEVER write "Okay" or "Yes". MAX 10 WORDS. One sentence. No mentions.`,
  QUESTION: `\n**CRITICAL INSTRUCTION**: You MUST ask a specific, highly relevant question about the tweet. NEVER write "Okay" or "Yes". MAX 8 WORDS. One sentence. No mentions.`,
  RELATABLE: `\n**CRITICAL INSTRUCTION**: You MUST fiercely validate the tweet with a "same" or "relatable" sentiment. NEVER write "Okay" or "Yes". MAX 10 WORDS. No mentions.`,
  CURIOUS: `\n**CRITICAL INSTRUCTION**: You MUST express casual, specific curiosity about a detail in the tweet (e.g., "wait where is this"). NEVER write "Okay" or "Yes". MAX 10 WORDS. No mentions.`,
  TEXT_EMOJI: `\n**CRITICAL INSTRUCTION**: You MUST write a short casual sentence containing precisely one text-based emotion. NEVER write "Okay" or "Yes". MAX 8 WORDS. No mentions.`,
  EMOJI_ONLY: `\n**CRITICAL INSTRUCTION**: React with a very short punchy phrase ONLY. No emoji. lowercase. NEVER write "Okay" or "Yes". No mentions.`,
  OBSERVATION: `\n**CRITICAL INSTRUCTION**: You MUST make a hyper-specific, casual observation about the tweet content. Avoid formal grammar. NEVER write "Okay" or "Yes". MAX 12 WORDS. No mentions.`,
  // ── New ───────────────────────────────────────────────────────────────
  HYPEMAN: `\n**CRITICAL INSTRUCTION**: You MUST hype this up wildly. Sound genuinely, aggressively excited. NEVER write "Okay" or "Yes". MAX 8 WORDS. lowercase. No mentions.`,
  LOWKEY: `\n**CRITICAL INSTRUCTION**: You MUST react with highly understated, deadpan agreement (e.g., "pretty much", "yeah basically"). NEVER write "Okay" or "Yes". MAX 6 WORDS. No mentions.`,
  CALLOUT: `\n**CRITICAL INSTRUCTION**: You MUST point out an irony or obvious contradiction in the tweet in one short sentence. NEVER write "Okay" or "Yes". MAX 12 WORDS. No mentions.`,
  AGREE_HARD: `\n**CRITICAL INSTRUCTION**: You MUST double-down with emphatic, aggressive agreement (e.g., "literally this", "could not agree more"). NEVER write "Okay" or "Yes". MAX 6 WORDS. No mentions.`,
  HOT_TAKE: `\n**CRITICAL INSTRUCTION**: You MUST give a confident short opinion that sounds slightly provocative or surprising regarding the tweet. NEVER write "Okay" or "Yes". MAX 12 WORDS. No mentions.`,
  REACTION: `\n**CRITICAL INSTRUCTION**: You MUST provide pure unfiltered reaction — one punchy exclamation (e.g., "bro", "wait what", "lmaooo"). lowercase. NEVER write "Okay" or "Yes". MAX 4 WORDS. No mentions.`,
  DOUBT: `\n**CRITICAL INSTRUCTION**: You MUST express distinct, specific skepticism about the tweet (e.g., "idk about that one"). NEVER write "Okay" or "Yes". MAX 8 WORDS. No mentions.`,
  RELATE_STORY: `\n**CRITICAL INSTRUCTION**: You MUST drop a one-line personal angle that connects to the tweet ("same thing happened to me when..."). NEVER write "Okay" or "Yes". MAX 15 WORDS. No mentions.`,
  HYPE_REPLY: `\n**CRITICAL INSTRUCTION**: You MUST cheer on or celebrate the exact specific thing mentioned in the tweet. NEVER write "Okay" or "Yes". MAX 8 WORDS. No mentions.`,
  DRY_WIT: `\n**CRITICAL INSTRUCTION**: You MUST use deadpan dry humor about the tweet topic. No exclamation marks. NEVER write "Okay" or "Yes". MAX 12 WORDS. No mentions.`,
  CLOUT: `\n**CRITICAL INSTRUCTION**: You MUST write one short, highly confident line, acting as if you are an expert on this tweet's topic. NEVER write "Okay" or "Yes". MAX 10 WORDS. No mentions.`,
};

/**
 * Pick a strategy using weighted random selection.
 * All strategies start at base weight 1; context boosts multiply specific keys.
 * @param {object} context - { sentiment, type, engagement }
 * @returns {string} The SPECIAL INSTRUCTION string
 */
export function getStrategyInstruction(context = {}) {
  const type = context.type || 'general';
  const sentiment = context.sentiment || 'neutral';
  const engagement = context.engagement || 'unknown';

  // Build boost map from matching context keys
  const boostKeys = [type, sentiment, engagement];
  const boostMap = {};
  for (const key of boostKeys) {
    const boost = CONTEXT_BOOSTS[key];
    if (boost) {
      for (const [strat, mult] of Object.entries(boost)) {
        boostMap[strat] = Math.max(boostMap[strat] || 1, mult);
      }
    }
  }

  // Apply boosts to pool weights
  const weightedPool = STRATEGY_POOL.map(([key, base]) => [key, base * (boostMap[key] || 1)]);

  // Weighted random pick
  const total = weightedPool.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, weight] of weightedPool) {
    r -= weight;
    if (r <= 0) return strategies[key];
  }
  return strategies[weightedPool[weightedPool.length - 1][0]];
}


/**
 * Build a lean reply prompt with hard character limits.
 * Tweet text capped at 500 chars. Each reply capped at 80 chars. Max 3 replies.
 */
export function buildReplyPrompt(tweetText, authorUsername, replies = [], _url = '', context = {}) {
  const tweetSnippet = (tweetText || '').substring(0, 500);
  let prompt = `Tweet from @${authorUsername}:\n"${tweetSnippet}"\n\n=== OTHER REPLIES ===\n`;

  if (replies && replies.length > 0) {
    replies.slice(0, 20).forEach((reply, idx) => {
      const author = reply.author || 'User';
      const text = (reply.text || '').substring(0, 80);
      prompt += `${idx + 1}. @${author}: ${text}\n`;
    });
  } else {
    prompt += '(no other replies visible)\n';
  }

  // === DYNAMIC STRATEGY SELECTION ===
  prompt += getStrategyInstruction(context);

  prompt += '\n=== YOUR REPLY ===\nYour reply:';

  return prompt;
}


export function getSentimentGuidance(sentiment, conversationType, sarcasmScore) {
  const guidance = {
    enthusiastic: 'Show genuine excitement and energy. Be warm and encouraging.',
    humorous: 'Add a light, witty observation. Keep it fun and relatable.',
    informative: 'Share a relevant fact, statistic, or related information.',
    emotional: 'Express genuine emotion - why does this resonate with you?',
    supportive: 'Show enthusiasm and encourage the author.',
    thoughtful: 'Offer a considered perspective or ask a thoughtful question.',
    critical: 'Present a thoughtful counterpoint or question respectfully.',
    neutral: 'Ask a specific question or add a relevant observation.',
    sarcastic: 'Use subtle irony, but keep it playful, never mean-spirited.',
    ironic: 'Employ dry wit, but avoid being dismissive or condescending.',
  };

  if (sarcasmScore > 0.5 && (sentiment === 'sarcastic' || sentiment === 'ironic')) {
    return 'Match the ironic tone - subtle, playful, never mean-spirited.';
  }

  return guidance[sentiment] || guidance.neutral;
}

export function getReplyLengthGuidance(conversationType, valence) {
  const valenceMultiplier = Math.abs(valence) > 0.5 ? 1.2 : 1.0;

  const lengthGuides = {
    'heated-debate': 'CRITICAL: Maximum 1 short sentence.',
    'casual-chat': 'Maximum 1 short sentence.',
    'announcement': 'Maximum 1 sentence.',
    'question': 'One short question or 1 sentence.',
    'humor': 'Maximum 1 punchy sentence.',
    'news': 'Maximum 1 short sentence.',
    'personal': 'Maximum 1-2 short sentences.',
    'controversial': 'CRITICAL: Maximum 1 short sentence.',
    'general': 'Maximum 1 short sentence.',
  };

  const baseGuidance = lengthGuides[conversationType] || lengthGuides.general;

  if (valenceMultiplier > 1.0) {
    return baseGuidance + ' Be more expressive given the emotional content.';
  }

  return baseGuidance;
}

/**
 * Build enhanced prompt using context engine data — lean version.
 * Does NOT prepend system prompt (sent separately as systemPrompt field).
 * Hard limits: 500 chars for tweet text, 80 chars per reply, max 3 replies.
 * @param {object} context - Enhanced context from AIContextEngine
 * @param {string} _systemPrompt - Unused here (sent via request.payload.systemPrompt)
 * @returns {string} Lean user prompt
 */
export function buildEnhancedPrompt(context, _systemPrompt = REPLY_SYSTEM_PROMPT) {
  const {
    tweetText,
    author,
    replies,
    sentiment,
    conversationType,
    engagementLevel,
    hasImage,
  } = context;

  const type = conversationType || sentiment?.conversationType || 'general';
  const valence = sentiment?.valence || 0;

  // === DYNAMIC STRATEGY SELECTION ===
  const strategyContext = {
    sentiment: sentiment?.overall || 'neutral',
    type,
    engagement: engagementLevel,
    valence,
  };

  // Hard limits: 500 chars for tweet, 80 chars per reply
  const tweetSnippet = (tweetText || '').substring(0, 500);

  let prompt = getStrategyInstruction(strategyContext);
  prompt += `\n\nTweet: "@${author}: ${tweetSnippet}"`;
  if (hasImage) {
    prompt += ' [IMAGE ATTACHED — comment on a specific visual detail]';
  }

  if (replies && replies.length > 0) {
    const topReplies = replies
      .filter(r => r.text && r.text.length > 5)
      .slice(0, 20);
    if (topReplies.length > 0) {
      prompt += '\n\nReplies:';
      topReplies.forEach((reply, idx) => {
        const text = (reply.text || reply.content || '').substring(0, 80);
        const replyAuthor = reply.author || 'User';
        prompt += `\n${idx + 1}. @${replyAuthor}: ${text}`;
      });
    }
  }

  prompt += '\n\nReply:';
  return prompt;
}


export function buildAnalysisPrompt(tweetText) {
  return `Analyze this tweet and determine if it's safe to reply to:

Tweet: "${tweetText}"

Respond with JSON:
{
  "safe": true/false,
  "reason": "brief explanation",
  "topic": "main topic detected"
}

Safe topics: technology, science, everyday life, humor, sports, food, travel, productivity
Unsafe topics: politics, NSFW, spam, religion, controversial opinions`;
}
