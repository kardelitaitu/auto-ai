import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/human-timing.js', () => ({
  humanTiming: {
    randomInRange: vi.fn().mockImplementation((min, max) => (max + min) / 2),
    getScrollPause: vi.fn().mockReturnValue(500),
    humanDelay: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../api/index.js', () => ({
  api: {
    setPage: vi.fn(),
    wait: vi.fn().mockResolvedValue(undefined),
    scroll: vi.fn().mockResolvedValue(undefined),
    scrollToTop: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('scroll-humanizer.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export required functions', async () => {
    const scrollHumanizer = await import('../../utils/scroll-humanizer.js');
    expect(typeof scrollHumanizer.getScrollDistance).toBe('function');
    expect(typeof scrollHumanizer.getScrollDuration).toBe('function');
    expect(typeof scrollHumanizer.getPauseDuration).toBe('function');
    expect(typeof scrollHumanizer.naturalScroll).toBe('function');
  });

  it('should have correct default values for SCROLL_DEFAULTS', async () => {
    const { getScrollDistance, getScrollDuration, SCROLL_DEFAULTS } = await import('../../utils/scroll-humanizer.js');
    expect(SCROLL_DEFAULTS.distanceMin).toBe(300);
    expect(SCROLL_DEFAULTS.distanceMax).toBe(600);
    expect(SCROLL_DEFAULTS.durationMin).toBe(200);
    expect(SCROLL_DEFAULTS.durationMax).toBe(500);
    const distance = getScrollDistance();
    const duration = getScrollDuration();
    expect(distance).toBeGreaterThanOrEqual(300);
    expect(distance).toBeLessThanOrEqual(600);
    expect(duration).toBeGreaterThanOrEqual(200);
    expect(duration).toBeLessThanOrEqual(500);
  });

  it('getScrollDistance should return value within custom range', async () => {
    const { getScrollDistance } = await import('../../utils/scroll-humanizer.js');
    const distance = getScrollDistance({ min: 100, max: 200 });
    expect(distance).toBeGreaterThanOrEqual(100);
    expect(distance).toBeLessThanOrEqual(200);
  });

  it('naturalScroll should execute without error', async () => {
    const { naturalScroll } = await import('../../utils/scroll-humanizer.js');
    await expect(naturalScroll()).resolves.not.toThrow();
  });
});
