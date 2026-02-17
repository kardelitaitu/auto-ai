import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs', () => {
  const mockFs = {
    writeFileSync: vi.fn(),
    appendFile: vi.fn((...args) => {
      const cb = args[args.length - 1];
      if (typeof cb === 'function') cb(null);
    }),
    appendFileSync: vi.fn()
  };
  return {
    default: mockFs,
    ...mockFs
  };
});

describe('logger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize log file only once', async () => {
    const fs = await import('fs');
    const { createLogger } = await import('../../utils/logger.js');
    vi.runAllTimersAsync();
    createLogger('module-a');
    createLogger('module-b');
    vi.runAllTimersAsync();
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
  });

  it('should log with colors and write to file buffer', async () => {
    const fs = await import('fs');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { createLogger } = await import('../../utils/logger.js');
    vi.runAllTimersAsync();
    const logger = createLogger('task [Brave-1]');
    logger.info('[Agent:Bot] message http://example.com @user "q" (p)', { extra: true });
    logger.warn('[Metrics] warn');
    logger.error('[Module] error');
    logger.debug('[User] debug');
    logger.success('[Task] success');
    await vi.runAllTimersAsync();
    expect(consoleSpy).toHaveBeenCalled();
    expect(fs.appendFile).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should leave pre-colored tokens unchanged', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { createLogger } = await import('../../utils/logger.js');
    const logger = createLogger('color-test');
    logger.info('\x1b[31muser@host\x1b[0m "\x1b[32mquote\x1b[0m" (\x1b[33mparen\x1b[0m) \x1b[34mhttp://x.com\x1b[0m');
    await vi.runAllTimersAsync();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should colorize single-quoted text and user tags', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { createLogger } = await import('../../utils/logger.js');
    const logger = createLogger('tag-test');
    logger.info("[User:Test] 'single-quoted'");
    await vi.runAllTimersAsync();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should handle log file init failure', async () => {
    vi.resetModules();
    const fs = await import('fs');
    fs.writeFileSync.mockImplementation(() => { throw new Error('disk full'); });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { createLogger } = await import('../../utils/logger.js');
    createLogger('init-fail');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should flush no-op when buffer is empty', async () => {
    const fs = await import('fs');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { createLogger } = await import('../../utils/logger.js');
    const logger = createLogger('empty-flush');
    logger.info('one');
    process.emit('exit');
    await vi.runAllTimersAsync();
    expect(fs.appendFile).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log appendFile errors when flushing buffer', async () => {
    vi.resetModules();
    const fs = await import('fs');
    fs.appendFile.mockImplementation((...args) => {
      const cb = args[args.length - 1];
      if (typeof cb === 'function') cb(new Error('write fail'));
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { createLogger } = await import('../../utils/logger.js');
    const logger = createLogger('flush-error');
    logger.info('buffered');
    await vi.runAllTimersAsync();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should format script name when no brackets are provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { createLogger } = await import('../../utils/logger.js');
    const logger = createLogger('plain-script');
    logger.info('message');
    await vi.runAllTimersAsync();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should flush buffered logs on process exit', async () => {
    const fs = await import('fs');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { createLogger } = await import('../../utils/logger.js');
    const logger = createLogger('exit-test');
    logger.info('exit log');
    process.emit('exit');
    expect(fs.appendFileSync).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should track session lifecycle', async () => {
    const { sessionLogger } = await import('../../utils/logger.js');
    const started = sessionLogger.startSession('abc', 'brave');
    expect(started.sessionId).toBe('abc');
    expect(sessionLogger.getSessionId()).toBe('abc');
    const info = sessionLogger.getSessionInfo();
    expect(info.browserInfo).toBe('brave');
    const ended = sessionLogger.endSession();
    expect(ended.sessionId).toBe('abc');
    expect(sessionLogger.getSessionId()).toBe(null);
  });

  it('should handle session lifecycle without browser info', async () => {
    const { sessionLogger } = await import('../../utils/logger.js');
    const started = sessionLogger.startSession('no-browser');
    expect(started.browserInfo).toBe(null);
    const ended = sessionLogger.endSession();
    expect(ended.duration).toBe(0);
  });

  it('should handle endSession when no session is active', async () => {
    const { sessionLogger } = await import('../../utils/logger.js');
    const ended = sessionLogger.endSession();
    expect(ended.duration).toBe(0);
    expect(sessionLogger.getSessionId()).toBe(null);
  });

  it('should return empty session info when no session is active', async () => {
    const { sessionLogger } = await import('../../utils/logger.js');
    const info = sessionLogger.getSessionInfo();
    expect(info.sessionId).toBe(null);
  });

  it('should buffer and flush with BufferedLogger', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { createBufferedLogger } = await import('../../utils/logger.js');
    const buffered = createBufferedLogger('buffered', { maxBufferSize: 2, flushInterval: 10 });
    buffered.info('one');
    buffered.info('two');
    vi.advanceTimersByTime(20);
    buffered.shutdown();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should support buffered logger operations and stats', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { createBufferedLogger } = await import('../../utils/logger.js');
    const buffered = createBufferedLogger('ops', { maxBufferSize: 3, flushInterval: 10, minBufferSize: 1 });
    buffered.success('ok');
    buffered.warn('warn');
    buffered.debug('debug');
    buffered.error('error');
    buffered._startTimer();
    const stats = buffered.getStats();
    buffered.clear();
    buffered.shutdown();
    expect(stats.maxBufferSize).toBe(3);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should skip buffering when disabled', async () => {
    const { createBufferedLogger } = await import('../../utils/logger.js');
    const buffered = createBufferedLogger('disabled', { enabled: false });
    buffered.info('skip');
    const stats = buffered.getStats();
    buffered._stopTimer();
    expect(stats.enabled).toBe(false);
  });

  it('should use default module name when not provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { BufferedLogger } = await import('../../utils/logger.js');
    const buffered = new BufferedLogger({ maxBufferSize: 1, flushInterval: 10 });
    buffered.info('default-module');
    buffered.flush();
    buffered.shutdown();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should handle single entry flush', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { createBufferedLogger } = await import('../../utils/logger.js');
    const buffered = createBufferedLogger('single', { maxBufferSize: 5, flushInterval: 10 });
    buffered.info('only');
    buffered.flush();
    buffered.shutdown();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('BufferedLogger edge cases', () => {
  it('should handle flush when buffer is empty', async () => {
    const { createBufferedLogger } = await import('../../utils/logger.js');
    const buffered = createBufferedLogger('empty-flush', { flushInterval: 10 });
    // Should not throw
    buffered.flush();
    buffered.shutdown();
  });

  it('should auto-flush when maxBufferSize is reached', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { createBufferedLogger } = await import('../../utils/logger.js');
    const buffered = createBufferedLogger('auto-flush', { maxBufferSize: 2, flushInterval: 10000 });
    buffered.info('one');
    buffered.info('two');
    buffered.info('three'); // This should trigger auto-flush
    buffered.shutdown();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should group multiple entries by level', async () => {
    vi.useFakeTimers();
    try {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { createBufferedLogger } = await import('../../utils/logger.js');
      const buffered = createBufferedLogger('grouped', { maxBufferSize: 10, flushInterval: 10 });
      buffered.info('msg1');
      buffered.info('msg2');
      buffered.success('msg3');
      vi.advanceTimersByTime(20);
      buffered.shutdown();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Logger colorizeTags edge cases', () => {
  it('should handle URLs in tags', async () => {
    const { createLogger } = await import('../../utils/logger.js');
    const logger = createLogger('test');
    // The colorizeTags method is internal, test through logging
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('[http://example.com] message');
    consoleSpy.mockRestore();
  });

  it('should handle nested brackets in script name', async () => {
    const { createLogger } = await import('../../utils/logger.js');
    const logger = createLogger('task [Browser-1]');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test message');
    consoleSpy.mockRestore();
  });
});

describe('Logger file logging edge cases', () => {
  it('should handle structured data in log args', async () => {
    vi.useFakeTimers();
    try {
      const { createLogger } = await import('../../utils/logger.js');
      const logger = createLogger('structured-test');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.info('message with data', { key: 'value', nested: { a: 1 } });
      
      vi.runAllTimersAsync();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Logger exit handler', () => {
  it('should flush buffer on process exit', async () => {
    vi.useFakeTimers();
    try {
      // Clear any existing buffer
      vi.resetModules();
      
      const { createLogger } = await import('../../utils/logger.js');
      const logger = createLogger('exit-test');
      
      // Mock fs.appendFileSync to track calls
      const fs = await import('fs');
      const appendSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
      
      // Emit exit event to trigger the handler
      process.emit('exit');
      
      // With fake timers, the buffer won't have time to flush async
      // But we can check if the sync exit handler works
      expect(appendSpy).toHaveBeenCalled();
      appendSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should handle file write error on exit gracefully', async () => {
    vi.useFakeTimers();
    try {
      vi.resetModules();
      
      const { createLogger } = await import('../../utils/logger.js');
      const logger = createLogger('exit-error-test');
      
      const fs = await import('fs');
      const appendSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => {
        throw new Error('Disk full');
      });
      
      // Should not throw
      process.emit('exit');
      
      appendSpy.mockRestore();
    } catch (e) {
      // Should not reach here
      expect(false).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
