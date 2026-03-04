import { api } from '../api/index.js';
import { getPage, withPage } from '../api/core/context.js';
import playwright from 'playwright';

async function test() {
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();

    try {
        await withPage(page, async () => {
            await api.goto('https://example.com');
            console.log('Navigated to example.com');

            console.log('Testing api.waitFor with predicate...');
            let start = Date.now();
            await api.waitFor(async () => {
                const res = await api.eval(() => true).catch(() => false);
                console.log('  Predicate check:', res);
                return res;
            }, { timeout: 5000 });
            console.log('api.waitFor success after', Date.now() - start, 'ms');
        });
    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await browser.close();
    }
}

test();
