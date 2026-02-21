import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('generateDebugProfile', () => {
    let writeFileSync;
    let consoleLog;
    let consoleError;

    beforeEach(() => {
        writeFileSync = vi.fn();
        consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        consoleLog.mockRestore();
        consoleError.mockRestore();
    });

    it('should generate profile file with correct structure', async () => {
        vi.doMock('fs', () => ({
            default: { writeFileSync },
            writeFileSync
        }));

        await import('../../utils/generateDebugProfile.js');

        expect(writeFileSync).toHaveBeenCalledTimes(1);
        const written = JSON.parse(writeFileSync.mock.calls[0][1]);

        expect(Array.isArray(written)).toBe(true);
        expect(written.length).toBe(1);

        const profile = written[0];
        expect(profile).toHaveProperty('id');
        expect(profile).toHaveProperty('description');
        expect(profile).toHaveProperty('timings');
        expect(profile).toHaveProperty('probabilities');
        expect(profile).toHaveProperty('inputMethods');
        expect(profile).toHaveProperty('maxLike');
        expect(profile).toHaveProperty('maxFollow');
        expect(profile).toHaveProperty('theme');
    });

    it('should have correct probability and timing fields', async () => {
        vi.doMock('fs', () => ({
            default: { writeFileSync },
            writeFileSync
        }));

        const module = await import('../../utils/generateDebugProfile.js');
        const profile = module.DebugProfileFactory.create();

        expect(profile.probabilities).toHaveProperty('refresh');
        expect(profile.probabilities).toHaveProperty('profileDive');
        expect(profile.probabilities).toHaveProperty('tweetDive');
        expect(profile.probabilities).toHaveProperty('likeTweetafterDive');
        expect(profile.probabilities).toHaveProperty('bookmarkAfterDive');
        expect(profile.probabilities).toHaveProperty('followOnProfile');
        expect(profile.probabilities).toHaveProperty('idle');

        expect(profile.timings).toHaveProperty('readingPhase');
        expect(profile.timings).toHaveProperty('scrollPause');
        expect(profile.timings).toHaveProperty('actionSpecific');
    });

    it('should log error when file write fails', async () => {
        writeFileSync.mockImplementation(() => {
            throw new Error('disk full');
        });

        vi.doMock('fs', () => ({
            default: { writeFileSync },
            writeFileSync
        }));

        await import('../../utils/generateDebugProfile.js');

        expect(consoleError).toHaveBeenCalled();
    });
});
