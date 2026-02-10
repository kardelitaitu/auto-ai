
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, '../data/twitterActivityProfiles.json');

// Aggressive Bounds - Max 50s per loop
const BOUNDS = {
    Skimmer: {
        readingPhase: { mean: 25000, deviation: 10000 },
        scrollPause: { mean: 400, deviation: 150 },
        refresh: 0.3, dive: 0.4,
        tweetDive: 0.15, like: 0.03,
        bookmark: 0.005, follow: 0.003
    },
    Balanced: {
        readingPhase: { mean: 35000, deviation: 12000 },
        scrollPause: { mean: 800, deviation: 300 },
        refresh: 0.2, dive: 0.5,
        tweetDive: 0.2, like: 0.04,
        bookmark: 0.01, follow: 0.005
    },
    DeepDiver: {
        readingPhase: { mean: 45000, deviation: 8000 },
        scrollPause: { mean: 1500, deviation: 500 },
        refresh: 0.1, dive: 0.8,
        tweetDive: 0.35, like: 0.05,
        bookmark: 0.04, follow: 0.008
    },
    Lurker: {
        readingPhase: { mean: 40000, deviation: 10000 },
        scrollPause: { mean: 1000, deviation: 400 },
        refresh: 0.1, dive: 0.3,
        tweetDive: 0.25, like: 0.025,
        bookmark: 0.05, follow: 0.003
    },
    DoomScroller: {
        readingPhase: { mean: 15000, deviation: 8000 },
        scrollPause: { mean: 300, deviation: 100 },
        refresh: 0.15, dive: 0.2,
        tweetDive: 0.1, like: 0.02,
        bookmark: 0.003, follow: 0.002
    },
    NewsJunkie: {
        readingPhase: { mean: 20000, deviation: 10000 },
        scrollPause: { mean: 600, deviation: 200 },
        refresh: 0.8, dive: 0.3,
        tweetDive: 0.5, like: 0.03,
        bookmark: 0.05, follow: 0.02
    },
    Stalker: {
        readingPhase: { mean: 35000, deviation: 12000 },
        scrollPause: { mean: 800, deviation: 300 },
        refresh: 0.15, dive: 0.95,
        tweetDive: 0.15, like: 0.03,
        bookmark: 0.01, follow: 0.05
    }
};

class ProfileFactory {
    static gaussian(mean, stdev) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return mean + stdev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    static round(num) {
        return Math.round(num * 10000) / 10000; // 4 decimals
    }

    static create(index, type = "Balanced") {
        const bounds = BOUNDS[type];

        // 1. Timings - Aggressive: max 50s per loop
        const MAX_READING_PHASE = 50000; // 50 seconds max
        const MIN_READING_PHASE = 10000; // 10 seconds min
        
        let readingMean = this.gaussian(bounds.readingPhase.mean, 5000);
        readingMean = Math.max(MIN_READING_PHASE, Math.min(MAX_READING_PHASE, readingMean));
        
        let readingDev = this.gaussian(bounds.readingPhase.deviation, 1000);
        readingDev = Math.max(2000, Math.min(15000, readingDev));
        
        const pReading = {
            mean: Math.floor(readingMean),
            deviation: Math.floor(readingDev)
        };

        // Faster scrolling - more aggressive
        let scrollMean = this.gaussian(bounds.scrollPause.mean, 100);
        scrollMean = Math.max(200, Math.min(3000, scrollMean));
        
        let scrollDev = this.gaussian(bounds.scrollPause.deviation, 50);
        scrollDev = Math.max(50, Math.min(800, scrollDev));
        
        const pScroll = {
            mean: Math.floor(scrollMean),
            deviation: Math.floor(scrollDev)
        };

        // 2. Initial Probabilities
        let pRefresh = Math.max(0, Math.min(0.8, this.gaussian(bounds.refresh, 0.05)));
        let pDive = Math.max(0, Math.min(0.8, this.gaussian(bounds.dive, 0.1)));
        let pIdle = Math.max(0, Math.min(0.3, this.gaussian(0.1, 0.05)));

        // New Detailed Probabilities
        let pTweetDive = Math.max(0, Math.min(0.9, this.gaussian(bounds.tweetDive, 0.05)));
        // Enforce 0.5% min, 2% max for Likes
        let pLikeAfter = Math.max(0.005, Math.min(0.02, this.gaussian(bounds.like, 0.005)));
        let pBookmark = Math.max(0, Math.min(0.1, this.gaussian(bounds.bookmark, 0.005)));
        let pFollow = Math.max(0, Math.min(0.01, this.gaussian(bounds.follow, 0.001)));


        // 3. New Input Logic (Mouse vs Keyboard Personas)
        const isMouseUser = type === 'DoomScroller' ? true : (Math.random() < 0.9);
        let inputP = {};

        if (isMouseUser) {
            const wheelBase = (type === 'DoomScroller') ? 0.95 : 0.85;
            const wheelDown = this.gaussian(wheelBase, 0.05);
            const wheelUp = Math.random() * 0.04 + 0.01;
            const remaining = 1.0 - (wheelDown + wheelUp);
            let wDown = Math.max(0.70, wheelDown);
            let wUp = Math.max(0.01, wheelUp);
            let sp = Math.max(0, 1 - wDown - wUp);

            inputP = {
                wheelDown: this.round(wDown),
                wheelUp: this.round(wUp),
                space: this.round(sp),
                keysDown: 0,
                keysUp: 0
            };
        } else {
            const keysDown = this.gaussian(0.85, 0.05);
            const keysUp = Math.random() * 0.04 + 0.01;
            let kDown = Math.max(0.70, keysDown);
            let kUp = Math.max(0.01, keysUp);
            let sp = Math.max(0, 1 - kDown - kUp);

            inputP = {
                wheelDown: 0,
                wheelUp: 0,
                space: this.round(sp),
                keysDown: this.round(kDown),
                keysUp: this.round(kUp)
            };
        }

        pRefresh = this.round(pRefresh);
        pDive = this.round(pDive);
        pIdle = this.round(pIdle);
        pTweetDive = this.round(pTweetDive);
        pLikeAfter = this.round(pLikeAfter);
        pBookmark = this.round(pBookmark);
        pFollow = this.round(pFollow);

        // Generate ID and Description
        const id = `${String(index).padStart(2, '0')}-${type}`;
        const inputDesc = isMouseUser ? `Mouse (${(inputP.wheelDown * 100).toFixed(0)}%)` : `Keys (${(inputP.keysDown * 100).toFixed(0)}%)`;

        const desc = `Type: ${type} | Input: ${inputDesc} | Dive: ${(pDive * 100).toFixed(1)}% | T-Dive: ${(pTweetDive * 100).toFixed(1)}% Like: ${(pLikeAfter * 100).toFixed(2)}% Bkmk: ${(pBookmark * 100).toFixed(2)}% Follow: ${(pFollow * 100).toFixed(2)}%`;

        return {
            id,
            description: desc,
            timings: {
                readingPhase: pReading,
                scrollPause: pScroll,
                actionSpecific: {
                    space: {
                        mean: Math.floor(Math.random() * (1200 - 800) + 800),
                        deviation: Math.floor(Math.random() * (300 - 100) + 100)
                    },
                    keys: {
                        mean: Math.floor(Math.random() * (150 - 80) + 80),
                        deviation: Math.floor(Math.random() * (50 - 20) + 20)
                    },
                    // Idle duration (staring at screen) - Increased as requested
                    idle: {
                        mean: 15000,
                        deviation: 5000
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
                // Reverted to original range logic (approx 10-30%)
                idle: pIdle
            },
            inputMethods: inputP,
            maxLike: 5,
            maxFollow: 2,
            theme: 'dark'
        };
    }
}

// Generate Profiles
const profileCounts = {
    Skimmer: 4,
    Balanced: 26,
    DeepDiver: 4,
    Lurker: 4,
    DoomScroller: 4,
    NewsJunkie: 4,
    Stalker: 4
};

let profiles = [];
let idx = 1;

for (const [type, count] of Object.entries(profileCounts)) {
    for (let i = 0; i < count; i++) {
        profiles.push(ProfileFactory.create(idx++, type));
    }
}

try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(profiles, null, 2));
    console.log(`[SUCCESS] Generated ${profiles.length} profiles to ${OUTPUT_FILE}`);
    // Preview a few
    console.log("Preview:");
    profiles.slice(0, 3).forEach(p => console.log(p.description));
} catch (e) {
    console.error("Failed to save profiles:", e);
}