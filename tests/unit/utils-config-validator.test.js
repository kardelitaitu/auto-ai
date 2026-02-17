/**
 * @fileoverview Unit tests for utils/config-validator.js
 * @module tests/unit/utils-config-validator.test
 */

import { describe, it, expect, vi } from 'vitest';
import { ConfigValidator, configValidator, validateConfig, validateWithReport } from '../../utils/config-validator.js';

vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

describe('utils/config-validator', () => {
    let validator;

    beforeEach(() => {
        validator = new ConfigValidator();
    });

    describe('Constructor', () => {
        it('should initialize with schemas', () => {
            expect(validator.schemas).toBeDefined();
            expect(validator.schemas.session).toBeDefined();
            expect(validator.schemas.engagement).toBeDefined();
        });
    });

    describe('initializeSchemas', () => {
        it('should have session schema', () => {
            expect(validator.schemas.session.cycles.required).toBe(true);
            expect(validator.schemas.session.minDuration.required).toBe(true);
        });

        it('should have engagement schema', () => {
            expect(validator.schemas.engagement.limits).toBeDefined();
            expect(validator.schemas.engagement.probabilities).toBeDefined();
        });

        it('should have timing schema', () => {
            expect(validator.schemas.timing.warmup).toBeDefined();
            expect(validator.schemas.timing.scroll).toBeDefined();
        });

        it('should have humanization schema', () => {
            expect(validator.schemas.humanization.mouse).toBeDefined();
            expect(validator.schemas.humanization.typing).toBeDefined();
        });

        it('should have ai schema', () => {
            expect(validator.schemas.ai.enabled).toBeDefined();
            expect(validator.schemas.ai.localEnabled).toBeDefined();
        });

        it('should have browser schema', () => {
            expect(validator.schemas.browser.theme).toBeDefined();
            expect(validator.schemas.browser.theme.enum).toContain('light');
        });

        it('should have monitoring schema', () => {
            expect(validator.schemas.monitoring.queueMonitor).toBeDefined();
        });

        it('should have system schema', () => {
            expect(validator.schemas.system.debugMode).toBeDefined();
        });
    });

    describe('validateConfig', () => {
        it('should return valid for correct config', () => {
            const config = {
                session: {
                    cycles: 5,
                    minDuration: 300,
                    maxDuration: 600
                },
                engagement: {
                    limits: {
                        replies: 5,
                        retweets: 3,
                        quotes: 2,
                        likes: 10,
                        follows: 5,
                        bookmarks: 5
                    },
                    probabilities: {
                        reply: 0.5,
                        quote: 0.2,
                        like: 0.7,
                        bookmark: 0.3
                    }
                }
            };

            const result = validator.validateConfig(config);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should return errors for invalid nested objects', () => {
            const schema = {
                type: 'object',
                properties: {
                    replies: { type: 'number', min: 0, max: 20 },
                    retweets: { type: 'number', min: 0, max: 10 },
                    quotes: { type: 'number', min: 0, max: 10 },
                    likes: { type: 'number', min: 0, max: 50 },
                    follows: { type: 'number', min: 0, max: 20 },
                    bookmarks: { type: 'number', min: 0, max: 20 }
                }
            };
            const data = {
                replies: 'not a number',
                retweets: 3,
                quotes: 2,
                likes: 10,
                follows: 5,
                bookmarks: 5
            };

            const errors = validator.validateSection(data, schema, 'limits');
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should return errors for values below minimum in nested objects', () => {
            const schema = {
                type: 'object',
                properties: {
                    replies: { type: 'number', min: 0, max: 20 },
                    retweets: { type: 'number', min: 0, max: 10 }
                }
            };
            const data = {
                replies: -1,
                retweets: 3
            };

            const errors = validator.validateSection(data, schema, 'limits');
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should return errors for values above maximum in nested objects', () => {
            const schema = {
                type: 'object',
                properties: {
                    replies: { type: 'number', min: 0, max: 20 },
                    retweets: { type: 'number', min: 0, max: 10 }
                }
            };
            const data = {
                replies: 100,
                retweets: 3
            };

            const errors = validator.validateSection(data, schema, 'limits');
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should return errors for missing required fields in nested objects', () => {
            const schema = {
                type: 'object',
                properties: {
                    replies: { type: 'number', min: 0, max: 20, required: true },
                    retweets: { type: 'number', min: 0, max: 10, required: true }
                }
            };
            const data = {};

            const errors = validator.validateSection(data, schema, 'limits');
            expect(errors.some(e => e.includes('required'))).toBe(true);
        });

        it('should handle empty config', () => {
            const result = validator.validateConfig({});
            expect(result.valid).toBe(true);
        });
    });

    describe('validateSection', () => {
        it('should validate object schema', () => {
            const schema = {
                type: 'object',
                properties: {
                    name: { type: 'string', required: true },
                    age: { type: 'number', min: 0 }
                }
            };

            const data = { name: 'John', age: 30 };
            const errors = validator.validateSection(data, schema, 'test');
            expect(errors).toEqual([]);
        });

        it('should catch missing required fields', () => {
            const schema = {
                type: 'object',
                properties: {
                    name: { type: 'string', required: true }
                }
            };

            const data = {};
            const errors = validator.validateSection(data, schema, 'test');
            expect(errors.some(e => e.includes('required'))).toBe(true);
        });

        it('should validate nested objects', () => {
            const schema = {
                type: 'object',
                properties: {
                    nested: {
                        type: 'object',
                        properties: {
                            value: { type: 'number', required: true }
                        },
                        required: true
                    }
                }
            };

            const data = { nested: { value: 10 } };
            const errors = validator.validateSection(data, schema, 'test');
            expect(errors).toEqual([]);
        });
    });

    describe('validateField', () => {
        it('should validate string type', () => {
            const errors = validator.validateField('test', { type: 'string' }, 'field');
            expect(errors).toEqual([]);
        });

        it('should reject wrong type for string', () => {
            const errors = validator.validateField(123, { type: 'string' }, 'field');
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should validate number type', () => {
            const errors = validator.validateField(42, { type: 'number' }, 'field');
            expect(errors).toEqual([]);
        });

        it('should reject NaN for number', () => {
            const errors = validator.validateField(NaN, { type: 'number' }, 'field');
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should validate boolean type', () => {
            const errors = validator.validateField(true, { type: 'boolean' }, 'field');
            expect(errors).toEqual([]);
        });

        it('should validate object type', () => {
            const errors = validator.validateField({}, { type: 'object' }, 'field');
            expect(errors).toEqual([]);
        });

        it('should reject array for object type', () => {
            const errors = validator.validateField([], { type: 'object' }, 'field');
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should validate array type', () => {
            const errors = validator.validateField([1, 2, 3], { type: 'array' }, 'field');
            expect(errors).toEqual([]);
        });

        it('should validate enum values', () => {
            const errors = validator.validateField('light', { type: 'string', enum: ['light', 'dark'] }, 'field');
            expect(errors).toEqual([]);
        });

        it('should reject invalid enum values', () => {
            const errors = validator.validateField('blue', { type: 'string', enum: ['light', 'dark'] }, 'field');
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should validate minimum number', () => {
            const errors = validator.validateField(5, { type: 'number', min: 10 }, 'field');
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should validate maximum number', () => {
            const errors = validator.validateField(15, { type: 'number', max: 10 }, 'field');
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should validate array minItems', () => {
            const errors = validator.validateField([1], { type: 'array', minItems: 3 }, 'field');
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should validate array maxItems', () => {
            const errors = validator.validateField([1, 2, 3, 4, 5], { type: 'array', maxItems: 3 }, 'field');
            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('checkType', () => {
        it('should check string type', () => {
            expect(validator.checkType('test', 'string')).toBe(true);
            expect(validator.checkType(123, 'string')).toBe(false);
        });

        it('should check number type', () => {
            expect(validator.checkType(42, 'number')).toBe(true);
            expect(validator.checkType('42', 'number')).toBe(false);
            expect(validator.checkType(NaN, 'number')).toBe(false);
        });

        it('should check boolean type', () => {
            expect(validator.checkType(true, 'boolean')).toBe(true);
            expect(validator.checkType(false, 'boolean')).toBe(true);
            expect(validator.checkType('true', 'boolean')).toBe(false);
        });

        it('should check object type', () => {
            expect(validator.checkType({}, 'object')).toBe(true);
            expect(validator.checkType({ a: 1 }, 'object')).toBe(true);
            expect(validator.checkType([], 'object')).toBe(false);
            expect(validator.checkType(null, 'object')).toBe(false);
        });

        it('should check array type', () => {
            expect(validator.checkType([], 'array')).toBe(true);
            expect(validator.checkType([1, 2], 'array')).toBe(true);
            expect(validator.checkType({}, 'array')).toBe(false);
        });
    });

    describe('validateSectionConfig', () => {
        it('should validate specific section', () => {
            const data = {
                cycles: 5,
                minDuration: 300,
                maxDuration: 600
            };

            const result = validator.validateSectionConfig(data, 'session');
            expect(result.valid).toBe(true);
        });

        it('should return error for unknown section', () => {
            const result = validator.validateSectionConfig({}, 'unknown');
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Unknown section');
        });

        it('should validate engagement section', () => {
            const data = {
                limits: {
                    replies: 5,
                    retweets: 3,
                    quotes: 2,
                    likes: 10,
                    follows: 5,
                    bookmarks: 5
                },
                probabilities: {
                    reply: 0.5,
                    quote: 0.2,
                    like: 0.7,
                    bookmark: 0.3
                }
            };

            const result = validator.validateSectionConfig(data, 'engagement');
            expect(result.valid).toBe(true);
        });
    });

    describe('getSchema', () => {
        it('should return schema for valid section', () => {
            const schema = validator.getSchema('session');
            expect(schema).toBeDefined();
            expect(schema.cycles).toBeDefined();
        });

        it('should return null for unknown section', () => {
            expect(validator.getSchema('unknown')).toBeNull();
        });
    });

    describe('validateWithReport', () => {
        it('should return detailed report', () => {
            const config = {
                session: {
                    cycles: 5,
                    minDuration: 300,
                    maxDuration: 600
                }
            };

            const report = validator.validateWithReport(config);
            expect(report.valid).toBe(true);
            expect(report.errorCount).toBe(0);
            expect(report.duration).toBeDefined();
            expect(report.sections).toBeDefined();
        });

        it('should include section validation in report', () => {
            const schema = {
                type: 'object',
                properties: {
                    replies: { type: 'number', min: 0, max: 20 },
                    retweets: { type: 'number', min: 0, max: 10 }
                }
            };
            const data = {
                replies: -1,
                retweets: 3
            };

            const errors = validator.validateSection(data, schema, 'limits');
            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('getSectionValidationReport', () => {
        it('should report skipped for missing sections', () => {
            const report = validator.getSectionValidationReport({});
            expect(report.session.skipped).toBe(true);
        });

        it('should report valid for correct sections', () => {
            const config = {
                session: {
                    cycles: 5,
                    minDuration: 300,
                    maxDuration: 600
                }
            };

            const report = validator.getSectionValidationReport(config);
            expect(report.session.valid).toBe(true);
        });
    });

    describe('Exports', () => {
        it('should export singleton instance', () => {
            expect(configValidator).toBeDefined();
            expect(configValidator.validateConfig).toBeDefined();
        });

        it('should export convenience functions', () => {
            expect(validateConfig).toBeDefined();
            expect(validateWithReport).toBeDefined();
        });
    });

    describe('Edge Cases', () => {
        it('should handle deeply nested objects', () => {
            const config = {
                session: {
                    cycles: 5,
                    minDuration: 300,
                    maxDuration: 600
                },
                engagement: {
                    limits: {
                        replies: 5,
                        retweets: 3,
                        quotes: 2,
                        likes: 10,
                        follows: 5,
                        bookmarks: 5
                    },
                    probabilities: {
                        reply: 0.5,
                        quote: 0.2,
                        like: 0.7,
                        bookmark: 0.3
                    }
                },
                timing: {
                    warmup: { min: 2000, max: 10000 },
                    scroll: { min: 300, max: 700 },
                    read: { min: 5000, max: 15000 }
                }
            };

            const result = validator.validateConfig(config);
            expect(result.valid).toBe(true);
        });

        it('should handle config with extra unknown fields', () => {
            const config = {
                session: {
                    cycles: 5,
                    minDuration: 300,
                    maxDuration: 600,
                    unknownField: 'ignored'
                }
            };

            const result = validator.validateConfig(config);
            expect(result.valid).toBe(true);
        });
    });
});
