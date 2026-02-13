/**
 * @fileoverview Manages Playwright browser connections, including health checks and automatic reconnections.
 * @module core/automator
 */

import { chromium } from 'playwright';
import { createLogger } from '../utils/logger.js';
import { getTimeoutValue } from '../utils/configLoader.js';
import { withRetry } from '../utils/retry.js';

const logger = createLogger('automator.js');

/**
 * @class Automator
 * @description Manages browser connections with health monitoring and reconnection capabilities.
 */
class Automator {
  constructor() {
    /** @type {Map<string, object>} */
    this.connections = new Map();
    this.healthCheckInterval = null;
    this.isShuttingDown = false;
  }

  /**
   * Connects to a browser via its CDP endpoint.
   * @param {string} wsEndpoint - The WebSocket endpoint URL of the browser.
   * @param {object} [options={}] - Connection options for Playwright.
   * @returns {Promise<object>} A promise that resolves with the connected browser instance.
   */
  async connectToBrowser(wsEndpoint, options = {}) {
    const timeout = await getTimeoutValue('browser.connectionTimeoutMs', 10000);

    const browser = await withRetry(async () => {
      logger.info(`Attempting connection to ${wsEndpoint}`);
      const browser = await chromium.connectOverCDP(wsEndpoint, {
        timeout,
        ...options
      });
      await this.testConnection(browser);
      return browser;
    }, { description: `Browser connection to ${wsEndpoint}` });

    this.connections.set(wsEndpoint, {
      browser,
      endpoint: wsEndpoint,
      connectedAt: Date.now(),
      lastHealthCheck: Date.now(),
      healthy: true,
      reconnectAttempts: 0
    });

    logger.info(`Successfully connected to ${wsEndpoint}`);
    return browser;
  }

  /**
   * Tests the health of a browser connection.
   * @param {object} browser - The browser instance to test.
   * @returns {Promise<boolean>} A promise that resolves with true if the connection is healthy.
   * @throws {Error} If the browser is not connected.
   */
  async testConnection(browser) {
    if (!browser.isConnected()) {
      throw new Error('Browser is not connected');
    }
    return true;
  }

  /**
   * Reconnects to a browser if the connection is lost.
   * @param {string} wsEndpoint - The WebSocket endpoint to reconnect to.
   * @returns {Promise<object>} A promise that resolves with the reconnected browser instance.
   */
  async reconnect(wsEndpoint) {
    logger.info(`Attempting to reconnect to ${wsEndpoint}`);
    const connectionInfo = this.connections.get(wsEndpoint);

    if (connectionInfo?.browser) {
      try {
        await connectionInfo.browser.close();
      } catch (e) {
        logger.debug('Error closing old connection:', e.message);
      }
    }

    this.connections.delete(wsEndpoint);

    return this.connectToBrowser(wsEndpoint);
  }

  /**
   * Starts health check monitoring for all connections.
   * @param {number} [interval=null] - The health check interval in milliseconds. Defaults to the value from the configuration.
   */
  async startHealthChecks(interval = null) {
    if (this.healthCheckInterval) {
      logger.warn('Health checks already running');
      return;
    }

    const checkInterval = interval || await getTimeoutValue('browser.healthCheckIntervalMs', 30000);

    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      // Removed repetitive debug log - only log failures/changes

      for (const [endpoint, connectionInfo] of this.connections.entries()) {
        try {
          const timeSinceLastCheck = Date.now() - connectionInfo.lastHealthCheck;
          if (timeSinceLastCheck < 10000) {
            continue;
          }

          await this.testConnection(connectionInfo.browser);

          // Only log if status changed from unhealthy to healthy
          const wasUnhealthy = !connectionInfo.healthy;

          connectionInfo.lastHealthCheck = Date.now();
          connectionInfo.healthy = true;
          connectionInfo.reconnectAttempts = 0;

          if (wasUnhealthy) {
            logger.info(`Health check recovered for ${endpoint}`);
          }

        } catch (error) {
          logger.error(`Health check failed for ${endpoint}:`, error.message);
          connectionInfo.healthy = false;

          this.attemptBackgroundReconnect(endpoint, connectionInfo);
        }
      }
    }, checkInterval);

    logger.info(`Started health check monitoring (interval: ${checkInterval}ms)`);
  }

  /**
   * Attempts to reconnect to a browser in the background.
   * @param {string} endpoint - The WebSocket endpoint to reconnect to.
   * @param {object} connectionInfo - The connection information object.
   * @private
   */
  async attemptBackgroundReconnect(endpoint, connectionInfo) {
    if (connectionInfo.reconnectAttempts >= 3) {
      logger.error(`Max reconnect attempts reached for ${endpoint}, removing connection`);
      this.connections.delete(endpoint);
      return;
    }

    connectionInfo.reconnectAttempts++;

    try {
      logger.info(`Background reconnection attempt ${connectionInfo.reconnectAttempts} for ${endpoint}`);
      await this.reconnect(endpoint);
    } catch (error) {
      logger.error(`Background reconnect failed for ${endpoint}:`, error.message);
    }
  }

  /**
   * Stops the health check monitoring.
   */
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Stopped health check monitoring');
    }
  }

  /**
   * Gets a browser instance by its WebSocket endpoint.
   * @param {string} wsEndpoint - The WebSocket endpoint of the browser.
   * @returns {object | null} The browser instance, or null if not found.
   */
  getBrowser(wsEndpoint) {
    const connectionInfo = this.connections.get(wsEndpoint);
    return connectionInfo?.browser || null;
  }

  /**
   * Checks if a browser connection is healthy.
   * @param {string} wsEndpoint - The WebSocket endpoint of the browser.
   * @returns {boolean} True if the connection is healthy, false otherwise.
   */
  isHealthy(wsEndpoint) {
    const connectionInfo = this.connections.get(wsEndpoint);
    return connectionInfo?.healthy ?? false;
  }

  /**
   * Gets all connected WebSocket endpoints.
   * @returns {string[]} An array of connected WebSocket endpoints.
   */
  getConnectedEndpoints() {
    return Array.from(this.connections.keys());
  }

  /**
   * Gets the number of active connections.
   * @returns {number} The number of active connections.
   */
  getConnectionCount() {
    return this.connections.size;
  }

  /**
   * Gets the number of healthy connections.
   * @returns {number} The number of healthy connections.
   */
  getHealthyConnectionCount() {
    return Array.from(this.connections.values())
      .filter(conn => conn.healthy)
      .length;
  }

  /**
   * Closes all browser connections.
   * @returns {Promise<void>}
   */
  async closeAll() {
    this.isShuttingDown = true;

    logger.info(`Closing ${this.connections.size} browser connections`);

    this.stopHealthChecks();

    const closePromises = Array.from(this.connections.values()).map(
      async (connectionInfo) => {
        try {
          if (connectionInfo.browser && typeof connectionInfo.browser.close === 'function') {
            await connectionInfo.browser.close();
            logger.debug(`Closed connection to ${connectionInfo.endpoint}`);
          }
        } catch (error) {
          logger.error(`Error closing browser at ${connectionInfo.endpoint}:`, error.message);
        }
      }
    );

    await Promise.allSettled(closePromises);
    this.connections.clear();

    logger.info('All connections closed');
  }

  // =========================================================================
  // CONNECTION HEALTH CHECKS - Better error recovery
  // =========================================================================

  /**
   * Check network connectivity by trying to reach a known endpoint
   * @returns {Promise<object>} Health check result
   */
  async checkNetworkConnectivity() {
    const startTime = Date.now();
    
    try {
      // Try to fetch a simple known URL to check network
      const { chromium } = await import('playwright');
      const testContext = await chromium.launch({ headless: true });
      const testPage = await testContext.newPage();
      
      // Use a very short timeout for quick check
      await testPage.goto('https://x.com', { 
        waitUntil: 'domcontentloaded', 
        timeout: 5000 
      });
      
      await testContext.close();
      
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency,
        checkedAt: Date.now()
      };
    } catch (error) {
      return {
        healthy: false,
        latency: null,
        error: error.message,
        checkedAt: Date.now()
      };
    }
  }

  /**
   * Check if page is responsive by evaluating JavaScript
   * @param {object} page - Playwright page object
   * @returns {Promise<object>} Page health result
   */
  async checkPageResponsive(page) {
    try {
      if (!page || page.isClosed()) {
        return {
          healthy: false,
          error: 'Page is closed or null',
          checkedAt: Date.now()
        };
      }

      // Try to evaluate simple JS to check responsiveness
      const result = await page.evaluate(() => {
        return {
          documentReady: document.readyState,
          title: document.title,
          bodyExists: !!document.body
        };
      }).catch(() => ({ error: 'Evaluation failed' }));

      const isResponsive = result.documentReady === 'complete' || result.documentReady === 'interactive';
      
      return {
        healthy: isResponsive,
        documentState: result.documentReady,
        title: result.title,
        checkedAt: Date.now()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        checkedAt: Date.now()
      };
    }
  }

  /**
   * Perform comprehensive health check on a connection
   * @param {string} wsEndpoint - WebSocket endpoint
   * @param {object} page - Optional page object for page check
   * @returns {Promise<object>} Comprehensive health status
   */
  async checkConnectionHealth(wsEndpoint, page = null) {
    const connectionInfo = this.connections.get(wsEndpoint);
    
    const checks = {
      browserConnection: false,
      network: null,
      page: null
    };

    // Check browser connection
    try {
      if (connectionInfo?.browser?.isConnected()) {
        checks.browserConnection = true;
      }
    } catch (error) {
      checks.browserConnection = false;
    }

    // Check network (every 5th check to avoid overhead)
    if (Math.random() < 0.2) {
      checks.network = await this.checkNetworkConnectivity();
    }

    // Check page if provided
    if (page) {
      checks.page = await this.checkPageResponsive(page);
    }

    // Determine overall health
    const healthy = checks.browserConnection && 
                   (checks.network?.healthy !== false) &&
                   (checks.page?.healthy !== false);

    const result = {
      endpoint: wsEndpoint,
      healthy,
      checks,
      checkedAt: Date.now()
    };

    // Update connection info
    if (connectionInfo) {
      connectionInfo.healthy = healthy;
      connectionInfo.lastHealthCheck = Date.now();
    }

    return result;
  }

  /**
   * Attempt to recover a connection
   * @param {string} wsEndpoint - WebSocket endpoint
   * @param {object} page - Playwright page object
   * @returns {Promise<object>} Recovery result
   */
  async recoverConnection(wsEndpoint, page = null) {
    const connectionInfo = this.connections.get(wsEndpoint);
    const recoverySteps = [];

    logger.warn(`[Health] Starting connection recovery for ${wsEndpoint}`);

    // Step 1: Verify browser connection
    try {
      if (connectionInfo?.browser?.isConnected()) {
        recoverySteps.push({ step: 'browser_check', success: true });
        
        // Step 2: Try page navigation if page provided
        if (page && !page.isClosed()) {
          try {
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
            recoverySteps.push({ step: 'page_reload', success: true });
          } catch (error) {
            recoverySteps.push({ step: 'page_reload', success: false, error: error.message });
            
            // Step 3: Try navigating directly to home
            try {
              await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 20000 });
              recoverySteps.push({ step: 'navigate_home', success: true });
            } catch (navError) {
              recoverySteps.push({ step: 'navigate_home', success: false, error: navError.message });
            }
          }
        }
      } else {
        recoverySteps.push({ step: 'browser_check', success: false, error: 'Browser disconnected' });
        
        // Try to reconnect
        try {
          await this.reconnect(wsEndpoint);
          recoverySteps.push({ step: 'reconnect', success: true });
        } catch (error) {
          recoverySteps.push({ step: 'reconnect', success: false, error: error.message });
        }
      }
    } catch (error) {
      recoverySteps.push({ step: 'initial_check', success: false, error: error.message });
    }

    // Determine if recovery was successful
    const recoverySuccessful = recoverySteps.some(step => step.success);
    
    logger.warn(`[Health] Recovery ${recoverySuccessful ? 'succeeded' : 'failed'} for ${wsEndpoint}`);

    return {
      successful: recoverySuccessful,
      steps: recoverySteps,
      recoveredAt: Date.now()
    };
  }

  /**
   * Get health summary for all connections
   * @returns {Promise<object>} Health summary
   */
  async getHealthSummary() {
    const endpoints = this.getConnectedEndpoints();
    const summary = {
      total: endpoints.length,
      healthy: 0,
      unhealthy: 0,
      connections: {}
    };

    for (const endpoint of endpoints) {
      const health = await this.checkConnectionHealth(endpoint);
      summary.connections[endpoint] = health;
      
      if (health.healthy) {
        summary.healthy++;
      } else {
        summary.unhealthy++;
      }
    }

    return summary;
  }

  /**
   * Gets connection statistics.
   * @returns {object} An object containing connection statistics.
   */
  getStats() {
    const connections = Array.from(this.connections.values());

    return {
      totalConnections: this.connections.size,
      healthyConnections: this.getHealthyConnectionCount(),
      unhealthyConnections: this.connections.size - this.getHealthyConnectionCount(),
      connections: connections.map(conn => ({
        endpoint: conn.endpoint,
        healthy: conn.healthy,
        uptime: Date.now() - conn.connectedAt,
        lastHealthCheck: Date.now() - conn.lastHealthCheck,
        reconnectAttempts: conn.reconnectAttempts
      }))
    };
  }

  /**
   * Gracefully shuts down the automator.
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.info('Automator shutting down...');
    await this.closeAll();
    logger.info('Automator shutdown complete');
  }
}

export default Automator;
export { Automator };
