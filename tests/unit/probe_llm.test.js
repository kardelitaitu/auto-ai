import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as probeLLM from '../../utils/probe_llm.js';
import http from 'http';
import { EventEmitter } from 'events';

vi.mock('http');

describe('probe_llm', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        vi.clearAllMocks();
        mockReq = new EventEmitter();
        mockReq.destroy = vi.fn();
        
        mockRes = new EventEmitter();
        mockRes.statusCode = 200;
        
        http.get.mockImplementation((options, callback) => {
            callback(mockRes);
            return mockReq;
        });
        
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('check', () => {
        it('should return true for status 200', async () => {
            mockRes.statusCode = 200;
            const promise = probeLLM.check(8080, '/test');
            mockRes.emit('end');
            const result = await promise;
            expect(result).toBe(true);
        });

        it('should return true for status 404', async () => {
            mockRes.statusCode = 404;
            const promise = probeLLM.check(8080, '/test');
            mockRes.emit('end');
            const result = await promise;
            expect(result).toBe(true);
        });

        it('should return false for other status codes', async () => {
            mockRes.statusCode = 500;
            const promise = probeLLM.check(8080, '/test');
            mockRes.emit('end');
            const result = await promise;
            expect(result).toBe(false);
        });

        it('should return false on error', async () => {
            const promise = probeLLM.check(8080, '/test');
            mockReq.emit('error', new Error('Network error'));
            const result = await promise;
            expect(result).toBe(false);
        });

        it('should return false on timeout', async () => {
            const promise = probeLLM.check(8080, '/test');
            mockReq.emit('timeout');
            const result = await promise;
            expect(result).toBe(false);
            expect(mockReq.destroy).toHaveBeenCalled();
        });
    });

    describe('probeAll', () => {
        it('should check all ports and paths', async () => {
            // We cannot spy on internal 'check' easily in ESM, so we rely on http.get being called.
            // We ensure http.get calls callback and emits 'end' automatically.
            http.get.mockImplementation((options, callback) => {
                const res = new EventEmitter();
                res.statusCode = 200;
                callback(res);
                // Run in next tick to allow event listeners to be attached
                process.nextTick(() => {
                    res.emit('end');
                });
                return new EventEmitter();
            });
            
            await probeLLM.probeAll();
            
            const totalChecks = probeLLM.PORTS.length * probeLLM.PATHS.length;
            expect(http.get).toHaveBeenCalledTimes(totalChecks);
        });
    });
});
