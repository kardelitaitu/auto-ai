/**
 * @fileoverview TypeScript Type Definitions for Auto-AI API
 * Provides IDE autocomplete for consumers without full TypeScript migration.
 *
 * @module api/index.d.ts
 */

import type { Page, Locator, BrowserContext } from 'playwright';

export declare const api: {
    version: string;

    withPage: <T>(page: Page, fn: () => Promise<T>) => Promise<T>;
    clearContext: () => void;
    isSessionActive: () => boolean;
    checkSession: () => boolean;
    getPage: () => Page;
    getCursor: () => import('./utils/ghostCursor.js').GhostCursor;
    eval: (fn: (...args: any[]) => any, ...args: any[]) => Promise<any>;
    init: (page: Page, options?: ApiOptions) => Promise<void>;
    diagnose: (page: Page) => Promise<object>;
    emulateMedia: (options?: {
        type?: string;
        colorScheme?: 'light' | 'dark' | 'no-preference';
    }) => Promise<void>;
    clearLiteMode: () => Promise<void>;
    config: ConfigurationManager;

    click: (selector: string, options?: ClickOptions) => Promise<void>;
    type: (selector: string, text: string, options?: TypeOptions) => Promise<void>;
    hover: (selector: string, options?: { timeout?: number }) => Promise<void>;
    rightClick: (selector: string, options?: ClickOptions) => Promise<void>;

    scroll: {
        (distance: number): Promise<void>;
        focus: (selector: string, options?: ScrollFocusOptions) => Promise<void>;
        read: (target?: string | number | Locator, options?: ScrollReadOptions) => Promise<void>;
        back: (distance?: number) => Promise<void>;
        toTop: (duration?: number) => Promise<void>;
        toBottom: () => Promise<void>;
    };

    cursor: {
        move: (x: number, y: number, options?: CursorMoveOptions) => Promise<void>;
        click: (x: number, y: number, options?: ClickOptions) => Promise<void>;
    };

    wait: (ms: number) => Promise<void>;
    waitFor: (
        selectorOrPredicate: string | Locator | (() => Promise<boolean>),
        options?: WaitOptions
    ) => Promise<void>;
    waitVisible: (selector: string, options?: WaitOptions) => Promise<void>;
    waitHidden: (selector: string, options?: WaitOptions) => Promise<void>;
    waitForLoadState: (state?: string, options?: WaitOptions) => Promise<void>;
    waitForURL: (
        urlOrPredicate: string | RegExp | ((url: string) => boolean),
        options?: WaitOptions
    ) => Promise<void>;

    goto: (url: string, options?: NavigationOptions) => Promise<NavigationResult>;
    reload: (options?: NavigationOptions) => Promise<void>;
    back: () => Promise<void>;
    forward: () => Promise<void>;

    think: (ms?: number) => Promise<void>;
    delay: (ms: number) => Promise<void>;
    gaussian: (mean: number, dev: number, min?: number, max?: number) => number;
    randomInRange: (min: number, max: number) => number;

    setPersona: (name: string, overrides?: object) => void;
    getPersona: () => PersonaConfig;
    getPersonaName: () => string;
    listPersonas: () => string[];

    recover: (error: Error) => Promise<void>;
    findElement: (selector: string, options?: { timeout?: number }) => Promise<Locator | null>;
    smartClick: (selector: string, options?: ClickOptions) => Promise<void>;

    getContextState: () => object;
    setContextState: (state: object) => void;
    getStateSection: (section: string) => object;
    updateStateSection: (section: string, values: object) => void;

    createPipeline: (...middlewares: Function[]) => Function;
    createSyncPipeline: (...middlewares: Function[]) => Function;
    loggingMiddleware: (options?: object) => Function;
    validationMiddleware: (options?: object) => Function;
    retryMiddleware: (options?: RetryOptions) => Function;
    recoveryMiddleware: (options?: object) => Function;
    metricsMiddleware: (options?: object) => Function;
    rateLimitMiddleware: (options?: RateLimitOptions) => Function;

    file: {
        readline: (filename: string) => Promise<string>;
        consumeline: (filename: string) => Promise<string>;
    };

    text: (selector: string) => Promise<string>;
    attr: (selector: string, name: string) => Promise<string | null>;
    visible: (selector: string) => Promise<boolean>;
    count: (selector: string) => Promise<number>;
    exists: (selector: string) => Promise<boolean>;
    getCurrentUrl: () => Promise<string>;

    ActionError: typeof import('./core/errors.js').ActionError;
    ValidationError: typeof import('./core/errors.js').ValidationError;
    ElementNotFoundError: typeof import('./core/errors.js').ElementNotFoundError;
    ElementTimeoutError: typeof import('./core/errors.js').ElementTimeoutError;
};

export interface ApiOptions {
    persona?: string;
    personaOverrides?: object;
    patch?: boolean;
    humanizationPatch?: boolean;
    autoInitNewPages?: boolean;
    colorScheme?: 'light' | 'dark';
    logger?: object;
    sensors?: boolean;
}

export interface ClickOptions {
    recovery?: boolean;
    maxRetries?: number;
    hoverBeforeClick?: boolean;
    precision?: 'exact' | 'safe' | 'rough';
    button?: 'left' | 'right' | 'middle';
    force?: boolean;
    timeout?: number;
}

export interface TypeOptions {
    delay?: number;
    noClear?: boolean;
    humanize?: boolean;
}

export interface ScrollOptions {
    pauses?: number;
    scrollAmount?: number;
    variableSpeed?: boolean;
    backScroll?: boolean;
}

export interface ScrollFocusOptions {
    randomness?: number;
    timeout?: number;
}

export interface ScrollReadOptions {
    pauses?: number;
    scrollAmount?: number;
    variableSpeed?: boolean;
    backScroll?: boolean;
}

export interface CursorMoveOptions {
    steps?: number;
    duration?: number;
}

export interface WaitOptions {
    timeout?: number;
    state?: 'attached' | 'visible' | 'hidden' | 'detached';
    polling?: number;
    throwOnTimeout?: boolean;
}

export interface NavigationOptions {
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    headers?: Record<string, string>;
}

export interface NavigationResult {
    success: boolean;
    url: string;
    duration: number;
}

export interface RetryOptions {
    maxRetries?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error) => boolean;
}

export interface RateLimitOptions {
    maxPerSecond?: number;
    state?: { actionCount: number; windowStart: number };
}

export interface PersonaConfig {
    name: string;
    speed: number;
    scrollSpeed: number;
    typoRate: number;
    jitter: number;
    hesitation: number;
    [key: string]: any;
}

export interface ConfigurationManager {
    get: (path: string) => any;
    set: (path: string, value: any) => void;
    getAll: () => object;
    reset: () => void;
}

export class GhostCursor {
    constructor(page: Page, options?: object);
    move(x: number, y: number, options?: CursorMoveOptions): Promise<void>;
    click(x: number, y: number, options?: ClickOptions): Promise<void>;
}

export class AutomationError extends Error {
    code: string;
    constructor(message: string, code?: string);
}

export class SessionError extends AutomationError {}
export class ContextError extends AutomationError {}
export class ElementError extends AutomationError {}
export class ActionError extends AutomationError {}
export class NavigationError extends AutomationError {}
export class ConfigError extends AutomationError {}
export class LLMError extends AutomationError {}
export class ValidationError extends AutomationError {}

export function isErrorCode(error: Error, code: string): boolean;
