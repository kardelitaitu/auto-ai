import { describe, it, expect, vi, beforeEach } from 'vitest';
import { temporalAwareness } from '../../utils/temporal-awareness.js';

describe('temporal-awareness', () => {
  describe('getCurrentHour', () => {
    it('should return current hour', () => {
      const hour = temporalAwareness.getCurrentHour();
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);
    });
  });

  describe('getCircadianPhase', () => {
    it('should return sleep phase for hours 2-7', () => {
      expect(temporalAwareness.getCircadianPhase(2)).toBe('sleep');
      expect(temporalAwareness.getCircadianPhase(5)).toBe('sleep');
      expect(temporalAwareness.getCircadianPhase(7)).toBe('sleep');
    });

    it('should return evening phase for hours 18-23', () => {
      expect(temporalAwareness.getCircadianPhase(18)).toBe('evening');
      expect(temporalAwareness.getCircadianPhase(22)).toBe('evening');
      expect(temporalAwareness.getCircadianPhase(23)).toBe('evening');
    });

    it('should return morning phase for hours 8-11', () => {
      expect(temporalAwareness.getCircadianPhase(8)).toBe('morning');
      expect(temporalAwareness.getCircadianPhase(9)).toBe('morning');
      expect(temporalAwareness.getCircadianPhase(11)).toBe('morning');
    });

    it('should return day phase for hours 12-17', () => {
      expect(temporalAwareness.getCircadianPhase(12)).toBe('day');
      expect(temporalAwareness.getCircadianPhase(15)).toBe('day');
      expect(temporalAwareness.getCircadianPhase(17)).toBe('day');
    });

    it('should handle hour 0 as day', () => {
      expect(temporalAwareness.getCircadianPhase(0)).toBe('day');
    });

    it('should handle hour 1 as day', () => {
      expect(temporalAwareness.getCircadianPhase(1)).toBe('day');
    });
  });

  describe('shouldSkipSession', () => {
    it('should skip session during sleep hours', () => {
      const result = temporalAwareness.shouldSkipSession({ hour: 3 });
      expect(result.shouldSkip).toBe(true);
      expect(result.reason).toBe('sleep_hours');
    });

    it('should not skip session during day hours', () => {
      const result = temporalAwareness.shouldSkipSession({ hour: 12 });
      expect(result.shouldSkip).toBe(false);
      expect(result.phase).toBe('day');
    });

    it('should not skip session during morning hours', () => {
      const result = temporalAwareness.shouldSkipSession({ hour: 9 });
      expect(result.shouldSkip).toBe(false);
      expect(result.phase).toBe('morning');
    });

    it('should not skip session during evening hours', () => {
      const result = temporalAwareness.shouldSkipSession({ hour: 20 });
      expect(result.shouldSkip).toBe(false);
      expect(result.phase).toBe('evening');
    });

    it('should use custom skip chance', () => {
      const result = temporalAwareness.shouldSkipSession({ hour: 3, skipChance: 0.8 });
      expect(result.skipChance).toBe(0.8);
    });
  });

  describe('getActivityModifier', () => {
    it('should return zero modifiers during sleep', () => {
      const modifiers = temporalAwareness.getActivityModifier(3);
      expect(modifiers.energy).toBe(0);
      expect(modifiers.engagement).toBe(0);
      expect(modifiers.doomscroll).toBe(0);
    });

    it('should return morning modifiers', () => {
      const modifiers = temporalAwareness.getActivityModifier(9);
      expect(modifiers.energy).toBe(0.7);
      expect(modifiers.engagement).toBe(0.8);
      expect(modifiers.doomscroll).toBe(0.2);
    });

    it('should return day modifiers', () => {
      const modifiers = temporalAwareness.getActivityModifier(14);
      expect(modifiers.energy).toBe(0.5);
      expect(modifiers.engagement).toBe(0.6);
      expect(modifiers.doomscroll).toBe(0.1);
    });

    it('should return evening modifiers', () => {
      const modifiers = temporalAwareness.getActivityModifier(20);
      expect(modifiers.energy).toBe(0.8);
      expect(modifiers.engagement).toBe(0.9);
      expect(modifiers.doomscroll).toBe(0.4);
    });

    it('should default to day modifiers for unknown phase', () => {
      const modifiers = temporalAwareness.getActivityModifier(999);
      expect(modifiers).toEqual({ energy: 0.5, engagement: 0.6, doomscroll: 0.1 });
    });
  });

  describe('getSessionLength', () => {
    it('should return zero length during sleep', () => {
      const lengths = temporalAwareness.getSessionLength(3);
      expect(lengths.min).toBe(0);
      expect(lengths.max).toBe(0);
    });

    it('should return morning session lengths', () => {
      const lengths = temporalAwareness.getSessionLength(9);
      expect(lengths.min).toBe(300);
      expect(lengths.max).toBe(600);
    });

    it('should return day session lengths', () => {
      const lengths = temporalAwareness.getSessionLength(14);
      expect(lengths.min).toBe(300);
      expect(lengths.max).toBe(540);
    });

    it('should return evening session lengths', () => {
      const lengths = temporalAwareness.getSessionLength(20);
      expect(lengths.min).toBe(420);
      expect(lengths.max).toBe(720);
    });

    it('should default to day lengths for unknown phase', () => {
      const lengths = temporalAwareness.getSessionLength(999);
      expect(lengths).toEqual({ min: 300, max: 540 });
    });
  });

  describe('createTemporalAwareness', () => {
    let temporal;

    beforeEach(() => {
      temporal = temporalAwareness.createTemporalAwareness({});
    });

    it('should create temporal awareness instance', () => {
      expect(temporal).toBeDefined();
      expect(temporal.config).toBeDefined();
    });

    it('should have getCurrentHour method', () => {
      expect(typeof temporal.getCurrentHour).toBe('function');
    });

    it('should have getCircadianPhase method', () => {
      expect(typeof temporal.getCircadianPhase).toBe('function');
    });

    it('should have shouldSkipSession method', () => {
      expect(typeof temporal.shouldSkipSession).toBe('function');
    });

    it('should have getActivityModifier method', () => {
      expect(typeof temporal.getActivityModifier).toBe('function');
    });

    it('should have getSessionLength method', () => {
      expect(typeof temporal.getSessionLength).toBe('function');
    });

    it('should have measureNetworkQuality method', () => {
      expect(typeof temporal.measureNetworkQuality).toBe('function');
    });

    it('should have getBehaviorModifier method', () => {
      expect(typeof temporal.getBehaviorModifier).toBe('function');
    });

    it('should have adjustBehavior method', () => {
      expect(typeof temporal.adjustBehavior).toBe('function');
    });

    it('should have getOptimalTiming method', () => {
      expect(typeof temporal.getOptimalTiming).toBe('function');
    });

    it('should have formatTimeRemaining method', () => {
      expect(typeof temporal.formatTimeRemaining).toBe('function');
    });

    it('should have getStatus method', () => {
      expect(typeof temporal.getStatus).toBe('function');
    });

    describe('getProxyHour', () => {
      it('should return hour for valid timezone', () => {
        const hour = temporal.getProxyHour('America/New_York');
        expect(hour).toBeGreaterThanOrEqual(0);
        expect(hour).toBeLessThanOrEqual(24);
      });

      it('should fallback to current hour for invalid timezone', () => {
        const hour = temporal.getProxyHour('Invalid/Timezone');
        expect(hour).toBeGreaterThanOrEqual(0);
        expect(hour).toBeLessThanOrEqual(24);
      });
    });

    describe('getBehaviorModifier', () => {
      it('should return fast network modifiers', () => {
        const mods = temporal.getBehaviorModifier('fast');
        expect(mods.scrollSpeed).toBe(1.2);
        expect(mods.hesitation).toBe(0.8);
        expect(mods.frustration).toBe(0);
      });

      it('should return normal network modifiers', () => {
        const mods = temporal.getBehaviorModifier('normal');
        expect(mods.scrollSpeed).toBe(1.0);
        expect(mods.hesitation).toBe(1.0);
        expect(mods.frustration).toBe(0.3);
      });

      it('should return slow network modifiers', () => {
        const mods = temporal.getBehaviorModifier('slow');
        expect(mods.scrollSpeed).toBe(0.7);
        expect(mods.hesitation).toBe(1.5);
        expect(mods.frustration).toBe(0.7);
      });

      it('should default to normal modifiers for unknown quality', () => {
        const mods = temporal.getBehaviorModifier('unknown');
        expect(mods.scrollSpeed).toBe(1.0);
        expect(mods.hesitation).toBe(1.0);
        expect(mods.frustration).toBe(0.3);
      });
    });

    describe('measureNetworkQuality', () => {
      it('should measure fast network', async () => {
        const mockPage = {
          evaluate: vi.fn().mockResolvedValue(Date.now())
        };
        
        // Mock Date.now to return controlled values
        const originalDateNow = Date.now;
        let callCount = 0;
        Date.now = vi.fn(() => {
          callCount++;
          return callCount === 1 ? 0 : 500; // 500ms latency
        });

        const result = await temporal.measureNetworkQuality(mockPage);
        
        Date.now = originalDateNow;
        
        expect(result.quality).toBe('fast');
        expect(mockPage.evaluate).toHaveBeenCalled();
      });

      it('should measure slow network', async () => {
        const mockPage = {
          evaluate: vi.fn().mockResolvedValue(Date.now())
        };
        
        const originalDateNow = Date.now;
        let callCount = 0;
        Date.now = vi.fn(() => {
          callCount++;
          return callCount === 1 ? 0 : 6000; // 6000ms latency
        });

        const result = await temporal.measureNetworkQuality(mockPage);
        
        Date.now = originalDateNow;
        
        expect(result.quality).toBe('slow');
      });

      it('should measure normal network', async () => {
        const mockPage = {
          evaluate: vi.fn().mockResolvedValue(Date.now())
        };
        
        const originalDateNow = Date.now;
        let callCount = 0;
        Date.now = vi.fn(() => {
          callCount++;
          return callCount === 1 ? 0 : 2000; // 2000ms latency
        });

        const result = await temporal.measureNetworkQuality(mockPage);
        
        Date.now = originalDateNow;
        
        expect(result.quality).toBe('normal');
      });

      it('should handle errors gracefully', async () => {
        const mockPage = {
          evaluate: vi.fn().mockRejectedValue(new Error('Network error'))
        };

        const result = await temporal.measureNetworkQuality(mockPage);
        
        expect(result.quality).toBe('unknown');
        expect(result.latency).toBeNull();
      });
    });

    describe('adjustBehavior', () => {
      it('should adjust behavior with frustration', async () => {
        const mockPage = {
          evaluate: vi.fn().mockResolvedValue(undefined),
          waitForTimeout: vi.fn().mockResolvedValue(undefined)
        };

        const modifiers = {
          scrollSpeed: 0.7,
          hesitation: 1.5,
          frustration: 0.8
        };

        // Mock Math.random to trigger frustration scroll
        vi.spyOn(Math, 'random').mockReturnValue(0.5);

        const result = await temporal.adjustBehavior(mockPage, modifiers);

        expect(result.adjusted).toBe(true);
        expect(result.scrollSpeed).toBe(0.7);
        expect(result.frustration).toBe(0.8);
        expect(mockPage.evaluate).toHaveBeenCalled();

        vi.restoreAllMocks();
      });

      it('should adjust behavior without frustration', async () => {
        const mockPage = {
          evaluate: vi.fn().mockResolvedValue(undefined),
          waitForTimeout: vi.fn().mockResolvedValue(undefined)
        };

        const modifiers = {
          scrollSpeed: 1.0,
          hesitation: 1.0,
          frustration: 0.3
        };

        // Mock Math.random to not trigger frustration
        vi.spyOn(Math, 'random').mockReturnValue(0.9);

        const result = await temporal.adjustBehavior(mockPage, modifiers);

        expect(result.adjusted).toBe(true);
        expect(mockPage.evaluate).not.toHaveBeenCalled();

        vi.restoreAllMocks();
      });
    });

    describe('getOptimalTiming', () => {
      it('should return sleep timings', () => {
        const timings = temporal.getOptimalTiming(3);
        expect(timings.readTime).toBe(0);
        expect(timings.replyDelay).toBe(0);
        expect(timings.scrollSpeed).toBe(0);
      });

      it('should return morning timings', () => {
        const timings = temporal.getOptimalTiming(9);
        expect(timings.readTime).toBe(8000);
        expect(timings.replyDelay).toBe(2000);
        expect(timings.scrollSpeed).toBe(1.0);
      });

      it('should return day timings', () => {
        const timings = temporal.getOptimalTiming(14);
        expect(timings.readTime).toBe(5000);
        expect(timings.replyDelay).toBe(1500);
        expect(timings.scrollSpeed).toBe(0.9);
      });

      it('should return evening timings', () => {
        const timings = temporal.getOptimalTiming(20);
        expect(timings.readTime).toBe(10000);
        expect(timings.replyDelay).toBe(2500);
        expect(timings.scrollSpeed).toBe(1.1);
      });

      it('should default to day timings', () => {
        const timings = temporal.getOptimalTiming(999);
        expect(timings.readTime).toBe(5000);
      });
    });

    describe('formatTimeRemaining', () => {
      it('should format time remaining as string', () => {
        const result = temporal.formatTimeRemaining(14);
        expect(typeof result).toBe('string');
        expect(result).toMatch(/\d+ hours/);
      });
    });

    describe('getStatus', () => {
      it('should return complete status object', () => {
        const status = temporal.getStatus();
        
        expect(status.currentHour).toBeGreaterThanOrEqual(0);
        expect(status.currentHour).toBeLessThanOrEqual(23);
        expect(['sleep', 'morning', 'day', 'evening']).toContain(status.phase);
        expect(typeof status.shouldSkip).toBe('boolean');
        expect(status.modifiers).toBeDefined();
        expect(status.sessionLength).toBeDefined();
        expect(typeof status.canRun).toBe('boolean');
      });

      it('should return canRun false during sleep', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2025, 0, 1, 3, 0, 0));

        const status = temporal.getStatus();

        vi.useRealTimers();
        expect(status.shouldSkip).toBe(true);
        expect(status.canRun).toBe(false);
      });
    });
  });

  describe('defaults', () => {
    it('should export circadian defaults', () => {
      expect(temporalAwareness.defaults.circadian).toBeDefined();
      expect(temporalAwareness.defaults.circadian.sleepStart).toBe(2);
      expect(temporalAwareness.defaults.circadian.sleepEnd).toBe(8);
    });

    it('should export network defaults', () => {
      expect(temporalAwareness.defaults.network).toBeDefined();
      expect(temporalAwareness.defaults.network.fastThreshold).toBe(1000);
      expect(temporalAwareness.defaults.network.slowThreshold).toBe(5000);
    });
  });
});
