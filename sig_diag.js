import { chromium } from 'playwright';
import { api } from './api/index.js';

async function run() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await api.init(page, {
        persona: 'power',
        humanizationPatch: true
    });

    await page.goto('https://example.com');

    const diag = await page.evaluate(async () => {
        const results = {};

        const proto = Object.getPrototypeOf(navigator);
        const desc = Object.getOwnPropertyDescriptor(proto, 'webdriver');

        results.webdriver = {
            name: desc?.get?.name,
            toString: desc?.get?.toString(),
            isNative: desc?.get?.toString().includes('[native code]')
        };

        const memDesc = Object.getOwnPropertyDescriptor(proto, 'deviceMemory');
        results.memory = {
            name: memDesc?.get?.name,
            toString: memDesc?.get?.toString()
        };

        return results;
    });

    console.log('Signature Diagnostic:', JSON.stringify(diag, null, 2));
    await browser.close();
}

run();
