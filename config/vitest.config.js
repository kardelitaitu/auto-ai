import { defineConfig } from 'vitest/config';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { cpus } from 'os';

// 1. Path Resolution: Use absolute paths to prevent root fallback
const rootDir = resolve(__dirname, '..');
const coverageRoot = resolve(rootDir, 'api/coverage');

// 2. Ensure directory exists before Vitest starts
if (!existsSync(coverageRoot)) {
    mkdirSync(coverageRoot, { recursive: true });
}

// 3. Resource Management
const cpuCount = Math.max(1, cpus().length);
const maxWorkers = Math.min(6, Math.max(2, cpuCount - 1));

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
            'api/ui/electron-dashboard/node_modules',
            'api/ui/electron-dashboard/renderer/node_modules',
        ],

        testTimeout: 10000,
        hookTimeout: 10000,
        cache: true,

        // Execution Logic
        pool: 'forks',
        maxWorkers,
        fileParallelism: true,
        isolate: true,

        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            // Use the absolute path here explicitly
            reportsDirectory: coverageRoot,
            clean: true, // Set to true to avoid artifact pollution in your api/coverage folder
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
                'local-agent/',
                'api/ui/electron-dashboard/',
            ],
            thresholds: {
                statements: 70,
                branches: 70,
                functions: 80,
                lines: 75,
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
