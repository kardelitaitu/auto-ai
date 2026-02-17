import { EventEmitter } from 'events';

// Increase the limit for the specific process running this test thread
process.setMaxListeners(50);

// Set default for any new emitters created during tests
EventEmitter.defaultMaxListeners = 50;

console.log('✅ MaxListeners increased to 50');