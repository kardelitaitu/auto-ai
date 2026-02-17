import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.join(__dirname, '../../data/twitterActivityProfiles.json');

describe('generateDebugProfile', () => {
    it('should generate profile file with correct structure', () => {
        const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThanOrEqual(1);
        
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

    it('should have correct probability fields', () => {
        const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        const profile = data[0];
        
        expect(profile.probabilities).toHaveProperty('refresh');
        expect(profile.probabilities).toHaveProperty('profileDive');
        expect(profile.probabilities).toHaveProperty('tweetDive');
        expect(profile.probabilities).toHaveProperty('likeTweetafterDive');
        expect(profile.probabilities).toHaveProperty('bookmarkAfterDive');
        expect(profile.probabilities).toHaveProperty('followOnProfile');
        expect(profile.probabilities).toHaveProperty('idle');
    });

    it('should have correct timing fields', () => {
        const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
        const profile = data[0];
        
        expect(profile.timings).toHaveProperty('readingPhase');
        expect(profile.timings).toHaveProperty('scrollPause');
        expect(profile.timings).toHaveProperty('actionSpecific');
    });
});
