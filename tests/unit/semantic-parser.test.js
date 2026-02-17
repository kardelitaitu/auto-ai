import { describe, it, expect, vi, beforeEach } from 'vitest';
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
            {
              role: 'button',
              name: 'Submit Button',
              coordinates: { x: 100, y: 125 },
              visible: true,
              enabled: true,
              tag: 'button'
            },
            {
              role: 'a',
              name: 'https://example.com',
              coordinates: { x: 275, y: 310 },
              visible: true,
              enabled: true,
              tag: 'a'
            }
          ]);
        },
        title: vi.fn().mockResolvedValue('Test Page'),
        url: vi.fn().mockResolvedValue('https://example.com')
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
        $$eval: vi.fn().mockRejectedValue(new Error('Extraction error')),
        title: vi.fn().mockResolvedValue('Test Page'),
        url: vi.fn().mockResolvedValue('https://example.com')
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
            {
              role: 'main',
              name: 'Main Content',
              coordinates: { x: 500, y: 500 },
              visible: true
            },
            {
              role: 'navigation',
              name: 'navigation',
              coordinates: { x: 150, y: 100 },
              visible: true
            }
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

  describe('generateCompactRepresentation', () => {
    it('should include interactive elements in representation', () => {
      const tree = {
        pageTitle: 'Test Page',
        metadata: { url: 'https://test.com', totalElements: 2 },
        landmarks: [
          { role: 'main', name: 'Main Content', coordinates: { x: 500, y: 500 }, visible: true }
        ],
        interactiveElements: [
          { role: 'button', name: 'Submit', coordinates: { x: 100, y: 100 }, visible: true, enabled: true, tag: 'button' },
          { role: 'link', name: 'Click Me', coordinates: { x: 200, y: 200 }, visible: true, enabled: true, tag: 'a' }
        ]
      };

      const result = parser.generateCompactRepresentation(tree);
      expect(result).toContain('Page: Test Page');
      expect(result).toContain('Interactive Elements');
      expect(result).toContain('button: "Submit"');
      expect(result).toContain('link: "Click Me"');
    });

    it('should handle long element names without truncation in representation', () => {
      // Note: Truncation happens in _extractInteractiveElements, not in generateCompactRepresentation
      const longName = 'A'.repeat(150);
      const tree = {
        pageTitle: 'Test',
        metadata: { url: 'https://test.com', totalElements: 1 },
        landmarks: [],
        interactiveElements: [
          { role: 'button', name: longName, coordinates: { x: 100, y: 100 }, visible: true, enabled: true, tag: 'button' }
        ]
      };

      const result = parser.generateCompactRepresentation(tree);
      // Long names are passed through as-is in representation
      expect(result).toContain(longName.substring(0, 100));
    });

    it('should respect maxElements parameter', () => {
      const tree = {
        pageTitle: 'Test',
        metadata: { url: 'https://test.com', totalElements: 100 },
        landmarks: [],
        interactiveElements: Array.from({ length: 100 }, (_, i) => ({
          role: 'button',
          name: `Button ${i}`,
          coordinates: { x: i * 10, y: i * 10 },
          visible: true,
          enabled: true,
          tag: 'button'
        }))
      };

      const result = parser.generateCompactRepresentation(tree, 5);
      // Should show only 5 elements
      expect(result).toContain('(100 total, showing 5)');
    });

    it('should show landmarks in representation', () => {
      const tree = {
        pageTitle: 'Test Page',
        metadata: { url: 'https://test.com', totalElements: 2 },
        landmarks: [
          { role: 'navigation', name: 'Main Nav', coordinates: { x: 100, y: 50 }, visible: true },
          { role: 'main', name: 'Content', coordinates: { x: 500, y: 500 }, visible: true }
        ],
        interactiveElements: []
      };

      const result = parser.generateCompactRepresentation(tree);
      expect(result).toContain('Landmarks:');
      expect(result).toContain('navigation: "Main Nav"');
      expect(result).toContain('main: "Content"');
    });
  });

  describe('findElementByName', () => {
    it('should find element by partial name match', () => {
      const tree = {
        interactiveElements: [
          { role: 'button', name: 'Submit Form', coordinates: { x: 100, y: 100 }, visible: true, enabled: true },
          { role: 'link', name: 'Click Here', coordinates: { x: 200, y: 200 }, visible: true, enabled: true }
        ]
      };

      const result = parser.findElementByName(tree, 'submit');
      expect(result).not.toBeNull();
      expect(result.name).toBe('Submit Form');
    });

    it('should be case insensitive', () => {
      const tree = {
        interactiveElements: [
          { role: 'button', name: 'SUBMIT', coordinates: { x: 100, y: 100 }, visible: true, enabled: true }
        ]
      };

      const result = parser.findElementByName(tree, 'submit');
      expect(result).not.toBeNull();
    });

    it('should return null if no match found', () => {
      const tree = {
        interactiveElements: [
          { role: 'button', name: 'Submit', coordinates: { x: 100, y: 100 }, visible: true, enabled: true }
        ]
      };

      const result = parser.findElementByName(tree, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should handle tree without interactiveElements', () => {
      const tree = {};

      const result = parser.findElementByName(tree, 'test');
      expect(result).toBeNull();
    });

    it('should handle element with null name', () => {
      const tree = {
        interactiveElements: [
          { role: 'button', name: null, coordinates: { x: 100, y: 100 }, visible: true, enabled: true }
        ]
      };

      const result = parser.findElementByName(tree, 'test');
      expect(result).toBeNull();
    });
  });

  describe('getTreeStats', () => {
    it('should return statistics for a tree', () => {
      const tree = {
        pageTitle: 'Test Page',
        metadata: { url: 'https://test.com', totalElements: 5 },
        interactiveElements: [
          { role: 'button', name: 'Submit', coordinates: { x: 100, y: 100 }, visible: true, enabled: true },
          { role: 'button', name: 'Cancel', coordinates: { x: 200, y: 200 }, visible: true, enabled: true },
          { role: 'link', name: 'Click', coordinates: { x: 300, y: 300 }, visible: true, enabled: true }
        ],
        landmarks: [
          { role: 'main', name: 'Main' }
        ]
      };

      const stats = parser.getTreeStats(tree);
      expect(stats.pageTitle).toBe('Test Page');
      expect(stats.url).toBe('https://test.com');
      expect(stats.totalElements).toBe(5);
      expect(stats.interactiveElements).toBe(3);
      expect(stats.landmarks).toBe(1);
      expect(stats.roleBreakdown).toEqual({ button: 2, link: 1 });
    });

    it('should return role breakdown', () => {
      const tree = {
        interactiveElements: [
          { role: 'button', name: 'A' },
          { role: 'button', name: 'B' },
          { role: 'link', name: 'C' },
          { role: 'textbox', name: 'D' }
        ]
      };

      const stats = parser.getTreeStats(tree);
      expect(stats.roleBreakdown).toEqual({ button: 2, link: 1, textbox: 1 });
    });

    it('should handle missing interactiveElements array', () => {
      const tree = {
        pageTitle: 'Test',
        metadata: {}
      };

      const stats = parser.getTreeStats(tree);
      expect(stats.roleBreakdown).toEqual({});
    });
  });

  describe('_getRoleBreakdown', () => {
    it('should count roles correctly', () => {
      const elements = [
        { role: 'button' },
        { role: 'button' },
        { role: 'link' },
        { role: 'link' },
        { role: 'link' }
      ];

      const breakdown = parser._getRoleBreakdown(elements);
      expect(breakdown).toEqual({ button: 2, link: 3 });
    });

    it('should handle empty array', () => {
      const breakdown = parser._getRoleBreakdown([]);
      expect(breakdown).toEqual({});
    });
  });
});