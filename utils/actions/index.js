/**
 * Twitter Action Factory
 * Exports all modular action handlers for Twitter automation
 * @module utils/actions
 */

import { createLogger } from '../logger.js';

const logger = createLogger('actions/index.js');

export { AIReplyAction } from './ai-twitter-reply.js';
export { AIQuoteAction } from './ai-twitter-quote.js';
export { LikeAction } from './ai-twitter-like.js';
export { BookmarkAction } from './ai-twitter-bookmark.js';
export { GoHomeAction } from './ai-twitter-go-home.js';

/**
 * Smart Action Runner
 * Manages action probabilities with automatic redistribution when limits are reached
 */
export class ActionRunner {
  constructor(agent, actions = {}) {
    this.agent = agent;
    this.actions = actions;

    this.logger = createLogger('actions/index.js');

    this.loadConfig();
  }

  loadConfig() {
    const actionConfig = this.agent?.twitterConfig?.actions || {};
    this.config = {
      reply: actionConfig.reply || { probability: 0.60, enabled: true },
      quote: actionConfig.quote || { probability: 0.20, enabled: true },
      like: actionConfig.like || { probability: 0.15, enabled: true },
      bookmark: actionConfig.bookmark || { probability: 0.05, enabled: true },
      goHome: actionConfig.goHome || { enabled: true }
    };

    const totalProb = Object.entries(this.config)
      .filter(([k]) => k !== 'goHome')
      .reduce((sum, [_, v]) => sum + v.probability, 0);

    this.logger.info(`[ActionRunner] Initialized: reply=${this.config.reply.probability}, quote=${this.config.quote.probability}, like=${this.config.like.probability}, bookmark=${this.config.bookmark.probability} (total: ${(totalProb * 100).toFixed(0)}%)`);
  }

  /**
   * Get engagement type for an action
   */
  getEngagementType(actionName) {
    const mapping = {
      reply: 'replies',
      quote: 'quotes',
      like: 'likes',
      bookmark: 'bookmarks'
    };
    return mapping[actionName] || actionName;
  }

  /**
   * Check if an action can be executed (not at limit, enabled)
   */
  isActionAvailable(actionName) {
    const actionConfig = this.config[actionName];
    if (!actionConfig || !actionConfig.enabled) {
      return false;
    }

    const engagementType = this.getEngagementType(actionName);
    if (engagementType !== actionName) {
      const canEngage = this.agent.diveQueue?.canEngage(engagementType);
      if (!canEngage) {
        this.logger.debug(`[ActionRunner] ${actionName} at limit (${engagementType})`);
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate smart probabilities with redistribution
   * If an action is at limit, its probability is redistributed proportionally to remaining actions
   */
  calculateSmartProbabilities() {
    const baseActions = ['reply', 'quote', 'like', 'bookmark'];

    let totalBaseWeight = 0;
    const baseWeights = {};
    const availableWeights = {};

    for (const action of baseActions) {
      const actionConfig = this.config[action];
      const weight = actionConfig?.probability || 0;
      baseWeights[action] = weight;
      totalBaseWeight += weight;

      if (this.isActionAvailable(action)) {
        availableWeights[action] = weight;
      }
    }

    if (totalBaseWeight === 0) {
      this.logger.warn(`[ActionRunner] No base weights configured`);
      return {};
    }

    const availableTotal = Object.values(availableWeights).reduce((a, b) => a + b, 0);

    const smartProbs = {};
    for (const action of baseActions) {
      if (availableWeights[action] !== undefined) {
        const redistributedProb = availableWeights[action] / availableTotal;
        smartProbs[action] = redistributedProb;
      }
    }

    if (Object.keys(smartProbs).length > 0) {
      const redistributedTotal = Object.values(smartProbs).reduce((a, b) => a + b, 0);
      this.logger.debug(`[ActionRunner] Smart probabilities (total redistributed: ${(redistributedTotal * 100).toFixed(1)}%): ${JSON.stringify(smartProbs)}`);
    }

    return smartProbs;
  }

  /**
   * Select an action based on smart probabilities
   * Returns null if no actions available
   */
  selectAction() {
    const probabilities = this.calculateSmartProbabilities();

    const availableActions = Object.keys(probabilities);
    if (availableActions.length === 0) {
      this.logger.debug(`[ActionRunner] No actions available (all at limits or disabled)`);
      return null;
    }

    const roll = Math.random();
    let cumulative = 0;

    for (const action of availableActions) {
      cumulative += probabilities[action];
      if (roll < cumulative) {
        this.logger.debug(`[ActionRunner] Selected: ${action} (roll: ${(roll * 100).toFixed(1)}%, prob: ${(probabilities[action] * 100).toFixed(1)}%)`);
        return action;
      }
    }

    return availableActions[availableActions.length - 1];
  }

  /**
   * Execute an action by name
   */
  async executeAction(actionName, context = {}) {
    const action = this.actions[actionName];
    if (!action) {
      return { success: false, reason: 'unknown_action', actionName };
    }

    return await action.execute(context);
  }

  /**
   * Try to execute an action with probability roll
   */
  async tryExecute(actionName, context = {}) {
    const action = this.actions[actionName];
    if (!action) {
      return { success: false, reason: 'unknown_action', actionName };
    }

    return await action.tryExecute(context);
  }

  /**
   * Get all action stats
   */
  getStats() {
    const stats = {};
    for (const [name, action] of Object.entries(this.actions)) {
      stats[name] = action.getStats?.() || {};
    }
    return stats;
  }
}

