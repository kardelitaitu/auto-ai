/**
 * @fileoverview Unit tests for utils/scroll-helper.js
 * @module tests/unit/scroll-helper.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('utils/scroll-helper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should export required functions', async () => {
        const scrollHelper = await import('../../utils/scroll-helper.js');
        expect(typeof scrollHelper.scrollWheel).toBe('function');
        expect(typeof scrollHelper.scrollDown).toBe('function');
        expect(typeof scrollHelper.scrollUp).toBe('function');
        expect(typeof scrollHelper.scrollRandom).toBe('function');
        expect(typeof scrollHelper.scrollToTop).toBe('function');
        expect(typeof scrollHelper.scrollToBottom).toBe('function');
    });
});
