/**
 * @fileoverview Robust HTTP Client for Local LLM (OpenAI-compatible) with Vision Support.
 * STRICTLY HTTP MODE - No CLI Fallback.
 * @module local-agent/network/llmClient
 */

import { createLogger } from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const logger = createLogger('llmClient.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

class LLMClient {
    constructor() {
        this.config = this.loadConfig();
        this.isRestarting = false;
        this.restartPromise = null;
    }

    loadConfig() {
        try {
            const configPath = path.join(__dirname, '../config/agentConfig.json');
            const raw = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(raw).llm;
        } catch (e) {
            logger.error('Failed to load agentConfig.json', e);
            throw e;
        }
    }

    /**
     * Performs a health check on the LLM endpoint.
     * @returns {Promise<boolean>}
     */
    async checkAvailability() {
        logger.info(`Checking LLM availability at ${this.config.baseUrl}...`);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            // Using /models endpoint to check connectivity
            const response = await fetch(`${this.config.baseUrl}/models`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                logger.info(`LLM Service Available (HTTP). Found ${data.data ? data.data.length : 0} models.`);
                return true;
            } else {
                const text = await response.text();
                logger.error(`LLM Service responded with Error: ${response.status}. Body: ${text}`);
                return false;
            }
        } catch (error) {
            if (this.config.bypassHealthCheck) {
                logger.warn(`Health check failed (${error.message}) but bypassHealthCheck is enabled. Proceeding...`);
                return true;
            }
            logger.error(`LLM Connection Failed: ${error.message}. Ensure your server is running at ${this.config.baseUrl}`);
            return false;
        }
    }

    /**
     * Stops the running model container.
     */
    /**
     * Stops the running model container.
     */
    async stopModel() {
        logger.info(`Stopping model: ${this.config.model}...`);
        try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execPromise = promisify(exec);

            const script = this.config.serverType === 'docker' ? 'stop-docker.bat' : 'stop-vllm.bat';
            logger.info(`Executing stop script: ${script}`);

            await execPromise(`call ${script}`);
            logger.info(`${script} executed successfully.`);
        } catch (error) {
            logger.warn(`Failed to stop model server: ${error.message}`);
        }
    }

    /**
     * Ensures the model is running by checking availability and auto-starting if needed.
     * @returns {Promise<void>}
     */
    async ensureModelRunning() {
        logger.info('Checking if model is running...');

        // First check if it's already available
        const isAvailable = await this.checkAvailability();
        if (isAvailable) {
            logger.info('Model is already running.');
            return;
        }

        logger.info(`Model not running. Starting: ${this.config.model} (Type: ${this.config.serverType || 'vllm'})`);

        // Start the model in background
        const script = this.config.serverType === 'docker' ? 'start-docker.bat' : 'start-vllm.bat';
        const { spawn } = await import('child_process');

        const modelProcess = spawn('cmd.exe', ['/c', script], {
            detached: true,
            stdio: 'ignore'
        });

        // Unref so the parent process can exit independently
        modelProcess.unref();

        logger.info('Model starting in background. Waiting for API to become available...');

        // Poll for availability (max 60 seconds)
        const maxWaitTime = 60000;
        const pollInterval = 2000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            const available = await this.checkAvailability();
            if (available) {
                logger.info('Model API is now available!');
                return;
            }

            logger.debug('Waiting for model to start...');
        }

        throw new Error(`Model failed to start within ${maxWaitTime / 1000} seconds. Please check Docker logs.`);
    }

    /**
     * Restart the model safely with a mutex lock to prevent concurrent restarts.
     */
    async restartModel() {
        if (this.isRestarting) {
            logger.info("Model restart already in progress. Waiting...");
            if (this.restartPromise) await this.restartPromise;
            return;
        }

        this.isRestarting = true;
        this.restartPromise = (async () => {
            try {
                logger.warn("Initiating Model Restart Sequence...");
                await this.stopModel();
                await new Promise(r => setTimeout(r, 5000));
                await this.ensureModelRunning();
            } catch (e) {
                logger.error(`Restart failed: ${e.message}`);
            } finally {
                this.isRestarting = false;
                this.restartPromise = null;
            }
        })();

        await this.restartPromise;
    }

    /**
     * Generates a completion via HTTP API with Vision Support.
     * @param {Array<{role: string, content: string|Array}>} messages - Chat history
     * @returns {Promise<object>} The JSON parsed response from the LLM
     */
    async generateCompletion(messages, retryOnError = true) {
        // Wait if system is restarting
        if (this.isRestarting && this.restartPromise) {
            await this.restartPromise;
        }

        // --- CLI MODE HANDLING ---
        if (this.config.serverType === 'cli') {
            const { spawn } = await import('child_process');

            // 1. Construct Prompt from Messages
            // Enforce explicit instruction for JSON only
            let fullPrompt = "";
            for (const msg of messages) {
                if (msg.role === 'system') {
                    fullPrompt += `System: ${msg.content}\n\nIMPORTANT: You must output ONLY valid JSON. No conversational text.\n\n`;
                }
                else if (msg.role === 'user') {
                    // Start of turn
                    fullPrompt += `User: ${Array.isArray(msg.content) ? msg.content.map(c => c.text || '').join('\n') : msg.content}\n`;
                }
                else if (msg.role === 'assistant') {
                    fullPrompt += `Assistant: ${msg.content}\n`;
                }
            }
            // Force the assistant to start with JSON brace
            fullPrompt += "\nAssistant: {";

            logger.info(`CLI Request to ${this.config.model}...`);
            const startTime = Date.now();

            return new Promise((resolve, reject) => {
                // Command: docker model run <model> <prompt>
                const child = spawn('docker', ['model', 'run', this.config.model, fullPrompt], {
                    stdio: ['ignore', 'pipe', 'pipe']
                });

                let stdoutData = '';
                let stderrData = '';

                child.stdout.on('data', (data) => {
                    stdoutData += data.toString();
                });

                child.stderr.on('data', (data) => {
                    stderrData += data.toString();
                });

                child.on('close', (code) => {
                    const elapsedMs = Date.now() - startTime;
                    logger.info(`⏱️  CLI Response time: ${elapsedMs}ms`);

                    if (code !== 0) {
                        logger.error(`CLI Error (Exit ${code}): ${stderrData}`);
                        reject(new Error(`CLI Execution Failed: ${stderrData}`));
                        return;
                    }

                    // Attempt to parse JSON
                    let content = stdoutData.trim();

                    // Cleaning: Remove Markdown code blocks
                    content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

                    // Validation: check if model output starts with {
                    if (!content.trim().startsWith('{')) {
                        // Try to find the first '{' 
                        const firstBrace = content.indexOf('{');
                        if (firstBrace !== -1) {
                            content = content.substring(firstBrace);
                        } else {
                            // If no brace found, try prepending (dangerous but handled by try-catch)
                            content = '{' + content;
                        }
                    }

                    // Robust Extraction: Find the FIRST valid JSON object using brace counting
                    const firstBrace = content.indexOf('{');
                    if (firstBrace !== -1) {
                        let balance = 0;
                        let endBrace = -1;
                        for (let i = firstBrace; i < content.length; i++) {
                            if (content[i] === '{') balance++;
                            else if (content[i] === '}') {
                                balance--;
                                if (balance === 0) {
                                    endBrace = i;
                                    break;
                                }
                            }
                        }

                        if (endBrace !== -1) {
                            try {
                                const jsonStr = content.substring(firstBrace, endBrace + 1);
                                const jsonResult = JSON.parse(jsonStr);
                                resolve(jsonResult);
                                return;
                            } catch (e) {
                                logger.warn(`CLI JSON Parse Failed: ${e.message}. Content: ${content}`);
                                // Don't resolve with raw content, trigger a failure so Agent works loop can retry
                                reject(new Error(`Invalid JSON: ${e.message}`));
                                return;
                            }
                        }
                    }

                    // Fallback: If parsing failed, reject (don't return raw content to Agent)
                    reject(new Error("No valid JSON found in CLI response"));
                });

                child.on('error', (err) => {
                    reject(err);
                });
            });
        }

        // --- HTTP MODE HANDLING (Existing Logic) ---
        let url, payload;

        if (this.config.serverType === 'ollama') {
            url = `${this.config.baseUrl}/api/chat`;
            payload = {
                model: this.config.model,
                messages: messages,
                stream: false,
                options: {
                    temperature: this.config.temperature,
                    num_ctx: this.config.contextLength || 4096
                }
            };
        } else {
            // Standard OpenAI / vLLM
            url = `${this.config.baseUrl}/chat/completions`;
            payload = {
                model: this.config.model,
                messages: messages,
                temperature: this.config.temperature,
                stream: false,
                max_tokens: this.config.maxTokens || 2048
            };
        }

        // Add format: json_object if supported to force JSON? 
        // Some local servers support "response_format": { "type": "json_object" }
        // Qwen usually follows system prompt.


        const visionStatus = this.config.useVision !== false ? 'Vision Enabled' : 'Vision Disabled';
        logger.info(`Sending Request to ${this.config.model} [${visionStatus}]...`);
        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeoutMs = this.config.timeoutMs || 120000; // Default 2 mins
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();

                // Auto-Restart Logic for Context Errors or 500s
                if (retryOnError && (errorText.includes('Context size') || response.status === 500)) {
                    logger.warn(`LLM Error: "${errorText}". Requesting System Restart...`);
                    await this.restartModel();
                    return this.generateCompletion(messages, false); // Retry once
                }

                throw new Error(`HTTP Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const elapsedMs = Date.now() - startTime;

            // Log token usage metrics if available
            if (data.usage) {
                const { prompt_tokens, completion_tokens, total_tokens } = data.usage;
                const tokensPerSec = completion_tokens / (elapsedMs / 1000);

                logger.info(`📊 Tokens: ${prompt_tokens} prompt + ${completion_tokens} completion = ${total_tokens} total | ${tokensPerSec.toFixed(1)} tok/s | ${elapsedMs}ms`);
            } else {
                logger.info(`⏱️  Response time: ${elapsedMs}ms`);
            }

            // Extract content based on server type
            // Extract content based on server type
            let content;
            if (data.choices && data.choices.length > 0) {
                content = data.choices[0].message.content;
            } else if (data.message) {
                // Ollama format
                content = data.message.content;
            } else {
                throw new Error("Unexpected API response format (No choices or message)");
            }

            // Clean and Parse JSON
            try {
                content = content.trim();
                // Remove Markdown
                content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

                // Find JSON object
                const firstBrace = content.indexOf('{');
                if (firstBrace !== -1) {
                    content = content.substring(firstBrace);
                    // Simple balance check or just try parse
                    const lastBrace = content.lastIndexOf('}');
                    if (lastBrace !== -1) {
                        content = content.substring(0, lastBrace + 1);
                    }
                }

                const jsonResult = JSON.parse(content);
                return jsonResult;
            } catch (e) {
                logger.warn(`Failed to parse JSON from LLM: ${content}`);
                throw new Error("Received invalid JSON from LLM.");
            }

        } catch (error) {
            logger.error(`LLM Request Failed: ${error.message}`);
            throw error;
        }
    }
}

export default new LLMClient();
