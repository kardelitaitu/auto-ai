import { chromium } from 'playwright';

(async () => {
    try {
        const resp = await fetch('http://127.0.0.1:8857/json/version');
        const data = await resp.json();
        const browser = await chromium.connectOverCDP(data.webSocketDebuggerUrl);
        const contexts = browser.contexts();
        if (contexts.length === 0) {
            console.log("No browser contexts found.");
            process.exit(1);
        }

        const page = contexts[0].pages().find(p => p.url().includes('x.com')) || await contexts[0].newPage();

        page.on('console', msg => {
            const text = msg.text().toLowerCase();
            if (msg.type() === 'error' || text.includes('media') || text.includes('video') || text.includes('codec') || text.includes('play')) {
                console.log(`[PAGE CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
            }
        });

        page.on('pageerror', err => {
            console.log(`[PAGE ERROR] ${err.name}: ${err.message}`);
        });

        console.log("Navigating to https://x.com/home and scrolling down to find media...");
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });

        for (let i = 0; i < 5; i++) {
            await page.waitForTimeout(3000);
            await page.evaluate(() => window.scrollBy(0, 1500));
            console.log(`Scrolled down... (${i + 1}/5)`);
        }

        await page.waitForTimeout(5000);

        // Ensure to disconnect safely
        try {
            browser.disconnect();
        } catch (e) { }
        process.exit(0);
    } catch (e) {
        console.error("DEBUG ERROR:", e);
        process.exit(1);
    }
})();
