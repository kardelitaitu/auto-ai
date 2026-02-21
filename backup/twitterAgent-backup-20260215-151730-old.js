import { mathUtils } from '../utils/mathUtils.js';
import { GhostCursor } from '../utils/ghostCursor.js';
import { HumanizationEngine } from '../utils/humanization/index.js';

// Sub-handlers for modularization
import { InteractionHandler } from '../utils/twitter-agent/InteractionHandler.js';
import { NavigationHandler } from '../utils/twitter-agent/NavigationHandler.js';
import { EngagementHandler } from '../utils/twitter-agent/EngagementHandler.js';
import { SessionHandler } from '../utils/twitter-agent/SessionHandler.js';

export class TwitterAgent {
    constructor(page, initialProfile, logger) {
        this.page = page;
        this.config = initialProfile;
        this.logger = logger;
        this.ghost = new GhostCursor(page);

        // Humanization Engine
        this.human = new HumanizationEngine(page, this);

        // Session state model
        this.sessionStart = Date.now();
        this.sessionEndTime = null;
        this.loopIndex = 0;
        this.state = {
            lastRefreshAt: 0,
            lastEngagementAt: 0,
            engagements: 0,
            tabs: { preferForYou: true, switchChance: 0.15 },
            fatigueBias: 0,
            consecutiveLoginFailures: 0,
            likes: 0,
            follows: 0,
            retweets: 0,
            tweets: 0,
            activityMode: 'NORMAL', // NORMAL | BURST
            burstEndTime: 0,
            consecutiveSoftErrors: 0
        };

        // Fatigue trigger between 3 and 8 minutes
        this.isFatigued = false;
        this.fatigueThreshold = mathUtils.randomInRange(3 * 60 * 1000, 8 * 60 * 1000);

        this.log(`Initialized [${this.config.description}]. Fatigue scheduled for T+${(this.fatigueThreshold / 60000).toFixed(1)}m`);

        // --- HEALTH MONITORING ---
        this.lastNetworkActivity = Date.now();
        try {
            this.page.on('request', () => { this.lastNetworkActivity = Date.now(); });
            this.page.on('response', () => { this.lastNetworkActivity = Date.now(); });
        } catch (e) {
            this.log(`[Warning] Failed to attach network listeners: ${e.message}`);
        }

        // --- MODULAR HANDLERS ---
        this.interaction = new InteractionHandler(this);
        this.navigation = new NavigationHandler(this);
        this.engagement = new EngagementHandler(this);
        this.session = new SessionHandler(this);
    }

    // --- LOGGING & UTILS ---
    log(msg) {
        if (this.logger) {
            this.logger.info(`[Agent:${this.config.id}] ${msg}`);
        } else {
            console.log(`[Agent:${this.config.id}] ${msg}`);
        }
    }

    clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

    normalizeProbabilities(probs) {
        const total = Object.values(probs).reduce((a, b) => a + b, 0);
        if (total === 0) return probs;
        const normalized = {};
        for (const [key, val] of Object.entries(probs)) {
            normalized[key] = val / total;
        }
        return normalized;
    }

    isSessionExpired() {
        if (!this.sessionEndTime) return false;
        return Date.now() > this.sessionEndTime;
    }

    // --- DELEGATION (BACKWARD COMPATIBILITY) ---

    // BaseHandler Delegation
    async wait(min, max) { return this.interaction.wait(min, max); }

    // Interaction Delegation
    async humanClick(target, description) { return this.interaction.humanClick(target, description); }
    async safeHumanClick(target, description, retries) { return this.interaction.safeHumanClick(target, description, retries); }
    async isElementActionable(element) { return this.interaction.isElementActionable(element); }
    async scrollToGoldenZone(element) { return this.interaction.scrollToGoldenZone(element); }
    async dismissOverlays() { return this.interaction.dismissOverlays(); }
    async sixLayerClick(element, logPrefix) { return this.interaction.sixLayerClick(element, logPrefix); }
    async simulateFidget() { return this.interaction.simulateFidget(); }
    async humanType(element, text) { return this.interaction.humanType(element, text); }

    // Navigation Delegation
    async navigateHome() { return this.navigation.navigateHome(); }
    async ensureForYouTab() { return this.navigation.ensureForYouTab(); }
    async checkAndClickShowPostsButton() { return this.navigation.checkAndClickShowPostsButton(); }

    // Engagement Delegation
    async robustFollow(logPrefix, reloadUrl) { return this.engagement.robustFollow(logPrefix, reloadUrl); }
    async pollForFollowState(unfollowBtn, logPrefix) { return this.engagement.pollForFollowState(unfollowBtn, logPrefix); }
    async diveTweet() { return this.engagement.diveTweet(); }
    async diveProfile() { return this.engagement.diveProfile(); }
    async postTweet(text) { return this.engagement.postTweet(text); }

    // Session Delegation
    async checkLoginState() { return this.session.checkLoginState(); }
    async performHealthCheck() { return this.session.performHealthCheck(); }
    async checkAndHandleSoftError(reloadUrl) { return this.session.checkAndHandleSoftError(reloadUrl); }
    async simulateReading() { return this.session.simulateReading(); }
    async runSession(options) { return this.session.runSession(options); }
}
