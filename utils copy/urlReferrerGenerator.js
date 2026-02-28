/**
 * @fileoverview URL Referrer Generator
 * Generates realistic referrer URLs for anti-sybil protection
 * @module utils/urlReferrerGenerator
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: Generate random alphanumeric string
function randomId(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

// Helper: Random element from array
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Generate realistic Reddit post URLs
function generateRedditUrls(count) {
    const subreddits = [
        'Twitter', 'socialmedia', 'technology', 'news', 'worldnews',
        'business', 'programming', 'webdev', 'marketing', 'startups'
    ];

    const titleWords = [
        'discussion', 'thread', 'announcement', 'breaking', 'guide',
        'tutorial', 'review', 'analysis', 'update', 'leak', 'rumor'
    ];

    const urls = [];
    for (let i = 0; i < count; i++) {
        const subreddit = pick(subreddits);
        const postId = '1' + randomId(6); // Reddit IDs typically start with 1
        const title = pick(titleWords) + '_' + pick(titleWords);
        urls.push(`https://www.reddit.com/r/${subreddit}/comments/${postId}/${title}/`);
    }
    return urls;
}

// Generate social media URLs
function generateSocialUrls() {
    return [
        // Facebook - varied
        'https://www.facebook.com/messages/',
        'https://www.facebook.com/groups/',
        'https://www.facebook.com/notifications/',
        'https://www.facebook.com/watch/',
        'https://m.facebook.com/',
        'https://www.facebook.com/marketplace/',
        // Instagram - varied
        'https://www.instagram.com/direct/',
        'https://www.instagram.com/explore/',
        'https://www.instagram.com/reels/',
        'https://www.instagram.com/stories/',
        // LinkedIn - varied
        'https://www.linkedin.com/feed/',
        'https://www.linkedin.com/messaging/',
        'https://www.linkedin.com/notifications/',
        'https://www.linkedin.com/jobs/',
        // TikTok
        'https://www.tiktok.com/foryou',
        'https://www.tiktok.com/following',
        'https://www.tiktok.com/explore',
        // YouTube
        'https://www.youtube.com/feed/subscriptions',
        'https://www.youtube.com/feed/trending',
    ];
}

// Generate messaging app URLs
function generateMessagingUrls() {
    return [
        'https://web.whatsapp.com/',
        'https://web.telegram.org/',
        'https://discord.com/channels/@me',
        'https://slack.com/workspace/',
        'https://teams.microsoft.com/',
    ];
}

// Generate email client URLs
function generateEmailUrls() {
    return [
        'https://mail.google.com/mail/u/0/',
        'https://outlook.live.com/mail/inbox',
        'https://mail.yahoo.com/',
        'https://protonmail.com/inbox',
    ];
}

// Generate news & aggregator URLs
function generateNewsUrls() {
    return [
        'https://news.google.com/',
        'https://news.ycombinator.com/',
        'https://flipboard.com/',
        'https://feedly.com/',
        'https://www.techmeme.com/',
        'https://slashdot.org/',
        'https://www.reddit.com/', // Main Reddit as referrer
        'https://digg.com/',
        'https://www.fark.com/',
    ];
}

// Generate forum & community URLs
function generateForumUrls() {
    return [
        'https://stackoverflow.com/questions/',
        'https://medium.com/',
        'https://www.quora.com/',
        'https://dev.to/',
        'https://hashnode.com/',
        'https://www.producthunt.com/',
    ];
}

// Generate Twitter/X internal URLs
function generateTwitterUrls(count) {
    const urls = [
        'https://x.com/home',
        'https://x.com/explore/tabs/for_you',
        'https://x.com/explore/tabs/trending',
        'https://x.com/notifications',
        'https://x.com/messages',
    ];

    // Add t.co URLs (Twitter shortener)
    for (let i = 0; i < count; i++) {
        const shortId = randomId(10);
        urls.push(`https://t.co/${shortId}`);
    }

    return urls;
}

// Main generator
function generateAllReferrers() {
    const referrers = [];

    // Reddit (50% of total)
    referrers.push(...generateRedditUrls(153));

    // Social Media (20%)
    referrers.push(...generateSocialUrls());

    // Messaging (10%)
    referrers.push(...generateMessagingUrls());

    // Email (10%)
    referrers.push(...generateEmailUrls());

    // News (10%)
    referrers.push(...generateNewsUrls());

    // Forums (5%)
    referrers.push(...generateForumUrls());

    // Twitter/t.co (30%+)
    referrers.push(...generateTwitterUrls(100));

    // Shuffle the array
    for (let i = referrers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [referrers[i], referrers[j]] = [referrers[j], referrers[i]];
    }

    return referrers;
}

// Write to file
function writeReferrersFile() {
    const referrers = generateAllReferrers();
    const outputPath = path.join(__dirname, '../data/URLreferrer.txt');

    // Ensure data directory exists
    const dataDir = path.dirname(outputPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(outputPath, referrers.join('\n'), 'utf8');

    console.log(`✅ Generated ${referrers.length} referrer URLs`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`\nBreakdown:`);
    console.log(`  - Reddit: ~150 URLs`);
    console.log(`  - Social Media: ${generateSocialUrls().length} URLs`);
    console.log(`  - Messaging Apps: ${generateMessagingUrls().length} URLs`);
    console.log(`  - Email Clients: ${generateEmailUrls().length} URLs`);
    console.log(`  - News/Aggregators: ${generateNewsUrls().length} URLs`);
    console.log(`  - Forums: ${generateForumUrls().length} URLs`);
    console.log(`  - Twitter/t.co: ~105 URLs (includes 5 internal X URLs)`);
}

// Run if called directly
if (import.meta.url.startsWith('file:')) {
    const modulePath = fileURLToPath(import.meta.url);
    const scriptPath = process.argv[1];
    if (modulePath === scriptPath) {
        writeReferrersFile();
    }
}

export { generateAllReferrers };
