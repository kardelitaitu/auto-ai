import { createLogger } from './logger.js';

class PopupCloser {
  constructor(page, logger, options = {}) {
    this.page = page;
    this.logger = logger || createLogger('popup-closer.js');
    this.intervalMs = 120000;
    this.timer = null;
    this.lastClosedAt = Date.now();
    this.nextNotifyMinutes = 2;
    this.lock = options.lock;
    this.signal = options.signal;
    this.shouldSkip = options.shouldSkip;
    this.running = false;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runOnce().catch(() => {});
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce() {
    if (!this.page || this.page.isClosed()) return;
    if (this.signal?.aborted) return;
    if (this.shouldSkip?.()) return;
    if (this.running) return;
    this.running = true;
    try {
      if (this.lock) {
        return await this.lock(async () => this._runOnceInternal());
      }
      return await this._runOnceInternal();
    } finally {
      this.running = false;
    }
  }

  async _runOnceInternal() {
    if (!this.page || this.page.isClosed()) return;
    if (this.signal?.aborted) return;
    try {
      const btn = this.page.getByRole('button', { name: /Keep less relevant ads/i }).first();
      const count = await btn.count();
      if (count > 0) {
        if (await btn.isVisible().catch(() => false)) {
          await btn.scrollIntoViewIfNeeded();
          await btn.click();
          this.lastClosedAt = Date.now();
          this.nextNotifyMinutes = 2;
          this.logger.info('[popup-closer] Popup closed');
          return true;
        }
      }
      const alt = this.page.locator('button:has-text("Keep less relevant ads")').first();
      if (await alt.count() > 0 && await alt.isVisible().catch(() => false)) {
        await alt.scrollIntoViewIfNeeded();
        await alt.click();
        this.lastClosedAt = Date.now();
        this.nextNotifyMinutes = 2;
        this.logger.info('[popup-closer] Popup closed');
        return true;
      }
      return false;
    } catch (e) {
      this.logger.debug(`[popup-closer] ${e.message}`);
      return false;
    }
  }
}

export default PopupCloser;
