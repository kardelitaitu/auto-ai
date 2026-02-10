/**
 * Navigation Diversity Module
 * Implements state machine for navigation patterns (rabbit holes)
 * Transitions between FEED, PROFILE, THREAD, SEARCH states
 * 
 * @module utils/navigation-diversity
 */

export const NAV_STATES = {
    FEED: 'FEED',
    PROFILE: 'PROFILE',
    THREAD: 'THREAD',
    SEARCH: 'SEARCH',
    HOME: 'HOME'
};

export const NAV_TRANSITIONS = {
    FEED: {
        clickAvatar: 'PROFILE',
        clickHashtag: 'SEARCH',
        diveTweet: 'THREAD',
        clickHome: 'HOME'
    },
    PROFILE: {
        clickPinned: 'THREAD',
        clickTweet: 'THREAD',
        scrollDown: 'PROFILE',
        clickHome: 'HOME',
        clickBack: 'FEED'
    },
    THREAD: {
        clickBack: 'PROFILE',
        clickHome: 'HOME',
        scrollDown: 'THREAD',
        diveReply: 'THREAD'
    },
    SEARCH: {
        clickResult: 'THREAD',
        clickProfile: 'PROFILE',
        clickBack: 'FEED'
    },
    HOME: {
        scroll: 'FEED',
        clickSearch: 'SEARCH'
    }
};

const DEFAULT_CONFIG = {
    rabbitHoleChance: 0.05,
    maxDepth: 5,
    minDepth: 2,
    stayProbability: 0.3,
    exitProbability: 0.2
};

function createNavigationManager(options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };
    
    return {
        config,
        currentState: NAV_STATES.FEED,
        stateHistory: [],
        depth: 0,
        
        getCurrentState() {
            return this.currentState;
        },
        
        setState(newState, reason = '') {
            const oldState = this.currentState;
            this.currentState = newState;
            this.stateHistory.push({
                from: oldState,
                to: newState,
                timestamp: Date.now(),
                reason
            });
            
            if (this.stateHistory.length > 20) {
                this.stateHistory.shift();
            }
            
            return { oldState, newState };
        },
        
        getPossibleTransitions() {
            return NAV_TRANSITIONS[this.currentState] || {};
        },
        
        shouldEnterRabbitHole() {
            return Math.random() < config.rabbitHoleChance;
        },
        
        getTransition(action) {
            const transitions = this.getPossibleTransitions();
            return transitions[action] || null;
        },
        
        async navigate(page, action, options = {}) {
            const { logger = console } = options;
            
            const targetState = this.getTransition(action);
            if (!targetState) {
                logger.warn(`[Nav] No transition from ${this.currentState} via ${action}`);
                return { success: false, reason: 'no_transition' };
            }
            
            const previousState = this.setState(targetState, action);
            logger.info(`[Nav] ${previousState.oldState} → ${previousState.newState} (${action})`);
            
            return { success: true, from: previousState.oldState, to: previousState.newState };
        },
        
        // Convenience sync method for state transitions (without page)
        transition(action) {
            const targetState = this.getTransition(action);
            if (!targetState) {
                return { success: false, reason: 'no_transition' };
            }
            
            const previousState = this.setState(targetState, action);
            return { success: true, from: previousState.oldState, to: previousState.newState };
        },
        
        getDepth() {
            return this.depth;
        },
        
        incrementDepth() {
            this.depth++;
            return this.depth;
        },
        
        resetDepth() {
            this.depth = 0;
        },
        
        shouldExitRabbitHole() {
            if (this.depth >= config.maxDepth) {
                return true;
            }
            if (this.depth >= config.minDepth && Math.random() < config.exitProbability) {
                return true;
            }
            return false;
        },
        
        shouldStayInRabbitHole() {
            return Math.random() < config.stayProbability;
        },
        
        async executeRabbitHole(page, actions, options = {}) {
            const { logger = console } = options;
            
            this.resetDepth();
            logger.info(`[RabbitHole] Starting navigation rabbit hole (max depth: ${config.maxDepth})`);
            
            const actionsTaken = [];
            
            while (this.depth < config.maxDepth) {
                if (this.shouldExitRabbitHole()) {
                    logger.info(`[RabbitHole] Exiting at depth ${this.depth}`);
                    break;
                }
                
                if (actions.length === 0) {
                    logger.info(`[RabbitHole] No more actions to take`);
                    break;
                }
                
                const action = actions.shift();
                const result = await this.navigate(page, action, { logger });
                
                if (result.success) {
                    actionsTaken.push({ action, ...result });
                    this.incrementDepth();
                }
            }
            
            logger.info(`[RabbitHole] Completed. Depth: ${this.depth}, Actions: ${actionsTaken.length}`);
            
            return {
                success: true,
                finalState: this.currentState,
                depth: this.depth,
                actions: actionsTaken
            };
        },
        
        async returnToFeed(page, options = {}) {
            const { logger = console } = options;
            
            logger.info(`[Nav] Returning to FEED from ${this.currentState}`);
            
            const path = this.getReturnPath();
            
            for (const action of path) {
                await this.navigate(page, action, { logger });
                await page.waitForTimeout(mathUtils.randomInRange(500, 1500));
            }
            
            return { success: true, path };
        },
        
        getReturnPath() {
            const path = [];
            let state = this.currentState;
            
            while (state !== NAV_STATES.FEED && state !== NAV_STATES.HOME) {
                const transitions = NAV_TRANSITIONS[state];
                if (transitions.clickBack) {
                    path.push('clickBack');
                    state = NAV_STATES.FEED;
                } else if (transitions.clickHome) {
                    path.push('clickHome');
                    state = NAV_STATES.HOME;
                } else {
                    break;
                }
            }
            
            return path;
        },
        
        getStateHistory() {
            return [...this.stateHistory];
        },
        
        reset() {
            this.currentState = NAV_STATES.FEED;
            this.stateHistory = [];
            this.resetDepth();
        }
    };
}

function mathUtils() {
    return {
        randomInRange(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    };
}

export const navigationDiversity = {
    createNavigationManager,
    NAV_STATES,
    NAV_TRANSITIONS,
    defaults: DEFAULT_CONFIG
};

export default navigationDiversity;
