import { defineConfig } from 'vitest/config';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { cpus } from 'os';

const coverageRoot = resolve(__dirname, 'coverage');
const coverageTmp = resolve(coverageRoot, '.tmp');
mkdirSync(coverageTmp, { recursive: true });
const cpuCount = Math.max(1, cpus().length);
const maxWorkers = Math.min(6, Math.max(2, cpuCount - 1));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    setupFiles: ['./tests/vitest.setup.js'],
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git', 'ui/electron-dashboard/node_modules', 'ui/electron-dashboard/renderer/node_modules'],

    testTimeout: 10000,
    hookTimeout: 10000,

    cache: true,

    pool: 'forks',
    maxWorkers,
    fileParallelism: true,
    isolate: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: coverageRoot,
      clean: false,
      cleanOnRerun: false,
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
        'ui/electron-dashboard/',
      ],
      thresholds: {
        lines: 98.14,
        functions: 90,
        branches: 100,
        statements: 98.4,
        autoUpdate: true
      }
    },

    reporters: ['dot'],
  },

  resolve: {
    alias: {
      '@tests': resolve(__dirname, './tests'),
      '@unit': resolve(__dirname, './tests/unit'),
      '@integration': resolve(__dirname, './tests/integration'),
      '@edge-cases': resolve(__dirname, './tests/edge-cases'),
    },
  },
});