/**
 * @fileoverview Base class for discovery connectors.
 * @module connectors/baseDiscover
 */

import { createLogger } from '../utils/logger.js';

/**
 * @class BaseDiscover
 * @description An abstract base class for discovery connectors. Connectors should extend this class and implement the discover method.
 */
class BaseDiscover {
  constructor() {
    if (new.target === BaseDiscover) {
      throw new TypeError("Cannot construct BaseDiscover instances directly");
    }
    /** @type {object} */
    this.logger = createLogger('baseDiscover.js');
    this.logger.info('BaseDiscover initialized');
  }

  /**
   * Discovers browser instances.
   * @returns {Promise<object[]>} A promise that resolves with an array of discovered browser endpoints.
   * @throws {Error} If the method is not implemented by a subclass.
   */
  async discover() {
    this.logger.info('Discover method called');
    throw new Error("Method 'discover()' must be implemented.");
  }
}

export default BaseDiscover;
