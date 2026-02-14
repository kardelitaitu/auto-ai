/**
 * Temporal Awareness Module
 * Simulates human time-based behaviors:
 * - Circadian rhythm (skip night sessions)
 * - Network quality awareness
 * - Session timing patterns
 * 
 * @module utils/temporal-awareness
 */

const CIRCADIAN_CONFIG = {
    sleepStart: 2,
    sleepEnd: 8,
    skipChance: 0.95,
    eveningStart: 18,
    eveningEnd: 23,
    doomscrollChance: 0.3,
    morningStart: 6,
    morningEnd: 12,
    activeChance: 0.7
};

const NETWORK_CONFIG = {
    fastThreshold: 1000,
    slowThreshold: 5000,
    frustrationThreshold: 0.7,
    surpriseThreshold: 1.0
};

function getCurrentHour() {
    const now = new Date();
    return now.getHours();
}

function getProxyHour(timezone = 'America/New_York') {
    try {
        const now = new Date();
        const s = now.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false });
        return parseInt(s.split(':')[0], 10);
    } catch {
        return getCurrentHour();
    }
}

function getCircadianPhase(hour = getCurrentHour()) {
    if (hour >= CIRCADIAN_CONFIG.sleepStart && hour < CIRCADIAN_CONFIG.sleepEnd) {
        return 'sleep';
    } else if (hour >= CIRCADIAN_CONFIG.eveningStart && hour < 24) {
        return 'evening';
    } else if (hour >= CIRCADIAN_CONFIG.morningStart && hour < CIRCADIAN_CONFIG.morningEnd) {
        return 'morning';
    } else {
        return 'day';
    }
}

function shouldSkipSession(options = {}) {
    const { hour = getCurrentHour(), skipChance = CIRCADIAN_CONFIG.skipChance } = options;
    
    const phase = getCircadianPhase(hour);
    
    if (phase === 'sleep') {
        return { shouldSkip: true, reason: 'sleep_hours', skipChance };
    }
    
    return { shouldSkip: false, reason: null, phase };
}

function getActivityModifier(hour = getCurrentHour()) {
    const phase = getCircadianPhase(hour);
    
    const modifiers = {
        sleep: { energy: 0, engagement: 0, doomscroll: 0 },
        morning: { energy: 0.7, engagement: 0.8, doomscroll: 0.2 },
        day: { energy: 0.5, engagement: 0.6, doomscroll: 0.1 },
        evening: { energy: 0.8, engagement: 0.9, doomscroll: 0.4 }
    };
    
    return modifiers[phase] || modifiers.day;
}

function getSessionLength(hour = getCurrentHour()) {
    const phase = getCircadianPhase(hour);
    
    const lengths = {
        sleep: { min: 0, max: 0 },
        morning: { min: 300, max: 600 },
        day: { min: 300, max: 540 },
        evening: { min: 420, max: 720 }
    };
    
    return lengths[phase] || lengths.day;
}

function createTemporalAwareness(options = {}) {
    const circConfig = { ...CIRCADIAN_CONFIG, ...options.circadian };
    const netConfig = { ...NETWORK_CONFIG, ...options.network };
    
    return {
        config: { circadian: circConfig, network: netConfig },
        
        getCurrentHour,
        
        getProxyHour,
        
        getCircadianPhase,
        
        shouldSkipSession,
        
        getActivityModifier,
        
        getSessionLength,
        
        async measureNetworkQuality(page) {
            try {
                const startTime = Date.now();
                
                await page.evaluate(() => {
                    return new Promise(resolve => {
                        fetch('https://x.com', { method: 'HEAD' })
                            .then(() => resolve(Date.now()))
                            .catch(() => resolve(Date.now()));
                    });
                });
                
                const latency = Date.now() - startTime;
                
                let quality;
                if (latency < netConfig.fastThreshold) {
                    quality = 'fast';
                } else if (latency > netConfig.slowThreshold) {
                    quality = 'slow';
                } else {
                    quality = 'normal';
                }
                
                return { quality, latency };
                
            } catch (_error) {
                return { quality: 'unknown', latency: null };
            }
        },
        
        getBehaviorModifier(networkQuality) {
            const modifiers = {
                fast: {
                    scrollSpeed: 1.2,
                    hesitation: 0.8,
                    frustration: 0,
                    surprise: netConfig.surpriseThreshold
                },
                normal: {
                    scrollSpeed: 1.0,
                    hesitation: 1.0,
                    frustration: 0.3,
                    surprise: 0.5
                },
                slow: {
                    scrollSpeed: 0.7,
                    hesitation: 1.5,
                    frustration: netConfig.frustrationThreshold,
                    surprise: 0
                }
            };
            
            return modifiers[networkQuality] || modifiers.normal;
        },
        
        async adjustBehavior(page, modifiers) {
            const { scrollSpeed, hesitation, frustration } = modifiers;
            
            if (frustration > 0.5 && Math.random() < frustration) {
                await page.evaluate(() => {
                    window.scrollBy(0, 300);
                });
            }
            
            return {
                scrollSpeed,
                hesitation,
                frustration,
                adjusted: true
            };
        },
        
        getOptimalTiming(hour = getCurrentHour()) {
            const phase = getCircadianPhase(hour);
            
            const timings = {
                sleep: { readTime: 0, replyDelay: 0, scrollSpeed: 0 },
                morning: { readTime: 8000, replyDelay: 2000, scrollSpeed: 1.0 },
                day: { readTime: 5000, replyDelay: 1500, scrollSpeed: 0.9 },
                evening: { readTime: 10000, replyDelay: 2500, scrollSpeed: 1.1 }
            };
            
            return timings[phase] || timings.day;
        },
        
        formatTimeRemaining(targetHour) {
            const now = getCurrentHour();
            const diff = targetHour - now;
            
            if (diff < 0) {
                return `${diff + 24} hours`;
            }
            return `${diff} hours`;
        },
        
        getStatus() {
            const hour = getCurrentHour();
            const phase = getCircadianPhase(hour);
            const skipCheck = shouldSkipSession({ hour });
            const modifiers = getActivityModifier(hour);
            const lengths = getSessionLength(hour);
            
            return {
                currentHour: hour,
                phase,
                shouldSkip: skipCheck.shouldSkip,
                skipReason: skipCheck.reason,
                modifiers,
                sessionLength: lengths,
                canRun: lengths.max > 0
            };
        }
    };
}

export const temporalAwareness = {
    createTemporalAwareness,
    getCurrentHour,
    getCircadianPhase,
    shouldSkipSession,
    getActivityModifier,
    getSessionLength,
    defaults: {
        circadian: CIRCADIAN_CONFIG,
        network: NETWORK_CONFIG
    }
};

export default temporalAwareness;
