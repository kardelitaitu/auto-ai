import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['**/*.js'],
      exclude: [
        'node_modules/',
        'dist/',
        '.git/',
        'tests/',
        '**/*.test.js',
        '**/*.spec.js',
      ],
    },
    
    // Reporter configuration
    reporters: ['default', 'verbose'],
    
    // Pool configuration for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 16,
        maxThreads: 28, 
        useAtomics: true, // Speeds up communication between threads
      },
    },
    isolate: false,
  },
  
  // Resolve configuration for module resolution with aliases
  resolve: {
    alias: {
      '@tests': resolve(__dirname, './tests'),
      '@unit': resolve(__dirname, './tests/unit'),
      '@integration': resolve(__dirname, './tests/integration'),
      '@edge-cases': resolve(__dirname, './tests/edge-cases'),
    },
  },
});
