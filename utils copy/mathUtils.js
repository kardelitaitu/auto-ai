/**
 * @fileoverview Math utilities for stochastic calculations
 * @module utils/mathUtils
 */
export const mathUtils = {
    /**
     * Box-Muller Transform - generates a number normally distributed around a mean.
     * @param {number} mean - The center of the distribution
     * @param {number} dev - The standard deviation
     * @param {number} [min] - Optional minimum bound
     * @param {number} [max] - Optional maximum bound
     * @returns {number} A normally distributed integer value
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

    /**
     * Generates a random integer within a specified range.
     * @param {number} min - The minimum value (inclusive)
     * @param {number} max - The maximum value (inclusive)
     * @returns {number} A random integer between min and max
     */
    randomInRange: (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Returns true if a random value is below the threshold.
     * @param {number} threshold - A value between 0 and 1
     * @returns {boolean} True if random < threshold
     */
    roll: (threshold) => {
        return Math.random() < threshold;
    },

    /**
     * Returns a random element from an array.
     * @param {Array} array - The array to sample from
     * @returns {*} A random element from the array, or null if empty
     */
    sample: (array) => {
        if (!array || array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    }
};
