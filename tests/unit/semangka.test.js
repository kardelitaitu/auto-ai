import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../tasks/agent.js', () => ({
    default: vi.fn().mockResolvedValue(undefined)
}));

describe('tasks/semangka.js', () => {
    let mockPage;
    let mockPayload;
    let semangka;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPage = {
            goto: vi.fn().mockResolvedValue(undefined)
        };
        mockPayload = {};
        const module = await import('../../tasks/semangka.js');
        semangka = module.default;
    });

    it('should be a function', () => {
        expect(semangka).toBeDefined();
        expect(typeof semangka).toBe('function');
    });

    it('should set goal and steps in payload', async () => {
        await semangka(mockPage, mockPayload);
        
        expect(mockPayload.goal).toBe('search google for blueberry');
        expect(mockPayload.steps).toEqual([
            "1. navigate to google.com",
            "2. search for 'blueberry'",
            "3. click the 2nd result",
            "4. DONE"
        ]);
    });

    it('should navigate to blank page before running agent', async () => {
        await semangka(mockPage, mockPayload);
        
        expect(mockPage.goto).toHaveBeenCalledWith('about:blank');
    });

    it('should call the agent function', async () => {
        const agent = (await import('../../tasks/agent.js')).default;
        
        await semangka(mockPage, mockPayload);
        
        expect(agent).toHaveBeenCalledWith(mockPage, mockPayload);
    });
});
