import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';

vi.mock('fs', () => {
  const mockFs = {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn()
  };
  return { ...mockFs, default: mockFs };
});

describe('urlReferrerGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a mixed set of referrer URLs', async () => {
    const { generateAllReferrers } = await import('../../utils/urlReferrerGenerator.js');
    const referrers = generateAllReferrers();

    expect(referrers.length).toBe(301);
    expect(referrers.some((url) => url.startsWith('https://www.reddit.com/r/'))).toBe(true);
    expect(referrers.some((url) => url.startsWith('https://t.co/'))).toBe(true);
    expect(referrers.some((url) => url === 'https://x.com/home')).toBe(true);
  });

  it('writes referrers file when executed directly', async () => {
    const originalArgv = [...process.argv];
    const modulePath = path.resolve(process.cwd(), 'utils/urlReferrerGenerator.js');
    process.argv[1] = modulePath;
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await vi.resetModules();
    await import('../../utils/urlReferrerGenerator.js');

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
    const [outputPath, data, encoding] = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(outputPath).toContain(path.join('data', 'URLreferrer.txt'));
    expect(encoding).toBe('utf8');
    expect(data.split('\n').length).toBeGreaterThan(0);

    process.argv = originalArgv;
  });
});
