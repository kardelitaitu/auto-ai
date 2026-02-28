
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { injectSensors } from '../../../api/utils/sensors.js';
import * as context from '../../../api/core/context.js';
import { mathUtils } from '../../../api/utils/math.js';

describe('api/utils/sensors.js', () => {
  let mockPage;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = {
      addInitScript: vi.fn().mockImplementation((fn, arg) => {
        // Simple mock of execution
        return Promise.resolve();
      })
    };
    vi.spyOn(context, 'getPage').mockReturnValue(mockPage);
  });

  it('should inject sensors using addInitScript', async () => {
    await injectSensors();
    expect(mockPage.addInitScript).toHaveBeenCalled();

    // Check that we passed arguments for battery randomization
    const [fn, args] = mockPage.addInitScript.mock.calls[0];
    expect(args).toHaveProperty('level');
    expect(args).toHaveProperty('chargingTime');
    expect(args).toHaveProperty('dischargingTime');
  });

  it('should use gaussian noise for battery level', async () => {
    const spy = vi.spyOn(mathUtils, 'gaussian');
    await injectSensors();
    expect(spy).toHaveBeenCalledWith(0.85, 0.1, 0.5, 1.0);
  });
});
