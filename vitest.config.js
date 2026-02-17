import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    
    setupFiles: ['./tests/vitest.setup.js'], 
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git'],
    
    testTimeout: 10000,
    hookTimeout: 10000,
    
    cache: true,
    
    pool: 'threads',
    poolOptions: {
      threads: {
        isolate: false
      }
    },
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['core/**/*.js', 'utils/**/*.js', 'tasks/**/*.js'],
      exclude: [
        'node_modules/',
        'dist/',
        '.git/',
        'tests/',
        'backup/',
        '**/*.test.js',
        '**/*.spec.js',
        'local-agent/',
      ],
      thresholds: {
        lines: 80.00,
        functions: 80.00,
        branches: 80.00,
        statements: 80.00,
        autoUpdate: true
      }
    },
    
    reporters: ['default', 'verbose'], 
    isolate: false,
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