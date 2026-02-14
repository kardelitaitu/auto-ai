import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mistakeEngine } from '../../utils/mistake-engine.js';

describe('MistakeEngine', () => {
  let engine;
  let mockPage;

  beforeEach(() => {
    engine = mistakeEngine.createMistakeEngine({
      misclickChance: 1, // Always misclick for testing
      abandonmentChance: 1, // Always abandon for testing
      typingErrorChance: 1,
      navigationErrorChance: 1
    });

    mockPage = {
      $: vi.fn().mockResolvedValue({
        boundingBox: vi.fn().mockResolvedValue({ x: 10, y: 10, width: 100, height: 100 }),
        click: vi.fn().mockResolvedValue(undefined)
      }),
      mouse: {
        move: vi.fn().mockResolvedValue(undefined)
      },
      waitForTimeout: vi.fn().mockResolvedValue(undefined)
    };
  });

  it('should identify when to misclick', () => {
    expect(engine.shouldMisclick()).toBe(true);
  });

  it('should get misclick offset within range', () => {
    const offset = engine.getMisclickOffset();
    expect(offset.dx).toBeGreaterThanOrEqual(engine.config.misclickOffset.min);
    expect(offset.dx).toBeLessThanOrEqual(engine.config.misclickOffset.max);
  });

  it('should simulate misclick', async () => {
    const result = await engine.simulateMisclick(mockPage, '#target');
    expect(result.success).toBe(true);
    expect(mockPage.mouse.move).toHaveBeenCalled();
  });

  it('should handle missing target in misclick', async () => {
    mockPage.$.mockResolvedValue(null);
    const result = await engine.simulateMisclick(mockPage, '#missing');
    expect(result).toBe(false);
  });

  it('should simulate abandonment', async () => {
    const result = await engine.simulateAbandonment(mockPage);
    expect(result.abandoned).toBe(true);
    expect(mockPage.waitForTimeout).toHaveBeenCalled();
  });

  it('should simulate typing error', async () => {
    const result = await engine.simulateTypingError(mockPage, 'text', {});
    expect(result.errorMade).toBe(true);
  });

  it('should simulate navigation error', async () => {
    const result = await engine.simulateNavigationError(mockPage, 'http://url', { wrongSelector: '#wrong' });
    expect(result.navigatedToWrong).toBe(true);
    expect(mockPage.waitForTimeout).toHaveBeenCalled();
  });

  it('should execute with mistakes (misclick)', async () => {
    const action = { targetSelector: '#target' };
    const result = await engine.executeWithMistakes(mockPage, action, { simulateMisclick: true });
    expect(result.mistakes.some(m => m.type === 'misclick')).toBe(true);
  });

  it('should execute with mistakes (abandonment)', async () => {
    const action = { targetSelector: '#target' };
    const result = await engine.executeWithMistakes(mockPage, action, { simulateAbandonment: true });
    expect(result.mistakes.some(m => m.type === 'abandonment')).toBe(true);
    expect(result.actionTaken).toBe(false);
  });

  it('should create humanized click', async () => {
    const clickFn = mistakeEngine.createHumanizedClick(mockPage, '#btn');
    const result = await clickFn();
    expect(result.clicked).toBe(true);
  });
});
