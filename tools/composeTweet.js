/**
 * @fileoverview Interactive Tweet Composer Tool
 * Allows multi-line tweet composition with automatic encoding
 * @module tools/composeTweet.js
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TWEET_FILE = path.join(__dirname, '../tasks/twitterTweet.txt');
const MAX_TWEET_LENGTH = 280;
const SEPARATOR = '─'.repeat(60);

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
};

/**
 * Main function
 */
async function main() {
    console.log(`${colors.bright}${colors.cyan}`);
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          Twitter Tweet Composer (Multi-Line)              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(colors.reset);

    // Show current queue status
    showQueueStatus();

    // Show menu
    console.log(`\n${colors.bright}Options:${colors.reset}`);
    console.log(`  ${colors.green}1${colors.reset} - Compose new tweet (append to end)`);
    console.log(`  ${colors.yellow}2${colors.reset} - Compose new tweet (prepend to top)`);
    console.log(`  ${colors.blue}3${colors.reset} - View queue`);
    console.log(`  ${colors.red}0${colors.reset} - Exit\n`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question(`${colors.bright}Choose option: ${colors.reset}`, (choice) => {
        rl.close();

        switch (choice.trim()) {
            case '1':
                composeTweet('append');
                break;
            case '2':
                composeTweet('prepend');
                break;
            case '3':
                viewQueue();
                break;
            case '0':
                console.log(`${colors.dim}Goodbye!${colors.reset}\n`);
                process.exit(0);
                break;
            default:
                console.log(`${colors.red}Invalid option. Exiting.${colors.reset}\n`);
                process.exit(1);
        }
    });
}

/**
 * Show queue status
 */
function showQueueStatus() {
    try {
        if (!fs.existsSync(TWEET_FILE)) {
            console.log(`${colors.yellow}Queue is empty (file not found)${colors.reset}`);
            return;
        }

        const content = fs.readFileSync(TWEET_FILE, 'utf-8');
        const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

        if (lines.length === 0) {
            console.log(`${colors.yellow}Queue is empty${colors.reset}`);
        } else {
            console.log(`${colors.green}Current queue: ${lines.length} tweet(s)${colors.reset}`);
        }
    } catch (error) {
        console.log(`${colors.red}Error reading queue: ${error.message}${colors.reset}`);
    }
}

/**
 * View all tweets in queue
 */
function viewQueue() {
    console.log(`\n${colors.bright}${SEPARATOR}${colors.reset}`);
    console.log(`${colors.bright}TWEET QUEUE${colors.reset}`);
    console.log(`${SEPARATOR}\n`);

    try {
        if (!fs.existsSync(TWEET_FILE)) {
            console.log(`${colors.yellow}No tweets in queue.${colors.reset}\n`);
            process.exit(0);
        }

        const content = fs.readFileSync(TWEET_FILE, 'utf-8');
        const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

        if (lines.length === 0) {
            console.log(`${colors.yellow}No tweets in queue.${colors.reset}\n`);
        } else {
            lines.forEach((line, index) => {
                // Decode for preview
                const decoded = line.replace(/\\n/g, '\n');
                const hasLineBreaks = decoded.includes('\n');

                console.log(`${colors.bright}${colors.blue}[${index + 1}]${colors.reset} ${hasLineBreaks ? colors.cyan + '[Multi-line]' + colors.reset : ''}`);
                console.log(decoded);
                console.log(colors.dim + SEPARATOR + colors.reset);
            });
        }
    } catch (error) {
        console.log(`${colors.red}Error reading queue: ${error.message}${colors.reset}`);
    }

    console.log('');
    process.exit(0);
}

/**
 * Compose a new tweet
 * @param {string} mode - 'append' or 'prepend'
 */
function composeTweet(mode) {
    console.log(`\n${colors.bright}${SEPARATOR}${colors.reset}`);
    console.log(`${colors.bright}COMPOSE TWEET${colors.reset} ${colors.dim}(${mode === 'append' ? 'add to end' : 'add to top'})${colors.reset}`);
    console.log(`${SEPARATOR}\n`);
    console.log(`${colors.dim}Type your tweet below. Press Enter for line breaks.`);
    console.log(`Type ${colors.bright}:done${colors.reset}${colors.dim} on a new line to finish.`);
    console.log(`Type ${colors.bright}:cancel${colors.reset}${colors.dim} to abort.${colors.reset}\n`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: ''
    });

    const lines = [];
    let charCount = 0;

    rl.on('line', (line) => {
        // Check for commands
        if (line.trim() === ':done') {
            rl.close();
            return;
        }

        if (line.trim() === ':cancel') {
            console.log(`\n${colors.yellow}Cancelled.${colors.reset}\n`);
            process.exit(0);
        }

        // Add line to buffer
        lines.push(line);
        charCount += line.length + 1; // +1 for newline

        // Show character count
        const remaining = MAX_TWEET_LENGTH - charCount;
        const colorCode = remaining < 0 ? colors.red : remaining < 20 ? colors.yellow : colors.dim;
        console.log(`${colorCode}(${remaining} chars remaining)${colors.reset}`);
    });

    rl.on('close', () => {
        if (lines.length === 0) {
            console.log(`${colors.yellow}No content entered. Exiting.${colors.reset}\n`);
            process.exit(0);
        }

        // Join lines and encode
        const rawTweet = lines.join('\n');
        const encodedTweet = lines.join('\\n');

        // Validate length
        if (rawTweet.length > MAX_TWEET_LENGTH) {
            console.log(`\n${colors.red}❌ Tweet too long! (${rawTweet.length} chars, max ${MAX_TWEET_LENGTH})${colors.reset}`);
            console.log(`${colors.yellow}Please try again with shorter content.${colors.reset}\n`);
            process.exit(1);
        }

        // Show preview
        console.log(`\n${colors.bright}${SEPARATOR}${colors.reset}`);
        console.log(`${colors.bright}PREVIEW${colors.reset} ${colors.dim}(${rawTweet.length} chars)${colors.reset}`);
        console.log(`${SEPARATOR}\n`);
        console.log(rawTweet);
        console.log(`\n${colors.dim}${SEPARATOR}${colors.reset}`);
        console.log(`${colors.dim}Encoded: ${encodedTweet.substring(0, 50)}...${colors.reset}\n`);

        // Confirm
        const rlConfirm = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rlConfirm.question(`${colors.bright}Add to queue? (y/n): ${colors.reset}`, (answer) => {
            rlConfirm.close();

            if (answer.toLowerCase() !== 'y') {
                console.log(`${colors.yellow}Cancelled.${colors.reset}\n`);
                process.exit(0);
            }

            // Add to file
            try {
                let existingContent = '';
                if (fs.existsSync(TWEET_FILE)) {
                    existingContent = fs.readFileSync(TWEET_FILE, 'utf-8');
                }

                const existingLines = existingContent.split(/\r?\n/).filter(line => line.trim().length > 0);

                let newContent;
                if (mode === 'prepend') {
                    newContent = encodedTweet + '\n' + existingLines.join('\n');
                } else {
                    newContent = existingLines.join('\n') + (existingLines.length > 0 ? '\n' : '') + encodedTweet;
                }

                fs.writeFileSync(TWEET_FILE, newContent, 'utf-8');

                const newCount = newContent.split(/\r?\n/).filter(line => line.trim().length > 0).length;

                console.log(`\n${colors.green}✅ Tweet added to queue!${colors.reset}`);
                console.log(`${colors.dim}Position: ${mode === 'prepend' ? '1 (top)' : newCount + ' (bottom)'}${colors.reset}`);
                console.log(`${colors.dim}Total in queue: ${newCount}${colors.reset}\n`);

            } catch (error) {
                console.log(`\n${colors.red}❌ Error saving tweet: ${error.message}${colors.reset}\n`);
                process.exit(1);
            }
        });
    });
}

// Run
main();
