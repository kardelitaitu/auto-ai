import { describe, it, expect, vi, beforeEach } from 'vitest';
import { navigationDiversity, NAV_STATES } from '../../utils/navigation-diversity.js';

describe('NavigationDiversity', () => {
  let manager;
  let mockPage;

  beforeEach(() => {
    manager = navigationDiversity.createNavigationManager({
      rabbitHoleChance: 1, // Always enter rabbit hole for testing
      maxDepth: 3,
      minDepth: 1,
      exitProbability: 0.5,
      stayProbability: 0.5
    });

    mockPage = {
      waitForTimeout: vi.fn().mockResolvedValue(undefined)
    };
  });

  it('should initialize with default state', () => {
    expect(manager.getCurrentState()).toBe(NAV_STATES.FEED);
  });

  it('should set state and record history', () => {
    manager.setState(NAV_STATES.PROFILE, 'test-reason');
    expect(manager.getCurrentState()).toBe(NAV_STATES.PROFILE);
    const history = manager.getStateHistory();
    expect(history.length).toBe(1);
    expect(history[0].to).toBe(NAV_STATES.PROFILE);
    expect(history[0].reason).toBe('test-reason');
  });

  it('should get possible transitions', () => {
    manager.setState(NAV_STATES.FEED);
    const transitions = manager.getPossibleTransitions();
    expect(transitions).toHaveProperty('clickAvatar', NAV_STATES.PROFILE);
  });

  it('should get specific transition', () => {
    manager.setState(NAV_STATES.FEED);
    expect(manager.getTransition('clickAvatar')).toBe(NAV_STATES.PROFILE);
    expect(manager.getTransition('non-existent')).toBe(null);
  });

  it('should navigate between states', async () => {
    const result = await manager.navigate(mockPage, 'clickAvatar');
    expect(result.success).toBe(true);
    expect(result.to).toBe(NAV_STATES.PROFILE);
    expect(manager.getCurrentState()).toBe(NAV_STATES.PROFILE);
  });

  it('should fail navigation for invalid transitions', async () => {
    const result = await manager.navigate(mockPage, 'invalid-action');
    expect(result.success).toBe(false);
  });

  it('should handle sync transitions', () => {
    const result = manager.transition('clickAvatar');
    expect(result.success).toBe(true);
    expect(result.to).toBe(NAV_STATES.PROFILE);
  });

  it('should track depth', () => {
    expect(manager.getDepth()).toBe(0);
    manager.incrementDepth();
    expect(manager.getDepth()).toBe(1);
    manager.resetDepth();
    expect(manager.getDepth()).toBe(0);
  });

  it('should identify when to exit rabbit hole (max depth)', () => {
    manager.incrementDepth();
    manager.incrementDepth();
    manager.incrementDepth(); // Depth 3
    expect(manager.shouldExitRabbitHole()).toBe(true);
  });

  it('should calculate return path to FEED', () => {
    manager.setState(NAV_STATES.PROFILE);
    const path = manager.getReturnPath();
    expect(path).toContain('clickBack');
  });

  it('should return to FEED', async () => {
    manager.setState(NAV_STATES.PROFILE);
    const result = await manager.returnToFeed(mockPage);
    expect(result.success).toBe(true);
    expect(manager.getCurrentState()).toBe(NAV_STATES.FEED);
  });

  it('should execute rabbit hole sequence', async () => {
    const actions = ['clickAvatar', 'clickTweet', 'clickBack'];
    const result = await manager.executeRabbitHole(mockPage, actions);
    expect(result.success).toBe(true);
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it('should reset manager state', () => {
    manager.setState(NAV_STATES.PROFILE);
    manager.incrementDepth();
    manager.reset();
    expect(manager.getCurrentState()).toBe(NAV_STATES.FEED);
    expect(manager.getDepth()).toBe(0);
    expect(manager.getStateHistory().length).toBe(0);
  });
});
