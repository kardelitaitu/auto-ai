// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import aiTesterTask from '../../tasks/ai-testertask.js';
import { createLogger } from '../../utils/logger.js';
import { GhostCursor } from '../../utils/ghostCursor.js';
import { mathUtils } from '../../utils/mathUtils.js';
import AgentConnector from '../../core/agent-connector.js';
import { applyHumanizationPatch } from '../../utils/browserPatch.js';
import { entropy } from '../../utils/entropyController.js';

// Mocks
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
}));

vi.mock('../../utils/ghostCursor.js');
vi.mock('../../utils/mathUtils.js');
vi.mock('../../core/agent-connector.js');
vi.mock('../../utils/browserPatch.js');

// Mock entropyController with factory to avoid side effects during import
vi.mock('../../utils/entropyController.js', () => ({
    entropy: {
        reactionTime: vi.fn(() => 500),
    },
}));

describe('aiTesterTask', () => {
    let mockPage;
    let mockLogger;
    let mockCursor;
    let mockConnector;
    let mockLocator;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Logger mock
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
        createLogger.mockReturnValue(mockLogger);

        // Cursor mock
        mockCursor = {
            twitterClick: vi.fn(),
        };
        GhostCursor.mockImplementation(function() { return mockCursor; });

        // MathUtils mock
        mathUtils.sample = vi.fn((arr) => arr[0]);
        mathUtils.randomInRange = vi.fn(() => 100);

        // Entropy mock
        entropy.reactionTime = vi.fn(() => 500);

        // AgentConnector mock
        mockConnector = {
            processRequest: vi.fn(),
        };
        AgentConnector.mockImplementation(function() { return mockConnector; });

        // Page mock setup
        mockLocator = {
            first: vi.fn().mockReturnThis(),
            isVisible: vi.fn().mockResolvedValue(true),
            click: vi.fn().mockResolvedValue(undefined),
            catch: vi.fn().mockReturnThis(),
        };

        mockPage = {
            goto: vi.fn().mockResolvedValue(undefined),
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            locator: vi.fn().mockReturnValue(mockLocator),
            keyboard: {
                type: vi.fn().mockResolvedValue(undefined),
                press: vi.fn().mockResolvedValue(undefined),
            },
            url: vi.fn().mockReturnValue('https://www.google.com/search?q=technology'),
            title: vi.fn().mockResolvedValue('technology - Google Search'),
            evaluate: vi.fn((fn) => {
                // If fn is a function, execute it
                if (typeof fn === 'function') return fn();
                // If fn is a string, evaluate it (basic mock)
                return 'Search result content...';
            }),
            close: vi.fn().mockResolvedValue(undefined),
            isClosed: vi.fn().mockReturnValue(false),
        };

        // Mock document for jsdom environment
        global.document = {
            querySelector: vi.fn().mockReturnValue({ innerText: 'Main content' }),
            body: { innerText: 'Body content' },
        };

        // BrowserPatch mock
        applyHumanizationPatch.mockResolvedValue(undefined);
    });

    it('should handle consent popup check error', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockConnector.processRequest.mockResolvedValue({ success: true, content: 'Summary' });
        
        const consentBtn = {
            first: vi.fn().mockReturnThis(),
            isVisible: vi.fn().mockRejectedValue(new Error('Not visible')),
            click: vi.fn(),
        };
        
        mockPage.locator.mockImplementation((selector) => {
            if (selector === 'button:has-text("I agree")') return consentBtn;
            return mockLocator;
        });

        // Act
        await aiTesterTask(mockPage, payload);

        // Assert
        expect(consentBtn.click).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Accepting consent'));
    });

    it('should execute successfully with valid inputs', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome', sessionId: 'test-session' };
        mockConnector.processRequest.mockResolvedValue({
            success: true,
            content: 'This is a summary of the search results.',
        });

        // Act
        const result = await aiTesterTask(mockPage, payload);

        // Assert
        expect(createLogger).toHaveBeenCalledWith('ai-testertask.js [chrome]');
        expect(applyHumanizationPatch).toHaveBeenCalledWith(mockPage, mockLogger);
        expect(mockPage.goto).toHaveBeenCalledWith('https://www.google.com', expect.any(Object));
        expect(mockPage.locator).toHaveBeenCalledWith('textarea[name="q"], input[name="q"]');
        expect(mockCursor.twitterClick).toHaveBeenCalled();
        expect(mockPage.keyboard.type).toHaveBeenCalledTimes(10); // 'technology'.length
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
        expect(mockConnector.processRequest).toHaveBeenCalled();
        expect(result.status).toBe('success');
        expect(result.testResults.aiSummary).toBe('This is a summary of the search results.');
        expect(mockPage.close).toHaveBeenCalled();
    });

    it('should handle consent popup if visible', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockConnector.processRequest.mockResolvedValue({ success: true, content: 'Summary' });
        
        // Setup consent button locator
        const consentBtn = {
            first: vi.fn().mockReturnThis(),
            isVisible: vi.fn().mockResolvedValue(true),
            click: vi.fn().mockResolvedValue(undefined),
            catch: vi.fn().mockReturnThis(),
        };
        
        // Mock locator to return consent button for the specific selector
        mockPage.locator.mockImplementation((selector) => {
            if (selector === 'button:has-text("I agree")') return consentBtn;
            return mockLocator;
        });

        // Act
        await aiTesterTask(mockPage, payload);

        // Assert
        expect(consentBtn.click).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Accepting consent'));
    });

    it('should skip consent popup if not visible', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockConnector.processRequest.mockResolvedValue({ success: true, content: 'Summary' });
        
        const consentBtn = {
            first: vi.fn().mockReturnThis(),
            isVisible: vi.fn().mockResolvedValue(false), // Not visible
            click: vi.fn(),
            catch: vi.fn().mockReturnThis(),
        };
        
        mockPage.locator.mockImplementation((selector) => {
            if (selector === 'button:has-text("I agree")') return consentBtn;
            return mockLocator;
        });

        // Act
        await aiTesterTask(mockPage, payload);

        // Assert
        expect(consentBtn.click).not.toHaveBeenCalled();
    });

    it('should throw error if search box is not visible', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockLocator.isVisible.mockResolvedValue(false); // Search box not visible

        // Act
        const result = await aiTesterTask(mockPage, payload);

        // Assert
        expect(result.status).toBe('failed');
        expect(result.testResults.errors).toContain('Search box not visible');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Search box not visible'));
    });

    it('should handle AI summarization failure', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockConnector.processRequest.mockResolvedValue({
            success: false,
            error: 'API Error',
        });

        // Act
        const result = await aiTesterTask(mockPage, payload);

        // Assert
        expect(result.status).toBe('success'); // Task itself succeeds even if AI fails
        expect(result.testResults.aiSummary).toBe('');
        expect(result.testResults.errors).toContain('AI Error: API Error');
        expect(mockLogger.warn).toHaveBeenCalledWith('[ai-testertask] AI summarization failed');
    });

    it('should handle page closure errors gracefully', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockConnector.processRequest.mockResolvedValue({ success: true, content: 'Summary' });
        mockPage.close.mockRejectedValue(new Error('Close error'));

        // Act
        const result = await aiTesterTask(mockPage, payload);

        // Assert
        expect(result.status).toBe('success');
        // Should not crash
    });

    it('should use default session ID if not provided', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockConnector.processRequest.mockResolvedValue({ success: true, content: 'Summary' });

        // Act
        await aiTesterTask(mockPage, payload);

        // Assert
        expect(mockConnector.processRequest).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: 'chrome'
        }));
    });

    it('should handle page evaluation errors', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockPage.evaluate.mockRejectedValue(new Error('Evaluate error'));

        // Act
        const result = await aiTesterTask(mockPage, payload);

        // Assert
        expect(result.status).toBe('failed');
        expect(result.testResults.errors).toContain('Evaluate error');
    });

    it('should handle empty payload', async () => {
        // Arrange
        const payload = {};
        mockConnector.processRequest.mockResolvedValue({ success: true, content: 'Summary' });

        // Act
        await aiTesterTask(mockPage, payload);

        // Assert
        expect(createLogger).toHaveBeenCalledWith('ai-testertask.js [unknown]');
    });

    it('should fallback to document.body if main element is missing', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockConnector.processRequest.mockResolvedValue({ success: true, content: 'Summary' });

        // Mock document with no main element, only body
        global.document.querySelector.mockReturnValue(null);
        global.document.body = { innerText: 'Body content only' };

        // Act
        const result = await aiTesterTask(mockPage, payload);

        // Assert
        expect(result.testResults.pageContent).toBe('Body content only');
    });

    it('should handle missing innerText gracefully', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockConnector.processRequest.mockResolvedValue({ success: true, content: 'Summary' });

        // Mock document where body has no innerText
        global.document.querySelector.mockReturnValue(null);
        global.document.body = { innerText: undefined }; // or null

        // Act
        const result = await aiTesterTask(mockPage, payload);

        // Assert
        expect(result.testResults.pageContent).toBe('');
    });

    it('should handle case where both main and body are missing', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockConnector.processRequest.mockResolvedValue({ success: true, content: 'Summary' });

        // Mock document with no main and no body
        global.document.querySelector.mockReturnValue(null);
        global.document.body = null;

        // Act
        const result = await aiTesterTask(mockPage, payload);

        // Assert
        expect(result.testResults.pageContent).toBe('');
    });

    it('should use fallback sessionId when not provided', async () => {
        // Arrange
        const payload = { browserInfo: '' }; // empty browserInfo
        mockConnector.processRequest.mockResolvedValue({ success: true, content: 'Summary' });

        // Act
        await aiTesterTask(mockPage, payload);

        // Assert
        expect(mockConnector.processRequest).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: 'ai-testertask'
        }));
    });

    it('should handle AI success with empty content', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockConnector.processRequest.mockResolvedValue({
            success: true,
            content: null // No content
        });

        // Act
        const result = await aiTesterTask(mockPage, payload);

        // Assert
        expect(result.testResults.aiSummary).toBe('No summary generated');
    });

    it('should handle AI failure with no error message', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockConnector.processRequest.mockResolvedValue({
            success: false,
            error: null // No error message
        });

        // Act
        const result = await aiTesterTask(mockPage, payload);

        // Assert
        expect(result.testResults.errors).toContain('AI Error: Unknown error');
    });

    it('should handle null page gracefully', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };

        // Act
        const result = await aiTesterTask(null, payload);

        // Assert
        expect(result.status).toBe('failed');
        // Ensure cleanup didn't crash (page check handled null)
    });

    it('should not close page if already closed', async () => {
        // Arrange
        const payload = { browserInfo: 'chrome' };
        mockConnector.processRequest.mockResolvedValue({ success: true, content: 'Summary' });
        mockPage.isClosed.mockReturnValue(true);

        // Act
        await aiTesterTask(mockPage, payload);

        // Assert
        expect(mockPage.close).not.toHaveBeenCalled();
    });
});
