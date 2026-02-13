# Configuration Management Guide

This guide explains the new centralized configuration system for the `ai-twitterActivity.js` task and how to use it effectively.

## Overview

The new configuration system provides:

- **Centralized Configuration Loading**: Single point of configuration access
- **Caching**: Performance optimization with LRU cache and TTL
- **Validation**: Schema-based validation with detailed error reporting
- **Environment Variable Overrides**: Flexible configuration through environment variables
- **Hot Reloading**: Support for configuration changes without restart

## Architecture

```
ai-twitterActivity.js
    ↓
TaskConfigLoader.loadAiTwitterActivityConfig()
    ↓
ConfigCache (LRU + TTL)
    ↓
ConfigValidator (Schema-based)
    ↓
EnvironmentConfig (Env var overrides)
    ↓
config-service.js (settings.json + env)
    ↓
Unified Configuration Object
```

## Configuration Structure

The configuration is organized into logical sections:

### Session Configuration
```javascript
{
  "session": {
    "cycles": 20,                    // Number of activity cycles
    "minDuration": 360,             // Minimum session duration (seconds)
    "maxDuration": 540,             // Maximum session duration (seconds)
    "timeout": 900000               // Task timeout (milliseconds)
  }
}
```

### Engagement Configuration
```javascript
{
  "engagement": {
    "limits": {
      "replies": 3,                 // Maximum replies per session
      "retweets": 1,                // Maximum retweets per session
      "quotes": 1,                  // Maximum quote tweets per session
      "likes": 5,                   // Maximum likes per session
      "follows": 2,                 // Maximum follows per session
      "bookmarks": 2                // Maximum bookmarks per session
    },
    "probabilities": {
      "reply": 0.5,                 // Probability of replying to a tweet
      "quote": 0.2,                 // Probability of quoting a tweet
      "like": 0.15,                 // Probability of liking a tweet
      "bookmark": 0.05              // Probability of bookmarking a tweet
    }
  }
}
```

### Timing Configuration
```javascript
{
  "timing": {
    "warmup": {
      "min": 2000,                  // Minimum warmup time (ms)
      "max": 15000                  // Maximum warmup time (ms)
    },
    "scroll": {
      "min": 300,                   // Minimum scroll duration (ms)
      "max": 700                    // Maximum scroll duration (ms)
    },
    "read": {
      "min": 5000,                  // Minimum read time (ms)
      "max": 15000                  // Maximum read time (ms)
    },
    "globalScrollMultiplier": 1.0   // Global scroll speed multiplier
  }
}
```

### AI Configuration
```javascript
{
  "ai": {
    "enabled": true,                // Enable AI features
    "localEnabled": false,          // Enable local AI models
    "visionEnabled": true,          // Enable vision processing
    "timeout": 120000               // AI request timeout (ms)
  }
}
```

### Browser Configuration
```javascript
{
  "browser": {
    "theme": "dark",                // Browser theme (light, dark, auto)
    "referrer": {
      "addUTM": true                // Add UTM parameters to referrer
    },
    "headers": {
      "secFetchSite": "none",
      "secFetchMode": "navigate"
    }
  }
}
```

## Environment Variable Overrides

You can override any configuration setting using environment variables:

### Session Overrides
```bash
export TWITTER_CYCLES=15
export TWITTER_MIN_DURATION=300
export TWITTER_MAX_DURATION=600
export TWITTER_TIMEOUT_MS=1200000
```

### Engagement Overrides
```bash
export TWITTER_REPLY_PROBABILITY=0.7
export TWITTER_QUOTE_PROBABILITY=0.3
export TWITTER_LIKE_PROBABILITY=0.2
export TWITTER_BOOKMARK_PROBABILITY=0.1

export TWITTER_MAX_REPLIES=5
export TWITTER_MAX_LIKES=10
export TWITTER_MAX_BOOKMARKS=3
```

### Timing Overrides
```bash
export TWITTER_WARMUP_MIN=3000
export TWITTER_WARMUP_MAX=10000
export TWITTER_SCROLL_MIN=500
export TWITTER_SCROLL_MAX=1000
export GLOBAL_SCROLL_MULTIPLIER=1.5
```

### AI Overrides
```bash
export AI_ENABLED=true
export AI_LOCAL_ENABLED=true
export AI_VISION_ENABLED=false
export AI_TIMEOUT=180000
```

### Browser Overrides
```bash
export BROWSER_THEME=light
export BROWSER_ADD_UTM=false
```

### System Overrides
```bash
export DEBUG_MODE=true
export PERFORMANCE_TRACKING=true
export ERROR_RECOVERY_MAX_RETRIES=5
```

## Usage Examples

### Basic Usage
```javascript
import { loadAiTwitterActivityConfig } from '../utils/task-config-loader.js';

// Load configuration with default settings
const config = await loadAiTwitterActivityConfig({});

console.log(`Session cycles: ${config.session.cycles}`);
console.log(`Reply probability: ${config.engagement.probabilities.reply}`);
console.log(`Engagement limits: ${JSON.stringify(config.engagement.limits)}`);
```

### With Payload Overrides
```javascript
// Override specific settings via payload
const config = await loadAiTwitterActivityConfig({
    cycles: 25,
    minDuration: 420,
    maxDuration: 660,
    theme: 'light'
});

console.log(`Custom cycles: ${config.session.cycles}`);
console.log(`Custom theme: ${config.browser.theme}`);
```

### With Environment Variables
```bash
# Set environment variables
export TWITTER_CYCLES=30
export TWITTER_REPLY_PROBABILITY=0.8
export TWITTER_MAX_LIKES=8

# Run the task
node main.js ai-twitterActivity
```

### Debug Mode
```bash
# Enable debug mode for detailed logging
export DEBUG_MODE=true
export PERFORMANCE_TRACKING=true

# Run with debug output
node main.js ai-twitterActivity
```

## Configuration Validation

The system validates all configuration values against predefined schemas:

### Validation Examples
```javascript
import { validateConfig } from '../utils/config-validator.js';

const config = {
    session: {
        cycles: 150,  // Invalid: exceeds max of 100
        minDuration: 30,  // Invalid: below min of 60
    }
};

const result = validateConfig(config);
console.log(result.valid);  // false
console.log(result.errors); // Array of validation errors
```

### Schema Validation Rules
- **Session cycles**: 1-100
- **Duration values**: 60-7200 seconds
- **Probabilities**: 0.0-1.0
- **Engagement limits**: 0-50 (varies by action)
- **Timing values**: 100ms-120000ms (varies by action)
- **Theme**: 'light', 'dark', or 'auto'

## Performance Monitoring

The configuration system provides detailed performance metrics:

### Cache Statistics
```javascript
import { taskConfigLoader } from '../utils/task-config-loader.js';

const stats = taskConfigLoader.getStats();
console.log(`Cache hit rate: ${stats.cache.hitRate}`);
console.log(`Cache size: ${stats.cacheSize}/${stats.cacheMaxSize}`);
```

### Configuration Loading Time
```javascript
const startTime = Date.now();
const config = await loadAiTwitterActivityConfig(payload);
const loadTime = Date.now() - startTime;

console.log(`Configuration loaded in ${loadTime}ms`);
```

## Error Handling

The system provides comprehensive error handling:

### Configuration Loading Errors
```javascript
try {
    const config = await loadAiTwitterActivityConfig(payload);
    // Use configuration
} catch (error) {
    console.error(`Configuration loading failed: ${error.message}`);
    // Handle error appropriately
}
```

### Validation Errors
```javascript
import { validateWithReport } from '../utils/config-validator.js';

const report = validateWithReport(config);
if (!report.valid) {
    console.error(`Validation failed with ${report.errorCount} errors:`);
    report.errors.forEach(error => console.error(`  - ${error}`));
}
```

## Best Practices

### 1. Use Environment Variables for Deployment
```bash
# Production settings
export TWITTER_CYCLES=20
export TWITTER_REPLY_PROBABILITY=0.3
export TWITTER_MAX_LIKES=3

# Development settings
export DEBUG_MODE=true
export PERFORMANCE_TRACKING=true
```

### 2. Validate Configuration in Development
```javascript
if (process.env.NODE_ENV === 'development') {
    const { validateWithReport } = await import('../utils/config-validator.js');
    const report = validateWithReport(config);
    
    if (!report.valid) {
        console.warn('Configuration validation warnings:', report.errors);
    }
}
```

### 3. Monitor Configuration Performance
```javascript
import { taskConfigLoader } from '../utils/task-config-loader.js';

// Log cache performance
setInterval(() => {
    const stats = taskConfigLoader.getStats();
    console.log(`Config cache hit rate: ${stats.cache.hitRate}`);
}, 60000);
```

### 4. Use Payload Overrides for Dynamic Configuration
```javascript
// Dynamic configuration based on task requirements
const payload = {
    cycles: isHighActivity ? 30 : 15,
    minDuration: isHighActivity ? 600 : 300,
    maxDuration: isHighActivity ? 900 : 450,
    theme: isDarkMode ? 'dark' : 'light'
};

const config = await loadAiTwitterActivityConfig(payload);
```

## Migration Guide

### From Old Configuration System

**Before:**
```javascript
// Multiple configuration calls
const settings = await getSettings();
const activityConfig = await config.getTwitterActivity();
const engagementLimits = await config.getEngagementLimits();

// Manual validation
const validatedLimits = {
    replies: typeof engagementLimits.replies === 'number' ? engagementLimits.replies : 3,
    // ... more validation
};

// Manual environment variable handling
const replyProbability = process.env.TWITTER_REPLY_PROBABILITY 
    ? parseFloat(process.env.TWITTER_REPLY_PROBABILITY)
    : settings.twitter?.reply?.probability ?? 0.5;
```

**After:**
```javascript
// Single configuration call with all features
const config = await loadAiTwitterActivityConfig(payload);

// Automatic validation and environment variable handling
const replyProbability = config.engagement.probabilities.reply;
const engagementLimits = config.engagement.limits;
```

### Benefits of Migration

1. **Performance**: Single async call instead of multiple
2. **Reliability**: Automatic validation and error handling
3. **Maintainability**: Centralized configuration logic
4. **Flexibility**: Environment variable overrides
5. **Monitoring**: Built-in performance tracking

## Troubleshooting

### Common Issues

**Configuration Not Loading**
```bash
# Check environment variables
echo $TWITTER_CYCLES

# Check configuration file
cat config/settings.json

# Enable debug mode
export DEBUG_MODE=true
```

**Validation Errors**
```bash
# Check validation report
node -e "
import { validateWithReport } from './utils/config-validator.js';
import { loadAiTwitterActivityConfig } from './utils/task-config-loader.js';
const config = await loadAiTwitterActivityConfig({});
const report = validateWithReport(config);
console.log(JSON.stringify(report, null, 2));
"
```

**Cache Issues**
```bash
# Clear configuration cache
node -e "
import { taskConfigLoader } from './utils/task-config-loader.js';
taskConfigLoader.clearCache();
console.log('Cache cleared');
"
```

### Performance Issues

**Slow Configuration Loading**
- Check network connectivity to configuration sources
- Verify environment variable parsing
- Monitor cache hit rate

**High Memory Usage**
- Monitor cache size and eviction rate
- Adjust cache TTL if needed
- Check for memory leaks in configuration objects

## Support

For configuration issues:

1. Check the debug logs with `DEBUG_MODE=true`
2. Validate configuration with `validateWithReport()`
3. Monitor cache performance with `getStats()`
4. Review environment variable overrides
5. Check the configuration file syntax

For advanced configuration needs, refer to the individual module documentation:
- `utils/task-config-loader.js` - Main configuration loader
- `utils/config-validator.js` - Validation system
- `utils/config-cache.js` - Caching system
- `utils/environment-config.js` - Environment variable handling