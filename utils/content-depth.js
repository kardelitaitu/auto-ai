/**
 * Content Depth Module
 * Simulates rich content interactions:
 * - Video engagement (unmute/watch)
 * - Poll participation
 * - Image expansion
 * - Link hoarding (copy link)
 * 
 * @module utils/content-depth
 */

const CONTENT_CONFIG = {
    videoWatchChance: 0.4,
    videoDuration: { min: 10000, max: 30000 },
    pollParticipationChance: 0.3,
    imageExpandChance: 0.3,
    copyLinkChance: 0.3,
    mediaViewTime: { min: 2000, max: 5000 }
};

function createContentHandler(options = {}) {
    const config = { ...CONTENT_CONFIG, ...options };
    
    return {
        config,
        
        async detectContentType(page) {
            const indicators = {
                video: await page.$$('[data-testid="videoPlayer"], video, [data-testid="card.layout.media"]'),
                poll: await page.$$('[data-testid="polls"]'),
                image: await page.$$('[data-testid="tweetPhoto"], [data-testid="card.layout.media"]'),
                link: await page.$$('a[href*="http"]'),
                thread: await page.$$('[data-testid="tweetThread"]')
            };
            
            const types = [];
            for (const [type, elements] of Object.entries(indicators)) {
                if (elements.length > 0) {
                    types.push(type);
                }
            }
            
            return types;
        },
        
        async engageWithVideo(page, options = {}) {
            const { logger = console, selector = '[data-testid="videoPlayer"]' } = options;
            
            try {
                const video = await page.$(selector);
                
                if (!video) {
                    return { success: false, reason: 'no_video' };
                }
                
                const watchChance = config.videoWatchChance;
                
                if (Math.random() > watchChance) {
                    logger.info(`[Content] Skipping video (${(watchChance * 100).toFixed(0)}% watch threshold)`);
                    return { success: true, action: 'skipped' };
                }
                
                const duration = mathUtils.randomInRange(config.videoDuration.min, config.videoDuration.max);
                
                logger.info(`[Content] Watching video for ${(duration / 1000).toFixed(1)}s`);
                
                await video.click();
                await page.waitForTimeout(1000);
                
                await page.waitForTimeout(duration);
                
                await page.keyboard.press('Escape');
                
                return { success: true, action: 'watched', duration };
                
            } catch (error) {
                logger.error(`[Content] Video engagement error: ${error.message}`);
                return { success: false, reason: error.message };
            }
        },
        
        async participateInPoll(page, options = {}) {
            const { logger = console, selector = '[data-testid="polls"]' } = options;
            
            try {
                const poll = await page.$(selector);
                
                if (!poll) {
                    return { success: false, reason: 'no_poll' };
                }
                
                if (Math.random() > config.pollParticipationChance) {
                    logger.info(`[Content] Skipping poll`);
                    return { success: true, action: 'skipped' };
                }
                
                const options = await poll.$$('[data-testid="pollOption"]');
                
                if (options.length === 0) {
                    return { success: false, reason: 'no_options' };
                }
                
                const selectedIndex = Math.floor(Math.random() * options.length);
                const selected = options[selectedIndex];
                
                logger.info(`[Content] Voting on poll option ${selectedIndex + 1}/${options.length}`);
                
                await selected.click();
                
                await page.waitForTimeout(500);
                
                return { success: true, action: 'voted', option: selectedIndex + 1 };
                
            } catch (error) {
                logger.error(`[Content] Poll participation error: ${error.message}`);
                return { success: false, reason: error.message };
            }
        },
        
        async expandImage(page, options = {}) {
            const { logger = console, selector = '[data-testid="tweetPhoto"]' } = options;
            
            try {
                const image = await page.$(selector);
                
                if (!image) {
                    return { success: false, reason: 'no_image' };
                }
                
                if (Math.random() > config.imageExpandChance) {
                    logger.info(`[Content] Skipping image expand`);
                    return { success: true, action: 'skipped' };
                }
                
                logger.info(`[Content] Expanding image`);
                
                await image.click();
                
                const viewTime = mathUtils.randomInRange(config.mediaViewTime.min, config.mediaViewTime.max);
                
                await page.waitForTimeout(viewTime);
                
                await page.keyboard.press('Escape');
                
                return { success: true, action: 'expanded', viewTime };
                
            } catch (error) {
                logger.error(`[Content] Image expand error: ${error.message}`);
                return { success: false, reason: error.message };
            }
        },
        
        async copyLink(page, options = {}) {
            const { logger = console, selector = '[aria-label="Share post"]' } = options;
            
            try {
                const shareBtn = await page.$(selector);
                
                if (!shareBtn) {
                    return { success: false, reason: 'no_share_button' };
                }
                
                if (Math.random() > config.copyLinkChance) {
                    logger.info(`[Content] Skipping link copy`);
                    return { success: true, action: 'skipped' };
                }
                
                logger.info(`[Content] Copying link (shadow sharing)`);
                
                await shareBtn.click();
                
                await page.waitForTimeout(500);
                
                const copyLink = await page.$('text="Copy link"');
                
                if (copyLink) {
                    await copyLink.click();
                    
                    await page.waitForTimeout(500);
                    
                    logger.info(`[Content] Link copied to clipboard`);
                    
                    return { success: true, action: 'copied' };
                }
                
                await page.keyboard.press('Escape');
                
                return { success: false, reason: 'copy_option_not_found' };
                
            } catch (error) {
                logger.error(`[Content] Link copy error: ${error.message}`);
                return { success: false, reason: error.message };
            }
        },
        
        async engageWithContent(page, options = {}) {
            const { logger = console } = options;
            
            const contentTypes = await this.detectContentType(page);
            
            logger.info(`[Content] Detected types: ${contentTypes.join(', ') || 'none'}`);
            
            const actions = [];
            
            for (const type of contentTypes) {
                let result;
                
                switch (type) {
                    case 'video':
                        result = await this.engageWithVideo(page, { logger });
                        break;
                    case 'poll':
                        result = await this.participateInPoll(page, { logger });
                        break;
                    case 'image':
                        result = await this.expandImage(page, { logger });
                        break;
                    case 'link':
                        result = await this.copyLink(page, { logger });
                        break;
                }
                
                if (result && result.success) {
                    actions.push({ type, ...result });
                }
            }
            
            return {
                success: true,
                contentTypes,
                actions
            };
        },
        
        async viewMedia(page, options = {}) {
            const { logger = console, mediaType = 'auto' } = options;
            
            try {
                let selector;
                
                if (mediaType === 'image') {
                    selector = '[data-testid="tweetPhoto"]';
                } else if (mediaType === 'video') {
                    selector = '[data-testid="videoPlayer"]';
                } else {
                    selector = '[data-testid="tweetPhoto"], [data-testid="videoPlayer"]';
                }
                
                const media = await page.$(selector);
                
                if (!media) {
                    return { success: false, reason: 'no_media' };
                }
                
                await media.click();
                
                const viewTime = mathUtils.randomInRange(config.mediaViewTime.min, config.mediaViewTime.max);
                
                logger.info(`[Content] Viewing media for ${(viewTime / 1000).toFixed(1)}s`);
                
                await page.waitForTimeout(viewTime);
                
                await page.keyboard.press('Escape');
                
                return { success: true, action: 'viewed', viewTime };
                
            } catch (error) {
                logger.error(`[Content] Media view error: ${error.message}`);
                return { success: false, reason: error.message };
            }
        }
    };
}

function mathUtils() {
    return {
        randomInRange(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    };
}

export const contentDepth = {
    createContentHandler,
    defaults: CONTENT_CONFIG
};

export default contentDepth;
