import { chromium } from 'playwright';

(async () => {
    try {
        const resp = await fetch('http://127.0.0.1:8857/json/version');
        const data = await resp.json();
        const browser = await chromium.connectOverCDP(data.webSocketDebuggerUrl);
        const page = await browser.contexts()[0].newPage();

        await page.goto('https://example.com');

        const res = await page.evaluate(() => {
            const v = document.createElement('video');
            return {
                mp4: v.canPlayType('video/mp4; codecs="avc1.42E01E"'),
                webm: v.canPlayType('video/webm; codecs="vp9"'),
                msMp4: window.MediaSource ? window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"') : false,
                msWebm: window.MediaSource ? window.MediaSource.isTypeSupported('video/webm; codecs="vp9"') : false
            };
        });

        console.log("MEDIA_SUPPORT_RESULT:", JSON.stringify(res));
        await page.close();
        browser.disconnect();
        process.exit(0);
    } catch (e) {
        console.error("DEBUG ERROR:", e);
        process.exit(1);
    }
})();
