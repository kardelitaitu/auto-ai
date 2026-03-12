// gemini-edit-actions.js — Batch inject metricsCollector into action handlers
import fs from 'fs';

const IMPORT_LINE = "import metricsCollector from '../utils/metrics.js';";

const edits = [
    {
        path: 'api/actions/like.js',
        importAnchor: "import { click } from '../interactions/actions.js';",
        successLine: 'logger.info(`✅ api.likeWithAPI successful!`);',
        metricsLine: "            metricsCollector.recordSocialAction('like', 1);",
    },
    {
        path: 'api/actions/retweet.js',
        importAnchor: "import { click } from '../interactions/actions.js';",
        successLine: 'logger.info(`✅ api.retweetWithAPI successful!`);',
        metricsLine: "            metricsCollector.recordSocialAction('retweet', 1);",
    },
    {
        path: 'api/actions/follow.js',
        importAnchor: "import { click } from '../interactions/actions.js';",
        successLine: 'logger.info(`✅ api.followWithAPI: successfully followed @${username}!`);',
        metricsLine: "                metricsCollector.recordSocialAction('follow', 1);",
    },
    {
        path: 'api/actions/bookmark.js',
        importAnchor: "import { click } from '../interactions/actions.js';",
        successLine: 'logger.info(`✅ api.bookmarkWithAPI successful!`);',
        metricsLine: "            metricsCollector.recordTwitterEngagement('bookmark', 1);",
    },
    {
        path: 'api/actions/reply.js',
        importAnchor: "import { click, type } from '../interactions/actions.js';",
        successLine: 'logger.info(`✅ api.replyWithAI successful!`);',
        metricsLine: "        metricsCollector.recordTwitterEngagement('reply', 1);",
    },
    {
        path: 'api/actions/quote.js',
        importAnchor: "import { text, exists } from '../interactions/queries.js';",
        successLine: 'logger.info(`✅ api.quoteWithAI successful!`);',
        metricsLine: "        metricsCollector.recordTwitterEngagement('quote', 1);",
    },
];

for (const edit of edits) {
    let content = fs.readFileSync(edit.path, 'utf8');

    // 1. Add import (if not already present)
    if (!content.includes('metricsCollector')) {
        const anchorIdx = content.indexOf(edit.importAnchor);
        if (anchorIdx === -1) {
            console.error(`[SKIP] import anchor not found in ${edit.path}`);
            continue;
        }
        const insertPos = anchorIdx + edit.importAnchor.length;
        // Detect line ending style
        const eol = content.includes('\r\n') ? '\r\n' : '\n';
        content =
            content.slice(0, insertPos) + eol + IMPORT_LINE + content.slice(insertPos);
        console.log(`[OK] Added import to ${edit.path}`);
    } else {
        console.log(`[SKIP] import already present in ${edit.path}`);
    }

    // 2. Add metrics call after success log (if not already present)
    if (!content.includes(edit.metricsLine.trim())) {
        const successIdx = content.indexOf(edit.successLine);
        if (successIdx === -1) {
            console.error(`[SKIP] success anchor not found in ${edit.path}`);
            fs.writeFileSync(edit.path, content, 'utf8');
            continue;
        }
        const eol = content.includes('\r\n') ? '\r\n' : '\n';
        const insertPos = successIdx + edit.successLine.length;
        content =
            content.slice(0, insertPos) + eol + edit.metricsLine + content.slice(insertPos);
        console.log(`[OK] Added metrics call to ${edit.path}`);
    } else {
        console.log(`[SKIP] metrics call already present in ${edit.path}`);
    }

    fs.writeFileSync(edit.path, content, 'utf8');
}

console.log('\nDone! All action handlers updated.');
