import { describe, it, expect, vi, beforeEach } from 'vitest';
import { takeScreenshot } from '../../../utils/screenshot.js';
import fs from 'fs';
import path from 'path';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn()
  };
});

vi.mock('../../../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

describe('screenshot.js', () => {
  let mockPage;

  beforeEach(() => {
    mockPage = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-image'))
    };
  });

  describe('takeScreenshot', () => {
    it('should take a screenshot with default parameters', async () => {
      const result = await takeScreenshot(mockPage);
      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'jpeg',
          quality: 30,
          fullPage: false
        })
      );
      expect(result).toContain('.jpg');
    });

    it('should take screenshot with session name', async () => {
      const result = await takeScreenshot(mockPage, 'my-session');
      expect(result).toContain('my-session');
      expect(result).toContain('.jpg');
    });

    it('should take screenshot with suffix', async () => {
      const result = await takeScreenshot(mockPage, 'session-1', '-Task-1');
      expect(result).toContain('session-1');
      expect(result).toContain('Task-1');
      expect(result).toContain('.jpg');
    });

    it('should return null on screenshot failure', async () => {
      mockPage.screenshot = vi.fn().mockRejectedValue(new Error('Capture failed'));
      const result = await takeScreenshot(mockPage);
      expect(result).toBeNull();
    });

    it('should sanitize invalid characters from session name', async () => {
      const result = await takeScreenshot(mockPage, 'session:1/test');
      expect(result).toContain('session-1-test');
    });
  });
});
