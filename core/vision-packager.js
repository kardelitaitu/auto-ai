/**
 * @fileoverview Vision Packager - Captures and compresses screenshots with ROI detection.
 * Part of the Distributed Agentic Orchestration (DAO) architecture.
 * @module core/vision-packager
 */

import { createLogger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('vision-packager.js');

/**
 * @typedef {object} VisionPackage
 * @property {string} screenshotPath - Path to screenshot file
 * @property {Buffer} screenshotBuffer - Screenshot as buffer
 * @property {string} base64 - Base64-encoded screenshot
 * @property {object} roi - Region of Interest coordinates
 * @property {object} metadata - Screenshot metadata
 */

/**
 * @class VisionPackager
 * @description Captures browser screenshots and identifies regions of interest to reduce token consumption.
 */
class VisionPackager {
    constructor() {
        /** @type {string} Screenshot storage directory */
        this.screenshotDir = path.join(process.cwd(), 'screenshot');

        /** @type {number} Maximum image width for compression */
        this.maxWidth = 1280;

        /** @type {number} Maximum image height for compression */
        this.maxHeight = 720;

        /** @type {number} JPEG quality (1-100) */
        this.quality = 80;

        /** @type {number} Target file size in KB */
        this.targetSizeKB = 50;

        logger.info(`VisionPackager initialized. Screenshot dir: ${this.screenshotDir}`);
    }

    /**
     * Capture a screenshot from a Playwright page.
     * @param {playwright.Page} page - The Playwright page object.
     * @param {object} [options={}] - Capture options.
     * @param {boolean} [options.fullPage=false] - Capture full page or viewport only.
     * @param {object} [options.clip] - Clip region {x, y, width, height}.
     * @param {string} [options.sessionId] - Session ID for naming.
     * @returns {Promise<VisionPackage>} The vision package.
     */
    async captureScreenshot(page, options = {}) {
        const { fullPage = false, clip = null, sessionId = 'unknown', saveToDisk = true } = options;

        try {
            const timestamp = Date.now();
            // Sanitize sessionId for Windows (colons are illegal in filenames)
            const safeSessionId = sessionId.replace(/:/g, '-');
            const filename = `${safeSessionId}_${timestamp}.jpg`;
            const filepath = path.join(this.screenshotDir, filename);

            // Ensure screenshot directory exists
            await fs.mkdir(this.screenshotDir, { recursive: true });

            logger.debug(`[VisionPackager] Capturing screenshot: ${filename}`);

            // Capture screenshot - don't pass clip if it's null (use undefined instead)
            // Capture screenshot - don't pass clip if it's null (use undefined instead)
            const screenshotOptions = {
                type: 'jpeg',
                quality: 70, // Balanced for LLM text reading but lower size
                fullPage
            };

            // Only add clip if it's truthy
            if (clip) {
                screenshotOptions.clip = clip;
            }

            const buffer = await page.screenshot(screenshotOptions);

            // Get actual window dimensions (works for CDP browsers where viewportSize is null)
            const viewport = await page.evaluate(() => ({
                width: window.innerWidth,
                height: window.innerHeight
            }));
            logger.info(`[VisionPackager] 📐 Actual window size: ${viewport.width}x${viewport.height}`);

            // Convert to base64
            const base64 = buffer.toString('base64');

            // Save to file (only if requested, useful for debugging even internal vision)
            if (saveToDisk) {
                await fs.writeFile(filepath, buffer);
                logger.info(`[VisionPackager] Screenshot captured: ${filename} (${this._formatBytes(buffer.length)})`);
            } else {
                logger.debug(`[VisionPackager] Captured memory-only screenshot (${this._formatBytes(buffer.length)})`);
            }

            return {
                screenshotPath: filepath,
                screenshotBuffer: buffer,
                base64,
                roi: clip || { x: 0, y: 0, width: viewport.width, height: viewport.height },
                metadata: {
                    timestamp,
                    filename,
                    sizeBytes: buffer.length,
                    fullPage,
                    viewport,
                    url: page.url()
                }
            };

        } catch (error) {
            logger.error(`[VisionPackager] Screenshot capture failed:`, error.message);
            throw error;
        }
    }

    /**
     * Identify Region of Interest (ROI) in a page.
     * This is a simplified implementation. In production, this would use 
     * computer vision or heuristics to detect active areas (modals, forms, etc.).
     * @param {playwright.Page} page - The Playwright page.
     * @returns {Promise<object|null>} ROI coordinates or null if full viewport.
     */
    async identifyROI(page) {
        try {
            // Simple heuristic: Check for visible modals or dialogs
            const modalSelector = '[role="dialog"], .modal, [aria-modal="true"]';
            const modal = await page.$(modalSelector);

            if (modal) {
                const box = await modal.boundingBox();
                if (box) {
                    logger.debug(`[VisionPackager] ROI detected: modal at (${box.x}, ${box.y})`);

                    // Add padding
                    const padding = 20;
                    return {
                        x: Math.max(0, box.x - padding),
                        y: Math.max(0, box.y - padding),
                        width: box.width + (padding * 2),
                        height: box.height + (padding * 2)
                    };
                }
            }

            // No ROI detected, use full viewport
            return null;

        } catch (error) {
            logger.warn(`[VisionPackager] ROI detection failed:`, error.message);
            return null;
        }
    }

    /**
     * Capture screenshot with automatic ROI detection.
     * @param {playwright.Page} page - The Playwright page.
     * @param {string} [sessionId='unknown'] - Session ID.
     * @returns {Promise<VisionPackage>} The vision package.
     */
    async captureWithROI(page, sessionId = 'unknown') {
        const roi = await this.identifyROI(page);

        const options = {
            fullPage: false,
            sessionId
        };

        // Only include clip if ROI was actually detected  
        if (roi) {
            options.clip = roi;
        }

        return await this.captureScreenshot(page, { ...options, saveToDisk: false });
    }

    /**
     * Compress screenshot to target size.
     * NOTE: This is a placeholder. Actual compression would require image processing libraries.
     * @param {Buffer} buffer - Original screenshot buffer.
     * @param {number} [targetKB=50] - Target size in KB.
     * @returns {Promise<Buffer>} Compressed buffer.
     */
    async compressScreenshot(buffer, targetKB = 50) {
        // Placeholder: In production, use sharp or jimp for compression
        logger.debug(`[VisionPackager] Compression requested (target: ${targetKB}KB). Returning original.`);

        // TODO: Implement with sharp:
        // const sharp = require('sharp');
        // const compressed = await sharp(buffer)
        //   .resize(this.maxWidth, this.maxHeight, { fit: 'inside' })
        //   .jpeg({ quality: this.quality })
        //   .toBuffer();

        return buffer;
    }

    /**
     * Clean up old screenshots.
     * @param {number} [maxAgeMs=3600000] - Maximum age in ms (default: 1 hour).
     * @returns {Promise<number>} Number of files deleted.
     */
    async cleanupOldScreenshots(maxAgeMs = 3600000) {
        try {
            const files = await fs.readdir(this.screenshotDir);
            const now = Date.now();

            const filesWithStats = await Promise.all(
                files.map(async (file) => {
                    const filepath = path.join(this.screenshotDir, file);
                    const stats = await fs.stat(filepath);
                    return { filepath, mtimeMs: stats.mtimeMs };
                })
            );

            const toDelete = filesWithStats.filter(f => now - f.mtimeMs > maxAgeMs);

            await Promise.all(toDelete.map(f => fs.unlink(f.filepath)));

            if (toDelete.length > 0) {
                logger.info(`[VisionPackager] Cleaned up ${toDelete.length} old screenshot(s)`);
            }

            return toDelete.length;

        } catch (error) {
            logger.warn(`[VisionPackager] Cleanup failed:`, error.message);
            return 0;
        }
    }

    /**
     * Format bytes to human-readable string.
     * @param {number} bytes - Number of bytes.
     * @returns {string} Formatted string.
     * @private
     */
    _formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    /**
     * Get statistics.
     * @returns {Promise<object>} Statistics object.
     */
    async getStats() {
        try {
            const files = await fs.readdir(this.screenshotDir);

            const sizes = await Promise.all(
                files.map(async (file) => {
                    const filepath = path.join(this.screenshotDir, file);
                    const stats = await fs.stat(filepath);
                    return stats.size;
                })
            );

            const totalSize = sizes.reduce((sum, size) => sum + size, 0);

            return {
                totalScreenshots: files.length,
                totalSizeBytes: totalSize,
                totalSizeFormatted: this._formatBytes(totalSize),
                screenshotDir: this.screenshotDir
            };

        } catch (error) {
            return {
                totalScreenshots: 0,
                totalSizeBytes: 0,
                totalSizeFormatted: '0 B',
                screenshotDir: this.screenshotDir,
                error: error.message
            };
        }
    }
}

export default VisionPackager;
