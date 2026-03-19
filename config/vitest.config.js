/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

import { defineConfig } from 'vitest/config';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { cpus } from 'os';

// ============================================================================
// Module A: Hardware Topology & Execution Strategy
// ============================================================================
const cpuCount = cpus().length;
// Reserve 2 threads for OS/IDE stability, allocate the rest to the execution pool
const calculatedThreads = Math.max(1, cpuCount - 2); 

console.log(`\n=== [SYSTEM_NODE] Test Execution Orchestrator ===`);
console.log(`Hardware Detected: ${cpuCount} Logical Cores`);
console.log(`Thread Allocation: ${calculatedThreads} Max Workers`);
console.log(`Coverage Engine: istanbul (Memory Optimized)`);
console.log(`=================================================\n`);

// ============================================================================
// Module B: Pathing & Directory Hygiene
// ============================================================================
const rootDir = resolve(__dirname, '..');
const coverageRoot = resolve(rootDir, 'api/coverage');

if (!existsSync(coverageRoot)) {
    mkdirSync(coverageRoot, { recursive: true });
}

// ============================================================================
// Module C: Core Vitest Configuration
// ============================================================================
export default defineConfig({
    test: {
        globals: false,
        environment: 'node',

        setupFiles: [resolve(rootDir, './api/tests/vitest.setup.js')],
        include: ['**/*.{test,spec}.{js,ts}'],
        exclude: [
            'node_modules',
            'dist',
            '.git',
            '.opencode',
            'api/ui/electron-dashboard/node_modules',
            'api/ui/electron-dashboard/renderer/node_modules',
        ],

        testTimeout: 10000,
        hookTimeout: 10000,
        cache: true,

        // --------------------------------------------------------------------
        // Concurrency Engine - Unchained Architecture
        // --------------------------------------------------------------------
        pool: 'threads',
        poolOptions: {
            threads: {
                maxThreads: calculatedThreads,
                minThreads: 12,
                isolate: true,
            }
        },
        fileParallelism: true,
        logHeapUsage: true, // Injects memory telemetry into the dot reporter

        // --------------------------------------------------------------------
        // Coverage Engine - Transpilation Variant
        // --------------------------------------------------------------------
        coverage: {
            provider: 'istanbul',
            reporter: ['text', 'json', 'html'],
            reportsDirectory: coverageRoot,
            clean: true,
            cleanOnRerun: true,
            include: ['core/**/*.js', 'utils/**/*.js', 'api/**/*.js'],
            exclude: [
                'node_modules/',
                'dist/',
                '.git/',
                'tests/',
                'backup/',
                '**/*.test.js',
                '**/*.spec.js',
                '**/*.manual.js',
                'local-agent/',
                'api/ui/electron-dashboard/',
                'api/tests/unit/semantic-parser-runner.js',
                'api/tests/edge-cases/',
                'api/tests/dashboard-data-generator.js',
                'api/tests/simulate-task-history.js',
                'api/tests/mocks/index.js',
            ],
            thresholds: {
                statements: 0,
                branches: 0,
                functions: 0,
                lines: 0,
                autoUpdate: false,
            },
        },

        reporters: ['dot'],
    },

    resolve: {
        alias: {
            '@tests': resolve(rootDir, './api/tests'),
            '@unit': resolve(rootDir, './api/tests/unit'),
            '@integration': resolve(rootDir, './api/tests/integration'),
            '@edge-cases': resolve(rootDir, './api/tests/edge-cases'),
            '@api': resolve(rootDir, './api'),
            '@tasks': resolve(rootDir, './tasks'),
        },
    },
});