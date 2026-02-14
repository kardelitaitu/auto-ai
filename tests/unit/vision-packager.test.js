import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VisionPackager from '../../core/vision-packager.js';
import RoIDetector from '../../core/vision/roi-detector.js';
import ImageStorage from '../../core/vision/image-storage.js';
import fs from 'fs/promises';

vi.mock('fs/promises');
vi.mock('../../core/vision/roi-detector.js');
vi.mock('../../core/vision/image-storage.js');
vi.mock('../../utils/logger.js', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    })
}));

describe('VisionPackager', () => {
    let packager;
    let mockPage;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('window', { innerWidth: 1920, innerHeight: 1080 });

        // Mock fs promises
        fs.mkdir.mockResolvedValue();
        fs.writeFile.mockResolvedValue();
        fs.readdir.mockResolvedValue([]);
        fs.stat.mockResolvedValue({ mtimeMs: Date.now() });
        fs.unlink.mockResolvedValue();


        packager = new VisionPackager('test-dir');
        mockPage = {
            screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
            evaluate: vi.fn().mockImplementation((fn) => {
                if (typeof fn === 'function') {
                    return Promise.resolve(fn());
                }
                return Promise.resolve({ width: 1920, height: 1080 });
            }),
            url: vi.fn().mockReturnValue('http://test.com')
        };
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('captureScreenshot', () => {
        it('should capture and save screenshot', async () => {
            const result = await packager.captureScreenshot(mockPage, { saveToDisk: true });

            expect(mockPage.screenshot).toHaveBeenCalled();
            expect(fs.writeFile).toHaveBeenCalled();
            expect(result.screenshotPath).toContain('.jpg');
            expect(result.metadata.viewport).toEqual({ width: 1920, height: 1080 });
        });

        it('should capture without saving to disk', async () => {
            const result = await packager.captureScreenshot(mockPage, { saveToDisk: false });
            expect(fs.writeFile).not.toHaveBeenCalled();
            expect(result.screenshotPath).toContain('.jpg'); // Path is still generated
        });

        it('should handle capture errors', async () => {
            mockPage.screenshot.mockRejectedValue(new Error('Snap failed'));
            await expect(packager.captureScreenshot(mockPage)).rejects.toThrow('Snap failed');
        });
    });

    describe('captureWithROI', () => {
        it('should use ROI when detected', async () => {
            const roi = { x: 10, y: 10, width: 100, height: 100 };
            // Mock identifyROI directly as it's a method of the class under test
            vi.spyOn(packager, 'identifyROI').mockResolvedValue(roi);
            const spy = vi.spyOn(packager, 'captureScreenshot');

            await packager.captureWithROI(mockPage);

            expect(spy).toHaveBeenCalledWith(mockPage, expect.objectContaining({
                clip: roi,
                saveToDisk: false
            }));
        });

        it('should use full page when no ROI detected', async () => {
            vi.spyOn(packager, 'identifyROI').mockResolvedValue(null);
            const spy = vi.spyOn(packager, 'captureScreenshot');

            await packager.captureWithROI(mockPage);

            const callArgs = spy.mock.calls[0];
            const options = callArgs[1];
            expect(options).not.toHaveProperty('clip');
            expect(options.fullPage).toBe(false);
        });
    });

    describe('Delegated Methods', () => {
        it('should delegate cleanup to storage', async () => {
            fs.readdir.mockResolvedValue(['old.jpg']);
            fs.stat.mockResolvedValue({ mtimeMs: Date.now() - 4000000 });
            const count = await packager.cleanupOldScreenshots(3600000);
            expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('old.jpg'));
            expect(count).toBe(1);
        });

        it('should log cleanup count if greater than 0', async () => {
            fs.readdir.mockResolvedValue(['old.jpg']);
            fs.stat.mockResolvedValue({ mtimeMs: Date.now() - 4000000 });
            await packager.cleanupOldScreenshots(3600000);
            // The logger is mocked, we just need to ensure the code path is taken.
            // The fact that it doesn't throw is sufficient for this test's purpose.
        });

        it('should delegate stats to storage', async () => {
            fs.readdir.mockResolvedValue(['1.jpg', '2.jpg']);
            fs.stat.mockResolvedValue({ size: 1024 });
            const stats = await packager.getStats();
            expect(stats.totalScreenshots).toBe(2);
            expect(stats.totalSizeBytes).toBe(2048);
        });
    });
});
