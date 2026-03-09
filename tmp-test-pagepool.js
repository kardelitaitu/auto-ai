import { initPage } from './api/core/init.js';
import { EventEmitter } from 'events';

// Mock playwright page
class MockPage extends EventEmitter {
    constructor() {
        super();
        this.routes = [];
        // Mock async local storage context dependency loosely
        this.mainContext = new EventEmitter();
        this.mainContext.browser = () => ({ isConnected: () => true });
    }
    context() { return this.mainContext; }
    url() { return 'https://example.com/test'; }
    async emulateMedia() { }
    async route(url, handler) {
        this.routes.push({ url, handler });
    }
    async unroute() {
        this.routes = [];
    }
    async setMuted() { }
    async addInitScript() { }
    isClosed() { return this.isClosedFlag; }
    async close() { this.isClosedFlag = true; }
}

async function runTest() {
    console.log('Testing Page Pool Reuse Leak...');

    const page = new MockPage();

    console.log(`Initial listeners on 'dialog': ${page.listenerCount('dialog')}`);
    console.log(`Initial routes blocked: ${page.routes.length}`);

    // Simulate 50 sequential tasks reusing the exact same page from the Page Pool
    for (let i = 0; i < 50; i++) {
        // initPage applies dialog blocking and lite mode routing blockers
        await initPage(page, {
            lite: true,
            blockDialogs: true,
            muteAudio: true,
            patch: false,
            humanizationPatch: false
        });
    }

    console.log(`\nAfter 50 task reusing the page:`);
    console.log(`Active listeners on 'dialog': ${page.listenerCount('dialog')}`);
    console.log(`Active 'route' interceptions: ${page.routes.length}`);

    if (page.listenerCount('dialog') > 1 || page.routes.length > 1) {
        console.log('\n❌ LEAK CONFIRMED: Reusing pages stacks listeners endlessly. Every task adds heavy memory overhead directly to the Playwright renderer.');
    } else {
        console.log('\n✅ No leak detected.');
    }
}

runTest().catch(console.error);
