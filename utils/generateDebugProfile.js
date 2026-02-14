
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for Hyper-Active Debug Profile
const OUTPUT_FILE = path.join(__dirname, '../data/twitterActivityProfiles.json');

class DebugProfileFactory {
    static round(num) {
        return Math.round(num * 10000) / 10000;
    }

    static create() {
        const type = "DEBUG_TESTER";

        // Very short reading phase to trigger actions quickly (10s - 30s)
        // const baseDuration = 10000;
        // const durationBuffer = 20000;

        // Fast scrolling to reach triggers
        const meanPause = 1000;
        const deviation = 200;

        // Force High Probabilities
        const probRefresh = 0.1;
        const probDive = 0.05; // Reduced as per user feedback
        const probIdle = 0.0;
        const probTweetDive = 0.1; // 10% chance to expand
        const probLikeAfter = 0.2; // 20% chance to like after expanding
        const probBookmark = 0.1;
        const probFollow = 0.05;

        // Input: Mostly wheel for standard scrolling
        const inputP = { wheelDown: 0.8, wheelUp: 0.05, space: 0.05, keysDown: 0.1, keysUp: 0 };

        // Finalize values for description
        const pRefresh = this.round(probRefresh);
        const pDive = this.round(probDive);
        const pIdle = this.round(probIdle);
        const pTweetDive = this.round(probTweetDive);
        const pLikeAfter = this.round(probLikeAfter);
        const pBookmark = this.round(probBookmark);
        const pFollow = this.round(probFollow);

        const desc = `Type: ${type} | Pace: DEBUG_FAST | Refresh: ${(pRefresh * 100).toFixed(1)}% Click Profile: ${(pDive * 100).toFixed(1)}% | T-Dive: ${(pTweetDive * 100).toFixed(1)}% Like: ${(pLikeAfter * 100).toFixed(1)}% Bkmk: ${(pBookmark * 100).toFixed(1)}% Follow: ${(pFollow * 100).toFixed(1)}%`;

        return {
            id: `PROF_DEBUG_01`,
            description: desc,
            timings: {
                readingPhase: { mean: 20000, deviation: 5000 },
                scrollPause: { mean: meanPause, deviation: deviation },
                actionSpecific: {
                    space: {
                        mean: Math.floor(Math.random() * (1200 - 800) + 800),
                        deviation: Math.floor(Math.random() * (200 - 100) + 100)
                    },
                    keys: {
                        mean: Math.floor(Math.random() * (120 - 80) + 80),
                        deviation: Math.floor(Math.random() * (40 - 15) + 15)
                    }
                }
            },
            probabilities: {
                refresh: pRefresh,
                profileDive: pDive,
                tweetDive: pTweetDive,
                likeTweetafterDive: pLikeAfter,
                bookmarkAfterDive: pBookmark,
                followOnProfile: pFollow,
                idle: pIdle
            },
            inputMethods: inputP,
            maxLike: 2,
            maxFollow: 1,
            theme: 'dark'
        };
    }
}

// Generate Single Profile
const profiles = [DebugProfileFactory.create()];

try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(profiles, null, 2));
    console.log(`[SUCCESS] Generated 1 DEBUG profile to ${OUTPUT_FILE}`);
    console.log(profiles[0].description);
} catch (e) {
    console.error("Failed to save profiles:", e);
}
