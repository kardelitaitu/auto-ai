import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as contextModule from '@api/core/context.js';

vi.mock('@api/core/context.js', () => ({
    getPage: vi.fn(),
}));

vi.mock('@api/utils/math.js', () => ({
    mathUtils: {
        gaussian: vi.fn().mockReturnValue(0.85),
        randomInRange: vi.fn().mockReturnValue(50),
    },
}));

import { injectSensors } from '@api/utils/sensors.js';

describe('api/utils/sensors.js', () => {
    let mockPage;

    beforeEach(() => {
        mockPage = {
            addInitScript: vi.fn().mockResolvedValue(undefined),
        };
        contextModule.getPage.mockReturnValue(mockPage);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('injectSensors', () => {
        it('should call addInitScript with sensor configuration', async () => {
            await injectSensors();

            expect(mockPage.addInitScript).toHaveBeenCalledTimes(1);

            const callArgs = mockPage.addInitScript.mock.calls[0];
            const scriptFn = callArgs[0];
            const scriptOptions = callArgs[1];

            expect(typeof scriptFn).toBe('function');
            expect(scriptOptions).toHaveProperty('level');
            expect(scriptOptions).toHaveProperty('chargingTime');
            expect(scriptOptions).toHaveProperty('dischargingTime');
        });

        it('should pass valid sensor parameters', async () => {
            await injectSensors();

            const callArgs = mockPage.addInitScript.mock.calls[0];
            const scriptOptions = callArgs[1];

            expect(scriptOptions.level).toBeGreaterThanOrEqual(0.5);
            expect(scriptOptions.level).toBeLessThanOrEqual(1.0);
            expect(scriptOptions.chargingTime).toBeGreaterThanOrEqual(0);
            expect(scriptOptions.dischargingTime).toBe(Infinity);
        });
    });
});
