/**
 * Example: Using ConfigManager alongside existing code
 * 
 * This demonstrates how to use the new ConfigManager while maintaining
 * backward compatibility with existing config loading.
 */

import { configManager } from './utils/config-manager.js';

async function example() {
  // Initialize the config manager (do this once at startup)
  await configManager.init();

  // Method 1: Using ConfigManager (NEW - recommended for new code)
  const replyProb = configManager.get('twitter.reply.probability');
  const minDuration = configManager.get('twitter.session.minSeconds');
  
  console.log('Using ConfigManager:');
  console.log('  Reply probability:', replyProb);
  console.log('  Min duration:', minDuration);

  // Method 2: Using existing configLoader (OLD - still works)
  // import { getSettings } from './utils/configLoader.js';
  // const settings = await getSettings();
  // const replyProb = settings.twitter.reply.probability;

  // ConfigManager benefits:
  // - Caching (faster repeated access)
  // - Validation (catches errors early)
  // - Environment variable override
  // - Better error messages
  // - Source tracking (where did value come from?)

  // Get with metadata
  const configWithMeta = configManager.getWithMeta('twitter.reply.probability');
  console.log('\nWith metadata:');
  console.log('  Value:', configWithMeta.value);
  console.log('  Source:', configWithMeta.source);
  console.log('  Timestamp:', configWithMeta.timestamp);

  // Cache statistics
  console.log('\nCache stats:', configManager.getCacheStats());
}

// Run example
example().catch(console.error);
