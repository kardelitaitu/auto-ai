/**
 * @fileoverview Unit tests for tasks/agent.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import agent from '../../tasks/agent.js';
import AgentCortex from '../../core/agent-cortex.js';
import VisionPackager from '../../core/vision-packager.js';
import HumanizerEngine from '../../core/humanizer-engine.js';
import { takeScreenshot } from '../../utils/screenshot.js';
import { scrollRandom } from '../../utils/scroll-helper.js';

// Mocks
vi.mock('../../core/agent-cortex.js');
vi.mock('../../core/vision-packager.js');
vi.mock('../../core/humanizer-engine.js');
vi.mock('../../utils/screenshot.js');
vi.mock('../../utils/scroll-helper.js');
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
        debug: vi.fn()
    }))
}));

describe('tasks/agent', () => {
    let mockPage;
    let mockCortex;
    let mockVision;
    let mockHumanizer;

    beforeEach(() => {
        vi.clearAllMocks();

        mockPage = {
            mouse: {
                move: vi.fn().mockResolvedValue(undefined),
                down: vi.fn().mockResolvedValue(undefined),
                up: vi.fn().mockResolvedValue(undefined)
            },
            keyboard: {
                type: vi.fn().mockResolvedValue(undefined),
                press: vi.fn().mockResolvedValue(undefined)
            },
            goto: vi.fn().mockResolvedValue(undefined),
            waitForTimeout: vi.fn().mockResolvedValue(undefined)
        };

        // Create the mock objects
        mockCortex = {
            planNextStep: vi.fn(),
            recordResult: vi.fn()
        };
        mockVision = {
            captureWithROI: vi.fn()
        };
        mockHumanizer = {
            generateMousePath: vi.fn(),
            generateKeystrokeTiming: vi.fn()
        };

        // Use traditional function to ensure it can be used with 'new'
        AgentCortex.mockImplementation(function () {
            return mockCortex;
        });
        VisionPackager.mockImplementation(function () {
            return mockVision;
        });
        HumanizerEngine.mockImplementation(function () {
            return mockHumanizer;
        });

        // Set up default successful behaviors
        mockVision.captureWithROI.mockResolvedValue({ id: 'vision-1' });
        mockHumanizer.generateMousePath.mockReturnValue({ points: [{ x: 10, y: 10 }] });
        mockHumanizer.generateKeystrokeTiming.mockReturnValue([10, 20]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    // Tests pass when run individually - skipped due to parallel test isolation issues
    it('should complete a simple navigation and click task', async () => {
        mockCortex.planNextStep.mockResolvedValueOnce({
            actions: [{ type: 'navigate', url: 'https://example.com' }]
        });
        mockCortex.planNextStep.mockResolvedValueOnce({
            type: 'terminate',
            reason: 'Goal reached'
        });

        await agent(mockPage, { browserInfo: 'test-browser', goal: 'test goal' });

        expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', { waitUntil: 'domcontentloaded' });
        expect(mockCortex.recordResult).toHaveBeenCalled();
        expect(takeScreenshot).toHaveBeenCalled();
    });

    // Skipped due to test isolation issues (mocks don't reset with isolate: false)
    it('should handle complex action sequences (click, type, press)', async () => {
        mockCortex.planNextStep.mockResolvedValueOnce({
            actions: [
                { type: 'click', x: 100, y: 200, description: 'click button' },
                { type: 'type', text: 'hello', description: 'type hello' },
                { type: 'press', key: 'Enter' }
            ]
        });
        mockCortex.planNextStep.mockResolvedValueOnce({ type: 'terminate' });

        await agent(mockPage, { goal: 'sequence' });

        expect(mockPage.mouse.move).toHaveBeenCalled();
        expect(mockPage.mouse.down).toHaveBeenCalled();
        expect(mockPage.mouse.up).toHaveBeenCalled();
        expect(mockPage.keyboard.type).toHaveBeenCalled();
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    });

    // Skipped due to test isolation issues (mocks don't reset with isolate: false)
    it('should handle wait and scroll actions', async () => {
        mockCortex.planNextStep.mockResolvedValueOnce({
            actions: [
                { type: 'wait', duration: 100 },
                { type: 'scroll', direction: 'down' },
                { type: 'scroll', direction: 'up' }
            ]
        });
        mockCortex.planNextStep.mockResolvedValueOnce({ type: 'terminate' });

        await agent(mockPage, { goal: 'wait and scroll' });

        expect(mockPage.waitForTimeout).toHaveBeenCalledWith(100);
        expect(scrollRandom).toHaveBeenCalledTimes(2);
    });

    // Skipped due to test isolation issues (mocks don't reset with isolate: false)
    it('should handle missing click coordinates gracefully', async () => {
        mockCortex.planNextStep.mockResolvedValueOnce({
            actions: [{ type: 'click', description: 'bad click' }]
        });
        mockCortex.planNextStep.mockResolvedValueOnce({ type: 'terminate' });

        await agent(mockPage, { goal: 'bad click' });

        expect(mockCortex.recordResult).toHaveBeenCalledWith(expect.anything(), false, 'Missing coordinates');
    });

    it('should handle vision failure and stop', async () => {
        mockVision.captureWithROI.mockRejectedValue(new Error('vision dead'));

        await agent(mockPage, { goal: 'vision fail' });

        expect(mockCortex.planNextStep).not.toHaveBeenCalled();
    });

    // Skipped due to test isolation issues (mocks don't reset with isolate: false)
    it('should handle action execution failure', async () => {
        mockCortex.planNextStep.mockResolvedValueOnce({
            actions: [{ type: 'navigate', url: 'https://bad.url' }]
        });
        mockPage.goto.mockRejectedValue(new Error('nav failed'));
        mockCortex.planNextStep.mockResolvedValueOnce({ type: 'terminate' });

        await agent(mockPage, { goal: 'action fail' });

        expect(mockCortex.recordResult).toHaveBeenCalledWith(expect.anything(), false, 'nav failed');
    });

    // Skipped due to test isolation issues (mocks don't reset with isolate: false)
    it('should stop after MAX_STEPS', async () => {
        mockCortex.planNextStep.mockResolvedValue({
            actions: [{ type: 'wait', duration: 1 }]
        });

        await agent(mockPage, { goal: 'loop' });

        expect(mockCortex.planNextStep).toHaveBeenCalledTimes(15);
    });

    // Skipped due to test isolation issues (mocks don't reset with isolate: false)
    it('should handle unknown interaction types', async () => {
        mockCortex.planNextStep.mockResolvedValueOnce({
            actions: [{ type: 'dance', description: 'impossible' }]
        });
        mockCortex.planNextStep.mockResolvedValueOnce({ type: 'terminate' });

        await agent(mockPage, { goal: 'unknown' });
        expect(mockCortex.recordResult).toHaveBeenCalled();
    });
});
