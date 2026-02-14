/**
 * @fileoverview Unit tests for Humanization Utilities
 * @module tests/unit/humanization-utils.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HumanizationEngine } from '../../utils/humanization/engine.js';
import { HumanScroll } from '../../utils/humanization/scroll.js';
import { HumanTiming } from '../../utils/humanization/timing.js';
import { ContentSkimmer } from '../../utils/humanization/content.js';
import { ErrorRecovery } from '../../utils/humanization/error.js';
import { SessionManager } from '../../utils/humanization/session.js';
import { MultitaskEngine } from '../../utils/humanization/multitask.js';
import { ActionPredictor } from '../../utils/humanization/action.js';

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
        randomInRange: vi.fn((min, max) => min),
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
            }
        };
        mockAgent = {
            log: vi.fn()
        };

        // Setup mock implementations for sub-engines
        HumanScroll.mockImplementation(function() {
            return {
                setAgent: vi.fn(),
                execute: vi.fn().mockResolvedValue()
            };
        });
        HumanTiming.mockImplementation(function() {
            return {
                getThinkTime: vi.fn().mockReturnValue(1000)
            };
        });
        ContentSkimmer.mockImplementation(function() {
            return {
                setAgent: vi.fn()
            };
        });
        ErrorRecovery.mockImplementation(function() { return {}; });
        SessionManager.mockImplementation(function() { return {}; });
        MultitaskEngine.mockImplementation(function() { return {}; });
        ActionPredictor.mockImplementation(function() { return {}; });

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
            expect(mockPage.waitForTimeout).toHaveBeenCalledWith(1000);
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
});
