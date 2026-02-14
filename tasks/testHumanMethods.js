/**
 * @fileoverview Human Methods Tester Task
 * Tests reply and quote methods individually on a specific tweet
 * 
 * Usage:
 *   node main.js testHumanMethods targetUrl=https://x.com/CJnDrama/status/2020768399064961496 method=replyA
 *   node main.js testHumanMethods targetUrl=https://x.com/username/status/123 method=quoteA
 *   node main.js testHumanMethods targetUrl=https://x.com/username/status/123 method=extractOnly mode=test
 * 
 * Reply Methods:
 *   replyA - Keyboard shortcut (R key)
 *   replyB - Button click (reply button)
 *   replyC - Direct composer focus (click reply box directly)
 * 
 * Quote Methods:
 *   quoteA - Keyboard compose (T key)
 *   quoteB - Retweet menu
 *   quoteC - Quote URL
 *   quoteD - Copy-paste
 * 
 * Other:
 *   extractOnly - Just extract replies without posting
 * 
 * Modes:
 *   test (default) - Full test with posting
 *   safe - Extract replies and generate content but don't post
 */

import { createLogger } from '../utils/logger.js';
import { getSettings } from '../utils/configLoader.js';
import { AIReplyEngine } from '../utils/ai-reply-engine.js';
import { AIQuoteEngine } from '../utils/ai-quote-engine.js';
import { AIContextEngine } from '../utils/ai-context-engine.js';
import { profileManager } from '../utils/profileManager.js';
import { mathUtils } from '../utils/mathUtils.js';
import { HumanInteraction } from '../utils/human-interaction.js';
import { applyHumanizationPatch } from '../utils/browserPatch.js';
import { config } from '../utils/config-service.js';
import AgentConnector from '../core/agent-connector.js';
import { FreeOpenRouterHelper } from '../utils/free-openrouter-helper.js';
import { replyMethods, quoteMethods, executeReplyMethod, executeQuoteMethod } from '../utils/twitter-interaction-methods.js';

const logger = createLogger('testHumanMethods.js');

export default async function testHumanMethodsTask(page, payload) {
    const TARGET_URL = payload?.targetUrl || 'https://x.com/CJnDrama/status/2020768399064961496';
    const TEST_METHOD = payload?.method || 'replyA';
    const TEST_MODE = payload?.mode || 'test'; // 'test' or 'safe'

    logger.info(`[TestHumanMethods] Starting...`);
    logger.info(`[TestHumanMethods] Target URL: ${TARGET_URL}`);
    logger.info(`[TestHumanMethods] Test Method: ${TEST_METHOD}`);
    logger.info(`[TestHumanMethods] Test Mode: ${TEST_MODE}`);
    
    if (TEST_MODE === 'safe') {
        logger.info(`[TestHumanMethods] SAFE MODE - Will NOT post to Twitter`);
    }

    await config.init();
    const settings = await getSettings();
    const twitterSettings = settings?.twitter || {};

    const agentConnector = new AgentConnector();
    const replyEngine = new AIReplyEngine(agentConnector, {
        replyProbability: twitterSettings.reply?.probability ?? 0.5,
        maxRetries: 2
    });
    const quoteEngine = new AIQuoteEngine(agentConnector, {
        quoteProbability: twitterSettings.quote?.probability ?? 0.5,
        maxRetries: 2
    });
    const contextEngine = new AIContextEngine({
        maxReplies: 30,
        sentimentThreshold: 0.3,
        includeMetrics: true
    });

    const human = new HumanInteraction();
    human.debugMode = true;

    /**
     * Wait for router tests to complete before making LLM requests
     * Returns true if ready, false on timeout
     */
    async function waitForRouterReady(maxWait = 60000) {
        const routerHelper = FreeOpenRouterHelper.getInstance();

        if (!routerHelper.isTesting()) {
            return { ready: true, models: routerHelper.getResults()?.working?.length || 0 };
        }

        logger.info(`[TestHumanMethods] Router tests running, waiting...`);
        await routerHelper.waitForTests(maxWait);

        if (routerHelper.isTesting()) {
            logger.error(`[TestHumanMethods] ✗ Router tests timeout after ${maxWait}ms`);
            return { ready: false, error: 'timeout' };
        }

        const workingCount = routerHelper.getResults()?.working?.length || 0;
        logger.info(`[TestHumanMethods] ✓ Router ready (${workingCount} models working)`);
        return { ready: true, models: workingCount };
    }

    /**
     * Simple tweet text extraction with fallback selectors
     */
    async function extractTweetText(page) {
        const selectors = [
            '[data-testid="tweetText"]',
            '[class*="tweetText"]',
            '[class*="tweet-text"]',
            '[class*="TweetText"]',
            'article [dir="auto"]',
            '[role="article"] [dir="auto"]'
        ];

        for (const selector of selectors) {
            try {
                const elements = await page.$$(selector);
                for (const el of elements) {
                    const text = await el.innerText();
                    if (text && text.length > 10 && text.length < 500) {
                        return { text, selector };
                    }
                }
            } catch {
                continue;
            }
        }
        return null;
    }

    try {
        await applyHumanizationPatch(page, logger);

        logger.info(`[TestHumanMethods] Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 30000 });
        
        // Enforce dark theme IMMEDIATELY to prevent light mode flash
        logger.info(`[TestHumanMethods] Enforcing dark theme...`);
        await page.emulateMedia({ colorScheme: 'dark' });
        
        // Wait for content to settle
        await page.waitForTimeout(5000);

        // Extract tweet text
        let mainTweetText = null;
        let tweetFound = false;
        
        const tweetResult = await extractTweetText(page);
        
        if (tweetResult) {
            logger.info(`[TestHumanMethods] ✓ Found tweet with selector: ${tweetResult.selector}`);
            logger.info(`[TestHumanMethods] Main Tweet: "${tweetResult.text.substring(0, 80)}..."`);
            mainTweetText = tweetResult.text;
            tweetFound = true;
        } else {
            logger.warn(`[TestHumanMethods] No tweet found, refreshing...`);
            await page.reload({ waitUntil: 'load' });
            await page.emulateMedia({ colorScheme: 'dark' }); // Re-apply after refresh
            await page.waitForTimeout(5000);
            
            const retryResult = await extractTweetText(page);
            if (retryResult) {
                logger.info(`[TestHumanMethods] ✓ Found tweet after refresh`);
                logger.info(`[TestHumanMethods] Main Tweet: "${retryResult.text.substring(0, 80)}..."`);
                mainTweetText = retryResult.text;
                tweetFound = true;
            }
        }

        if (!tweetFound) {
            logger.error(`[TestHumanMethods] ✗ Could not extract tweet text`);
            return;
        }

        let replyContext = [];
        let isReply = TEST_METHOD.startsWith('reply');
        let isExtractOnly = TEST_METHOD.toLowerCase() === 'extractonly';

        // Handle extractOnly mode
        if (isExtractOnly) {
            logger.info(`[TestHumanMethods] ===== EXTRACT ONLY MODE =====`);
            try {
                logger.info(`[TestHumanMethods] Extracting replies for LLM context...`);
                replyContext = await contextEngine.extractRepliesSmart(page);
                logger.info(`[TestHumanMethods] Extracted ${replyContext.length} replies`);
                
                if (replyContext.length > 0) {
                    logger.info(`[TestHumanMethods] All extracted replies:`);
                    replyContext.forEach((r, i) => {
                        logger.info(`[TestHumanMethods]   [${i+1}] @${r.author}: "${r.text.substring(0, 80)}..."`);
                    });
                    
                    // Generate a reply using AI but don't post
                    if (mainTweetText && mainTweetText !== 'NOT FOUND') {
                        logger.info(`[TestHumanMethods] Generating AI reply (not posting)...`);
                        const generated = await replyEngine.generateReply(mainTweetText, 'test_user', {
                            replies: replyContext
                        });
                        if (generated.reply) {
                            logger.info(`[TestHumanMethods] ✓ AI Generated Reply: "${generated.reply}"`);
                        }
                    }
                } else {
                    logger.warn(`[TestHumanMethods] No replies extracted - trying different extraction strategy...`);
                    // Fallback: Simple extraction without scrolling
                    const simpleReplies = await page.$$('[data-testid="tweetText"]');
                    logger.info(`[TestHumanMethods] Found ${simpleReplies.length} tweetText elements`);
                    
                    for (const el of simpleReplies.slice(1, 20)) {
                        try {
                            const text = await el.innerText();
                            if (text && text.length > 2) {
                                logger.info(`[TestHumanMethods]   - "${text.substring(0, 60)}..."`);
                            }
                        } catch {
                            continue;
                        }
                    }
                }
            } catch (e) {
                logger.error(`[TestHumanMethods] Extraction error: ${e.message}`);
            }
            
            logger.info(`[TestHumanMethods] Extract only mode completed.`);
            await page.waitForTimeout(2000);
            return;
        }

        if (mainTweetText && mainTweetText !== 'NOT FOUND' && mainTweetText.length > 5) {
            try {
                logger.info(`[TestHumanMethods] Extracting replies for LLM context...`);
                replyContext = await contextEngine.extractRepliesSmart(page);
                logger.info(`[TestHumanMethods] Extracted ${replyContext.length} replies for context`);
                
                if (replyContext.length > 0) {
                    logger.info(`[TestHumanMethods] Sample replies:`);
                    replyContext.slice(0, 5).forEach((r, i) => {
                        logger.info(`[TestHumanMethods]   [${i+1}] @${r.author}: "${r.text.substring(0, 60)}..."`);
                    });
                } else {
                    logger.info(`[TestHumanMethods] No replies extracted - will generate reply without context`);
                }
            } catch (e) {
                logger.warn(`[TestHumanMethods] Reply extraction warning: ${e.message}`);
            }

            try {
                logger.info(`[TestHumanMethods] Generating ${isReply ? 'reply' : 'quote'} using AI...`);

                if (isReply) {
                    // For replyC, wait for router tests to complete
                    if (TEST_METHOD.toLowerCase() === 'replyc') {
                        const routerStatus = await waitForRouterReady(60000);
                        if (!routerStatus.ready) {
                            logger.error(`[TestHumanMethods] ✗ Aborting replyC - router not ready`);
                            return;
                        }
                    }

                    const decision = await replyEngine.shouldReply(mainTweetText, 'test_user', {});
                    if (decision.decision === 'proceed') {
                        const generated = await replyEngine.generateReply(mainTweetText, 'test_user', {
                            replies: replyContext
                        });
                        if (generated.reply) {
                            logger.info(`[TestHumanMethods] ✓ AI Generated Reply: "${generated.reply.substring(0, 50)}..."`);
                            
                            logger.info(`[TestHumanMethods] ===== TESTING ${TEST_METHOD.toUpperCase()} =====`);
                            
                            if (TEST_MODE === 'safe') {
                                logger.info(`[TestHumanMethods] SAFE MODE - Would have posted: "${generated.reply.substring(0, 50)}..."`);
                                logger.info(`[TestHumanMethods] Composer verification:`);
                                const verify = await human.verifyComposerOpen(page);
                                if (verify.open) {
                                    logger.info(`[TestHumanMethods] ✓ Composer opened successfully with selector: ${verify.selector}`);
                                    logger.info(`[TestHumanMethods] SAFE MODE - Closing composer without posting...`);
                                    await page.keyboard.press('Escape');
                                    await page.waitForTimeout(500);
                                } else {
                                    logger.warn(`[TestHumanMethods] Composer did not open`);
                                }
                            } else {
                                await testReplyMethod(page, TEST_METHOD, generated.reply, replyEngine, human, logger);
                            }
                        } else {
                            logger.warn(`[TestHumanMethods] ✗ AI did not generate reply`);
                        }
                    } else {
                        logger.info(`[TestHumanMethods] AI skipped reply (probability) - FORCING for testing...`);
                        
                        // For replyC, wait for router tests even in forcing mode
                        if (TEST_METHOD.toLowerCase() === 'replyc') {
                            const routerStatus = await waitForRouterReady(60000);
                            if (!routerStatus.ready) {
                                logger.error(`[TestHumanMethods] ✗ Aborting replyC - router not ready`);
                                return;
                            }
                        }
                        
                        const generated = await replyEngine.generateReply(mainTweetText, 'test_user', {
                            replies: replyContext
                        });
                        if (generated.reply) {
                            logger.info(`[TestHumanMethods] ✓ AI Generated Reply: "${generated.reply.substring(0, 50)}..."`);
                            
                            logger.info(`[TestHumanMethods] ===== TESTING ${TEST_METHOD.toUpperCase()} =====`);
                            
                            if (TEST_MODE === 'safe') {
                                logger.info(`[TestHumanMethods] SAFE MODE - Would have posted: "${generated.reply.substring(0, 50)}..."`);
                                const verify = await human.verifyComposerOpen(page);
                                if (verify.open) {
                                    logger.info(`[TestHumanMethods] ✓ Composer opened - closing without posting`);
                                    await page.keyboard.press('Escape');
                                    await page.waitForTimeout(500);
                                }
                            } else {
                                await testReplyMethod(page, TEST_METHOD, generated.reply, replyEngine, human, logger);
                            }
                        }
                    }
                } else {
                    const generated = await quoteEngine.generateQuote(mainTweetText, 'test_user', {
                        replies: replyContext
                    });
                    if (generated.quote) {
                        logger.info(`[TestHumanMethods] ✓ AI Generated Quote: "${generated.quote.substring(0, 50)}..."`);
                        
                        logger.info(`[TestHumanMethods] ===== TESTING ${TEST_METHOD.toUpperCase()} =====`);
                        
                        if (TEST_MODE === 'safe') {
                            logger.info(`[TestHumanMethods] SAFE MODE - Would have quoted: "${generated.quote.substring(0, 50)}..."`);
                            const verify = await human.verifyComposerOpen(page);
                            if (verify.open) {
                                logger.info(`[TestHumanMethods] ✓ Composer opened - closing without posting`);
                                await page.keyboard.press('Escape');
                                await page.waitForTimeout(500);
                            }
                        } else {
                            await testQuoteMethod(page, TEST_METHOD, generated.quote, quoteEngine, human, logger);
                        }
                    } else {
                        logger.warn(`[TestHumanMethods] ✗ AI did not generate quote`);
                    }
                }
            } catch (e) {
                logger.error(`[TestHumanMethods] AI generation error: ${e.message}`);
            }
        } else {
            logger.warn(`[TestHumanMethods] Could not extract tweet text`);
        }

        logger.info(`[TestHumanMethods] Test completed. Waiting 10s for review...`);
        await page.waitForTimeout(10000);

    } catch (error) {
        logger.error(`[TestHumanMethods] Error: ${error.message}`);
    } finally {
        try { if (page && !page.isClosed()) await page.close(); } catch { logger.warn('[TestHumanMethods] Failed to close page'); }
        logger.info(`[TestHumanMethods] Done.`);
    }
}

async function testReplyMethod(page, method, text, engine, human, logger) {
    logger.info(`[TestHumanMethods] ===== TESTING REPLY METHOD: ${method} =====`);

    // Use modularized methods for replyC
    if (method.toLowerCase() === 'replyc' || method.toLowerCase() === 'replyc_focus' || method.toLowerCase() === 'replyc_direct') {
        const result = await executeReplyMethod('replyC', page, text, human, logger);
        if (result.success) {
            logger.info(`[TestHumanMethods] ✓ Reply posted successfully via ${result.method}`);
        } else {
            logger.warn(`[TestHumanMethods] ✗ Post failed: ${result.reason}`);
        }
        return;
    }

    switch (method.toLowerCase()) {
        case 'replya':
        case 'replya_keyboard': {
            logger.info(`[TestHumanMethods] Method A: Keyboard Shortcut (R key)`);
            
            let replyARetries = 0;
            const maxReplyARetries = 2;
            let composerOpened = false;

            while (!composerOpened && replyARetries <= maxReplyARetries) {
                if (replyARetries > 0) {
                    logger.info(`[TestHumanMethods] Retry attempt ${replyARetries}/${maxReplyARetries}...`);
                    await page.waitForTimeout(500);
                }

                // Reset state
                await page.evaluate(() => window.scrollTo(0, 0));
                await page.waitForTimeout(500);

                // Step 1: Click main tweet timestamp to ensure focus
                logger.info(`[TestHumanMethods] Clicking main tweet to focus...`);
                const timeElement = page.locator('article time').first();
                if (await timeElement.count() > 0) {
                    await timeElement.click({ timeout: 3000 });
                    logger.info(`[TestHumanMethods] Clicked tweet timestamp`);
                } else {
                    // Fallback: click tweet text
                    const tweetText = page.locator('[data-testid="tweetText"]').first();
                    if (await tweetText.count() > 0) {
                        await tweetText.click({ offset: { x: 10, y: 10 }, timeout: 3000 });
                        logger.info(`[TestHumanMethods] Clicked tweet text (fallback)`);
                    }
                }
                await page.waitForTimeout(300);

                // Step 2: Verify tweet is focused
                const focusCheck = await page.evaluate(() => {
                    const active = document.activeElement;
                    const article = active?.closest('article');
                    return {
                        tagName: active?.tagName,
                        hasTweetText: active?.innerText?.includes('@') || active?.closest('[data-testid="tweetText"]') !== null,
                        inArticle: article !== null,
                        ariaLabel: active?.getAttribute('aria-label') || ''
                    };
                });
                logger.info(`[TestHumanMethods] Focus check: ${JSON.stringify(focusCheck)}`);

                // If focus not verified, try alternative
                if (!focusCheck.inArticle) {
                    logger.warn(`[TestHumanMethods] Tweet not focused, trying alternative...`);
                    const tweetText2 = page.locator('[data-testid="tweetText"]').first();
                    if (await tweetText2.count() > 0) {
                        await tweetText2.click({ offset: { x: 5, y: 5 }, force: true });
                        await page.waitForTimeout(300);
                    }
                }

                // Step 3: Press R to open reply composer
                await page.keyboard.press('r');
                logger.info(`[TestHumanMethods] Pressed R - waiting for composer...`);
                await page.waitForTimeout(2000);

                // Step 4: Verify composer opened
                const verifyA = await human.verifyComposerOpen(page);
                
                if (verifyA.open) {
                    composerOpened = true;
                    logger.info(`[TestHumanMethods] ✓ Composer opened with selector: ${verifyA.selector}`);
                    
                    // Use the locator from verifyComposerOpen for best results
                    const composerA = verifyA.locator || page.locator(verifyA.selector).first();
                    
                    // Additional check: ensure we have the right element
                    const composerInfo = await page.evaluate((sel) => {
                        const el = document.querySelector(sel);
                        if (el) {
                            return {
                                tagName: el.tagName,
                                isContentEditable: el.isContentEditable,
                                placeholder: el.getAttribute('placeholder') || '',
                                boundingBox: el.getBoundingClientRect ? 'found' : 'none'
                            };
                        }
                        return null;
                    }, verifyA.selector);
                    
                    logger.info(`[TestHumanMethods] Composer element: ${JSON.stringify(composerInfo)}`);
                    
                    logger.info(`[TestHumanMethods] Attempting to type...`);
                    await human.typeText(page, text, composerA);
                    logger.info(`[TestHumanMethods] Typing complete - attempting post...`);
                    
                    const postA = await human.postTweet(page);
                    if (postA.success) {
                        logger.info(`[TestHumanMethods] ✓ Reply posted successfully via ${postA.method}`);
                    } else {
                        logger.warn(`[TestHumanMethods] ✗ Post failed: ${postA.reason}`);
                    }
                } else {
                    logger.warn(`[TestHumanMethods] ✗ Composer did not open on attempt ${replyARetries}`);
                    replyARetries++;
                    
                    // Debug info
                    const debugInfo = await page.evaluate(() => {
                        const textareas = document.querySelectorAll('textarea');
                        const editables = document.querySelectorAll('[contenteditable="true"]');
                        return {
                            textareaCount: textareas.length,
                            editableCount: editables.length,
                            url: window.location.href
                        };
                    });
                    logger.warn(`[TestHumanMethods] Debug: ${JSON.stringify(debugInfo)}`);
                }
            }

            if (!composerOpened) {
                logger.error(`[TestHumanMethods] ✗ Failed to open composer after ${maxReplyARetries + 1} attempts`);
            }
            break;
        }

        case 'replyb':
        case 'replyb_button': {
            logger.info(`[TestHumanMethods] Method B: Button Click`);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(500);

            const btnResultB = await human.findElement(page, ['[data-testid="replyEdge"]', '[data-testid="reply"]'], { visibleOnly: true });
            if (btnResultB.element) {
                logger.info(`[TestHumanMethods] Found button: ${btnResultB.selector}`);
                await btnResultB.element.scrollIntoViewIfNeeded();
                await human.fixation(300, 800);
                await human.microMove(page, 20);
                await btnResultB.element.click();
                logger.info(`[TestHumanMethods] Clicked button - waiting for composer...`);
                await page.waitForTimeout(2000);

                const verifyB = await human.verifyComposerOpen(page);
                if (verifyB.open) {
                    logger.info(`[TestHumanMethods] ✓ Composer opened with: ${verifyB.selector}`);
                    
                    const composerB = verifyB.locator || page.locator(verifyB.selector).first();
                    
                    const composerInfoB = await page.evaluate((sel) => {
                        const el = document.querySelector(sel);
                        return el ? { tagName: el.tagName, isContentEditable: el.isContentEditable } : null;
                    }, verifyB.selector);
                    logger.info(`[TestHumanMethods] Composer: ${JSON.stringify(composerInfoB)}`);
                    
                    logger.info(`[TestHumanMethods] Typing...`);
                    await human.typeText(page, text, composerB);
                    
                    const postB = await human.postTweet(page);
                    if (postB.success) {
                        logger.info(`[TestHumanMethods] ✓ Reply posted successfully via ${postB.method}`);
                    } else {
                        logger.warn(`[TestHumanMethods] ✗ Post failed: ${postB.reason}`);
                    }
                } else {
                    logger.warn(`[TestHumanMethods] ✗ Composer did not open`);
                }
            } else {
                logger.warn(`[TestHumanMethods] ✗ Reply button not found`);
            }
            break;
        }

        default:
            logger.warn(`[TestHumanMethods] Unknown reply method: ${method}`);
    }
}

async function testQuoteMethod(page, method, text, engine, human, logger) {
    logger.info(`[TestHumanMethods] ===== TESTING QUOTE METHOD: ${method} =====`);

    // Map method names to utility method names
    const methodMap = {
        'quotea': 'quoteA',
        'quotea_keyboard': 'quoteA',
        'quoteb': 'quoteB',
        'quoteb_retweet': 'quoteB',
        'quotec': 'quoteC',
        'quotec_newpost': 'quoteC'
    };

    const utilityMethod = methodMap[method.toLowerCase()];
    if (utilityMethod) {
        const result = await executeQuoteMethod(utilityMethod, page, text, human, logger);
        if (result.success) {
            logger.info(`[TestHumanMethods] ✓ Quote posted successfully via ${result.method}`);
        } else {
            logger.warn(`[TestHumanMethods] ✗ Post failed: ${result.reason}`);
        }
        return;
    }

    switch (method.toLowerCase()) {
        default:
            logger.warn(`[TestHumanMethods] Unknown quote method: ${method}`);
    }
}
