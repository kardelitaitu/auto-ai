/**
 * @fileoverview Base class for all browser discovery connectors.
 * @module connectors/baseDiscover
 */

class BaseDiscover {
    constructor() {
        /**
         * @type {string}
         * @description The type of browser this connector discovers (e.g., 'ixbrowser', 'chrome').
         */
        this.browserType = 'base';
    }

    /**
     * Discovers running browser instances.
     * @async
     * @abstract
     * @returns {Promise<object[]>} A promise that resolves to an array of discovered browser profiles.
     * Each profile should have: id, name, type, ws or http endpoint.
     */
    async discover() {
        throw new Error('Method "discover()" must be implemented by subclass');
    }
}

export default BaseDiscover;
