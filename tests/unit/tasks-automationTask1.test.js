import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

vi.mock('../../../utils/utils.js', () => ({
  createRandomScroller: vi.fn(),
  createRandomZoomer: vi.fn(),
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

vi.mock('../../../utils/browserPatch.js', () => ({
  applyHumanizationPatch: vi.fn()
}));

describe('tasks/automationTask1.js', () => {
  it('should export a default function', async () => {
    const task = await import('../../../tasks/automationTask1.js');
    expect(task.default).toBeDefined();
    expect(typeof task.default).toBe('function');
  });
});
