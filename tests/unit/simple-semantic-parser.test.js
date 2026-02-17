import { describe, it, expect, vi } from 'vitest';
import SemanticParser from '../../core/semantic-parser.js';

describe('SemanticParser', () => {
  let parser;

  beforeEach(() => {
    parser = new SemanticParser();
  });

  it('should initialize with correct interactive roles', () => {
    expect(parser.interactiveRoles).toContain('button');
    expect(parser.interactiveRoles).toContain('link');
    expect(parser.interactiveRoles).toContain('textbox');
  });
});