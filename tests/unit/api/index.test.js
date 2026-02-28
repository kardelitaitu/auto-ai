
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import api from '../../../api/index.js';

// Mock the modules that index.js calls
vi.mock('../../../api/core/init.js', () => ({
  initPage: vi.fn().mockResolvedValue('init-result'),
  diagnosePage: vi.fn().mockResolvedValue('diagnose-result')
}));

vi.mock('../../../api/core/context.js', () => ({
  withPage: vi.fn(),
  clearContext: vi.fn(),
  isSessionActive: vi.fn(),
  checkSession: vi.fn(),
  getPage: vi.fn().mockReturnValue({
    emulateMedia: vi.fn().mockResolvedValue('emulate-result')
  }),
  getCursor: vi.fn(),
  evalPage: vi.fn(),
  getEvents: vi.fn(),
  getPlugins: vi.fn(),
  getContextState: vi.fn(),
  setContextState: vi.fn(),
  getStateSection: vi.fn(),
  updateStateSection: vi.fn()
}));

vi.mock('../../../api/interactions/cursor.js', () => ({
  move: vi.fn().mockResolvedValue('move-result'),
  up: vi.fn(),
  down: vi.fn(),
  setPathStyle: vi.fn(),
  getPathStyle: vi.fn(),
  startFidgeting: vi.fn(),
  stopFidgeting: vi.fn()
}));

describe('api/index.js', () => {
  it('should export all core modules', () => {
    // Context - Note: setPage is deprecated, use withPage instead
    expect(api.withPage).toBeDefined();
    expect(api.getPage).toBeDefined();
    expect(api.getCursor).toBeDefined();
    expect(api.isSessionActive).toBeDefined();
    expect(api.checkSession).toBeDefined();
    expect(api.clearContext).toBeDefined();
    expect(api.eval).toBeDefined();
    
    // Actions
    expect(api.click).toBeDefined();
    expect(api.type).toBeDefined();
    expect(api.hover).toBeDefined();
    expect(api.rightClick).toBeDefined();
    
    // Scroll
    expect(api.scroll).toBeDefined();
    expect(api.scroll.focus).toBeDefined();
    expect(api.scroll.toTop).toBeDefined();
    expect(api.scroll.read).toBeDefined();
    
    // Cursor
    expect(api.cursor).toBeDefined();
    expect(api.cursor.move).toBeDefined();
    expect(api.cursor.up).toBeDefined();
    expect(api.cursor.setPathStyle).toBeDefined();
    
    // Queries
    expect(api.text).toBeDefined();
    expect(api.attr).toBeDefined();
    expect(api.visible).toBeDefined();
    expect(api.count).toBeDefined();
    expect(api.exists).toBeDefined();
    expect(api.getCurrentUrl).toBeDefined();
    
    // Wait
    expect(api.wait).toBeDefined();
    expect(api.waitFor).toBeDefined();
    expect(api.waitForURL).toBeDefined();
    
    // Navigation
    expect(api.goto).toBeDefined();
    expect(api.reload).toBeDefined();
    expect(api.back).toBeDefined();
    expect(api.forward).toBeDefined();
    expect(api.setExtraHTTPHeaders).toBeDefined();
    
    // Warmup
    expect(api.beforeNavigate).toBeDefined();
    expect(api.randomMouse).toBeDefined();
    
    // Timing
    expect(api.think).toBeDefined();
    expect(api.delay).toBeDefined();
    
    // Persona
    expect(api.setPersona).toBeDefined();
    expect(api.getPersona).toBeDefined();
    
    // Recovery
    expect(api.recover).toBeDefined();
    expect(api.smartClick).toBeDefined();
    
    // Attention
    expect(api.gaze).toBeDefined();
    expect(api.attention).toBeDefined();
    
    // Idle
    expect(api.idle).toBeDefined();
    expect(api.idle.start).toBeDefined();
    expect(api.idle.stop).toBeDefined();
    expect(api.idle.heartbeat).toBeDefined();
    
    // Patch
    expect(api.patch).toBeDefined();
    expect(api.patch.apply).toBeDefined();
    expect(api.patch.check).toBeDefined();
    
    // Init
    expect(api.init).toBeDefined();
    expect(api.diagnose).toBeDefined();
    expect(api.emulateMedia).toBeDefined();
    
    // Events & Plugins
    // expect(api.events).toBeDefined(); // Getter throws if session inactive
    expect(api.plugins).toBeDefined();
    expect(api.plugins.register).toBeDefined();
    expect(api.plugins.list).toBeDefined();
    
    // Middleware
    expect(api.middleware).toBeDefined();
    expect(api.middleware.createPipeline).toBeDefined();
  });

  it('should expose cursor function and object properties', async () => {
    expect(typeof api.cursor).toBe('function');
    expect(typeof api.cursor.move).toBe('function');
    
    // Call the function part
    const { move } = await import('../../../api/interactions/cursor.js');
    await api.cursor('#target');
    expect(move).toHaveBeenCalledWith('#target');
  });

  it('should expose scroll function and object properties', () => {
    expect(typeof api.scroll).toBe('function');
    expect(typeof api.scroll.focus).toBe('function');
  });

  it('should call initPage when api.init is called', async () => {
    const { initPage } = await import('../../../api/core/init.js');
    const result = await api.init('page', { opt: 1 });
    expect(initPage).toHaveBeenCalledWith('page', { opt: 1 });
    expect(result).toBe('init-result');
  });

  it('should call diagnosePage when api.diagnose is called', async () => {
    const { diagnosePage } = await import('../../../api/core/init.js');
    const result = await api.diagnose('page');
    expect(diagnosePage).toHaveBeenCalledWith('page');
    expect(result).toBe('diagnose-result');
  });

  it('should call page.emulateMedia when api.emulateMedia is called', async () => {
    const { getPage } = await import('../../../api/core/context.js');
    const mockPage = getPage();
    const result = await api.emulateMedia({ colorScheme: 'dark' });
    expect(mockPage.emulateMedia).toHaveBeenCalledWith({ colorScheme: 'dark' });
    expect(result).toBe('emulate-result');
  });

  it('should expose events getter', async () => {
    const { getEvents } = await import('../../../api/core/context.js');
    getEvents.mockReturnValue('mock-events');
    expect(api.events).toBe('mock-events');
  });
});
