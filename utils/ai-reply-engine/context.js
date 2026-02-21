/**
 * @fileoverview AI Reply Engine - Context Module
 * captureContext, extractRepliesMultipleStrategies
 * @module utils/ai-reply-engine/context
 */

import { mathUtils } from "../mathUtils.js";

const logger = createLogger("ai-reply-engine.js");

function createLogger(name) {
  return {
    debug: (msg) => console.debug(`[${name}] ${msg}`),
    warn: (msg) => console.warn(`[${name}] ${msg}`),
  };
}

export async function captureContext(engine, page, tweetUrl = "") {
  const context = {
    url: tweetUrl,
    screenshot: null,
    replies: [],
  };

  try {
    engine.logger.debug(`[AIReply] Extracting replies with multiple strategies...`);

    const extractedReplies = await extractRepliesMultipleStrategies(engine, page);
    context.replies = extractedReplies.slice(0, 50);
    engine.logger.debug(`[AIReply] Extracted ${context.replies.length} replies`);
  } catch (error) {
    engine.logger.warn(`[AIReply] Reply extraction failed: ${error.message}`);
  }

  return context;
}

export async function extractRepliesMultipleStrategies(engine, page) {
  const replies = [];
  const seenTexts = new Set();

  engine.logger.debug(`[AIReply] Starting reply extraction...`);

  try {
    await page
      .waitForSelector(
        '[data-testid="tweetText"], article, [role="article"]',
        { timeout: 5000 },
      )
      .catch(() => {});
    await page.waitForTimeout(mathUtils.randomInRange(500, 1000));
    engine.logger.debug(`[AIReply] Tweet page loaded`);
  } catch (e) {
    engine.logger.debug(`[AIReply] Page load check: ${e.message}`);
  }

  const uiPatterns = [
    /keyboard shortcuts/i,
    /press question mark/i,
    /view keyboard/i,
    /see new posts/i,
    /view more/i,
    /show more/i,
    /read more/i,
    /translated from/i,
    /translate tweet/i,
    /copy link/i,
    /share tweet/i,
    /report tweet/i,
    /post.*see new/i,
    /conversation/i,
    /more options/i,
    /view counts/i,
    /highlight/i,
    /bookmark tweet/i,
    /like tweet/i,
    /retweet/i,
    /reply/i,
    /^@\w+:\s*$/,
    /^@\w+:[\s…]*$/,
    /@\w+\s+@\w+\s+@\w+/,
  ];

  const addReply = (author, text) => {
    if (!text || text.length < 3) return false;
    const cleaned = text
      .replace(/^@\w+\s*/g, "")
      .replace(/\n+/g, " ")
      .trim();

    if (cleaned.length < 2) return false;
    if (cleaned.length > 280) return false;

    if (
      cleaned.endsWith("...") ||
      cleaned.endsWith("…") ||
      cleaned.includes("Show less")
    ) {
      return false;
    }

    for (const pattern of uiPatterns) {
      if (pattern.test(cleaned)) {
        return false;
      }
    }

    const mentionCount = (cleaned.match(/@\w+/g) || []).length;
    const totalLength = cleaned.length;
    if (mentionCount >= 2 && mentionCount / totalLength > 0.5) {
      return false;
    }

    const lowerKey = cleaned.toLowerCase();
    if (seenTexts.has(lowerKey)) return false;
    seenTexts.add(lowerKey);

    replies.push({ author, text: cleaned.substring(0, 280) });
    return true;
  };

  try {
    engine.logger.debug(`[AIReply] Step 1: Scrolling to bottom to load replies...`);

    for (let scroll = 0; scroll < 6; scroll++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(mathUtils.randomInRange(150, 300));
      engine.logger.debug(`[AIReply] Scroll to bottom ${scroll + 1}/6`);
    }

    const scrollUpSteps = 15;
    for (let i = 0; i < scrollUpSteps; i++) {
      const visibleReplies = await page.evaluate(() => {
        const found = [];
        const elements = document.querySelectorAll('[data-testid="tweetText"]');
        elements.forEach((el) => {
          const text = el.textContent?.trim();
          if (
            text &&
            text.length > 3 &&
            text.length < 300 &&
            !text.includes("Show more")
          ) {
            found.push(text);
          }
        });
        return found;
      });

      for (const text of visibleReplies) {
        addReply("unknown", text);
      }

      await page.evaluate(() => window.scrollBy(0, -300));
      await page.waitForTimeout(mathUtils.randomInRange(100, 200));
    }
  } catch (e) {
    engine.logger.debug(`[AIReply] Scroll extraction failed: ${e.message}`);
  }

  try {
    engine.logger.debug(`[AIReply] Step 2: Direct DOM query...`);
    const articles = await page.$$("article");
    engine.logger.debug(`[AIReply] Found ${articles.length} articles`);

    for (const article of articles.slice(1, 20)) {
      try {
        const reply = await extractReplyFromArticle(engine, article, page);
        if (reply && reply.text) {
          addReply(reply.author, reply.text);
        }
      } catch (e) {
        // Skip failed articles
      }
    }
  } catch (e) {
    engine.logger.debug(`[AIReply] DOM query failed: ${e.message}`);
  }

  try {
    engine.logger.debug(`[AIReply] Step 3: User timeline selector...`);
    const timelineReplies = await page.$$(
      '[data-testid="cellInnerDiv"] [role="group"]',
    );
    for (const replyEl of timelineReplies.slice(0, 10)) {
      try {
        const textEl = await replyEl.$('[data-testid="tweetText"]');
        if (textEl) {
          const text = await textEl.innerText();
          addReply("unknown", text);
        }
      } catch (e) {
        // Skip
      }
    }
  } catch (e) {
    engine.logger.debug(`[AIReply] Timeline selector failed: ${e.message}`);
  }

  try {
    engine.logger.debug(`[AIReply] Step 4: Text content search...`);
    const allText = await page.evaluate(() => {
      const textEls = document.querySelectorAll(
        '[data-testid="tweetText"], article [role="presentation"]',
      );
      return Array.from(textEls)
        .slice(1, 30)
        .map((el) => el.textContent?.trim())
        .filter(Boolean);
    });

    for (const text of allText) {
      if (text.length > 10 && text.length < 280) {
        addReply("unknown", text);
      }
    }
  } catch (e) {
    engine.logger.debug(`[AIReply] Text search failed: ${e.message}`);
  }

  await returnToMainTweet(engine, page);

  engine.logger.debug(`[AIReply] Total extracted: ${replies.length} replies`);
  return replies.slice(0, 50);
}

async function returnToMainTweet(engine, page) {
  try {
    engine.logger.debug(`[AIReply] Returning to main tweet...`);
    await page.waitForTimeout(mathUtils.randomInRange(500, 1000));

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Home");
      await page.waitForTimeout(mathUtils.randomInRange(200, 400));
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(mathUtils.randomInRange(300, 600));

    await page.evaluate(() => {
      const main = document.querySelector('main, [role="main"]');
      if (main) {
        main.scrollTop = 0;
      }
    });

    await page.waitForTimeout(mathUtils.randomInRange(400, 800));

    const scrollPos = await page.evaluate(() => window.scrollY);
    if (scrollPos > 100) {
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    await page.waitForTimeout(mathUtils.randomInRange(300, 500));
    engine.logger.debug(`[AIReply] Returned to main tweet (scrollY: ${scrollPos})`);
  } catch (e) {
    engine.logger.debug(`[AIReply] Return scroll failed: ${e.message}`);
  }
}

export async function extractReplyFromArticle(engine, article, _page) {
  try {
    const textEl = await article.$('[data-testid="tweetText"], [dir="auto"]');
    if (!textEl) return null;

    const text = await textEl.innerText().catch(() => "");
    if (!text || text.length < 5) return null;

    const author = await extractAuthorFromArticle(engine, article);

    let cleanedText = text;
    const firstAtMatch = text.match(/^@\w+/);
    if (firstAtMatch && firstAtMatch[0] === author) {
      cleanedText = text.replace(/^@\w+\s*/, "").trim();
    }
    cleanedText = cleanedText.replace(/\n+/g, " ").trim();

    return { author, text: cleanedText.substring(0, 300) };
  } catch (_error) {
    return null;
  }
}

export async function extractAuthorFromArticle(engine, article) {
  try {
    const link = await article.$('a[href^="/"]');
    if (link) {
      const href = await link.getAttribute("href");
      if (href && href.startsWith("/")) {
        return href.replace("/", "").split("?")[0];
      }
    }

    const timeEl = await article.$("time");
    if (timeEl) {
      const parent = await timeEl.$("x");
    }

    return "unknown";
  } catch (e) {
    return "unknown";
  }
}

export async function extractAuthorFromElement(engine, element, _page) {
  return extractAuthorFromArticle(engine, element);
}
