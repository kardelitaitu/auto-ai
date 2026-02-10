/**
 * Content Skimmer
 * Human-like content consumption patterns
 * 
 * Human Reading Patterns:
 * 1. Quick glance (1-2s) - "What is this?"
 * 2. Scan (2-4s) - "Is this interesting?"
 * 3. Read (4-8s) - "Let me understand this"
 * 4. Deep read (8-15s) - "This is interesting!"
 */

import { mathUtils } from '../mathUtils.js';
import { entropy } from '../entropyController.js';
import { scrollRandom } from '../scroll-helper.js';

export class ContentSkimmer {
    constructor(page, logger) {
        this.page = page;
        this.logger = logger;
        this.agent = null;
    }
    
    setAgent(agent) {
        this.agent = agent;
    }
    
    /**
     * Main content consumption method
     * 
     * @param {string} type - 'tweet', 'thread', 'media', 'profile'
     * @param {string} duration - 'glance', 'skim', 'read', 'deep'
     */
    async skipping(type = 'tweet', duration = 'skim') {
        const durationConfig = {
            glance: { read: 1000, scroll: 50, pause: 500 },
            skim: { read: 2500, scroll: 100, pause: 1000 },
            read: { read: 5000, scroll: 150, pause: 1500 },
            deep: { read: 10000, scroll: 200, pause: 2500 }
        };
        
        const config = durationConfig[duration] || durationConfig.skim;
        
        switch (type) {
            case 'tweet':
                await this._skimTweet(config);
                break;
            case 'thread':
                await this._skimThread(config);
                break;
            case 'media':
                await this._skimMedia(config);
                break;
            case 'profile':
                await this._skimProfile(config);
                break;
            default:
                await this._skimTweet(config);
        }
    }
    
    /**
     * Reading behavior (for "reading" logs)
     */
    async reading(duration = 'normal') {
        const durationMap = {
            quick: { min: 1000, max: 2000 },
            normal: { min: 2000, max: 4000 },
            long: { min: 4000, max: 8000 }
        };
        
        const config = durationMap[duration] || durationMap.normal;
        const readTime = mathUtils.randomInRange(config.min, config.max);
        
        await this.page.waitForTimeout(readTime);
        
        if (this.agent) {
            this.agent.log(`[Read] Reading for ${readTime}ms...`);
        }
    }
    
    // ==========================================
    // PRIVATE METHODS
    // ==========================================
    
    /**
     * Skim a single tweet
     */
    async _skimTweet(config) {
        // Quick glance
        await this.page.waitForTimeout(config.read);
        
        // Sometimes scroll a bit
        if (mathUtils.roll(0.3)) {
            await scrollRandom(this.page, config.scroll, config.scroll);
            await this.page.waitForTimeout(config.pause);
        }
        
        // Micro-adjustments
        await this._microAdjustments(2);
    }
    
    /**
     * Skim a thread
     */
    async _skimThread(config) {
        // Read first tweet
        await this.page.waitForTimeout(config.read);
        
        // Scroll through thread (2-4 tweets)
        const tweetCount = mathUtils.randomInRange(2, 4);
        
        for (let i = 0; i < tweetCount; i++) {
            await scrollRandom(this.page, config.scroll, config.scroll);
            await this.page.waitForTimeout(config.pause);
        }
        
        // Go back up slightly (finished reading)
        if (mathUtils.roll(0.5)) {
            await scrollRandom(this.page, 100, 200);
        }
    }
    
    /**
     * Skim media (image/video)
     */
    async _skimMedia(config) {
        // Quick glance at media
        await this.page.waitForTimeout(config.read * 0.5);
        
        // Sometimes zoom or interact
        if (mathUtils.roll(0.2)) {
            // Simulate "looking closer"
            await scrollRandom(this.page, config.scroll, config.scroll);
        }
        
        await this.page.waitForTimeout(config.pause);
    }
    
    /**
     * Skim profile
     */
    async _skimProfile(config) {
        // Check profile info
        await this.page.waitForTimeout(config.read);
        
        // Scroll through bio and recent tweets
        await scrollRandom(this.page, config.scroll * 2, config.scroll * 2);
        await this.page.waitForTimeout(config.pause);
        
        // Sometimes check pinned tweet
        if (mathUtils.roll(0.3)) {
            await this.page.waitForTimeout(2000);
        }
    }
    
    /**
     * Micro-adjustments during "reading"
     */
    async _microAdjustments(count = 3) {
        for (let i = 0; i < count; i++) {
            // Tiny random movements
            const x = mathUtils.randomInRange(-20, 20);
            const y = mathUtils.randomInRange(-10, 10);
            await this.page.mouse.move(x, y);
            await this.page.waitForTimeout(mathUtils.randomInRange(100, 300));
        }
    }
    
    // ==========================================
    // SPECIALIZED PATTERNS
    // ==========================================
    
    /**
     * "Skimming" pattern - quick scan through feed
     */
    async skimFeed() {
        const cycleCount = mathUtils.randomInRange(3, 6);
        
        for (let i = 0; i < cycleCount; i++) {
            // Quick scroll
            await scrollRandom(this.page, 100, 200);
            
            // Brief pause (glance)
            await this.page.waitForTimeout(mathUtils.randomInRange(200, 500));
            
            // Occasional stop (interesting content)
            if (mathUtils.roll(0.2)) {
                await this.page.waitForTimeout(mathUtils.randomInRange(1000, 2000));
            }
        }
    }
    
    /**
     * "Deep reading" pattern - focus on interesting content
     */
    async deepRead() {
        // Settle in
        await this.page.waitForTimeout(1000);
        
        // Read for extended period
        await this.page.waitForTimeout(mathUtils.randomInRange(5000, 10000));
        
        // Occasional note-taking (bookmark/save)
        if (mathUtils.roll(0.2)) {
            // Simulate "bookmarking for later"
            await this.page.waitForTimeout(2000);
        }
    }
    
    /**
     * "Quick glance" pattern - almost no time
     */
    async quickGlance() {
        await this.page.waitForTimeout(mathUtils.randomInRange(500, 1000));
        
        // Tiny movement to show "looking"
        await this.page.mouse.move(mathUtils.randomInRange(-10, 10), 0);
    }
}

export default ContentSkimmer;
