import { chromium } from 'playwright';
import fs from 'fs';

async function verifyMedia() {
    console.log("Starting media debug...");

    // Connect to roxybrowser
    const wsEndpoint = 'ws://127.0.0.1:8857/devtools/browser/a032f017-010c-4a1e-8c05-62b4c89833e4'; // Grabbed from terminal logs
    let browser;
    try {
        browser = await chromium.connectOverCDP(wsEndpoint);
        console.log("Connected to browser.");
    } catch (e) {
        // If the specific endpoint fails, we should fetch the active endpoint dynamically
        console.log("Failed to connect to hardcoded endpoint, trying to find active one...");
        try {
            const resp = await fetch('http://127.0.0.1:8857/json/version');
            const data = await resp.json();
            browser = await chromium.connectOverCDP(data.webSocketDebuggerUrl);
        } catch (err) {
            console.error("Could not find devtools endpoint.", err);
            return;
        }
    }

    const context = browser.contexts()[0];
    const pages = context.pages();
    let page = pages.find(p => p.url().includes('x.com') || p.url().includes('twitter.com'));

    if (!page) {
        if (pages.length > 0) page = pages[0];
        else page = await context.newPage();
        console.log("Navigating to x.com video tweet...");
        await page.goto('https://x.com/doge/status/1892644265436660144'); // random video tweet
        await page.waitForTimeout(5000);
    } else {
        console.log("Found existing x.com page: " + page.url());
    }

    // Capture console logs
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            console.log(`[Browser ${msg.type()}] ${msg.text()}`);
        }
    });

    // Capture page errors
    page.on('pageerror', error => {
        console.log(`[Page Error] ${error.message}`);
    });

    console.log("Evaluating media capabilities...");
    const capabilities = await page.evaluate(() => {
        const h264Types = [
            'video/mp4; codecs="avc1.42E01E"',
            'video/mp4; codecs="avc1.4d401e"',
            'video/mp4; codecs="avc1.42001e"',
            'video/mp4',
            'video/webm; codecs="vp8"',
            'video/webm; codecs="vp9"'
        ];

        const audioTypes = [
            'audio/mp4; codecs="mp4a.40.2"',
            'audio/aac',
            'audio/ogg; codecs="vorbis"'
        ];

        const results = {
            canPlayType: {},
            mediaSource: {},
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            isChrome: !!window.chrome,
            webglRenderer: null
        };

        const video = document.createElement('video');
        for (const t of h264Types) {
            results.canPlayType[t] = video.canPlayType(t);
            results.mediaSource[t] = window.MediaSource ? window.MediaSource.isTypeSupported(t) : false;
        }
        for (const t of audioTypes) {
            results.canPlayType[t] = video.canPlayType(t);
            results.mediaSource[t] = window.MediaSource ? window.MediaSource.isTypeSupported(t) : false;
        }

        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    results.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                }
            }
        } catch (e) {
            results.webglRenderer = e.message;
        }

        return results;
    });

    const output = { capabilities, videoData };
    fs.writeFileSync('debug.json', JSON.stringify(output, null, 2));

    // Stay alive for a bit to catch delayed console logs
    await page.waitForTimeout(1000);
    console.log("Done.");
}

verifyMedia().catch(console.error);
