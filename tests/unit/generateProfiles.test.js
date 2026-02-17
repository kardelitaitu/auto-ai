import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.join(__dirname, '../../data/twitterActivityProfiles.json');

describe('generateProfiles', () => {
    it('should generate 50 profiles', () => {
        const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(50);
    });

    it('should create profiles with required fields', () => {
        const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        const profile = data[0];
        
        expect(profile).toHaveProperty('id');
        expect(profile).toHaveProperty('description');
        expect(profile).toHaveProperty('timings');
        expect(profile).toHaveProperty('probabilities');
        expect(profile).toHaveProperty('inputMethods');
        expect(profile).toHaveProperty('maxLike');
        expect(profile).toHaveProperty('maxFollow');
        expect(profile).toHaveProperty('theme');
    });

    it('should have required probability fields', () => {
        const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        const profile = data[0];
        
        expect(profile.probabilities).toHaveProperty('refresh');
        expect(profile.probabilities).toHaveProperty('profileDive');
        expect(profile.probabilities).toHaveProperty('tweetDive');
        expect(profile.probabilities).toHaveProperty('likeTweetafterDive');
        expect(profile.probabilities).toHaveProperty('bookmarkAfterDive');
        expect(profile.probabilities).toHaveProperty('followOnProfile');
        expect(profile.probabilities).toHaveProperty('tweet');
        expect(profile.probabilities).toHaveProperty('idle');
    });

    it('should have required timing fields', () => {
        const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        const profile = data[0];
        
        expect(profile.timings).toHaveProperty('readingPhase');
        expect(profile.timings).toHaveProperty('scrollPause');
        expect(profile.timings).toHaveProperty('actionSpecific');
    });

    it('should include actionSpecific timing for different actions', () => {
        const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        const profile = data[0];
        
        expect(profile.timings.actionSpecific).toHaveProperty('space');
        expect(profile.timings.actionSpecific).toHaveProperty('keys');
        expect(profile.timings.actionSpecific).toHaveProperty('idle');
    });

    it('should generate different profile types', () => {
        const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        
        const types = new Set(data.map(p => {
            const match = p.id.match(/^\d+-(.+)$/);
            return match ? match[1] : '';
        }));
        
        expect(types.has('Skimmer')).toBe(true);
        expect(types.has('Balanced')).toBe(true);
        expect(types.has('DeepDiver')).toBe(true);
        expect(types.has('Lurker')).toBe(true);
        expect(types.has('DoomScroller')).toBe(true);
        expect(types.has('NewsJunkie')).toBe(true);
        expect(types.has('Stalker')).toBe(true);
    });
});
