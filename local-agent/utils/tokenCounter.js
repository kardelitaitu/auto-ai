/**
 * @fileoverview Simple token estimation utility for context tracking.
 * Provides rough estimates based on character count (1 token ≈ 4 characters).
 */

/**
 * Estimates token count for a given text string.
 * @param {string} text - The text to estimate tokens for.
 * @returns {number} Estimated token count.
 */
export function estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
}

/**
 * Estimates tokens for a message object (with role and content).
 * @param {object} message - Message object with role and content.
 * @returns {number} Estimated token count.
 */
export function estimateMessageTokens(message) {
    if (!message) return 0;

    let total = 0;

    // Count role (small overhead)
    if (message.role) {
        total += estimateTokens(message.role);
    }

    // Count content
    if (typeof message.content === 'string') {
        total += estimateTokens(message.content);
    } else if (Array.isArray(message.content)) {
        // Handle multi-part content (e.g., text + images)
        for (const part of message.content) {
            if (part.type === 'text' && part.text) {
                total += estimateTokens(part.text);
            }
            // Images are typically not counted in history (we strip them)
        }
    }

    return total;
}

/**
 * Estimates total tokens for an array of messages.
 * @param {Array} messages - Array of message objects.
 * @returns {number} Total estimated token count.
 */
export function estimateConversationTokens(messages) {
    if (!Array.isArray(messages)) return 0;
    return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}
