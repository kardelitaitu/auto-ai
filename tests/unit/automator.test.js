import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Automator from '../../core/automator.js';
import { chromium } from 'playwright';
import { getTimeoutValue } from '../../utils/configLoader.js';
import { withRetry } from '../../utils/retry.js';

vi.mock('playwright', () => ({
  chromium: {
    connectOverCDP: vi.fn(),
    launch: vi.fn(),
  },
}));
vi.mock('../../utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));
vi.mock('../../utils/configLoader.js', () => ({
  getTimeoutValue: vi.fn(),
}));
vi.mock('../../utils/retry.js', () => ({
  withRetry: vi.fn((fn) => fn()),
}));

describe('Automator', () => {
  let automator;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    automator = new Automator();
  });

  afterEach(() => {
    automator.stopHealthChecks();
    vi.useRealTimers();
  });

  it('connectToBrowser should connect and test the browser', async () => {
    const mockBrowser = {
      isConnected: vi.fn().mockReturnValue(true),
      close: vi.fn().mockResolvedValue(),
    };
    chromium.connectOverCDP.mockResolvedValue(mockBrowser);
    getTimeoutValue.mockResolvedValue(5000);

    const wsEndpoint = 'ws://localhost:1234';
    const browser = await automator.connectToBrowser(wsEndpoint);

    expect(browser).toBe(mockBrowser);
    expect(chromium.connectOverCDP).toHaveBeenCalledWith(wsEndpoint, { timeout: 5000 });
    expect(automator.connections.has(wsEndpoint)).toBe(true);
  });

  it('testConnection should throw if browser is disconnected', async () => {
    const mockBrowser = { isConnected: vi.fn().mockReturnValue(false) };
    await expect(automator.testConnection(mockBrowser)).rejects.toThrow('Browser is not connected');
  });

  it('reconnect should close old and open new connection', async () => {
    const oldBrowser = { close: vi.fn().mockResolvedValue(), isConnected: vi.fn().mockReturnValue(true) };
    const newBrowser = { isConnected: vi.fn().mockReturnValue(true) };
    const wsEndpoint = 'ws://localhost:1234';

    automator.connections.set(wsEndpoint, { browser: oldBrowser });
    chromium.connectOverCDP.mockResolvedValue(newBrowser);

    const reconnected = await automator.reconnect(wsEndpoint);

    expect(oldBrowser.close).toHaveBeenCalled();
    expect(reconnected).toBe(newBrowser);
    expect(automator.connections.get(wsEndpoint).browser).toBe(newBrowser);
  });

  it('startHealthChecks should periodically check healthy connections', async () => {
    const mockBrowser = { isConnected: vi.fn().mockReturnValue(true) };
    const wsEndpoint = 'ws://localhost:1234';
    automator.connections.set(wsEndpoint, {
      browser: mockBrowser,
      lastHealthCheck: Date.now() - 20000, // Trigger check
      healthy: true
    });

    getTimeoutValue.mockResolvedValue(1000);
    await automator.startHealthChecks(1000);

    vi.advanceTimersByTime(1500);
    expect(mockBrowser.isConnected).toHaveBeenCalled();
  });

  it('checkPageResponsive should evaluate script in page', async () => {
    const mockPage = {
      isClosed: vi.fn().mockReturnValue(false),
      evaluate: vi.fn().mockResolvedValue({ documentReady: 'complete', title: 'Test', bodyExists: true })
    };

    const result = await automator.checkPageResponsive(mockPage);
    expect(result.healthy).toBe(true);
    expect(result.title).toBe('Test');
  });

  it('recoverConnection should attempt reload or reconnect', async () => {
    const mockBrowser = { isConnected: vi.fn().mockReturnValue(false) };
    const wsEndpoint = 'ws://localhost:1234';
    automator.connections.set(wsEndpoint, { browser: mockBrowser });

    const newBrowser = { isConnected: vi.fn().mockReturnValue(true) };
    chromium.connectOverCDP.mockResolvedValue(newBrowser);

    const result = await automator.recoverConnection(wsEndpoint);
    expect(result.successful).toBe(true);
    expect(result.steps.some(s => s.step === 'reconnect' && s.success)).toBe(true);
  });

  it('closeAll should close all browsers and clear connections', async () => {
    const mockBrowser = { close: vi.fn().mockResolvedValue() };
    automator.connections.set('ws1', { browser: mockBrowser, endpoint: 'ws1' });
    automator.connections.set('ws2', { browser: mockBrowser, endpoint: 'ws2' });

    await automator.closeAll();

    expect(mockBrowser.close).toHaveBeenCalledTimes(2);
    expect(automator.connections.size).toBe(0);
    expect(automator.isShuttingDown).toBe(true);
  });
});
