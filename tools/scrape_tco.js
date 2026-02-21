/**
 * @fileoverview Twitter t.co Link Scraper (Stealth/Human-Assist)
 * @description
 * 1. Opens Twitter/X.
 * 2. Waits for you to Log In (if needed).
 * 3. Scrolls and captures real 't.co' links from tweets.
 * 4. Saves to config/tco_links.json.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Helper for random delays
const sleep = (min, max) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

async function scrape() {
    console.log('[t.co-Scraper] Launching Browser...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    let allLinks = new Set();
    const outputPath = path.resolve('config/tco_links.json');

    // Load existing
    if (fs.existsSync(outputPath)) {
        try {
            JSON.parse(fs.readFileSync(outputPath, 'utf8')).forEach(l => allLinks.add(l));
            console.log(`[t.co-Scraper] Loaded ${allLinks.size} existing links.`);
        } catch (_error) {
            console.warn('[t.co-Scraper] Failed to load existing links:', _error);
        }
    }

    try {
        console.log('[t.co-Scraper] Going to X.com search...');
        // Search for tweets with links
        await page.goto('https://x.com/search?q=filter%3Alinks&src=typed_query&f=live');

        // Login Wait Loop
        console.log('--- PLEASE LOG IN IF NEEDED ---');
        console.log('Waiting for timeline to appear...');

        // Wait for primary column or a tweet
        try {
            await page.waitForSelector('[data-testid="tweet"]', { timeout: 0 }); // Infinite wait until user logs in and content loads
        } catch (_error) {
            console.log('Timeout waiting for login?');
        }

        console.log('Login detected! Starting scrape loop...');

        // Scrape Loop
        const TARGET_COUNT = 50; // How many new links to find
        let consecutiveNoNew = 0;

        while (allLinks.size < TARGET_COUNT + 20 && consecutiveNoNew < 5) {
            // Extract t.co links
            const newLinks = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href*="t.co"]'));
                return anchors
                    .map(a => (a instanceof HTMLAnchorElement ? a.href : ''))
                    .filter(href => href.includes('t.co/')); // Basic validation
            });

            const initialSize = allLinks.size;
            newLinks.forEach(l => allLinks.add(l));

            const added = allLinks.size - initialSize;
            console.log(`[Scraper] Found ${newLinks.length} links. New unique: ${added}. Total: ${allLinks.size}`);

            if (added === 0) consecutiveNoNew++;
            else consecutiveNoNew = 0;

            // Scroll
            await page.keyboard.press('PageDown');
            await sleep(1500, 3000); // Read time
        }

        // Save
        const finalArr = Array.from(allLinks);
        fs.writeFileSync(outputPath, JSON.stringify(finalArr, null, 2));

        console.log(`[t.co-Scraper] SUCCESS! Saved ${finalArr.length} links to ${outputPath}`);
        console.log('You can run this again to add more.');

    } catch (_error) {
        console.error('[t.co-Scraper] Error:', _error);
    } finally {
        console.log('Closing in 5 seconds...');
        await sleep(5000, 5000);
        await browser.close();
    }
}

scrape();
