import fs from 'fs';
let c = fs.readFileSync('tests/unit/twitterAgent.test.js', 'utf-8');

// Normalize CRLF to LF for reliable string matching
c = c.replace(/\r\n/g, '\n');

c = c.replace(
    "  describe('diveTweet', () => {\n    beforeEach(() => {",
    "  describe('diveTweet', () => {\n    beforeEach(() => {\n      vi.useFakeTimers();"
);

c = c.replace(
    "      agent.page.viewportSize = vi.fn().mockReturnValue({ width: 1280, height: 720 });\n    });\n\n    it('should dive into a tweet', async () => {",
    "      agent.page.viewportSize = vi.fn().mockReturnValue({ width: 1280, height: 720 });\n    });\n\n    afterEach(() => {\n      vi.useRealTimers();\n    });\n\n    it('should dive into a tweet', async () => {"
);

c = c.replace(
    "  describe('runSession', () => {\n    beforeEach(() => {\n      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');",
    "  describe('runSession', () => {\n    beforeEach(() => {\n      vi.useFakeTimers();\n      agent.page.url = vi.fn().mockReturnValue('https://x.com/home');"
);

c = c.replace(
    "      agent.human.session = { shouldEndSession: vi.fn().mockReturnValue(true) };\n    });\n\n    it('should run session initialization', async () => {",
    "      agent.human.session = { shouldEndSession: vi.fn().mockReturnValue(true) };\n    });\n\n    afterEach(() => {\n      vi.useRealTimers();\n    });\n\n    it('should run session initialization', async () => {"
);

fs.writeFileSync('tests/unit/twitterAgent.test.js', c);
console.log('Fixed timers in twitterAgent.test.js');
