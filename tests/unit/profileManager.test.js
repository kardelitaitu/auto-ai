import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import { profileManager } from '../../utils/profileManager.js';

vi.mock('fs');

// Helper to create valid profiles
const createValidProfile = (id, meanScrollPause = 1000) => ({
  id,
  type: 'test-type',
  timings: {
    scrollPause: { mean: meanScrollPause, std: 200 }
  },
  probabilities: {
    dive: 50,
    like: 50,
    follow: 50,
    retweet: 50,
    quote: 50,
  }
});

describe('profileManager', () => {
  beforeEach(() => {
    profileManager.reset();
    vi.resetAllMocks();
  });

  it('should get a starter profile', () => {
    const profiles = [createValidProfile('profile1')];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(profiles));
    profileManager.reload();
    const starter = profileManager.getStarter();
    expect(starter).toEqual(profiles[0]);
  });

  it('should throw an error when getting a starter profile and none are loaded', () => {
    fs.existsSync.mockReturnValue(false);
    profileManager.reload();
    expect(() => profileManager.getStarter()).toThrow('No profiles loaded and auto-generation failed.');
  });

  it('should get a profile by ID', () => {
    const profiles = [createValidProfile('profile1'), createValidProfile('profile2')];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(profiles));
    profileManager.reload();
    const result = profileManager.getById('profile2');
    expect(result).toEqual(profiles[1]);
  });

  it('should throw an error when getting a profile by ID and none are loaded', () => {
    fs.existsSync.mockReturnValue(false);
    profileManager.reload();
    expect(() => profileManager.getById('any-id')).toThrow('No profiles loaded and auto-generation failed.');
  });

  it('should throw an error when profile is not found', () => {
    const profiles = [createValidProfile('profile1')];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(profiles));
    profileManager.reload();
    expect(() => profileManager.getById('nonexistent')).toThrow('Profile "nonexistent" not found.');
  });

  it('should reload profiles', () => {
    const profiles = [createValidProfile('profile1')];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(profiles));
    const result = profileManager.reload();
    expect(result).toBe(true);
    expect(profileManager.getCount()).toBe(1);
  });

  it('should return false when reloading and profiles file does not exist', () => {
    fs.existsSync.mockReturnValue(false);
    const result = profileManager.reload();
    expect(result).toBe(false);
  });

  it('should return the number of loaded profiles', () => {
    const profiles = [createValidProfile('profile1'), createValidProfile('profile2')];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(profiles));
    profileManager.reload();
    const count = profileManager.getCount();
    expect(count).toBe(2);
  });

  it('should handle empty profiles array', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify([]));
    profileManager.reload();
    expect(profileManager.getCount()).toBe(0);
  });

  it('should handle malformed JSON', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('invalid json');
    const result = profileManager.reload();
    expect(result).toBe(false);
    expect(profileManager.getCount()).toBe(0);
  });

  it('should get a starter profile asynchronously', async () => {
    const profiles = [createValidProfile('profile1')];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(profiles));
    await profileManager.reloadAsync();
    const starter = await profileManager.getStarterAsync();
    expect(starter).toEqual(profiles[0]);
  });

  it('should get a profile by ID asynchronously', async () => {
    const profiles = [createValidProfile('profile1'), createValidProfile('profile2')];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(profiles));
    await profileManager.reloadAsync();
    const result = await profileManager.getByIdAsync('profile2');
    expect(result).toEqual(profiles[1]);
  });

  it('should get a fatigued variant', () => {
    const profiles = [
      createValidProfile('profile1', 1000),
      createValidProfile('profile2', 3000),
    ];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(profiles));
    profileManager.reload();
    const fatigued = profileManager.getFatiguedVariant(1000);
    expect(fatigued).toEqual(profiles[1]);
  });

  it('should return null for fatigued variant if none match', () => {
    const profiles = [createValidProfile('profile1', 1000)];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(profiles));
    profileManager.reload();
    const fatigued = profileManager.getFatiguedVariant(2000);
    expect(fatigued).toBeNull();
  });

  it('should return null for fatigued variant if no profiles are loaded', () => {
    fs.existsSync.mockReturnValue(false);
    profileManager.reload();
    const fatigued = profileManager.getFatiguedVariant(1000);
    expect(fatigued).toBeNull();
  });

  it('should log validation issues for invalid profiles', () => {
    const invalidProfiles = [
      createValidProfile('valid1'),
      { id: 'invalid1' }, // Missing required fields
    ];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(invalidProfiles));
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    profileManager.reload();
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Profile validation issues'));
    consoleWarnSpy.mockRestore();
  });

  it('should throw an error with available IDs when profile is not found', () => {
    const profiles = [createValidProfile('profile1')];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(profiles));
    profileManager.reload();
    expect(() => profileManager.getById('nonexistent')).toThrow('Profile "nonexistent" not found. Available profiles: profile1');
  });

  it('should throw an error with available IDs when profile is not found asynchronously', async () => {
    const profiles = [createValidProfile('profile1')];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(profiles));
    await profileManager.reloadAsync();
    await expect(profileManager.getByIdAsync('nonexistent')).rejects.toThrow('Profile "nonexistent" not found. Available profiles: profile1');
  });
});
