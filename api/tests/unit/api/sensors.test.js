
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { injectSensors } from '@api/utils/sensors.js';
import * as context from '@api/core/context.js';
import { mathUtils } from '@api/utils/math.js';

vi.mock('@api/core/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

describe('api/utils/sensors.js', () => {
  let mockPage;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = {
      addInitScript: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(context, 'getPage').mockReturnValue(mockPage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should inject sensors using addInitScript', async () => {
    await injectSensors();
    expect(mockPage.addInitScript).toHaveBeenCalled();
  });

  it('should pass battery parameters to addInitScript', async () => {
    await injectSensors();
    
    const [fn, args] = mockPage.addInitScript.mock.calls[0];
    expect(args).toHaveProperty('level');
    expect(args).toHaveProperty('chargingTime');
    expect(args).toHaveProperty('dischargingTime');
  });

  it('should use gaussian for battery level with correct params', async () => {
    const spy = vi.spyOn(mathUtils, 'gaussian');
    await injectSensors();
    expect(spy).toHaveBeenCalledWith(0.85, 0.1, 0.5, 1.0);
  });

  it('should use randomInRange for chargingTime', async () => {
    const spy = vi.spyOn(mathUtils, 'randomInRange');
    await injectSensors();
    expect(spy).toHaveBeenCalledWith(0, 100);
  });

  it('should set dischargingTime to Infinity', async () => {
    await injectSensors();
    
    const [fn, args] = mockPage.addInitScript.mock.calls[0];
    expect(args.dischargingTime).toBe(Infinity);
  });

  it('should call addInitScript with a function as first argument', async () => {
    await injectSensors();
    
    const [fn] = mockPage.addInitScript.mock.calls[0];
    expect(typeof fn).toBe('function');
  });

  it('should get page from context', async () => {
    await injectSensors();
    
    expect(context.getPage).toHaveBeenCalled();
  });

  it('should pass consistent args structure on multiple calls', async () => {
    await injectSensors();
    await injectSensors();
    
    expect(mockPage.addInitScript).toHaveBeenCalledTimes(2);
    
    const [, args1] = mockPage.addInitScript.mock.calls[0];
    const [, args2] = mockPage.addInitScript.mock.calls[1];
    
    expect(args1).toHaveProperty('level');
    expect(args2).toHaveProperty('level');
  });

  it('should pass numeric values for all parameters', async () => {
    await injectSensors();
    
    const [, args] = mockPage.addInitScript.mock.calls[0];
    expect(typeof args.level).toBe('number');
    expect(typeof args.chargingTime).toBe('number');
    expect(Number.isFinite(args.chargingTime)).toBe(true);
  });
});
