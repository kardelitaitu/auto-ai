/**
 * Retweet Action
 * Handles pure retweeting (no quote) of tweets
 * @module utils/actions/ai-twitter-retweet
 */

import { createLogger } from "../logger.js";

export class RetweetAction {
  constructor(agent, _options = {}) {
    this.agent = agent;
    this.logger = createLogger("ai-twitter-retweet.js");
    this.engagementType = "retweets";

    this.stats = {
      attempts: 0,
      successes: 0,
      failures: 0,
      skipped: 0,
    };

    this.loadConfig();
  }

  loadConfig() {
    if (this.agent?.twitterConfig?.actions?.retweet) {
      const actionConfig = this.agent.twitterConfig.actions.retweet;
      this.probability = actionConfig.probability ?? 0.2;
      this.enabled = actionConfig.enabled !== false;
    } else {
      this.probability = 0.2;
      this.enabled = true;
    }
    this.logger.info(
      `[RetweetAction] Initialized (enabled: ${this.enabled}, probability: ${(this.probability * 100).toFixed(0)}%)`,
    );
  }

  async canExecute(_context = {}) {
    if (!this.agent) {
      return { allowed: false, reason: "agent_not_initialized" };
    }

    if (this.agent.diveQueue && !this.agent.diveQueue.canEngage("retweets")) {
      return { allowed: false, reason: "engagement_limit_reached" };
    }

    return { allowed: true, reason: null };
  }

  async execute(context = {}) {
    this.stats.attempts++;

    const { tweetElement, tweetUrl } = context;

    this.logger.info(`[RetweetAction] Executing retweet`);

    try {
      const result = await this.handleRetweet(tweetElement);

      if (result.success) {
        this.stats.successes++;
        this.logger.info(`[RetweetAction] ✅ Retweet posted`);

        return {
          success: true,
          executed: true,
          reason: "success",
          data: { tweetUrl },
          engagementType: this.engagementType,
        };
      } else {
        this.stats.failures++;
        this.logger.warn(`[RetweetAction] Failed: ${result.reason}`);

        return {
          success: false,
          executed: true,
          reason: result.reason,
          data: { tweetUrl },
          engagementType: this.engagementType,
        };
      }
    } catch (error) {
      this.stats.failures++;
      this.logger.error(`[RetweetAction] Exception: ${error.message}`);

      return {
        success: false,
        executed: true,
        reason: "exception",
        data: { error: error.message },
        engagementType: this.engagementType,
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
        engagementType: this.engagementType,
      };
    }

    if (Math.random() > this.probability) {
      this.stats.skipped++;
      return {
        success: false,
        executed: false,
        reason: "probability",
        engagementType: this.engagementType,
      };
    }

    return await this.execute(context);
  }

  /**
   * Handle retweet action on a tweet element
   * @param {Object} tweetElement - Playwright element handle for the tweet
   * @returns {Promise<{success: boolean, reason: string}>}
   */
  async handleRetweet(tweetElement) {
    const page = this.agent.page;

    try {
      try {
        if (this.agent.scrollToGoldenZone) {
          await this.agent.scrollToGoldenZone(tweetElement);
        } else {
          await tweetElement.scrollIntoViewIfNeeded();
        }
        await page.waitForTimeout(300);
      } catch (scrollError) {
        this.logger.warn(`[RetweetAction] Failed to scroll element into view: ${scrollError.message}`);
      }

      // 1. ROBUST CHECK: Is it already retweeted?
      // Look for the "unretweet" testid which appears when a tweet is already retweeted
      // User snippet: <button ... data-testid="unretweet" aria-label="... Reposted" ...>
      const unretweetBtnSelector = '[data-testid="unretweet"]';
      const unretweetBtn = tweetElement.locator(unretweetBtnSelector).first();
      if (this.agent.scrollToGoldenZone) {
        try {
          if ((await unretweetBtn.count()) > 0) {
            await this.agent.scrollToGoldenZone(unretweetBtn);
          } else {
            const retweetBtnCandidate = tweetElement.locator('[data-testid="retweet"]').first();
            if ((await retweetBtnCandidate.count()) > 0) {
              await this.agent.scrollToGoldenZone(retweetBtnCandidate);
            }
          }
          await page.waitForTimeout(200);
        } catch (_error) {
          void _error;
        }
      }
      const isAlreadyRetweeted = await unretweetBtn.isVisible().catch(() => false);

      if (isAlreadyRetweeted) {
        this.logger.info("[RetweetAction] Checker: Tweet is already retweeted (unretweet button visible)");
        return { success: true, reason: "already_retweeted" };
      }
      
      // Secondary check: Look for aria-label containing "Reposted" just in case testid is missing/changed
      const repostedLabel = tweetElement.locator('[aria-label*="Reposted"]').first();
      if (await repostedLabel.isVisible().catch(() => false)) {
        this.logger.info("[RetweetAction] Checker: Tweet is already retweeted (aria-label match)");
        return { success: true, reason: "already_retweeted" };
      }

      // 2. LOCATE BUTTON: Find the retweet/repost button
      // User snippet: <button ... data-testid="retweet" aria-label="... Repost" ...>
      const retweetBtnSelector = '[data-testid="retweet"]';
      let retweetBtn = tweetElement.locator(retweetBtnSelector).first();

      if ((await retweetBtn.count()) === 0) {
        // Fallback: Try searching by aria-label "Repost" or "Retweet"
        const ariaRepost = tweetElement.locator('[aria-label*="Repost"], [aria-label*="Retweet"]').first();
        if (await ariaRepost.isVisible()) {
             this.logger.info("[RetweetAction] Found button via aria-label fallback");
             retweetBtn = ariaRepost;
        } else {
            return { success: false, reason: "retweet_button_not_found" };
        }
      }

      // 3. INTERACTION STEP 1: Click the retweet button
      if (this.agent.scrollToGoldenZone) {
        try {
          await this.agent.scrollToGoldenZone(retweetBtn);
        } catch (_error) {
          void _error;
        }
      }
      await this.agent.humanClick(retweetBtn, "Retweet/Repost Button");
      this.logger.info("[RetweetAction] Clicked retweet button");

      // WAIT: User requested 1s wait before confirming
      await page.waitForTimeout(1000);

      // 4. MENU HANDLING STEP 2: Click the confirm option
      // User snippet: <div ... data-testid="retweetConfirm" ...>
      const retweetConfirmSelector = '[data-testid="retweetConfirm"]';
      
      try {
        const confirmBtn = page.locator(retweetConfirmSelector).first();
        await confirmBtn.waitFor({ state: 'visible', timeout: 3000 });
        
        if (this.agent.scrollToGoldenZone) {
          try {
            await this.agent.scrollToGoldenZone(confirmBtn);
          } catch (_error) {
            void _error;
          }
        }
        await this.agent.humanClick(confirmBtn, "Retweet Confirm");
        this.logger.info("[RetweetAction] Confirmed retweet via menu");
        
      } catch (menuError) {
        this.logger.warn(`[RetweetAction] Retweet menu did not appear or confirm button missing: ${menuError.message}`);
        // Attempt to close any open menus/modals to reset state
        await page.keyboard.press("Escape");
        return { success: false, reason: "retweet_menu_failed" };
      }

      // 6. VERIFICATION CHECKER: Wait for state change
      // The "retweet" button should disappear and "unretweet" should appear
      try {
        await tweetElement.locator(unretweetBtnSelector).first().waitFor({ state: 'visible', timeout: 5000 });
        
        // Success! Record engagement
        if (this.agent.diveQueue) {
          this.agent.diveQueue.recordEngagement("retweets");
        }
        
        return { success: true, reason: "retweet_successful" };
        
      } catch (_verifyError) {
        this.logger.warn("[RetweetAction] Verification failed - 'unretweet' state did not appear");
        return { success: false, reason: "retweet_verification_failed" };
      }

    } catch (error) {
      this.logger.error(
        `[RetweetAction] Error during retweet: ${error.message}`,
      );
      return { success: false, reason: `error: ${error.message}` };
    }
  }

  getStats() {
    const total = this.stats.attempts;
    const successRate =
      total > 0 ? ((this.stats.successes / total) * 100).toFixed(1) : "0.0";

    return {
      attempts: this.stats.attempts,
      successes: this.stats.successes,
      failures: this.stats.failures,
      skipped: this.stats.skipped,
      successRate: `${successRate}%`,
      engagementType: this.engagementType,
    };
  }

  resetStats() {
    this.stats = {
      attempts: 0,
      successes: 0,
      failures: 0,
      skipped: 0,
    };
  }
}
