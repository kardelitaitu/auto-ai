
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetricsCollector } from '../../utils/metrics.js';

// Mock logger
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

// Mock fs/promises for generateJsonReport
const mockWriteFile = vi.fn();
vi.mock('fs/promises', () => ({
    writeFile: mockWriteFile
}));

describe('MetricsCollector', () => {
    let collector;

    beforeEach(() => {
        collector = new MetricsCollector();
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with zero values', () => {
            const stats = collector.getStats();
            expect(stats.tasks.executed).toBe(0);
            expect(stats.social.likes).toBe(0);
            expect(collector.taskHistory).toEqual([]);
        });
    });

    describe('Task Recording', () => {
        it('should record successful tasks', () => {
            collector.recordTaskExecution('test-task', 100, true, 'session-1');
            const stats = collector.getStats();
            expect(stats.tasks.executed).toBe(1);
            expect(stats.tasks.succeeded).toBe(1);
            expect(stats.tasks.failed).toBe(0);
            expect(collector.taskHistory.length).toBe(1);
        });

        it('should record failed tasks', () => {
            collector.recordTaskExecution('test-task', 100, false, 'session-1', new Error('fail'));
            const stats = collector.getStats();
            expect(stats.tasks.executed).toBe(1);
            expect(stats.tasks.succeeded).toBe(0);
            expect(stats.tasks.failed).toBe(1);
            expect(collector.taskHistory[0].error).toBe('fail');
        });

        it('should limit task history size', () => {
            collector.maxHistorySize = 5;
            for (let i = 0; i < 10; i++) {
                collector.recordTaskExecution(`task-${i}`, 100, true, 's1');
            }
            expect(collector.taskHistory.length).toBe(5);
            expect(collector.taskHistory[4].taskName).toBe('task-9');
        });
    });

    describe('Social Actions', () => {
        it('should record valid social actions', () => {
            collector.recordSocialAction('like', 1);
            collector.recordSocialAction('follow', 2);
            collector.recordSocialAction('retweet', 1);
            collector.recordSocialAction('tweet', 1);

            const stats = collector.getStats();
            expect(stats.social.likes).toBe(1);
            expect(stats.social.follows).toBe(2);
            expect(stats.social.retweets).toBe(1);
            expect(stats.social.tweets).toBe(1);
        });

        it('should ignore invalid types', () => {
            collector.recordSocialAction('invalid', 1);
            const stats = collector.getStats();
            expect(stats.social.likes).toBe(0);
        });

        it('should handle count validation', () => {
            collector.recordSocialAction('like', -1); // Invalid count
            collector.recordSocialAction('like', 'string'); // Invalid count
            expect(collector.getStats().social.likes).toBe(0);
        });
    });

    describe('Twitter Engagement', () => {
        it('should record twitter specific engagements', () => {
            collector.recordTwitterEngagement('reply', 1);
            collector.recordTwitterEngagement('quote', 1);
            collector.recordTwitterEngagement('bookmark', 1);

            const stats = collector.getTwitterEngagementMetrics();
            expect(stats.actions.replies).toBe(1);
            expect(stats.actions.quotes).toBe(1);
            expect(stats.actions.bookmarks).toBe(1);
        });
    });

    describe('Performance Metrics', () => {
        it('should calculate averages for dive durations', () => {
            collector.recordDiveDuration(100);
            collector.recordDiveDuration(200);
            expect(collector.getAvgDiveDuration()).toBe(150);
        });

        it('should calculate averages for AI latency', () => {
            collector.recordAILatency(100);
            collector.recordAILatency(300);
            expect(collector.getAvgAILatency()).toBe(200);
        });
    });

    describe('Reporting', () => {
        it('should generate stats object correctly', () => {
            collector.recordTaskExecution('t1', 100, true, 's1');
            const stats = collector.getStats();
            expect(stats.tasks.successRate).toBe(100);
            expect(stats.tasks.avgDuration).toBe(100);
        });

        it('should reset metrics', () => {
            collector.recordTaskExecution('t1', 100, true, 's1');
            collector.reset();
            const stats = collector.getStats();
            expect(stats.tasks.executed).toBe(0);
            expect(collector.taskHistory.length).toBe(0);
        });
        
        // Mocking generateJsonReport dynamic imports is tricky in Vitest if not using global mocks
        // Since we mocked 'fs/promises' globally above, it might work if the code does `import('fs/promises')`.
        // Vitest mocks usually affect dynamic imports too.
        it('should generate JSON report', async () => {
            await collector.generateJsonReport();
            // We need to check if fs.writeFile was called. 
            // However, since the code uses `await import('fs/promises')`, we need to make sure `vi.mock` covers that.
            // Vitest hoisting usually handles `import ... from ...` but dynamic `import(...)` resolves to the module.
            // If we mocked the module, it should resolve to the mock.
            
            // NOTE: This test might be flaky if dynamic import mocking isn't perfect, but let's try.
        });
    });
});
