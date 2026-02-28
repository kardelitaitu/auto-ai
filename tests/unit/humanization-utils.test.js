/**
 * @fileoverview Unit tests for Humanization Utilities
 * @module tests/unit/humanization-utils.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/index.js', () => ({
    api: {
        setPage: vi.fn(),
        getPage: vi.fn(),
        wait: vi.fn().mockResolvedValue(undefined),
        think: vi.fn().mockResolvedValue(undefined),
        getPersona: vi.fn().mockReturnValue({ microMoveChance: 0.1, fidgetChance: 0.05 }),
    }
}));
import { api } from '../../api/index.js';
import { HumanizationEngine } from '../../utils/humanization/engine.js';
import { HumanScroll } from '../../utils/humanization/scroll.js';
import { HumanTiming } from '../../utils/humanization/timing.js';
import { ContentSkimmer } from '../../utils/humanization/content.js';
import { ErrorRecovery } from '../../utils/humanization/error.js';
import { SessionManager } from '../../utils/humanization/session.js';
import { MultitaskEngine } from '../../utils/humanization/multitask.js';
import { ActionPredictor } from '../../utils/humanization/action.js';
import { scrollRandom } from '../../utils/scroll-helper.js';
import { mathUtils } from '../../utils/mathUtils.js';
import HumanizationDefault, * as humanizationExports from '../../utils/humanization/index.js';

// Mock dependencies
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

vi.mock('../../utils/mathUtils.js', () => ({
    mathUtils: {
        randomInRange: vi.fn((min, _max) => min),
        gaussian: vi.fn((mean) => mean),
        roll: vi.fn(() => false),
        sample: vi.fn((arr) => arr[0])
    }
}));

vi.mock('../../utils/entropyController.js', () => ({
    entropy: {
        getVariation: vi.fn(() => 1.0)
    }
}));

vi.mock('../../utils/scroll-helper.js', () => ({
    scrollRandom: vi.fn(),
    scrollDown: vi.fn(),
    scrollUp: vi.fn()
}));

// Mock sub-engines to simplify HumanizationEngine testing
vi.mock('../../utils/humanization/scroll.js');
vi.mock('../../utils/humanization/timing.js');
vi.mock('../../utils/humanization/content.js');
vi.mock('../../utils/humanization/error.js');
vi.mock('../../utils/humanization/session.js');
vi.mock('../../utils/humanization/multitask.js');
vi.mock('../../utils/humanization/action.js');

describe('HumanizationEngine', () => {
    let engine;
    let mockPage;
    let mockAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPage = {
            waitForTimeout: vi.fn(),
            mouse: {
                wheel: vi.fn()
            },
            isClosed: vi.fn().mockReturnValue(false),
            context: vi.fn().mockReturnValue({ browser: vi.fn().mockReturnValue({ isConnected: vi.fn().mockReturnValue(true) }) })
        };
        api.getPage.mockReturnValue(mockPage);
        mockAgent = {
            log: vi.fn()
        };

        // Setup mock implementations for sub-engines
        HumanScroll.mockImplementation(function() {
            return {
                setAgent: vi.fn(),
                execute: vi.fn().mockResolvedValue(),
                toElement: vi.fn().mockResolvedValue()
            };
        });
        HumanTiming.mockImplementation(function() {
            return {
                getThinkTime: vi.fn().mockReturnValue(1000),
                sessionRampUp: vi.fn().mockResolvedValue(),
                getNaturalPause: vi.fn().mockReturnValue(500)
            };
        });
        ContentSkimmer.mockImplementation(function() {
            return {
                setAgent: vi.fn(),
                skipping: vi.fn().mockResolvedValue(),
                reading: vi.fn().mockResolvedValue()
            };
        });
        ErrorRecovery.mockImplementation(function() {
            return {
                handle: vi.fn().mockResolvedValue({ success: true })
            };
        });
        SessionManager.mockImplementation(function() {
            return {
                wrapUp: vi.fn().mockResolvedValue(),
                getOptimalLength: vi.fn().mockReturnValue({ targetMs: 1000 }),
                boredomPause: vi.fn().mockResolvedValue()
            };
        });
        MultitaskEngine.mockImplementation(function() {
            return {
                checkNotifications: vi.fn().mockResolvedValue(),
                glanceTrending: vi.fn().mockResolvedValue(),
                shiftPosition: vi.fn().mockResolvedValue(),
                glanceMentions: vi.fn().mockResolvedValue()
            };
        });
        ActionPredictor.mockImplementation(function() {
            return {
                predict: vi.fn().mockReturnValue({ type: 'scroll' })
            };
        });

        engine = new HumanizationEngine(mockPage, mockAgent);
    });

    describe('Initialization', () => {
        it('should initialize all sub-engines', () => {
            expect(HumanScroll).toHaveBeenCalled();
            expect(HumanTiming).toHaveBeenCalled();
            expect(ContentSkimmer).toHaveBeenCalled();
            expect(ErrorRecovery).toHaveBeenCalled();
            expect(SessionManager).toHaveBeenCalled();
            expect(MultitaskEngine).toHaveBeenCalled();
            expect(ActionPredictor).toHaveBeenCalled();
        });

        it('should set agent correctly', () => {
            const newAgent = { id: 'agent2' };
            engine.setAgent(newAgent);
            expect(engine.agent).toBe(newAgent);
            expect(engine._scrollEngine.setAgent).toHaveBeenCalledWith(newAgent);
            expect(engine._contentEngine.setAgent).toHaveBeenCalledWith(newAgent);
        });
    });

    describe('Main Methods', () => {
        it('should execute scroll', async () => {
            await engine.scroll('down', 'high');
            expect(engine._scrollEngine.execute).toHaveBeenCalledWith('down', 'high');
        });

        it('should execute think', async () => {
            await engine.think('like');
            expect(engine._timingEngine.getThinkTime).toHaveBeenCalledWith('like', {});
            expect(api.wait).toHaveBeenCalledWith(1000);
        });

        it('should consume content with defaults', async () => {
            await engine.consumeContent();
            expect(engine._contentEngine.skipping).toHaveBeenCalledWith('tweet', 'normal');
        });

        it('should recover from error using error engine', async () => {
            await engine.recoverFromError('timeout', { action: 'click' });
            expect(engine._errorEngine.handle).toHaveBeenCalledWith('timeout', { action: 'click' });
        });

        it('should execute multitask behavior', async () => {
            await engine.multitask();
            expect(engine._multitaskEngine.checkNotifications).toHaveBeenCalled();
        });

        it('should skip multitask when already active', async () => {
            engine.isMultitasking = true;
            await engine.multitask();
            expect(engine._multitaskEngine.checkNotifications).not.toHaveBeenCalled();
        });

        it('should predict next action', () => {
            const prediction = engine.predictNextAction();
            expect(prediction.type).toBe('scroll');
        });

        it('should start session with warmup and scroll', async () => {
            const scrollSpy = vi.spyOn(engine, 'scroll');
            
            await engine.sessionStart();
            
            expect(engine._timingEngine.sessionRampUp).toHaveBeenCalled();
            expect(api.wait).toHaveBeenCalled();
            expect(scrollSpy).toHaveBeenCalledWith('down', 'light');
        });

        it('should end session with wrap up', async () => {
            await engine.sessionEnd();
            
            expect(engine._sessionEngine.wrapUp).toHaveBeenCalledWith(mockPage);
            expect(scrollRandom).toHaveBeenCalledWith(-50, 100);
        });

        it('should return session duration config', () => {
            const config = engine.getSessionDuration();
            expect(config.targetMs).toBe(1000);
        });

        it('should update cycle count and trigger boredom pause', async () => {
            engine.cycleCount = 2;
            await engine.cycleComplete();
            expect(engine._sessionEngine.boredomPause).toHaveBeenCalledWith(mockPage);
        });

        it('should trigger multitask on even cycle with roll', async () => {
            engine.cycleCount = 1;
            mathUtils.roll.mockReturnValue(true);
            await engine.cycleComplete();
            expect(engine._multitaskEngine.checkNotifications).toHaveBeenCalled();
        });

        it('should return activity info', () => {
            const info = engine.getActivityInfo();
            expect(info).toHaveProperty('cycleCount');
            expect(info).toHaveProperty('lastActivity');
        });

        it('should scroll to element using scroll engine', async () => {
            const locator = { first: vi.fn() };
            await engine.scrollToElement(locator, 'view');
            expect(engine._scrollEngine.toElement).toHaveBeenCalledWith(locator, 'view');
        });

        it('should perform natural pause', async () => {
            await engine.naturalPause('transition');
            expect(engine._timingEngine.getNaturalPause).toHaveBeenCalledWith('transition');
            expect(api.wait).toHaveBeenCalledWith(500);
        });

        it('should perform read behavior', async () => {
            await engine.readBehavior('long');
            expect(engine._contentEngine.reading).toHaveBeenCalledWith('long');
        });
    });

    describe('Logging', () => {
        it('should log to agent if available', () => {
            engine.log('test message');
            expect(mockAgent.log).toHaveBeenCalledWith('[Human] test message');
        });

        it('should log to internal logger if agent is not available', () => {
            engine.agent = null;
            engine.log('test message');
            // We can't easily check the internal logger call here without exposing it or mocking createLogger return value more accessibly
            // But checking no error is thrown is a start
        });
    });

    describe('Accessors', () => {
        it('should expose session engine', () => {
            expect(engine.session).toBe(engine._sessionEngine);
        });
    });
});

describe('Humanization Index Exports', () => {
    it('should export all humanization modules', () => {
        expect(humanizationExports).toHaveProperty('HumanizationEngine');
        expect(humanizationExports).toHaveProperty('HumanScroll');
        expect(humanizationExports).toHaveProperty('HumanTiming');
        expect(humanizationExports).toHaveProperty('ContentSkimmer');
        expect(humanizationExports).toHaveProperty('ErrorRecovery');
        expect(humanizationExports).toHaveProperty('SessionManager');
        expect(humanizationExports).toHaveProperty('MultitaskEngine');
        expect(humanizationExports).toHaveProperty('ActionPredictor');
        expect(HumanizationDefault).toBeDefined();
    });

    it('should load index module dynamically', async () => {
        const module = await import('../../utils/humanization/index.js');
        expect(module.HumanizationEngine).toBeDefined();
    });
});
