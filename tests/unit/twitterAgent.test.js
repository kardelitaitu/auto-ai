import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/ghostCursor.js', () => ({
  GhostCursor: class {
    constructor() { }
    click() { }
  }
}));

vi.mock('../../utils/scroll-helper.js', () => ({
  scrollDown: vi.fn().mockResolvedValue(undefined),
  scrollUp: vi.fn().mockResolvedValue(undefined),
  scrollRandom: vi.fn().mockResolvedValue(undefined),
  scrollWheel: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../api/index.js', () => {
    const api = {
        setPage: vi.fn(),
        getPage: vi.fn(),
        wait: vi.fn().mockImplementation(async (ms) => {
            vi.advanceTimersByTime(ms || 0);
            return Promise.resolve();
        }),
        think: vi.fn().mockResolvedValue(undefined),
        getPersona: vi.fn().mockReturnValue({ microMoveChance: 0.1, fidgetChance: 0.05 }),
        scroll: Object.assign(vi.fn().mockResolvedValue(undefined), {
            toTop: vi.fn().mockResolvedValue(undefined),
            back: vi.fn().mockResolvedValue(undefined),
            read: vi.fn().mockResolvedValue(undefined),
            focus: vi.fn().mockResolvedValue(undefined)
        }),
        visible: vi.fn().mockImplementation(async (el) => {
            if (el && typeof el.isVisible === 'function') return await el.isVisible();
            if (el && typeof el.count === 'function') return (await el.count()) > 0;
            return true;
        }),
        exists: vi.fn().mockImplementation(async (el) => {
            if (el && typeof el.count === 'function') return (await el.count()) > 0;
            return el !== null;
        }),
        getCurrentUrl: vi.fn().mockResolvedValue('https://x.com/'),
        goto: vi.fn().mockResolvedValue(undefined),
        reload: vi.fn().mockResolvedValue(undefined),
        eval: vi.fn().mockResolvedValue('mock result'),
        text: vi.fn().mockResolvedValue('mock text'),
        click: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined),
        emulateMedia: vi.fn().mockResolvedValue(undefined),
        setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
        clearContext: vi.fn(),
        checkSession: vi.fn().mockResolvedValue(true),
        isSessionActive: vi.fn().mockReturnValue(true)
    };
    return { api, default: api };
});
import { api } from '../../api/index.js';

vi.mock('../../utils/humanization/index.js', () => ({
  HumanizationEngine: class {
    constructor() { }
    think() { return Promise.resolve(); }
    consumeContent() { return Promise.resolve(); }
    multitask() { return Promise.resolve(); }
    recoverFromError() { return Promise.resolve(); }
    sessionStart() { return Promise.resolve(); }
    sessionEnd() { return Promise.resolve(); }
    cycleComplete() { return Promise.resolve(); }
    session = { shouldEndSession: () => true };
  }
}));
vi.mock('../../utils/profileManager.js', () => ({
  profileManager: {
    getFatiguedVariant: vi.fn(),
    getStarter: vi.fn().mockReturnValue({ theme: 'dark' }),
    getById: vi.fn().mockReturnValue({ id: 'p1', theme: 'light' })
  }
}));
vi.mock('../../utils/mathUtils.js', () => ({
  mathUtils: {
    randomInRange: vi.fn(() => 1000),
    gaussian: vi.fn(() => 1000),
    roll: vi.fn(() => true)
  }
}));

describe('twitterAgent', () => {
  let TwitterAgent;
  let agent;
  let mockPage;
  let mockLogger;
  let mockProfile;
  let profileManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
      emulateMedia: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://x.com/'),
      isClosed: vi.fn().mockReturnValue(false),
      context: vi.fn().mockReturnValue({ browser: vi.fn().mockReturnValue({ isConnected: vi.fn().mockReturnValue(true) }) }),
      title: vi.fn().mockResolvedValue('mock title'),
      locator: vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        count: vi.fn().mockResolvedValue(1),
        isVisible: vi.fn().mockResolvedValue(true),
        boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 }),
        click: vi.fn().mockResolvedValue(undefined),
        textContent: vi.fn().mockResolvedValue('mock text'),
        getAttribute: vi.fn().mockResolvedValue('mock attr')
      }),
      getByText: vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
           isVisible: vi.fn().mockResolvedValue(false)
        })
      }),
      keyboard: { press: vi.fn().mockResolvedValue(undefined), type: vi.fn().mockResolvedValue(undefined) },
      mouse: { move: vi.fn().mockResolvedValue(undefined), click: vi.fn().mockResolvedValue(undefined), wheel: vi.fn().mockResolvedValue(undefined) },
      reload: vi.fn().mockResolvedValue(undefined)
    };

    api.getPage.mockReturnValue(mockPage);
    api.setPage.mockReturnValue(undefined);

    ({ TwitterAgent } = await import('../../utils/twitterAgent.js'));
    ({ profileManager } = await import('../../utils/profileManager.js'));

    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), log: vi.fn() };
    mockProfile = {
      id: 'test-profile',
      username: 'testuser',
      inputMethods: { wheelDown: 0.8, wheelUp: 0.05, space: 0.05, keysDown: 0.1, keysUp: 0 }
    };
    agent = new TwitterAgent(mockPage, mockProfile, mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize correctly', () => {
    expect(agent).toBeDefined();
    expect(agent.page).toBe(mockPage);
  });

  it('checkLoginState should return true if logged in', async () => {
    mockPage.locator.mockReturnValue({
      first: vi.fn().mockReturnThis(),
      isVisible: vi.fn().mockResolvedValue(false),
      count: vi.fn().mockResolvedValue(1)
    });
    const result = await agent.checkLoginState();
    expect(result).toBe(true);
  });

  it('navigateHome should call api.goto', async () => {
    await agent.navigateHome();
    expect(api.goto).toHaveBeenCalledWith('https://x.com/');
  });

  it('postTweet should call api methods', async () => {
    await agent.postTweet('Hello World');
    expect(api.wait).toHaveBeenCalled();
  });
});
