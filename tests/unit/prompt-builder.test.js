import { describe, it, expect } from 'vitest';
import PromptBuilder from '../../core/prompt-builder.js';

describe('PromptBuilder', () => {
    const goal = 'Search for cats';
    const steps = ['Navigate to Google', 'Type cats', 'Press Enter'];

    it('should initialize with goal and steps', () => {
        const builder = new PromptBuilder(goal, steps);
        expect(builder.goal).toBe(goal);
        expect(builder.steps).toBe(steps);
    });

    it('should include goal in prompt', () => {
        const builder = new PromptBuilder(goal);
        const prompt = builder.build({ history: '', visionPacket: {} });
        expect(prompt).toContain(goal);
    });

    it('should show methodology and current step', () => {
        const builder = new PromptBuilder(goal, steps);
        const prompt = builder.build({
            history: '',
            visionPacket: {},
            currentStep: 2
        });
        expect(prompt).toContain('1. Navigate to Google');
        expect(prompt).toContain('2. Type cats ← YOU ARE HERE');
        expect(prompt).toContain('CURRENT TASK (Step 2/3): "Type cats"');
    });

    it('should show stuck warning', () => {
        const builder = new PromptBuilder(goal);
        const prompt = builder.build({
            history: '',
            visionPacket: {},
            stuckCounter: 3,
            stuckThreshold: 3
        });
        expect(prompt).toContain('WARNING: You are STUCK');
    });

    it('should show failure warning', () => {
        const builder = new PromptBuilder(goal);
        const prompt = builder.build({
            history: '',
            visionPacket: {},
            consecutiveFailures: 2,
            failureThreshold: 2
        });
        expect(prompt).toContain('WARNING: Last 2 actions FAILED');
    });

    it('should show ALL DONE when current step exceeds total steps', () => {
        const builder = new PromptBuilder(goal, steps);
        const prompt = builder.build({
            history: '',
            visionPacket: {},
            currentStep: 4 // steps.length is 3
        });
        expect(prompt).toContain('ALL DONE');
    });

    it('should handle blank page override', () => {
        const builder = new PromptBuilder(goal);
        const prompt = builder.build({
            history: '',
            visionPacket: { metadata: { url: 'about:blank' } }
        });
        expect(prompt).toContain('MANDATORY OVERRIDE');
        expect(prompt).toContain('navigate');
    });
});
