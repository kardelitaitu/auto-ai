/**
 * @fileoverview Unit tests for AsyncQueue
 * @module tests/unit/async-queue.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AsyncQueue, DiveQueue } from '../../utils/async-queue.js';

describe('AsyncQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new AsyncQueue({
      maxConcurrent: 2,
      maxQueueSize: 10,
      defaultTimeout: 5000
    });
  });

  afterEach(() => {
    if (queue.processingPromise) {
      queue.processingPromise.cancel?.();
    }
  });

  describe('Initialization', () => {
    it('should initialize with correct values', () => {
      expect(queue.maxConcurrent).toBe(2);
      expect(queue.maxQueueSize).toBe(10);
      expect(queue.defaultTimeout).toBe(5000);
      expect(queue.queue).toEqual([]);
      expect(queue.active.size).toBe(0);
    });

    it('should use default values when not provided', () => {
      const defaultQueue = new AsyncQueue();
      expect(defaultQueue.maxConcurrent).toBe(3);
      expect(defaultQueue.maxQueueSize).toBe(50);
      expect(defaultQueue.defaultTimeout).toBe(5000);
    });
  });

  describe('add', () => {
    it('should add item to queue', async () => {
      const task = vi.fn().mockResolvedValue('result');
      
      const result = await queue.add(task);
      
      expect(result.success).toBe(true);
      expect(task).toHaveBeenCalled();
    });

    it('should track statistics', async () => {
      const task = vi.fn().mockResolvedValue('result');
      
      await queue.add(task);
      
      expect(queue.stats).toBeDefined();
    });
  });

  describe('getStatus', () => {
    it('should return current queue status', async () => {
      const task = vi.fn().mockResolvedValue('result');
      
      queue.add(task);
      const status = queue.getStatus();
      
      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('activeCount');
    });
  });
});

describe('DiveQueue', () => {
  let diveQueue;

  beforeEach(() => {
    diveQueue = new DiveQueue({
      maxConcurrent: 2,
      maxQueueSize: 10,
      defaultTimeout: 5000
    });
  });

  afterEach(() => {
    if (diveQueue.processingPromise) {
      diveQueue.processingPromise.cancel?.();
    }
  });

  describe('Initialization', () => {
    it('should initialize with engagement counters', () => {
      expect(diveQueue.engagementCounters).toBeDefined();
      expect(diveQueue.engagementCounters.likes).toBe(0);
      expect(diveQueue.engagementCounters.replies).toBe(0);
    });

    it('should initialize quickMode to false', () => {
      expect(diveQueue.quickMode).toBe(false);
    });
  });

  describe('addDive', () => {
    it('should add dive with fallback support', async () => {
      const primaryFn = vi.fn().mockResolvedValue({ success: true });
      const fallbackFn = vi.fn().mockResolvedValue({ success: true, fallback: true });
      
      const result = await diveQueue.addDive(primaryFn, fallbackFn, { timeout: 5000 });
      
      expect(result.success).toBe(true);
      expect(primaryFn).toHaveBeenCalled();
    });
  });

  describe('quickMode', () => {
    it('should enable quick mode', () => {
      diveQueue.enableQuickMode();
      
      expect(diveQueue.quickMode).toBe(true);
    });

    it('should disable quick mode', () => {
      diveQueue.enableQuickMode();
      diveQueue.disableQuickMode();
      
      expect(diveQueue.quickMode).toBe(false);
    });
  });

  describe('engagement tracking', () => {
    it('should record likes', () => {
      const result = diveQueue.recordEngagement('likes');
      
      expect(result).toBe(true);
      expect(diveQueue.engagementCounters.likes).toBe(1);
    });

    it('should not exceed limit', () => {
      diveQueue.engagementCounters.likes = 5; // Set to max
      
      const result = diveQueue.recordEngagement('likes');
      
      expect(result).toBe(false);
    });
  });

  describe('canEngage', () => {
    it('should return true when under limit', () => {
      expect(diveQueue.canEngage('likes')).toBe(true);
    });

    it('should return false when at limit', () => {
      diveQueue.engagementCounters.likes = 5; // Set to max
      
      expect(diveQueue.canEngage('likes')).toBe(false);
    });
  });

  describe('getFullStatus', () => {
    it('should include engagement metrics', () => {
      diveQueue.recordEngagement('likes', 3);
      diveQueue.recordEngagement('replies', 1);
      
      const status = diveQueue.getFullStatus();
      
      expect(status.engagement).toBeDefined();
      expect(status.quickMode).toBe(false);
    });
  });
});
