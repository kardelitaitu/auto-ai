
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StateManager from '../../core/state-manager.js';

// Mock Logger
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    })
}));

describe('StateManager', () => {
    let stateManager;

    beforeEach(() => {
        stateManager = new StateManager();
    });

    describe('Constructor', () => {
        it('should initialize with empty maps and default limits', () => {
            expect(stateManager.breadcrumbs).toBeInstanceOf(Map);
            expect(stateManager.executionState).toBeInstanceOf(Map);
            expect(stateManager.maxBreadcrumbs).toBe(50);
        });
    });

    describe('addBreadcrumb', () => {
        it('should add a breadcrumb to a new session', () => {
            const breadcrumb = { action: 'navigate', target: 'http://example.com', success: true };
            stateManager.addBreadcrumb('session-1', breadcrumb);

            const crumbs = stateManager.getBreadcrumbs('session-1');
            expect(crumbs).toHaveLength(1);
            expect(crumbs[0].action).toBe('navigate');
            expect(crumbs[0].timestamp).toBeDefined();
        });

        it('should use provided timestamp if present', () => {
            const timestamp = 123456789;
            const breadcrumb = { action: 'click', target: 'btn', success: true, timestamp };
            stateManager.addBreadcrumb('session-1', breadcrumb);

            const crumbs = stateManager.getBreadcrumbs('session-1');
            expect(crumbs[0].timestamp).toBe(timestamp);
        });

        it('should maintain sliding window limit', () => {
            stateManager.maxBreadcrumbs = 3;
            for (let i = 1; i <= 5; i++) {
                stateManager.addBreadcrumb('session-1', { action: 'click', target: `button-${i}`, success: true });
            }

            const crumbs = stateManager.getBreadcrumbs('session-1');
            expect(crumbs).toHaveLength(3);
            expect(crumbs[0].target).toBe('button-3');
            expect(crumbs[2].target).toBe('button-5');
        });
    });

    describe('getBreadcrumbs', () => {
        it('should return last N breadcrumbs when limit is provided', () => {
            for (let i = 1; i <= 5; i++) {
                stateManager.addBreadcrumb('session-1', { action: 'click', target: `button-${i}`, success: true });
            }

            const crumbs = stateManager.getBreadcrumbs('session-1', 2);
            expect(crumbs).toHaveLength(2);
            expect(crumbs[0].target).toBe('button-4');
            expect(crumbs[1].target).toBe('button-5');
        });

        it('should return an empty array for non-existent session', () => {
            expect(stateManager.getBreadcrumbs('non-existent')).toEqual([]);
        });
    });

    describe('getBreadcrumbSummary', () => {
        it('should return a condensed summary for a session', () => {
            stateManager.addBreadcrumb('session-1', { action: 'navigate', target: 'url1', success: true });
            stateManager.addBreadcrumb('session-1', { action: 'click', target: 'btn1', success: false });

            const summary = stateManager.getBreadcrumbSummary('session-1');
            expect(summary).toContain('Recent actions (last 2):');
            expect(summary).toContain('1. ✓ navigate → url1');
            expect(summary).toContain('2. ✗ click → btn1');
        });

        it('should return a message for empty sessions', () => {
            const summary = stateManager.getBreadcrumbSummary('session-1');
            expect(summary).toBe('No prior actions in this session.');
        });
    });

    describe('Execution State', () => {
        it('should update and retrieve execution state', () => {
            stateManager.updateExecutionState('session-1', { key1: 'val1' });
            stateManager.updateExecutionState('session-1', { key2: 'val2' });

            const state = stateManager.getExecutionState('session-1');
            expect(state.key1).toBe('val1');
            expect(state.key2).toBe('val2');
            expect(state.updatedAt).toBeDefined();
        });

        it('should return empty object for unknown session', () => {
            expect(stateManager.getExecutionState('unknown')).toEqual({});
        });
    });

    describe('Session Management', () => {
        it('should clear session data', () => {
            stateManager.addBreadcrumb('session-1', { action: 'navigate', target: 'url1', success: true });
            stateManager.updateExecutionState('session-1', { key1: 'val1' });

            stateManager.clearSession('session-1');
            expect(stateManager.getBreadcrumbs('session-1')).toEqual([]);
            expect(stateManager.getExecutionState('session-1')).toEqual({});
        });
    });

    describe('getStats', () => {
        it('should calculate statistics correctly', () => {
            stateManager.addBreadcrumb('session-1', { action: 'a1', target: 't1', success: true });
            stateManager.addBreadcrumb('session-1', { action: 'a2', target: 't2', success: true });
            stateManager.addBreadcrumb('session-2', { action: 'a1', target: 't1', success: true });

            const stats = stateManager.getStats();
            expect(stats.activeSessions).toBe(2);
            expect(stats.totalBreadcrumbs).toBe(3);
            expect(stats.avgBreadcrumbsPerSession).toBe("1.50");
        });

        it('should return zero stats for no sessions', () => {
            const stats = stateManager.getStats();
            expect(stats.activeSessions).toBe(0);
            expect(stats.totalBreadcrumbs).toBe(0);
            expect(stats.avgBreadcrumbsPerSession).toBe(0);
        });
    });

    describe('calculateComplexityScore', () => {
        it('should return 0 for no history', () => {
            expect(stateManager.calculateComplexityScore('session-1')).toBe(0);
        });

        it('should calculate score based on failure rate', () => {
            stateManager.addBreadcrumb('session-1', { action: 'a1', target: 't1', success: true });
            stateManager.addBreadcrumb('session-1', { action: 'a2', target: 't2', success: false });

            // failure rate = 0.5. Score = 0.5 * 10 = 5.
            expect(stateManager.calculateComplexityScore('session-1')).toBe(5);
        });

        it('should boost score for rate limit errors', () => {
            stateManager.addBreadcrumb('session-1', { action: 'a1', target: 't1', success: true });
            stateManager.addBreadcrumb('session-1', { action: 'a2', target: 't2', success: false, error: 'Rate Limit Exceeded' });

            // failure rate = 0.5. Base score = 5. Rate limit boost +3 = 8.
            expect(stateManager.calculateComplexityScore('session-1')).toBe(8);
        });

        it('should cap score at 10', () => {
            for (let i = 0; i < 5; i++) {
                stateManager.addBreadcrumb('session-1', { action: 'a', target: 't', success: false, error: 'Rate Limit' });
            }
            expect(stateManager.calculateComplexityScore('session-1')).toBe(10);
        });
    });

    describe('shutdown', () => {
        it('should clear all tracked data', () => {
            stateManager.addBreadcrumb('session-1', { action: 'a1', target: 't1', success: true });
            stateManager.updateExecutionState('session-1', { k1: 'v1' });

            stateManager.shutdown();
            expect(stateManager.breadcrumbs.size).toBe(0);
            expect(stateManager.executionState.size).toBe(0);
        });
    });
});
