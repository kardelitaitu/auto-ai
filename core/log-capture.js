import { logEmitter } from '../utils/logger.js';

export class LogCapture {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.lastActivity = new Map();
    this.idleInterval = null;
    this.boundHandleLog = this.handleLog.bind(this);
    this.allowedModules = this.discoverTaskModules();
    this.allowedModules.add('ai-twitterAgent');
    this.start();
  }

  discoverTaskModules() {
    const set = new Set();
    try {
      const fs = require('fs');
      const path = require('path');
      const { fileURLToPath } = require('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const tasksDir = path.join(__dirname, '..', 'tasks');
      const files = fs.readdirSync(tasksDir);
      for (const file of files) {
        if (file.endsWith('.js') && !file.startsWith('_')) {
          set.add(file.replace('.js', ''));
        }
      }
    } catch (_e) {
      const known = ['ai-twitterActivity', 'twitterTweet', 'twitterFollow', 'agentNavigate', 'agent', 'twitterScroll', 'twitterReply', 'twitterQuote', 'twitterFollowLikeRetweet', 'retweet-test'];
      for (const name of known) set.add(name);
    }
    return set;
  }

  start() {
    logEmitter.on('log', this.boundHandleLog);
    this.idleInterval = setInterval(() => this.checkIdle(), 2000);
  }

  stop() {
    if (this.idleInterval) clearInterval(this.idleInterval);
    logEmitter.off('log', this.boundHandleLog);
  }

  handleLog(entry) {
    const { sessionId, module, message, level } = entry;
    if (!sessionId) return;
    if (!this.allowedModules.has(module)) return;
    if (!['info', 'warn'].includes(level)) return;

    const excludeWords = ['initialized', 'starting', 'session', 'waiting', 'debug', 'verbose', 'retry', 'attempt', 'error'];
    const lower = message.toLowerCase();
    if (excludeWords.some(word => lower.includes(word))) return;

    const activity = this.cleanMessage(message).slice(0, 30);
    if (!activity) return;

    this.orchestrator.updateSessionProcessing(sessionId, activity);
    this.lastActivity.set(sessionId, Date.now());
  }

  cleanMessage(msg) {
    return msg
      .replace(/^\[[\w-]+\]\s*/, '')
      .replace(/^\[[\w-]+\]\[[\w:]+\]\s*/, '')
      .replace(/^\d{2}:\d{2}:\d{2}\s+[^\]]+\]\s*/, '')
      .trim();
  }

  checkIdle() {
    const now = Date.now();
    const sessions = this.orchestrator.sessionManager.getAllSessions();
    for (const session of sessions) {
      if (!session.currentTaskName) continue;
      const last = this.lastActivity.get(session.id) || 0;
      if (now - last > 5000) {
        this.orchestrator.updateSessionProcessing(session.id, null);
        this.lastActivity.delete(session.id);
      }
    }
  }
}