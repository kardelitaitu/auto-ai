/**
 * @fileoverview Google VED Scraper (Stealth Mode)
 * @description
 * 1. Opens Google
 * 2. Searches for neutral terms with HUMAN delays
 * 3. Pauses if CAPTCHA detected
 * 4. Extracts 'data-ved'
 * 5. Saves to config/ved_data.json
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const QUERIES = [
    'weather forecast',
    'technological singularity',
    'types of pasta',
    'history of the internet',
    'best sci-fi books 2024',
    'global warming effects',
    'capital cities of europe',
    'how to bake sourdough',
    'quantum physics basics',
    'top 10 travel destinations',
    'famous impressionist paintings',
    'healthy dinner recipes',
    'latest mars rover news',
    'olympic games history',
    'learn spanish online',
    'diy home improvement ideas',
    'best hiking trails near me',
    'renewable energy sources',
    'meditation techniques for beginners',
    'classic movie recommendations'
];

// Helper for random delays
const sleep = (min, max) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

async function scrape() {
    console.log('[VED-Scraper] Launching Browser (Stealth Mode)...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    let allVeds = new Set();
    const outputPath = path.resolve('config/ved_data.json');

    try {
        for (const query of QUERIES) {
            console.log(`\n[VED-Scraper] --- New Query: "${query}" ---`);

            await page.goto('https://www.google.com'); // Google often redirects to local domain
            await sleep(2000, 4000);

            // Check for CAPTCHA / "Unusual Traffic"
            const pageText = await page.innerText('body');
            if (pageText.includes('unusual traffic') || pageText.includes('I\'m not a robot')) {
                console.log('!!!!!!! CAPTCHA DETECTED !!!!!!!');
                console.log('Please solve the CAPTCHA in the browser window manually.');
                console.log('Waiting for you to solve it...');

                // Infinite wait for user to solve
                while (true) {
                    await sleep(2000, 3000);
                    const currentText = await page.innerText('body');
                    if (!currentText.includes('unusual traffic') && !currentText.includes('I\'m not a robot')) {
                        console.log('CAPTCHA cleared! Resuming...');
                        await sleep(2000, 4000); // Cool down after solve
                        break;
                    }
                }
            }

            // Cookie Consent
            try {
                const acceptBtn = page.getByRole('button', { name: /accept|agree|reject/i }).first();
                if (await acceptBtn.isVisible()) {
                    await acceptBtn.click();
                    await sleep(1000, 2000);
                }
            } catch (e) {
                console.warn('[VED-Scraper] Cookie consent handling failed:', e);
            }

            // Type Query Human-like
            const searchBox = page.locator('textarea[name="q"], input[name="q"]').first();
            await searchBox.click();
            await sleep(500, 1000);

            console.log(`[VED-Scraper] Typing query...`);
            await page.keyboard.type(query, { delay: Math.floor(Math.random() * 150) + 50 }); // Random typing speed
            await sleep(1000, 2000); // Think before enter
            await page.keyboard.press('Enter');

            await page.waitForLoadState('domcontentloaded');
            await sleep(3000, 6000); // Wait for results & hydration

            // Final CAPTCHA Check on Results Page
            if ((await page.innerText('body')).includes('unusual traffic')) {
                console.log('!!!!!!! CAPTCHA DETECTED ON RESULTS !!!!!!!');
                console.log('Please solve it...');
                while ((await page.innerText('body')).includes('unusual traffic')) { await sleep(2000, 3000); }
                console.log('Resuming...');
                await sleep(2000, 4000);
            }

            // Extract VEDs
            const veds = await page.evaluate(() => {
                const direct = Array.from(document.querySelectorAll('[data-ved]'))
                    .map(el => el.getAttribute('data-ved'));

                const hrefs = Array.from(document.querySelectorAll('a[href*="ved="]'))
                    .map(el => {
                        if (!(el instanceof HTMLAnchorElement)) return null;
                        try { return new URL(el.href).searchParams.get('ved'); } catch (e) { return null; }
                    });

                return [...direct, ...hrefs].filter(v => v && v.length > 5);
            });

            console.log(`[VED-Scraper] Found ${veds.length} VEDs for this query.`);
            veds.forEach(v => allVeds.add(v));

            // Random pause between queries
            await sleep(5000, 10000);
        }

        // Save
        const vedList = Array.from(allVeds);

        // Filter out junk
        let cleanList = vedList.filter(v => v.length > 15 && !v.includes(' '));

        // Load existing to append
        if (fs.existsSync(outputPath)) {
            try {
                const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
                if (Array.isArray(existing)) {
                    console.log(`[VED-Scraper] Loading ${existing.length} existing VEDs...`);
                    // Merge and Deduplicate
                    const combined = new Set([...existing, ...cleanList]);
                    cleanList = Array.from(combined);
                }
            } catch (e) { console.warn('Could not read existing VEDs, starting fresh.'); }
        }

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(cleanList, null, 2));

        console.log(`[VED-Scraper] Success! Total: ${cleanList.length} unique VEDs saved to ${outputPath}`);

    } catch (e) {
        console.error('[VED-Scraper] Error:', e);
    } finally {
        console.log('[VED-Scraper] Closing...');
        await browser.close();
    }
}

scrape();
