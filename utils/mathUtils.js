/**
 * MATH UTILS
 * Pure functions for stochastic calculations.
 */
export const mathUtils = {
    /**
     * Box-Muller Transform
     * Generates a number normally distributed around a mean.
     */
    gaussian: (mean, dev, min, max) => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();

        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        let result = mean + (z * dev);

        if (min !== undefined) result = Math.max(min, result);
        if (max !== undefined) result = Math.min(max, result);

        return Math.floor(result);
    },

    randomInRange: (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    roll: (threshold) => {
        return Math.random() < threshold;
    },

    sample: (array) => {
        if (!array || array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    }
};