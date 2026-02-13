/**
 * AI Reply Action
 * Handles AI-generated reply to tweets
 * @module utils/actions/ai-twitter-reply
 */

import { createLogger } from '../logger.js';

export class AIReplyAction {
  constructor(agent, options = {}) {
    this.agent = agent;
    this.logger = createLogger('ai-twitter-reply.js');
    this.engagementType = 'replies';

    this.stats = {
      attempts: 0,
      successes: 0,
      failures: 0,
      skipped: 0
    };

    this.loadConfig();
  }

  loadConfig() {
    if (this.agent?.twitterConfig?.actions?.reply) {
      const actionConfig = this.agent.twitterConfig.actions.reply;
      this.probability = actionConfig.probability ?? 0.6;
      this.enabled = actionConfig.enabled !== false;
    } else {
      this.probability = 0.6;
      this.enabled = true;
    }
    this.logger.info(`[AIReplyAction] Initialized (enabled: ${this.enabled}, probability: ${(this.probability * 100).toFixed(0)}%)`);
  }

  async canExecute(context = {}) {
    if (!this.agent) {
      return { allowed: false, reason: 'agent_not_initialized' };
    }

    if (!context.tweetText) {
      return { allowed: false, reason: 'no_tweet_text' };
    }

    if (!context.username) {
      return { allowed: false, reason: 'no_username' };
    }

    if (this.agent.diveQueue && !this.agent.diveQueue.canEngage('replies')) {
      return { allowed: false, reason: 'engagement_limit_reached' };
    }

    if (this.enabled === false) {
      return { allowed: false, reason: 'action_disabled' };
    }

    return { allowed: true, reason: null };
  }

  async execute(context = {}) {
    this.stats.attempts++;

    const { tweetText, username, tweetUrl } = context;

    this.logger.info(`[AIReplyAction] Executing reply to @${username}`);

    try {
      // STEP 1: Extract enhanced context (scroll down to read replies)
      this.logger.info(`[AIReplyAction] Loading replies for context...`);
      const enhancedContext = await this.agent.contextEngine.extractEnhancedContext(
        this.agent.page,
        tweetUrl,
        tweetText,
        username
      );

      this.logger.info(`[AIReplyAction] Context: ${enhancedContext.replies?.length || 0} replies, sentiment: ${enhancedContext.sentiment?.overall || 'unknown'}`);

      // STEP 2: Generate reply with context
      const result = await this.agent.replyEngine.generateReply(
        tweetText,
        username,
        enhancedContext
      );

      if (result.success && result.reply) {
        await this.agent.executeAIReply(result.reply);
        this.stats.successes++;

        this.logger.info(`[AIReplyAction] ✅ Reply posted: "${result.reply.substring(0, 30)}..."`);

        return {
          success: true,
          executed: true,
          reason: 'success',
          data: {
            reply: result.reply,
            username,
            tweetUrl
          },
          engagementType: this.engagementType
        };
      } else {
        this.stats.failures++;
        const reason = result.reason || 'ai_generation_failed';

        this.logger.warn(`[AIReplyAction] ❌ Failed: ${reason}`);

        return {
          success: false,
          executed: true,
          reason,
          data: { error: result.reason },
          engagementType: this.engagementType
        };
      }
    } catch (error) {
      this.stats.failures++;
      this.logger.error(`[AIReplyAction] Exception: ${error.message}`);

      return {
        success: false,
        executed: true,
        reason: 'exception',
        data: { error: error.message },
        engagementType: this.engagementType
      };
    }
  }

  async tryExecute(context = {}) {
    const can = await this.canExecute(context);
    if (!can.allowed) {
      this.stats.skipped++;
      return {
        success: false,
        executed: false,
        reason: can.reason,
        engagementType: this.engagementType
      };
    }

    if (Math.random() > this.probability) {
      this.stats.skipped++;
      return {
        success: false,
        executed: false,
        reason: 'probability',
        engagementType: this.engagementType
      };
    }

    return await this.execute(context);
  }

  getStats() {
    const total = this.stats.attempts;
    const successRate = total > 0 ? (this.stats.successes / total * 100).toFixed(1) : '0.0';

    return {
      attempts: this.stats.attempts,
      successes: this.stats.successes,
      failures: this.stats.failures,
      skipped: this.stats.skipped,
      successRate: `${successRate}%`,
      engagementType: this.engagementType
    };
  }

  resetStats() {
    this.stats = {
      attempts: 0,
      successes: 0,
      failures: 0,
      skipped: 0
    };
  }
}
