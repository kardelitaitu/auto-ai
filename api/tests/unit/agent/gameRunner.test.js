/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@api/core/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

vi.mock('@api/core/context.js', () => ({
    getPage: vi.fn(),
}));

vi.mock('@api/agent/llmClient.js', () => ({
    llmClient: {
        init: vi.fn().mockResolvedValue(undefined),
        chat: vi.fn().mockResolvedValue({ content: '{"action": "done"}' }),
    },
}));

vi.mock('@api/agent/actionEngine.js', () => ({
    actionEngine: {
        execute: vi.fn().mockResolvedValue({ success: true, done: false }),
    },
}));

vi.mock('@api/agent/tokenCounter.js', () => ({
    estimateConversationTokens: vi.fn().mockReturnValue(100),
}));

vi.mock('@api/core/config.js', () => ({
    configManager: {
        get: vi.fn().mockReturnValue({}),
    },
}));

vi.mock('@api/agent/visualDiff.js', () => ({
    visualDiffEngine: {
        captureState: vi.fn().mockResolvedValue({}),
        hasChanged: vi.fn().mockReturnValue(false),
    },
}));

vi.mock('@api/agent/adaptiveTiming.js', () => ({
    adaptiveTiming: {
        getDelay: vi.fn().mockReturnValue(100),
    },
}));

vi.mock('@api/agent/goalDecomposer.js', () => ({
    goalDecomposer: {
        decompose: vi.fn().mockReturnValue([{ subgoal: 'test', priority: 1 }]),
    },
}));

vi.mock('@api/agent/sessionStore.js', () => ({
    sessionStore: {
        get: vi.fn().mockReturnValue(null),
        set: vi.fn(),
    },
}));

vi.mock('@api/agent/progressTracker.js', () => ({
    progressTracker: {
        track: vi.fn(),
        getProgress: vi.fn().mockReturnValue(0),
    },
}));

vi.mock('@api/agent/actionRollback.js', () => ({
    actionRollback: {
        save: vi.fn(),
        restore: vi.fn(),
    },
}));

vi.mock('@api/agent/semanticMapper.js', () => ({
    semanticMapper: {
        map: vi.fn().mockReturnValue([]),
    },
}));

vi.mock('@api/agent/parallelExecutor.js', () => ({
    parallelExecutor: {
        execute: vi.fn().mockResolvedValue([]),
    },
}));

describe('api/agent/gameRunner.js', () => {
    let gameAgentRunner;
    let mockPage;

    beforeEach(async () => {
        vi.clearAllMocks();

        mockPage = {
            url: vi.fn().mockReturnValue('https://game.example.com'),
            screenshot: vi.fn().mockResolvedValue(Buffer.from('screenshot')),
            bringToFront: vi.fn().mockResolvedValue(undefined),
            viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
        };

        const { getPage } = await import('@api/core/context.js');
        getPage.mockReturnValue(mockPage);

        const module = await import('@api/agent/gameRunner.js');
        gameAgentRunner = module.gameAgentRunner || module.default;
    });

    describe('gameAgentRunner', () => {
        it('should be defined', () => {
            expect(gameAgentRunner).toBeDefined();
        });
    });

    describe('module exports', () => {
        it('should export gameAgentRunner', () => {
            expect(gameAgentRunner).toBeDefined();
            expect(typeof gameAgentRunner.run).toBe('function');
        });
    });
});
