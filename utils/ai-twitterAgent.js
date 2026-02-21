/**
 * @fileoverview AI-Enhanced Twitter Agent
 * This file is now a facade that redirects to the modular version.
 * For backward compatibility, imports from this file still work.
 * @module utils/ai-twitterAgent
 * @deprecated Use utils/ai-twitterAgent/index.js for new code
 */

export { AITwitterAgent } from "./ai-twitterAgent/index.js";
import AITwitterAgent from "./ai-twitterAgent/index.js";
export default AITwitterAgent;
