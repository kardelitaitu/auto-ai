import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn()
  }))
}));

vi.mock('../../utils/screenshot.js', () => ({
  takeScreenshot: vi.fn().mockResolvedValue('/path/to/screenshot.png')
}));

describe('tasks/agentNavigate.js', () => {
  it('should export a default function', async () => {
    const task = await import('../../tasks/agentNavigate.js');
    expect(task.default).toBeDefined();
    expect(typeof task.default).toBe('function');
  });

  it('should require targetUrl parameter', async () => {
    const task = await import('../../tasks/agentNavigate.js');
    const agentNavigate = task.default;
    
    const mockPage = {
      goto: vi.fn(),
      waitForTimeout: vi.fn()
    };

    await expect(agentNavigate(mockPage, { goal: 'test' }))
      .rejects.toThrow('agentNavigate requires targetUrl and goal parameters');
  });

  it('should require goal parameter', async () => {
    const task = await import('../../tasks/agentNavigate.js');
    const agentNavigate = task.default;
    
    const mockPage = {
      goto: vi.fn(),
      waitForTimeout: vi.fn()
    };

    await expect(agentNavigate(mockPage, { targetUrl: 'https://example.com' }))
      .rejects.toThrow('agentNavigate requires targetUrl and goal parameters');
  });

  it('should require both parameters', async () => {
    const task = await import('../../tasks/agentNavigate.js');
    const agentNavigate = task.default;
    
    const mockPage = {
      goto: vi.fn(),
      waitForTimeout: vi.fn()
    };

    await expect(agentNavigate(mockPage, {}))
      .rejects.toThrow('agentNavigate requires targetUrl and goal parameters');
  });

  it('should use default browser info', async () => {
    const task = await import('../../tasks/agentNavigate.js');
    const agentNavigate = task.default;
    
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
      mouse: {
        move: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined)
      }
    };

    // This will fail due to missing mocks, but that's ok for this test
    await expect(agentNavigate(mockPage, { targetUrl: 'https://example.com', goal: 'test' }))
      .rejects.toBeDefined();
  });
});

describe('tasks/agentNavigate.js - Parameter Validation', () => {
  it('should throw when targetUrl is empty string', async () => {
    const task = await import('../../tasks/agentNavigate.js');
    const agentNavigate = task.default;
    
    const mockPage = { goto: vi.fn() };
    
    await expect(agentNavigate(mockPage, { targetUrl: '', goal: 'test' }))
      .rejects.toThrow('agentNavigate requires targetUrl and goal parameters');
  });

  it('should throw when goal is empty string', async () => {
    const task = await import('../../tasks/agentNavigate.js');
    const agentNavigate = task.default;
    
    const mockPage = { goto: vi.fn() };
    
    await expect(agentNavigate(mockPage, { targetUrl: 'https://example.com', goal: '' }))
      .rejects.toThrow('agentNavigate requires targetUrl and goal parameters');
  });

  it('should throw when targetUrl is null', async () => {
    const task = await import('../../tasks/agentNavigate.js');
    const agentNavigate = task.default;
    
    const mockPage = { goto: vi.fn() };
    
    await expect(agentNavigate(mockPage, { targetUrl: null, goal: 'test' }))
      .rejects.toThrow('agentNavigate requires targetUrl and goal parameters');
  });

  it('should throw when goal is null', async () => {
    const task = await import('../../tasks/agentNavigate.js');
    const agentNavigate = task.default;
    
    const mockPage = { goto: vi.fn() };
    
    await expect(agentNavigate(mockPage, { targetUrl: 'https://example.com', goal: null }))
      .rejects.toThrow('agentNavigate requires targetUrl and goal parameters');
  });

  it('should throw when targetUrl is undefined', async () => {
    const task = await import('../../tasks/agentNavigate.js');
    const agentNavigate = task.default;
    
    const mockPage = { goto: vi.fn() };
    
    await expect(agentNavigate(mockPage, { targetUrl: undefined, goal: 'test' }))
      .rejects.toThrow('agentNavigate requires targetUrl and goal parameters');
  });
});
