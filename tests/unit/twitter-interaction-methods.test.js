import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  replyMethods,
  quoteMethods,
  executeReplyMethod,
  executeQuoteMethod
} from '../../utils/twitter-interaction-methods.js';

describe('twitter-interaction-methods', () => {
  let mockPage;
  let mockHuman;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    mockHuman = {
      safeHumanClick: vi.fn().mockResolvedValue(undefined),
      typeText: vi.fn().mockResolvedValue(undefined),
      postTweet: vi.fn().mockResolvedValue({ success: true }),
      verifyComposerOpen: vi.fn().mockResolvedValue({ open: true, selector: '[data-testid="tweetTextarea_0"]', locator: null }),
      findElement: vi.fn().mockResolvedValue({ element: null, selector: '' }),
      fixation: vi.fn().mockResolvedValue(undefined),
      microMove: vi.fn().mockResolvedValue(undefined)
    };

    mockPage = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      keyboard: {
        press: vi.fn().mockResolvedValue(undefined),
        down: vi.fn().mockResolvedValue(undefined),
        up: vi.fn().mockResolvedValue(undefined)
      },
      locator: vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0),
          isVisible: vi.fn().mockResolvedValue(false),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
          focus: vi.fn().mockResolvedValue(undefined),
          textContent: vi.fn().mockResolvedValue(''),
          elementHandle: vi.fn().mockResolvedValue(null)
        }),
        count: vi.fn().mockResolvedValue(0),
        all: vi.fn().mockResolvedValue([])
      }),
      url: vi.fn().mockReturnValue('https://x.com/user/status/123'),
      mouse: {
        wheel: vi.fn().mockResolvedValue(undefined)
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('replyMethods', () => {
    describe('replyA', () => {
      it('should successfully post reply using keyboard shortcut', async () => {
        const mockTimeElement = {
          count: vi.fn().mockResolvedValue(1)
        };
        
        mockPage.locator.mockImplementation((selector) => {
          if (selector === 'article time') {
            return {
              first: vi.fn().mockReturnValue(mockTimeElement)
            };
          }
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(0),
              isVisible: vi.fn().mockResolvedValue(false)
            }),
            count: vi.fn().mockResolvedValue(0)
          };
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({ 
          open: true, 
          selector: '[data-testid="tweetTextarea_0"]',
          locator: null
        });

        const result = await replyMethods.replyA(mockPage, 'Test reply', mockHuman, mockLogger);

        expect(result.success).toBe(true);
        expect(result.method).toBe('replyA');
        expect(mockHuman.safeHumanClick).toHaveBeenCalled();
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('r');
      });

      it('should retry on failure', async () => {
        mockPage.locator.mockReturnValue({
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0),
            isVisible: vi.fn().mockResolvedValue(false)
          }),
          count: vi.fn().mockResolvedValue(0)
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({ open: false });

        const result = await replyMethods.replyA(mockPage, 'Test', mockHuman, mockLogger, { maxRetries: 1 });

        expect(result.success).toBe(false);
        expect(result.reason).toBe('composer_not_opened');
      });

      it('should fall back to tweet text if time not found', async () => {
        const mockTweetText = {
          count: vi.fn().mockResolvedValue(1)
        };

        mockPage.locator.mockImplementation((selector) => {
          if (selector === 'article time') {
            return {
              first: vi.fn().mockReturnValue({
                count: vi.fn().mockResolvedValue(0)
              })
            };
          }
          if (selector === '[data-testid="tweetText"]') {
            return {
              first: vi.fn().mockReturnValue(mockTweetText)
            };
          }
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(0),
              isVisible: vi.fn().mockResolvedValue(false)
            }),
            count: vi.fn().mockResolvedValue(0)
          };
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({ 
          open: true, 
          selector: 'textarea',
          locator: null 
        });

        await replyMethods.replyA(mockPage, 'Test', mockHuman, mockLogger);

        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Clicked tweet text'));
      });

      it('should handle post failure', async () => {
        mockPage.locator.mockReturnValue({
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1)
          }),
          count: vi.fn().mockResolvedValue(0)
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({ 
          open: true, 
          selector: 'textarea',
          locator: null 
        });

        mockHuman.postTweet.mockResolvedValue({ 
          success: false, 
          reason: 'rate_limited' 
        });

        const result = await replyMethods.replyA(mockPage, 'Test', mockHuman, mockLogger);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('rate_limited');
      });
    });

    describe('replyB', () => {
      it('should post reply using reply button', async () => {
        const mockButton = {
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
          isVisible: vi.fn().mockResolvedValue(true)
        };

        mockHuman.findElement.mockResolvedValue({
          element: mockButton,
          selector: '[data-testid="replyEdge"]'
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({
          open: true,
          selector: 'textarea',
          locator: null
        });

        const result = await replyMethods.replyB(mockPage, 'Test reply', mockHuman, mockLogger);

        expect(result.success).toBe(true);
        expect(mockHuman.findElement).toHaveBeenCalledWith(
          mockPage,
          ['[data-testid="replyEdge"]', '[data-testid="reply"]'],
          { visibleOnly: true }
        );
      });

      it('should fail if reply button not found', async () => {
        mockHuman.findElement.mockResolvedValue({
          element: null,
          selector: ''
        });

        const result = await replyMethods.replyB(mockPage, 'Test', mockHuman, mockLogger);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('button_not_found');
      });

      it('should fail if composer does not open', async () => {
        const mockButton = {
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        };

        mockHuman.findElement.mockResolvedValue({
          element: mockButton,
          selector: '[data-testid="replyEdge"]'
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({ open: false });

        const result = await replyMethods.replyB(mockPage, 'Test', mockHuman, mockLogger);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('composer_not_opened');
      });
    });

    describe('replyC', () => {
      it('should post reply using direct composer focus', async () => {
        const mockReplyBox = {
          count: vi.fn().mockResolvedValue(1),
          focus: vi.fn().mockResolvedValue(undefined),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        };

        mockPage.locator.mockImplementation((selector) => {
          if (selector === 'article time') {
            return {
              first: vi.fn().mockReturnValue({
                count: vi.fn().mockResolvedValue(1)
              })
            };
          }
          if (selector === '[data-testid="tweetTextarea_0"]') {
            return {
              first: vi.fn().mockReturnValue(mockReplyBox)
            };
          }
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(0)
            }),
            count: vi.fn().mockResolvedValue(0)
          };
        });

        mockPage.evaluate.mockResolvedValue('Post your reply');

        const result = await replyMethods.replyC(mockPage, 'Test reply', mockHuman, mockLogger);

        expect(result.success).toBe(true);
        expect(mockReplyBox.focus).toHaveBeenCalled();
        expect(mockHuman.typeText).toHaveBeenCalled();
      });

      it('should scroll to find reply box', async () => {
        const mockReplyBox = {
          count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
          focus: vi.fn().mockResolvedValue(undefined),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        };

        mockPage.locator.mockImplementation((selector) => {
          if (selector === 'article time') {
            return {
              first: vi.fn().mockReturnValue({
                count: vi.fn().mockResolvedValue(1)
              })
            };
          }
          if (selector === '[data-testid="tweetTextarea_0"]') {
            return {
              first: vi.fn().mockReturnValue(mockReplyBox)
            };
          }
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(0)
            })
          };
        });

        mockPage.evaluate.mockResolvedValue('Post your reply');

        const result = await replyMethods.replyC(mockPage, 'Test', mockHuman, mockLogger);

        expect(result.success).toBe(true);
      });

      it('should fail if reply box not found', async () => {
        mockPage.locator.mockReturnValue({
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0)
          }),
          count: vi.fn().mockResolvedValue(0)
        });

        const result = await replyMethods.replyC(mockPage, 'Test', mockHuman, mockLogger);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('reply_box_not_found');
      });

      it('should handle mismatched placeholder text', async () => {
        const mockReplyBox = {
          count: vi.fn().mockResolvedValue(1),
          focus: vi.fn().mockResolvedValue(undefined),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        };

        mockPage.locator.mockImplementation((selector) => {
          if (selector === 'article time') {
            return {
              first: vi.fn().mockReturnValue({
                count: vi.fn().mockResolvedValue(1)
              })
            };
          }
          if (selector === '[data-testid="tweetTextarea_0"]') {
            return {
              first: vi.fn().mockReturnValue(mockReplyBox)
            };
          }
          return {
            first: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue(0)
            })
          };
        });

        mockPage.evaluate.mockResolvedValue('Wrong placeholder');

        await replyMethods.replyC(mockPage, 'Test', mockHuman, mockLogger);

        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Placeholder text mismatch'));
      });
    });
  });

  describe('quoteMethods', () => {
    describe('quoteA', () => {
      it('should post quote using T key method', async () => {
        mockPage.locator.mockReturnValue({
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1)
          })
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({
          open: true,
          selector: 'textarea',
          locator: null
        });

        const result = await quoteMethods.quoteA(mockPage, 'Test quote', mockHuman, mockLogger);

        expect(result.success).toBe(true);
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('t');
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('ArrowDown');
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
      });

      it('should fail if composer does not open', async () => {
        mockPage.locator.mockReturnValue({
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0)
          })
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({ open: false });

        const result = await quoteMethods.quoteA(mockPage, 'Test', mockHuman, mockLogger);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('composer_not_opened');
      });

      it('should clear existing text before typing', async () => {
        mockPage.locator.mockReturnValue({
          first: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1)
          })
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({
          open: true,
          selector: 'textarea',
          locator: null
        });

        await quoteMethods.quoteA(mockPage, 'Test', mockHuman, mockLogger);

        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Control+a');
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Delete');
      });
    });

    describe('quoteB', () => {
      it('should post quote via retweet menu', async () => {
        const mockRetweetBtn = {
          isVisible: vi.fn().mockResolvedValue(true),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        };

        const mockQuoteOption = {
          isVisible: vi.fn().mockResolvedValue(true),
          innerText: vi.fn().mockResolvedValue('Quote')
        };

        mockPage.locator.mockImplementation((selector) => {
          if (selector.includes('retweet') || selector.includes('Repost')) {
            return {
              all: vi.fn().mockResolvedValue([mockRetweetBtn]),
              first: vi.fn().mockReturnValue(mockRetweetBtn)
            };
          }
          if (selector.includes('Quote') || selector.includes('menuitem')) {
            return {
              all: vi.fn().mockResolvedValue([mockQuoteOption]),
              first: vi.fn().mockReturnValue(mockQuoteOption)
            };
          }
          return {
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            }),
            all: vi.fn().mockResolvedValue([])
          };
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({
          open: true,
          selector: 'textarea',
          locator: null
        });

        const result = await quoteMethods.quoteB(mockPage, 'Test quote', mockHuman, mockLogger);

        expect(result.success).toBe(true);
        expect(mockHuman.safeHumanClick).toHaveBeenCalledWith(
          expect.anything(),
          'Retweet Button',
          3
        );
      });

      it('should fail if retweet button not found', async () => {
        mockPage.locator.mockReturnValue({
          all: vi.fn().mockResolvedValue([]),
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        });

        const result = await quoteMethods.quoteB(mockPage, 'Test', mockHuman, mockLogger);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('retweet_button_not_found');
      });

      it('should fail if quote option not found', async () => {
        const mockRetweetBtn = {
          isVisible: vi.fn().mockResolvedValue(true),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        };

        mockPage.locator.mockImplementation((selector) => {
          if (selector.includes('retweet') || selector.includes('Repost')) {
            return {
              all: vi.fn().mockResolvedValue([mockRetweetBtn]),
              first: vi.fn().mockReturnValue(mockRetweetBtn)
            };
          }
          return {
            all: vi.fn().mockResolvedValue([]),
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        });

        const result = await quoteMethods.quoteB(mockPage, 'Test', mockHuman, mockLogger);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('quote_option_not_found');
      });

      it('should escape before finding retweet button', async () => {
        const mockRetweetBtn = {
          isVisible: vi.fn().mockResolvedValue(true),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        };

        const mockQuoteOption = {
          isVisible: vi.fn().mockResolvedValue(true),
          innerText: vi.fn().mockResolvedValue('Quote')
        };

        mockPage.locator.mockImplementation((selector) => {
          if (selector.includes('retweet') || selector.includes('Repost')) {
            return {
              all: vi.fn().mockResolvedValue([mockRetweetBtn]),
              first: vi.fn().mockReturnValue(mockRetweetBtn)
            };
          }
          if (selector.includes('Quote')) {
            return {
              all: vi.fn().mockResolvedValue([mockQuoteOption]),
              first: vi.fn().mockReturnValue(mockQuoteOption)
            };
          }
          return {
            all: vi.fn().mockResolvedValue([]),
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({
          open: true,
          selector: 'textarea',
          locator: null
        });

        await quoteMethods.quoteB(mockPage, 'Test', mockHuman, mockLogger);

        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Escape');
      });
    });

    describe('quoteC', () => {
      it('should post quote via compose button', async () => {
        const mockComposeBtn = {
          isVisible: vi.fn().mockResolvedValue(true),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        };

        mockPage.locator.mockImplementation((selector) => {
          if (selector.includes('SideNav_NewTweet') || selector.includes('Post')) {
            return {
              all: vi.fn().mockResolvedValue([mockComposeBtn]),
              first: vi.fn().mockReturnValue(mockComposeBtn)
            };
          }
          return {
            all: vi.fn().mockResolvedValue([]),
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({
          open: true,
          selector: 'textarea',
          locator: null
        });

        const result = await quoteMethods.quoteC(mockPage, 'Test quote', mockHuman, mockLogger);

        expect(result.success).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Compose button'));
      });

      it('should fail if compose button not found', async () => {
        mockPage.locator.mockReturnValue({
          all: vi.fn().mockResolvedValue([]),
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        });

        const result = await quoteMethods.quoteC(mockPage, 'Test', mockHuman, mockLogger);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('compose_button_not_found');
      });

      it('should paste URL after typing text', async () => {
        const mockComposeBtn = {
          isVisible: vi.fn().mockResolvedValue(true),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        };

        mockPage.locator.mockImplementation((selector) => {
          if (selector.includes('SideNav') || selector.includes('Post')) {
            return {
              all: vi.fn().mockResolvedValue([mockComposeBtn]),
              first: vi.fn().mockReturnValue(mockComposeBtn)
            };
          }
          return {
            all: vi.fn().mockResolvedValue([]),
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({
          open: true,
          selector: 'textarea',
          locator: null
        });

        await quoteMethods.quoteC(mockPage, 'Test quote', mockHuman, mockLogger);

        expect(mockPage.evaluate).toHaveBeenCalledWith(
          expect.any(Function),
          'https://x.com/user/status/123'
        );
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Control+v');
      });

      it('should create new line before pasting URL', async () => {
        const mockComposeBtn = {
          isVisible: vi.fn().mockResolvedValue(true),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        };

        mockPage.locator.mockImplementation((selector) => {
          if (selector.includes('SideNav') || selector.includes('Post')) {
            return {
              all: vi.fn().mockResolvedValue([mockComposeBtn]),
              first: vi.fn().mockReturnValue(mockComposeBtn)
            };
          }
          return {
            all: vi.fn().mockResolvedValue([]),
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({
          open: true,
          selector: 'textarea',
          locator: null
        });

        await quoteMethods.quoteC(mockPage, 'Test', mockHuman, mockLogger);

        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
      });

      it('should escape before finding compose button', async () => {
        const mockComposeBtn = {
          isVisible: vi.fn().mockResolvedValue(true),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        };

        mockPage.locator.mockImplementation((selector) => {
          if (selector.includes('SideNav') || selector.includes('Post')) {
            return {
              all: vi.fn().mockResolvedValue([mockComposeBtn]),
              first: vi.fn().mockReturnValue(mockComposeBtn)
            };
          }
          return {
            all: vi.fn().mockResolvedValue([]),
            first: vi.fn().mockReturnValue({
              isVisible: vi.fn().mockResolvedValue(false)
            })
          };
        });

        mockHuman.verifyComposerOpen.mockResolvedValue({
          open: true,
          selector: 'textarea',
          locator: null
        });

        await quoteMethods.quoteC(mockPage, 'Test', mockHuman, mockLogger);

        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Escape');
      });
    });
  });

  describe('executeReplyMethod', () => {
    it('should handle unknown method', async () => {
      const result = await executeReplyMethod('unknown', mockPage, 'Test', mockHuman, mockLogger);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('unknown_method');
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown method'));
    });

    it('should accept uppercase method names', async () => {
      const result = await executeReplyMethod('REPLYA', mockPage, 'Test', mockHuman, mockLogger);

      expect(result).toBeDefined();
      expect(result.method).toBeDefined();
    });
  });

  describe('executeQuoteMethod', () => {
    it('should handle unknown method', async () => {
      const result = await executeQuoteMethod('unknown', mockPage, 'Test', mockHuman, mockLogger);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('unknown_method');
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown method'));
    });

    it('should accept uppercase method names', async () => {
      const result = await executeQuoteMethod('QUOTEA', mockPage, 'Test', mockHuman, mockLogger);

      expect(result).toBeDefined();
      expect(result.method).toBeDefined();
    });
  });
});
