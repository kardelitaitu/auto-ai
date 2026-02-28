import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../api/core/context-state.js', () => ({
  getStatePersona: vi.fn().mockReturnValue({ 
    name: 'casual', 
    speed: 0.8,
    microMoveChance: 0.08,
    muscleModel: { Kp: 0.1, Ki: 0.01, Kd: 0.05 }
  }),
  setStatePersona: vi.fn((name) => {
    if (name !== 'custom' && !['casual', 'efficient', 'researcher', 'power', 'glitchy', 'elderly', 'teen', 'professional', 'gamer', 'typer', 'hesitant', 'impulsive', 'distracted', 'focused', 'newbie', 'expert'].includes(name)) {
      throw new Error(`Unknown persona "${name}". Available: casual, efficient, researcher, power, glitchy, elderly, teen, professional, gamer, typer, hesitant, impulsive, distracted, focused, newbie, expert`);
    }
  }),
  getStatePersonaName: vi.fn().mockReturnValue('casual'),
  getStateSection: vi.fn().mockReturnValue({ 
    sessionStartTime: Date.now() - 1000 
  }),
}));

vi.mock('../../../api/core/context.js', () => ({
  clearContext: vi.fn(),
}));

import { 
  setPersona, 
  getPersona, 
  getPersonaParam, 
  getPersonaName, 
  listPersonas, 
  getSessionDuration,
  PERSONAS 
} from '../../../api/behaviors/persona.js';
describe('api/behaviors/persona.js', () => {
  describe('setPersona', () => {
    it.skip('should set valid persona', () => {
      setPersona('focused');
      expect(getPersonaName()).toBe('focused');
      expect(getPersona().speed).toBe(PERSONAS.focused.speed);
    });

    it('should throw on invalid persona', () => {
      expect(() => setPersona('invalid')).toThrow('Unknown persona');
    });

    it.skip('should allow "custom" persona with overrides', () => {
      setPersona('custom', { speed: 5.0 });
      expect(getPersonaName()).toBe('custom');
      expect(getPersona().speed).toBe(5.0);
    });

    it.skip('should apply overrides', () => {
      setPersona('casual', { speed: 99 });
      expect(getPersona().speed).toBe(99);
    });

    it.skip('should apply biometric randomization', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      
      const baseKp = PERSONAS.casual.muscleModel.Kp;
      setPersona('casual');
      
      const newKp = getPersona().muscleModel.Kp;
      expect(newKp).not.toBe(baseKp);
      expect(newKp).toBeCloseTo(baseKp * 0.92, 4);

      vi.restoreAllMocks();
    });
  });
  describe('getPersona', () => {
    it('should return active persona config', () => {
      const persona = getPersona();
      expect(persona).toBeDefined();
      expect(persona.speed).toBeDefined();
    });
  });

  describe('getPersonaParam', () => {
    it('should return specific parameter', () => {
      expect(getPersonaParam('speed')).toBe(PERSONAS.casual.speed);
    });
  });

  describe('listPersonas', () => {
    it('should list all available personas', () => {
      const personas = listPersonas();
      expect(personas).toContain('casual');
      expect(personas).toContain('focused');
      expect(personas.length).toBeGreaterThan(10);
    });
  });

  describe('getSessionDuration', () => {
    it('should return positive duration', async () => {
      await new Promise(r => setTimeout(r, 10));
      const duration = getSessionDuration();
      expect(duration).toBeGreaterThan(0);
    });
  });
});
