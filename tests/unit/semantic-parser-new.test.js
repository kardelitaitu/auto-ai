import { describe, it, expect, vi } from 'vitest';
import SemanticParser from '../../core/semantic-parser.js';

describe('SemanticParser', () => {
  let parser;

  beforeEach(() => {
    parser = new SemanticParser();
  });

  describe('constructor', () => {
    it('should initialize with correct interactive roles', () => {
      expect(parser.interactiveRoles).toContain('button');
      expect(parser.interactiveRoles).toContain('link');
      expect(parser.interactiveRoles).toContain('textbox');
    });
  });

  describe('_extractInteractiveElements', () => {
    it('should extract interactive elements with correct properties', async () => {
      const mockPage = {
        $$eval: () => {
          return Promise.resolve([
            { role: 'button', name: 'Submit Button', coordinates: { x: 100, y: 125 }, visible: true, enabled: true, tag: 'button' },
            { role: 'a', name: 'https://example.com', coordinates: { x: 275, y: 310 }, visible: true, enabled: true, tag: 'a' }
          ]);
        }
      };

      const elements = await parser._extractInteractiveElements(mockPage);
      expect(elements).toHaveLength(2);
      
      expect(elements[0]).toEqual({
        role: 'button',
        name: 'Submit Button',
        coordinates: { x: 100, y: 125 },
        visible: true,
        enabled: true,
        tag: 'button'
      });

      expect(elements[1]).toEqual({
        role: 'a',
        name: 'https://example.com',
        coordinates: { x: 275, y: 310 },
        visible: true,
        enabled: true,
        tag: 'a'
      });
    });

    it('should filter out invisible or disabled elements', async () => {
      const mockPage = {
        $$eval: vi.fn().mockResolvedValue([
          {
            getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
            getAttribute: () => null,
            innerText: 'Hidden',
            tagName: 'div',
            disabled: false,
            getComputedStyle: () => ({
              display: 'none',
              visibility: 'hidden'
            })
          },
          {
            getBoundingClientRect: () => ({ x: 10, y: 10, width: 50, height: 20 }),
            getAttribute: () => null,
            innerText: 'Disabled',
            tagName: 'button',
            disabled: true,
            getComputedStyle: () => ({
              display: 'block',
              visibility: 'visible'
            })
          }
        ])
      };

      const elements = await parser._extractInteractiveElements(mockPage);
      expect(elements).toHaveLength(0);
    });

    it('should handle extraction errors gracefully', async () => {
      const mockPage = {
        $$eval: vi.fn().mockRejectedValue(new Error('Extraction error'))
      };

      const elements = await parser._extractInteractiveElements(mockPage);
      expect(elements).toHaveLength(0);
    });
  });

  describe('extractSemanticTree', () => {
    it('should extract semantic tree with page title, URL, and elements', async () => {
      const mockPage = {
        title: vi.fn().mockResolvedValue('Test Page'),
        url: vi.fn().mockResolvedValue('https://example.com'),
        $$eval: () => {
          return Promise.resolve([
            { role: 'button', name: 'Submit', coordinates: { x: 50, y: 100 }, visible: true, enabled: true, tag: 'button' },
            { role: 'link', name: 'Click Here', coordinates: { x: 200, y: 300 }, visible: true, enabled: true, tag: 'a' }
          ]);
        }
      };

      const tree = await parser.extractSemanticTree(mockPage);
      expect(tree).toHaveProperty('pageTitle', 'Test Page');
      expect(tree.metadata).toHaveProperty('url', 'https://example.com');
      expect(tree.interactiveElements).toHaveLength(2);
      expect(tree.landmarks).toHaveLength(2);
    });

    it('should handle extraction errors gracefully', async () => {
      const mockPage = {
        title: vi.fn().mockRejectedValue(new Error('Page title error')),
        url: vi.fn().mockResolvedValue('https://example.com'),
        $$eval: vi.fn().mockResolvedValue([])
      };

      await expect(parser.extractSemanticTree(mockPage)).rejects.toThrow('Page title error');
    });
  });

  describe('_extractLandmarks', () => {
    it('should extract landmarks with correct properties', async () => {
      const mockPage = {
        $$eval: () => {
          return Promise.resolve([
            { role: 'main', name: 'Main Content', coordinates: { x: 500, y: 500 }, visible: true },
            { role: 'navigation', name: 'navigation', coordinates: { x: 150, y: 100 }, visible: true }
          ]);
        }
      };

      const landmarks = await parser._extractLandmarks(mockPage);
      expect(landmarks).toHaveLength(2);
      
      expect(landmarks[0]).toEqual({
        role: 'main',
        name: 'Main Content',
        coordinates: { x: 500, y: 500 },
        visible: true
      });

      expect(landmarks[1]).toEqual({
        role: 'navigation',
        name: 'navigation',
        coordinates: { x: 150, y: 100 },
        visible: true
      });
    });

    it('should filter out invisible landmarks', async () => {
      const mockPage = {
        $$eval: vi.fn().mockResolvedValue([
          {
            getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
            getAttribute: () => null,
            tagName: 'main',
            getComputedStyle: () => ({
              display: 'none',
              visibility: 'hidden'
            })
          }
        ])
      };

      const landmarks = await parser._extractLandmarks(mockPage);
      expect(landmarks).toHaveLength(0);
    });

    it('should handle extraction errors gracefully', async () => {
      const mockPage = {
        $$eval: vi.fn().mockRejectedValue(new Error('Extraction error'))
      };

      const landmarks = await parser._extractLandmarks(mockPage);
      expect(landmarks).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty semantic tree', () => {
      const tree = {
        pageTitle: 'Empty Page',
        metadata: { url: 'https://empty.com', totalElements: 0 },
        landmarks: [],
        interactiveElements: []
      };

      const result = parser.generateCompactRepresentation(tree);
      expect(result).toContain('Page: Empty Page');
      expect(result).toContain('URL: https://empty.com');
      expect(result).not.toContain('Landmarks');
      expect(result).not.toContain('Interactive Elements');
    });

    it('should handle null inputs gracefully', () => {
      const result = parser.generateCompactRepresentation(null);
      expect(result).toBe('Page: undefined\nURL: undefined\n\n\n');

      const result2 = parser.findElementByName(null, 'test');
      expect(result2).toBeNull();

      const result3 = parser.getTreeStats(null);
      expect(result3).toEqual({
        pageTitle: undefined,
        url: undefined,
        totalElements: undefined,
        interactiveElements: undefined,
        landmarks: undefined,
        roleBreakdown: {}
      });
    });

    it('should handle missing properties', () => {
      const tree = {
        pageTitle: 'Partial Page',
        metadata: { url: 'https://partial.com' }
      };

      const result = parser.generateCompactRepresentation(tree);
      expect(result).toContain('Page: Partial Page');
      expect(result).toContain('URL: https://partial.com');
      expect(result).not.toContain('Landmarks');
      expect(result).not.toContain('Interactive Elements');
    });
  });
});