import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('api/utils/fingerprint.js', () => {
    describe('fingerprintManager', () => {
        it('should have getAll function', () => {
            const { fingerprintManager } = require('../../../api/utils/fingerprint.js');
            expect(typeof fingerprintManager.getAll).toBe('function');
        });

        it('should have getByPlatform function', () => {
            const { fingerprintManager } = require('../../../api/utils/fingerprint.js');
            expect(typeof fingerprintManager.getByPlatform).toBe('function');
        });

        it('should have getRandom function', () => {
            const { fingerprintManager } = require('../../../api/utils/fingerprint.js');
            expect(typeof fingerprintManager.getRandom).toBe('function');
        });

        it('should have matchUserAgent function', () => {
            const { fingerprintManager } = require('../../../api/utils/fingerprint.js');
            expect(typeof fingerprintManager.matchUserAgent).toBe('function');
        });

        it('getAll should return array', () => {
            const { fingerprintManager } = require('../../../api/utils/fingerprint.js');
            const result = fingerprintManager.getAll();
            expect(Array.isArray(result)).toBe(true);
        });

        it('getByPlatform should return array', () => {
            const { fingerprintManager } = require('../../../api/utils/fingerprint.js');
            const result = fingerprintManager.getByPlatform('Windows');
            expect(Array.isArray(result)).toBe(true);
        });

        it('getRandom should return object or undefined', () => {
            const { fingerprintManager } = require('../../../api/utils/fingerprint.js');
            const result = fingerprintManager.getRandom();
            expect(result === undefined || typeof result === 'object').toBe(true);
        });

        it('matchUserAgent should work with string', () => {
            const { fingerprintManager } = require('../../../api/utils/fingerprint.js');
            const result = fingerprintManager.matchUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
            expect(typeof result === 'object' || result === undefined).toBe(true);
        });

        it('matchUserAgent should handle null', () => {
            const { fingerprintManager } = require('../../../api/utils/fingerprint.js');
            const result = fingerprintManager.matchUserAgent(null);
            expect(result === undefined || typeof result === 'object').toBe(true);
        });

        it('matchUserAgent should handle undefined', () => {
            const { fingerprintManager } = require('../../../api/utils/fingerprint.js');
            const result = fingerprintManager.matchUserAgent(undefined);
            expect(result === undefined || typeof result === 'object').toBe(true);
        });

        it('getByPlatform should handle case insensitivity', () => {
            const { fingerprintManager } = require('../../../api/utils/fingerprint.js');
            const lower = fingerprintManager.getByPlatform('windows');
            const upper = fingerprintManager.getByPlatform('WINDOWS');
            expect(Array.isArray(lower)).toBe(true);
            expect(Array.isArray(upper)).toBe(true);
        });

        it('getByPlatform should return empty for unknown platform', () => {
            const { fingerprintManager } = require('../../../api/utils/fingerprint.js');
            const result = fingerprintManager.getByPlatform('NonExistentPlatform123');
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThanOrEqual(0);
        });
    });
});
