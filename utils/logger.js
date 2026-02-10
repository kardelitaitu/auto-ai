/**
 * @fileoverview System-wide event logging facility with rich ANSI colors.
 * @module utils/logger
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, '../logs.txt');

// Rich ANSI Color Codes (Neon/Bright variants)
const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  UNDERSCORE: '\x1b[4m',
  BLINK: '\x1b[5m',
  REVERSE: '\x1b[7m',
  HIDDEN: '\x1b[8m',

  // Foreground Standard
  FG_BLACK: '\x1b[30m',
  FG_RED: '\x1b[31m',
  FG_GREEN: '\x1b[32m',
  FG_YELLOW: '\x1b[33m',
  FG_BLUE: '\x1b[34m',
  FG_MAGENTA: '\x1b[35m',
  FG_CYAN: '\x1b[36m',
  FG_WHITE: '\x1b[37m',
  FG_GRAY: '\x1b[90m',

  // Foreground Bright (Neon)
  FG_BRIGHT_RED: '\x1b[91m',
  FG_BRIGHT_GREEN: '\x1b[92m',
  FG_BRIGHT_YELLOW: '\x1b[93m',
  FG_BRIGHT_BLUE: '\x1b[94m',
  FG_BRIGHT_MAGENTA: '\x1b[95m',
  FG_BRIGHT_CYAN: '\x1b[96m',
  FG_BRIGHT_WHITE: '\x1b[97m',

  // Foreground Extended (256-color)
  FG_ORANGE: '\x1b[38;5;208m',
  FG_PINK: '\x1b[38;5;205m',
  FG_PURPLE: '\x1b[38;5;129m',
  FG_TEAL: '\x1b[38;5;37m',
  FG_NAVY: '\x1b[38;5;17m',
  FG_GOLD: '\x1b[38;5;220m',
  FG_LIME: '\x1b[38;5;118m',

  // Background Standard
  BG_BLACK: '\x1b[40m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
  BG_MAGENTA: '\x1b[45m',
  BG_CYAN: '\x1b[46m',
  BG_WHITE: '\x1b[47m',

  // Background Bright
  BG_GRAY: '\x1b[100m',
  BG_BRIGHT_RED: '\x1b[101m',
  BG_BRIGHT_GREEN: '\x1b[102m',
  BG_BRIGHT_YELLOW: '\x1b[103m',
  BG_BRIGHT_BLUE: '\x1b[104m',
  BG_BRIGHT_MAGENTA: '\x1b[105m',
  BG_BRIGHT_CYAN: '\x1b[106m',
  BG_BRIGHT_WHITE: '\x1b[107m',

  // Background Extended (256-color)
  BG_ORANGE: '\x1b[48;5;208m',
  BG_PINK: '\x1b[48;5;205m',
  BG_PURPLE: '\x1b[48;5;129m',
  BG_TEAL: '\x1b[48;5;37m',
  BG_NAVY: '\x1b[48;5;17m',
  BG_GOLD: '\x1b[48;5;220m'
};

// Global flag to track if log file has been initialized
let logFileInitialized = false;

/**
 * Initialize the log file (clear it)
 */
function initLogFile() {
  if (!logFileInitialized) {
    try {
      fs.writeFileSync(LOG_FILE, '', 'utf8');
      logFileInitialized = true;
    } catch (error) {
      console.error(`Failed to initialize log file: ${error.message}`);
    }
  }
}

/**
 * Write to log file (strips ANSI codes for clean text logs)
 */
function writeToLogFile(level, scriptName, message, args) {
  try {
    const timestamp = new Date().toISOString();
    // Regex to strip ANSI codes
    const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');
    const argsStr = args.length > 0 ? ' ' + JSON.stringify(args) : '';
    const logLine = `[${timestamp}] [${level.toUpperCase()}] [${scriptName}] ${cleanMessage}${argsStr}\n`;
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  } catch (error) {
    // Silently fail
  }
}

/**
 * @class Logger
 * @description A high-fidelity logger with smart tag coloring.
 */
class Logger {
  constructor(scriptName) {
    this.scriptName = scriptName;
    initLogFile();
  }

  /**
   * Applies distinct colors to valid bracketed tags
   * Priorities:
   * 1. [Agent:...] -> Green
   * 2. [Brave/Chrome/...] -> Cyan
   * 3. [*.js/Task] -> Magenta
   * 4. [Metrics] -> Blue
   * 5. Others -> Yellow/White
   */
  colorizeTags(text) {
    return text.replace(/\[(.*?)\]/g, (match, content) => {
      let color = COLORS.FG_YELLOW; // Default

      if (content.match(/Agent:|User:/i)) {
        color = COLORS.FG_BRIGHT_GREEN;
      } else if (content.match(/Brave|Chrome|Firefox|ixbrowser|Edge/i)) {
        color = COLORS.FG_BRIGHT_CYAN;
      } else if (content.match(/js|Task|Module|main/i)) { // Removed dot requirement for robustness
        color = COLORS.FG_ORANGE;
      } else if (content.match(/Metrics|Stats/i)) {
        color = COLORS.FG_BRIGHT_YELLOW;
      }

      return `${COLORS.RESET}${color}[${content}]${COLORS.RESET}`;
    });
  }

  /**
   * Helper to format console output
   */
  _log(level, color, icon, message, ...args) {
    // 1. Timestamp (Dim Gray)
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const timeStr = `${COLORS.DIM}${time}${COLORS.RESET}`;

    // 2. Level/Icon
    const levelStr = `${color}${icon}${COLORS.RESET}`;

    // 3. Script Name (Pre-processing)
    // If scriptName looks like "task [browser]", split it into "[task][browser]" for better coloring
    let displayScript = this.scriptName;

    // Check if scriptName has nested brackets or implicit structure "Name [Info]"
    if (displayScript.includes('[') && !displayScript.startsWith('[')) {
      // Fix: "twitterActivityTask [Brave-123]" -> "[twitterActivity.js][Brave-123]"
      // This makes them distinct blocks for the colorizer
      displayScript = displayScript.replace(/(.*?) \[(.*?)\]/, '[$1][$2]');
    } else if (!displayScript.startsWith('[')) {
      displayScript = `[${displayScript}]`;
    }

    // 4. Message Coloring
    const msgColor = level === 'ERROR' ? COLORS.FG_RED : (level === 'WARN' ? COLORS.FG_YELLOW : COLORS.RESET);

    // Apply Smart Coloring to Script Name
    const coloredScript = this.colorizeTags(displayScript);

    // Process Message
    // Remove space if message starts with a tag (Tight Packing)
    let separator = ' ';
    if (message.trim().startsWith('[')) {
      separator = '';
    }

    // Colorize tags within the RAW message first (to avoid parsing ANSI codes as tags)
    let coloredInnerMessage = message.replace(/\[(.*?)\]/g, (match, content) => {
      const coloredTag = this.colorizeTags(match);
      // Re-apply msgColor after the tag's RESET so the rest of the string stays colored
      return `${coloredTag}${msgColor}`;
    });

    // Highlight words with '@' (e.g. @User, email@addr)
    coloredInnerMessage = coloredInnerMessage.replace(/(\S*@\S*)/g, (match) => {
      // Don't colorize if it looks like an ANSI code or is inside one
      if (match.includes('\x1b')) return match;
      return `${COLORS.BG_YELLOW}${COLORS.FG_BLACK}${match}${COLORS.RESET}${msgColor}`;
    });

    // Highlight quoted text ("...", '...') and parentheses (...) with distinct text colors
    coloredInnerMessage = coloredInnerMessage.replace(/(".*?"|'.*?'|\(.*?\))/g, (match) => {
      if (match.includes('\x1b')) return match;

      if (match.startsWith('"')) {
        return `${COLORS.FG_BRIGHT_YELLOW}${match}${COLORS.RESET}${msgColor}`;
      } else if (match.startsWith("'")) {
        return `${COLORS.FG_BRIGHT_GREEN}${match}${COLORS.RESET}${msgColor}`;
      } else if (match.startsWith('(')) {
        return `${COLORS.FG_BRIGHT_MAGENTA}${match}${COLORS.RESET}${msgColor}`;
      }
      return match;
    });

    // Highlight URLs (http, https, ws, wss) in orange
    coloredInnerMessage = coloredInnerMessage.replace(/((?:https?|wss?):\/\/[^\s\]]+)/gi, (match) => {
      if (match.includes('\x1b')) return match;
      return `${COLORS.FG_ORANGE}${match}${COLORS.RESET}${msgColor}`;
    });

    // Wrap the message in the base color
    const coloredMessageFinal = `${msgColor}${coloredInnerMessage}${COLORS.RESET}`;

    console.log(`${timeStr} ${levelStr} ${coloredScript}${separator}${coloredMessageFinal}`, ...args);

    // Write clean version to file
    writeToLogFile(level, this.scriptName, message, args);
  }

  /**
   * Logs an informational message.
   */
  info(message, ...args) {
    this._log('INFO', COLORS.FG_CYAN, '🔵', message, ...args);
  }

  /**
   * Logs a success message.
   */
  success(message, ...args) {
    this._log('SUCCESS', COLORS.FG_GREEN, '🟢', message, ...args);
  }

  /**
   * Logs an error message.
   */
  error(message, ...args) {
    this._log('ERROR', COLORS.FG_RED, '🔴', message, ...args);
  }

  /**
   * Logs a warning message.
   */
  warn(message, ...args) {
    this._log('WARN', COLORS.FG_YELLOW, '🟡', message, ...args);
  }

  /**
   * Logs a debug message.
   */
  debug(message, ...args) {
    this._log('DEBUG', COLORS.FG_GRAY, '⚪', message, ...args);
  }
}

/**
 * Creates a new Logger instance.
 */
export function createLogger(scriptName) {
  return new Logger(scriptName);
}

export default Logger;
