import { api } from '../api/index.js';
import { createLogger } from '../api/utils/logger.js';
import { profileManager } from '../api/utils/profileManager.js';
import { ReferrerEngine } from '../api/utils/urlReferrer.js';
import fs from 'fs/promises';

const URL_FILE = './tasks/pageview.txt';

/**
 * Load URLs from the text file
 */
async function loadUrls() {
    try {
        const content = await fs.readFile(URL_FILE, 'utf-8');
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    } catch (_error) {
        return [];
    }
}

/**
 * Get a random URL from the file
 */
async function getRandomUrl() {
    const urls = await loadUrls();
    if (urls.length === 0) {
        throw new Error(`No URLs found in ${URL_FILE}`);
    }
    return urls[Math.floor(Math.random() * urls.length)];
}

/**
 * Ensure URL has proper protocol
 */
function ensureProtocol(url) {
    url = url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    return url;
}

/**
 * Main pageview task migrated to Unified API
 */
export default async function pageview(page, payload) {
    const startTime = process.hrtime.bigint();
    const browserInfo = payload.browserInfo || 'unknown_profile';
    const logger = createLogger(`pageview.js [${browserInfo}]`);

    logger.info('[pageview] Starting migrated pageview task...');

    return await api.withPage(page, async () => {
        try {
            // 1. Setup Profile & Persona
            let profile;
            try {
                profile = profileManager.getStarter();
                const personaName = profile.persona || 'casual';
                await api.init(page, {
                    logger,
                    persona: personaName,
                    colorScheme: profile.theme || 'dark'
                });
                logger.info(`[pageview] Initialized with profile: ${profile.id} (Persona: ${personaName})`);
            } catch (e) {
                logger.warn(`[pageview] Profile load failed: ${e.message}, using defaults`);
                await api.init(page, { logger, colorScheme: 'dark' });
            }

            // 2. Determine target URL
            let targetUrl;
            if (payload.url) {
                targetUrl = ensureProtocol(payload.url);
                logger.info(`[pageview] Target (Arg): ${targetUrl}`);
            } else {
                targetUrl = await getRandomUrl();
                logger.info(`[pageview] Target (Random): ${targetUrl}`);
            }

            // 3. Referrer & Headers
            const engine = new ReferrerEngine({ addUTM: false });
            const ctx = engine.generateContext(targetUrl);
            await api.setExtraHTTPHeaders(ctx.headers);
            logger.info(`[pageview] Referrer: ${ctx.referrer || '(Direct)'}`);

            // 4. Navigate using Unified API (handles warmup jitter & mouse movement internally)
            logger.info(`[pageview] Navigating...`);

            // Use a Promise.race to enforce a global 50s timeout for the "work" phase
            const taskTimeoutMs = 50000;

            try {
                await Promise.race([
                    (async () => {
                        try {
                            await api.goto(targetUrl, {
                                waitUntil: 'domcontentloaded',
                                timeout: 20000,
                                warmup: true,
                                warmupMouse: true,
                                warmupPause: true
                            });
                        } catch (navError) {
                            logger.error(`[pageview] Navigation failed: ${navError.message}`);
                            return;
                        }

                        // Settle time
                        await api.wait(api.randomInRange(1000, 2000));

                        // 5. Reading Simulation
                        const meanDurationMs = profile?.timings?.readingPhase?.mean || 30000;
                        const devDurationMs = profile?.timings?.readingPhase?.deviation || 10000;

                        const profileReadingMs = api.gaussian(meanDurationMs, devDurationMs, 10000, 45000);
                        const readingDurationS = Math.min(Math.max(profileReadingMs / 1000, 15), 45);

                        const estimatedPauses = Math.max(1, Math.floor(readingDurationS / 2.2));

                        logger.info(`[pageview] Simulating reading for ~${readingDurationS.toFixed(2)}s (${estimatedPauses} cycles)`);

                        await api.scroll.read(null, {
                            pauses: estimatedPauses,
                            scrollAmount: api.randomInRange(600, 1200),
                            variableSpeed: true,
                            backScroll: true
                        });

                        // Final pause
                        await api.wait(api.randomInRange(1000, 2000));
                    })(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Pageview task exceeded 50s limit')), taskTimeoutMs))
                ]);
            } catch (error) {
                if (error.message.includes('exceeded 50s limit')) {
                    logger.warn(`[pageview] Task forced to stop: ${error.message}`);
                } else {
                    throw error;
                }
            }
        } finally {
            try {
                if (page && !page.isClosed()) {
                    await page.close();
                    logger.debug(`[pageview] Page closed successfully.`);
                }
            } catch (closeError) {
                logger.warn(`[pageview] Error closing page: ${closeError.message}`);
            }
            // Cleanup (finally block in main orchestrator or task wrapper handles close)
            const endTime = process.hrtime.bigint();
            const durationInSeconds = (Number(endTime - startTime) / 1_000_000_000).toFixed(2);
            logger.info(`[pageview] Total task duration: ${durationInSeconds} seconds`);
        }
    });
}

