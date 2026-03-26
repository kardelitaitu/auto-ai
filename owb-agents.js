/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * @fileoverview OWB Agent Helpers & Auto-Play
 * Territory game specific automation with state machine
 * @module owb-agents
 */

import { api, getPage as getCurrentPage } from "./api/index.js";
import { createLogger } from "./api/core/logger.js";
import {
  STRATEGIES as _STRATEGIES,
  GAME_CONFIG,
  GAME_MECHANICS,
  BUILDING_COSTS,
  LAND_COSTS as _LAND_COSTS,
  LLM_CONFIG,
} from "./owb-config.js";
import { LLMClient } from "./api/agent/index.js";
import {
  STATES as _PROMPT_STATES,
  getStatePrompt,
  validateStateResponse as _validateStateResponse,
  detectStateFromResponse,
  scaleToViewport as _scaleToViewport,
  parseCoordinates,
  parseLLMJson,
} from "./prompts/index.js";

const logger = createLogger("owb-agents.js");

// OWB-specific LLM client with higher token limits for vision tasks
let owbLlmClient = null;

/**
 * Get or create OWB-specific LLM client with higher token limits
 * Increased timeout to 180s to allow model time to think through complex tile analysis
 */
async function getOwbLlmClient() {
  if (owbLlmClient) return owbLlmClient;

  owbLlmClient = new LLMClient();
  // Override config with OWB-specific settings
  await owbLlmClient.init();
  owbLlmClient.config = {
    ...owbLlmClient.config,
    model: LLM_CONFIG.defaultModel || "qwen2.5vl:3b",
    maxTokens: LLM_CONFIG.maxTokens || 4096,
    contextLength: LLM_CONFIG.contextLength || 8192,
    timeoutMs: 180000, // 3 minutes - give model time to analyze all tiles
  };

  logger.info(
    `[OWB] Initialized OWB-specific LLM client: model=${owbLlmClient.config.model}, maxTokens=${owbLlmClient.config.maxTokens}, timeout=${owbLlmClient.config.timeoutMs}ms`,
  );
  return owbLlmClient;
}

let isRunning = false;
let shouldStop = false;

/**
 * Get viewport dimensions (width and height)
 */
async function getViewportDimensions() {
  let page;
  try {
    page = getCurrentPage();
  } catch (_e) {
    page = api.getCurrentPage?.();
  }
  if (!page) return { width: 1280, height: 720 };

  const viewport = page.viewportSize();
  const jsSize = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  if (viewport) {
    const mismatchX = Math.abs(viewport.width - jsSize.width);
    const mismatchY = Math.abs(viewport.height - jsSize.height);

    if (mismatchX > 50 || mismatchY > 50) {
      logger.warn(
        `[Viewport] MISMATCH detected! viewportSize(): ${viewport.width}x${viewport.height}, window.inner: ${jsSize.width}x${jsSize.height}. Using window.inner values.`,
      );
      return { width: jsSize.width, height: jsSize.height, mismatched: true };
    }

    return { width: viewport.width, height: viewport.height };
  }

  return { width: jsSize.width, height: jsSize.height };
}

/**
 * Get viewport center coordinates
 */
async function getViewportCenter() {
  const dims = await getViewportDimensions();
  return { x: Math.round(dims.width / 2), y: Math.round(dims.height / 2) };
}

/**
 * Drag target to center then click center
 * @param {number} targetX - Source X coordinate (land to buy)
 * @param {number} targetY - Source Y coordinate (land to buy)
 * @param {number} duration - Duration in ms for the drag (default 1500)
 */
async function dragToCenterAndClick(targetX, targetY, duration = 700) {
  let page;
  try {
    page = getCurrentPage();
  } catch (_e) {
    page = api.getCurrentPage?.();
  }
  if (!page) {
    logger.warn("[dragToCenter] No page available");
    return;
  }

  const center = await getViewportCenter();
  const endX = center.x;
  const endY = center.y;

  logger.info(
    `[dragToCenter] Click hold at (${targetX}, ${targetY}), drag to center (${endX}, ${endY}), duration ${duration}ms`,
  );

  // Move to target and hold
  await page.mouse.move(targetX, targetY);
  await page.waitForTimeout(50);
  await page.mouse.down();
  await page.waitForTimeout(20);

  // Drag to center
  const steps = Math.max(3, Math.floor(duration / 10));
  await page.mouse.move(endX, endY, { steps });
  await page.waitForTimeout(20);

  // Release
  await page.mouse.up();
  await page.waitForTimeout(500);

  // Click center
  logger.info(`[dragToCenter] Clicking at center (${endX}, ${endY})`);
  await page.mouse.click(endX, endY);
}
let requestCount = 0;
let stateOrder = [];

const STATES = {
  A: { name: "A", desc: "Grey Free land", action: "buyLand" },
  B: { name: "B", desc: "Enemy Territory", action: "attackEnemy" },
  C: { name: "C", desc: "Own Territory", action: "buildOnEmpty" },
  D: { name: "D", desc: "Building Menu", action: "upgradeOrClose" },
  E: { name: "E", desc: "Build Options", action: "selectBuilding" },
  F: { name: "F", desc: "Go Home", action: "goHome" },
};

export { STATES };

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getNextState() {
  requestCount++;
  if (requestCount % 5 === 0) {
    stateOrder = shuffleArray(Object.keys(STATES));
    logger.info(
      `[StateMachine] Randomized state order: ${stateOrder.join(" → ")}`,
    );
  }
  const stateKey = stateOrder[requestCount % stateOrder.length] || "A";
  return { key: stateKey, ...STATES[stateKey] };
}

export function stop() {
  shouldStop = true;
  isRunning = false;
  logger.info("Auto-play stop signal received");
}

export function isAutoPlaying() {
  return isRunning;
}

/**
 * Analyze current game state and determine which state to process
 * Uses modular prompt system from prompts/index.js
 */
export async function detectState() {
  logger.info(
    "[State Detection] Analyzing game state with modular prompt system...",
  );

  // Enable V-PREP for better LLM vision
  const state = await api.agent.captureState({
    screenshot: true,
    axTree: false,
    vprep: true,
    vprepConfig: api.vprep?.presets?.OWB_GAME || {
      targetWidth: 640,
      contrast: 1.25,
      quality: 78,
    },
  });

  const screenshotSize = state.screenshot ? state.screenshot.length : 0;
  const base64SizeKB = Math.round(screenshotSize / 1024);
  logger.info(
    `[LLM Image] Base64 length: ${screenshotSize} chars (~${base64SizeKB} KB)`,
  );

  // Get viewport dimensions for context
  const viewport = await getViewportDimensions();
  const vprepWidth = state.vprepStats?.outputDimensions?.width || 640;
  const vprepHeight = state.vprepStats?.outputDimensions?.height || 360;

  logger.info(
    `[State Detection] Viewport: ${viewport.width}x${viewport.height}, V-PREP: ${vprepWidth}x${vprepHeight}`,
  );

  // Use modular prompt system - iterate through each state's detection prompt
  const stateKeys = ["A", "B", "C", "D", "E"];
  let bestMatch = { state: "A", confidence: 0, reason: "Default fallback" };

  try {
    const owbClient = await getOwbLlmClient();

    // Try each state detection prompt
    for (const stateKey of stateKeys) {
      try {
        const promptPackage = getStatePrompt(stateKey, {
          vprepWidth,
          vprepHeight,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          mode: "detection",
        });

        const messages = [
          ...promptPackage.messages,
          {
            role: "user",
            content: [
              { type: "text", text: promptPackage.messages[1].content },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${state.screenshot}`,
                },
              },
            ],
          },
        ];

        // Replace system message with proper content
        messages[0] = {
          role: "system",
          content: promptPackage.messages[0].content,
        };

        const result = await owbClient.generateCompletion(messages);
        const parsed = parseLLMJson(result);

        if (parsed && parsed.confidence > bestMatch.confidence) {
          bestMatch = {
            state: stateKey,
            confidence: parsed.confidence,
            reason: parsed.reason || `Detected as State ${stateKey}`,
          };
        }

        // If high confidence, stop searching
        if (bestMatch.confidence >= 0.9) {
          break;
        }
      } catch (stateErr) {
        logger.warn(
          `[State Detection] State ${stateKey} detection error: ${stateErr.message}`,
        );
      }
    }

    // Fallback: If no state detected with high confidence, use the original single-prompt approach
    if (bestMatch.confidence < 0.5) {
      logger.info(
        "[State Detection] Low confidence, using fallback detection...",
      );

      const fallbackPrompt = `<INSTRUCTIONS>
You are a territory game state detector. Analyze the provided image and return EXACTLY one JSON object.

CRITICAL RULES:
1. Output RAW JSON only - no markdown code blocks, no explanations
2. Always return a valid JSON object

<CONTEXT>
Image dimensions: ${viewport.width}x${viewport.height} pixels
</CONTEXT>

<DETECTION_RULES>
1. State A: GREY land with price numbers visible
2. State B: RED enemy territory
3. State C: BLUE owned territory without menus
4. State D: Large white hex with upgrade cost (e.g., "2400")
5. State E: Three hexagonal building options with costs (300, 200, 500)

<OUTPUT_FORMAT>
{"state": "A|B|C|D|E", "confidence": 0.0-1.0, "reason": "explanation"}
</OUTPUT_FORMAT>`;

      const fallbackMessages = [
        {
          role: "system",
          content:
            "You are a game state detector for a hexagonal territory game.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: fallbackPrompt },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${state.screenshot}` },
            },
          ],
        },
      ];

      const fallbackResult =
        await owbClient.generateCompletion(fallbackMessages);
      const fallbackParsed = detectStateFromResponse(fallbackResult);

      bestMatch = {
        state: fallbackParsed.state,
        confidence: fallbackParsed.confidence,
        reason: fallbackParsed.reason,
      };
    }

    const detected = bestMatch.state;
    logger.info(
      `[State Detection] Detected State: ${detected} (${STATES[detected]?.desc}) - Confidence: ${(bestMatch.confidence * 100).toFixed(1)}%`,
    );

    return {
      key: detected,
      ...STATES[detected],
      analysis: bestMatch,
    };
  } catch (e) {
    logger.error(`[State Detection] Failed: ${e.message}`);
    return {
      key: "A",
      ...STATES.A,
      analysis: { state: "A", confidence: 0, reason: "Error fallback" },
    };
  }
}

/**
 * Run state action: capture screenshot, ask LLM, drag and click
 */
async function _runStateAction(prompt, stateName) {
  const viewport = await getViewportDimensions();
  logger.info(`[${stateName}] Viewport: ${viewport.width}x${viewport.height}`);

  // Enable V-PREP for better LLM vision
  const state = await api.agent.captureState({
    screenshot: true,
    vprep: true,
    vprepConfig: api.vprep?.presets?.OWB_GAME || {
      targetWidth: 1024,
      contrast: 1.25,
      quality: 78,
    },
  });
  const screenshotBase64 = state.screenshot;

  // Improved prompt with XML delimiters and negative constraints
  const messages = [
    { role: "system", content: "You are a game coordinate detector." },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `${prompt}\n\nIMPORTANT: All coordinates must be within ${viewport.width}x${viewport.height} pixels.`,
        },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` },
        },
      ],
    },
  ];

  let result = { x: 0, y: 0, success: false };

  try {
    // Use OWB-specific LLM client with higher token limits for vision tasks
    const owbClient = await getOwbLlmClient();
    const llmResult = await owbClient.generateCompletion(messages);
    logger.info(`[${stateName}] LLM result: ${JSON.stringify(llmResult)}`);

    let x, y;
    if (llmResult?.x !== undefined && llmResult?.y !== undefined) {
      x = llmResult.x;
      y = llmResult.y;
    } else if (Array.isArray(llmResult) && llmResult.length > 0) {
      x = llmResult[0].x;
      y = llmResult[0].y;
    } else if (
      llmResult?.coordinates &&
      Array.isArray(llmResult.coordinates) &&
      llmResult.coordinates.length > 0
    ) {
      x = llmResult.coordinates[0].x;
      y = llmResult.coordinates[0].y;
    }

    // Validate coordinates against actual viewport bounds
    if (
      x !== undefined &&
      y !== undefined &&
      typeof x === "number" &&
      typeof y === "number" &&
      x >= 10 &&
      x <= viewport.width - 10 &&
      y >= 10 &&
      y <= viewport.height - 10
    ) {
      result.x = x;
      result.y = y;
      result.success = true;

      logger.info(`[${stateName}] Valid coords: (${x}, ${y}), clicking...`);
      await dragToCenterAndClick(x, y);
      await debugScreenshot(
        `after-${stateName.toLowerCase().replace(" ", "")}`,
      );
    } else {
      logger.warn(
        `[${stateName}] Invalid coordinates: (${x}, ${y}) - must be within viewport ${viewport.width}x${viewport.height}`,
      );
    }
  } catch (e) {
    logger.error(`[${stateName}] Failed: ${e.message}`);
  }

  return result;
}

/**
 * Debug: Take screenshot for debugging
 * Format: debug-{type}-{label}-{YYYY-MM-DD-HH-MM-SS}.png
 * Example: debug-stateA-before-2026-03-15-13-52-11.png
 * @param {string} label - Debug label for filename
 * @param {string} [base64] - Optional V-PREP processed base64 image to save (saves processed version)
 */
export async function debugScreenshot(label, base64 = null) {
  const now = new Date();
  const date = now.toISOString().split("T")[0]; // 2026-03-15
  const time = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // 13-52-11
  const filename = `logs/debug-${label}-${date}-${time}.png`;
  try {
    if (base64) {
      // Save V-PREP processed image directly from base64
      const fs = await import("fs/promises");
      const buffer = Buffer.from(base64, "base64");
      await fs.writeFile(filename, buffer);
      logger.info(
        `[DEBUG] V-PREP processed image saved: ${filename} (${Math.round(buffer.length / 1024)} KB)`,
      );
    } else {
      // Fallback: capture raw screenshot
      await api.screenshot({ path: filename });
      logger.info(`[DEBUG] Screenshot saved: ${filename}`);
    }
  } catch (e) {
    logger.warn(`[DEBUG] Screenshot failed: ${e.message}`);
  }
}

/**
 * State A: Grey Free land - drag from center then click
 */
async function executeStateA() {
  logger.info(`[State A] Buy Unowned/Grey land`);
  const DEBUG = process.env.DEBUG === "true";

  const viewport = await getViewportDimensions();
  logger.info(`[State A] Viewport: ${viewport.width}x${viewport.height}`);

  // Detect canvas position if present
  let canvasOffset = { x: 0, y: 0 };
  try {
    const page = getCurrentPage();
    if (page) {
      const canvasInfo = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          };
        }
        return null;
      });
      if (canvasInfo) {
        canvasOffset = { x: canvasInfo.x, y: canvasInfo.y };
        logger.info(
          `[State A] Canvas detected at (${canvasInfo.x}, ${canvasInfo.y}), size: ${canvasInfo.width}x${canvasInfo.height}`,
        );
      }
    }
  } catch (e) {
    logger.debug("[State A] Could not detect canvas position:", e.message);
  }

  // 1. Capture State with V-PREP enabled
  // Calculate V-PREP dimensions to ensure max 2.0x scaling
  const MAX_SCALE = 2.0;
  const vprepTargetWidth = Math.min(
    1280,
    Math.ceil(viewport.width / MAX_SCALE),
  );
  const vprepTargetHeight = Math.min(
    720,
    Math.ceil(viewport.height / MAX_SCALE),
  );

  const vprepConfig = {
    ...(api.vprep?.presets?.OWB_GAME || { contrast: 1.25, quality: 78 }),
    targetWidth: vprepTargetWidth,
    targetHeight: vprepTargetHeight,
  };
  logger.info(
    `[State A] V-PREP config: ${vprepTargetWidth}x${vprepTargetHeight} (max scale: ${MAX_SCALE}x)`,
  );

  console.time("[ACTION_TIMER] Capture State");
  const state = await api.agent.captureState({
    screenshot: true,
    vprep: true,
    vprepConfig,
  });
  const screenshotBase64 = state.screenshot;
  console.timeEnd("[ACTION_TIMER] Capture State");

  // Debug: Save V-PREP processed image (what LLM sees)
  if (DEBUG) await debugScreenshot("before-stateA", screenshotBase64);

  // Calculate V-PREP scale factors using ACTUAL output dimensions (separate X and Y for different aspect ratios)
  // Use dynamically calculated dimensions as fallback
  const vprepOutputWidth =
    state.vprepStats?.outputDimensions?.width || vprepTargetWidth;
  const vprepOutputHeight =
    state.vprepStats?.outputDimensions?.height || vprepTargetHeight;
  const vprepScaleFactorX = viewport.width / vprepOutputWidth;
  const vprepScaleFactorY = viewport.height / vprepOutputHeight;
  logger.info(
    `[V-PREP] Output: ${vprepOutputWidth}x${vprepOutputHeight}, Viewport: ${viewport.width}x${viewport.height}, Scale factors: X=${vprepScaleFactorX.toFixed(3)}, Y=${vprepScaleFactorY.toFixed(3)}`,
  );

  if (!screenshotBase64) {
    throw new Error("State capture failed: No screenshot data returned.");
  }

  // Use same V-PREP dimensions for the prompt
  const vprepWidth = vprepOutputWidth;
  const vprepHeight = vprepOutputHeight;

  // 2. Build visual-first prompt - accurate to posterized image
  const prompt = `
╔══════════════════════════════════════════════════════════════════════════════╗
║  🎯 FIND GREY TILES WITH NUMBERS THAT TOUCH YOUR BLUE TERRITORY             ║
╚══════════════════════════════════════════════════════════════════════════════╝

IMAGE SIZE: ${vprepWidth}x${vprepHeight} pixels (posterized to 64 colors for clarity)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<COLOR KEY - THESE ARE THE ONLY 3 COLORS THAT MATTER>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔵 BLUE AREAS = Your territory (FORBIDDEN - never click)
   - May appear as solid blue or dark blue after posterization

⬜ GREY AREAS = Neutral/unowned land
   - WITH white number = YOUR TARGET (purchasable!)
   - WITHOUT number = Skip (not purchasable)

🟥 RED/PINK AREAS = Enemy territory (skip)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<STEP 1: FIND GREY TILES WITH WHITE NUMBERS>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ VALID TARGET:
- Background: GREY (not blue, not red)
- Has WHITE number: "50", "100", "200", "400", "1200", "Free"
- ANY edge touches a BLUE area (your territory)

❌ SKIP:
- Grey tile WITHOUT number (not purchasable)
- Grey tile NOT touching blue (not connected to your territory)
- Any BLUE or RED tile

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<STEP 2: RETURN COORDINATES OF WHITE NUMBER CENTERS>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find ALL grey tiles with numbers that touch blue territory.
Return the CENTER of each WHITE NUMBER TEXT.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<OUTPUT FORMAT>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return targets as JSON array:

{"targets": [{"x": <int>, "y": <int>, "price": "<number>"}, ...], "found": true}

If NO valid targets: {"targets": [], "found": false}

COORDINATE RULES:
- x, y = CENTER of the WHITE NUMBER (not tile center)
- Must be integers within ${vprepWidth}x${vprepHeight}
- Valid range: x 20 to ${vprepWidth - 20}, y 20 to ${vprepHeight - 20}

╔══════════════════════════════════════════════════════════════════════════════╗
║  REMINDER: GREY + WHITE NUMBER + TOUCHES BLUE = CLICK                        ║
║            BLUE = FORBIDDEN | RED = SKIP                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
`.trim();

  // 3. Orchestrate LLM Call with optimized prompt
  const owbClient = await getOwbLlmClient();
  console.log(
    `[AGENT_STATE] Dispatching prompt to ${owbClient.config.model} vision model...`,
  );
  console.time("[ACTION_TIMER] LLM Inference");

  const messages = [
    {
      role: "system",
      content: `You are a hex game coordinate detector for a territory conquest game.

IMAGE NOTE: Image is posterized (64 colors) for clarity. Colors are simplified but preserved.

COLOR RULES:
- BLUE = Your territory (FORBIDDEN - never click)
- GREY with WHITE number = Valid target (purchasable land)
- RED/PINK = Enemy territory (skip)

TASK: Find all GREY tiles with WHITE numbers that ADJOIN BLUE territory.
Return the CENTER coordinates of each WHITE NUMBER TEXT.

Image is ${vprepWidth}x${vprepHeight} pixels.`,
    },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` },
        },
      ],
    },
  ];

  let result = { x: 0, y: 0, success: false };

  try {
    const llmResult = await owbClient.generateCompletion(messages);
    logger.info(`[State A] LLM result: ${JSON.stringify(llmResult)}`);

    // 4. Parse coordinates - support both single target and multiple targets
    let targets = [];

    // Check for new format: {targets: [...], found: true}
    if (llmResult?.targets && Array.isArray(llmResult.targets)) {
      targets = llmResult.targets;
    }
    // Check for single target format: {x, y, found}
    else if (llmResult?.x !== undefined && llmResult?.y !== undefined) {
      targets = [{ x: llmResult.x, y: llmResult.y, price: llmResult.price }];
    }
    // Check for array format: [{x, y}, ...]
    else if (Array.isArray(llmResult) && llmResult.length > 0) {
      targets = llmResult;
    }
    // Check for coordinates array: {coordinates: [{x, y}, ...]}
    else if (llmResult?.coordinates && Array.isArray(llmResult.coordinates)) {
      targets = llmResult.coordinates;
    }

    logger.info(`[State A] Found ${targets.length} target(s)`);

    /**
     * Validate that a pixel coordinate is NOT on black (masked blue) or blue
     * Returns true if safe to click (grey tile), false if black/blue detected
     */
    async function validateNotForbidden(x, y) {
      try {
        const page = getCurrentPage();
        if (!page) return true; // Can't validate without page

        const pixelColor = await page.evaluate(
          ([px, py]) => {
            const canvas = document.querySelector("canvas");
            if (canvas) {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                const pixel = ctx.getImageData(px, py, 1, 1).data;
                return { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] };
              }
            }
            return null;
          },
          [x, y],
        );

        if (!pixelColor) return true; // Can't get pixel, assume safe

        const { r, g, b } = pixelColor;

        // Check for BLACK (masked blue) - all channels < 30
        const isBlack = r < 30 && g < 30 && b < 30;

        // Check for BLUE (if not masked) - B > R*1.3 && B > G*1.2
        const isBlue = b > 100 && b > r * 1.3 && b > g * 1.2;

        if (isBlack) {
          logger.warn(
            `[State A] ❌ BLACK (masked blue) at (${x}, ${y}): RGB(${r},${g},${b}) - FORBIDDEN`,
          );
          return false;
        }

        if (isBlue) {
          logger.warn(
            `[State A] ❌ BLUE at (${x}, ${y}): RGB(${r},${g},${b}) - FORBIDDEN`,
          );
          return false;
        }

        logger.debug(`[State A] ✓ Safe at (${x}, ${y}): RGB(${r},${g},${b})`);
        return true;
      } catch (e) {
        logger.debug(`[State A] Color validation error: ${e.message}`);
        return true; // On error, allow click
      }
    }

    // Scale and validate each target
    const validTargets = [];
    for (const target of targets) {
      let x = target.x;
      let y = target.y;

      if (x !== undefined && y !== undefined) {
        const origX = x,
          origY = y;
        // Scale coordinates from V-PREP space to browser space
        if (vprepScaleFactorX !== 1.0 || vprepScaleFactorY !== 1.0) {
          x = Math.round(x * vprepScaleFactorX);
          y = Math.round(y * vprepScaleFactorY);
        }

        // Add canvas offset if detected
        x = x + canvasOffset.x;
        y = y + canvasOffset.y;

        logger.info(
          `[State A] Coords: (${origX}, ${origY}) -> scaled (${x - canvasOffset.x}, ${y - canvasOffset.y}) -> final (${x}, ${y})`,
        );

        // Validate coordinates are within viewport bounds
        if (
          typeof x !== "number" ||
          typeof y !== "number" ||
          x < 10 ||
          x > viewport.width - 10 ||
          y < 10 ||
          y > viewport.height - 10
        ) {
          logger.warn(`[State A] Skipping out-of-bounds coords: (${x}, ${y})`);
          continue;
        }

        // CRITICAL: Validate NOT on black/blue before adding to valid targets
        const isSafe = await validateNotForbidden(x, y);
        if (!isSafe) {
          logger.warn(`[State A] Skipping FORBIDDEN target at (${x}, ${y})`);
          continue;
        }

        validTargets.push({ x, y, price: target.price });
      }
    }

    // Click each valid target
    if (validTargets.length > 0) {
      logger.info(`[State A] Clicking ${validTargets.length} target(s)...`);

      for (let i = 0; i < validTargets.length; i++) {
        const { x, y, price } = validTargets[i];
        logger.info(
          `[State A] Target ${i + 1}/${validTargets.length}: (${x}, ${y}) price=${price || "?"}`,
        );

        // Click target to open popup, then click below to select action
        await api.clickAt(x, y, { speed: "fast" });
        // Small delay between targets
        if (i < validTargets.length - 1) {
          await api.wait(200);
        }
      }

      // Wait for game to process the actions
      logger.info(`[State A] Waiting for actions to complete...`);
      await api.wait(100);

      // Take verification screenshot only in debug mode (save V-PREP processed version)
      if (DEBUG)
        await debugScreenshot(
          `state-a-verified-${Date.now()}`,
          screenshotBase64,
        );

      // Mark as success
      result.x = validTargets[0].x;
      result.y = validTargets[0].y;
      result.targets = validTargets;
      result.success = true;
      result.method = "direct-click";
      logger.info(
        `[State A] Action completed successfully - clicked ${validTargets.length} target(s)`,
      );
    } else {
      logger.warn(`[State A] No valid targets found`);
    }
  } catch (e) {
    logger.error(`[State A] Failed: ${e.message}`);
  }

  return result;
}

/**
 * Execute the appropriate action based on detected state
 * Routes to the correct state handler using modular prompt system
 */
export async function executeState(stateInfo = null) {
  const state = stateInfo || getNextState();
  logger.info(`>>> Executing State ${state.name}: ${state.desc}`);

  // Enable visual debug overlay if DEBUG=true
  if (
    process.env.DEBUG === "true" &&
    api.visualDebug &&
    typeof api.visualDebug.enable === "function"
  ) {
    if (!api.visualDebug.isEnabled()) {
      await api.visualDebug.enable();
    }
  }

  // Route to appropriate state handler
  switch (state.key) {
    case "A":
      return await executeStateA();
    case "B":
      return await executeStateB();
    case "C":
      return await executeStateC();
    case "D":
      return await executeStateD();
    case "E":
      return await executeStateE();
    case "F":
      return await executeStateF();
    default:
      logger.warn(
        `[executeState] Unknown state key: ${state.key}, defaulting to State A`,
      );
      return await executeStateA();
  }
}

/**
 * State B: Enemy Territory - Attack red hexes adjacent to blue
 */
async function executeStateB() {
  logger.info(`[State B] Attack Enemy Territory`);

  const viewport = await getViewportDimensions();
  logger.info(`[State B] Viewport: ${viewport.width}x${viewport.height}`);

  // Capture state with V-PREP
  const state = await api.agent.captureState({
    screenshot: true,
    vprep: true,
    vprepConfig: api.vprep?.presets?.OWB_GAME || {
      targetWidth: 640,
      contrast: 1.25,
      quality: 78,
    },
  });

  // Debug: Save V-PREP processed image (what LLM sees)
  await debugScreenshot("before-stateB", state.screenshot);

  const vprepWidth = state.vprepStats?.outputDimensions?.width || 640;
  const vprepHeight = state.vprepStats?.outputDimensions?.height || 360;
  const vprepScaleFactor = viewport.width / vprepWidth;

  // Get prompt from modular system
  const promptPackage = getStatePrompt("B", {
    vprepWidth,
    vprepHeight,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    mode: "action",
  });

  const messages = [
    { role: "system", content: promptPackage.messages[0].content },
    {
      role: "user",
      content: [
        { type: "text", text: promptPackage.messages[1].content },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${state.screenshot}` },
        },
      ],
    },
  ];

  let result = { x: 0, y: 0, success: false };

  try {
    const owbClient = await getOwbLlmClient();
    const llmResult = await owbClient.generateCompletion(messages);
    logger.info(`[State B] LLM result: ${JSON.stringify(llmResult)}`);

    const parsed = parseCoordinates(llmResult);
    if (parsed) {
      let x = parsed.x;
      let y = parsed.y;

      // Scale coordinates
      if (vprepScaleFactor !== 1.0) {
        x = Math.round(x * vprepScaleFactor);
        y = Math.round(y * vprepScaleFactor);
      }

      // Validate and execute
      if (
        x >= 10 &&
        x <= viewport.width - 10 &&
        y >= 10 &&
        y <= viewport.height - 10
      ) {
        result.x = x;
        result.y = y;

        logger.info(`[State B] Valid coords: (${x}, ${y}), attacking...`);
        await dragToCenterAndClick(x, y);
        await api.wait(1000);
        await debugScreenshot(
          `state-b-verified-${Date.now()}`,
          state.screenshot,
        );

        result.success = true;
        logger.info(`[State B] Attack completed`);
      }
    }
  } catch (e) {
    logger.error(`[State B] Failed: ${e.message}`);
  }

  return result;
}

/**
 * State C: Own Territory - Build on empty blue hex
 */
async function executeStateC() {
  logger.info(`[State C] Build on Own Territory`);

  const viewport = await getViewportDimensions();
  logger.info(`[State C] Viewport: ${viewport.width}x${viewport.height}`);

  // Capture state with V-PREP
  const state = await api.agent.captureState({
    screenshot: true,
    vprep: true,
    vprepConfig: api.vprep?.presets?.OWB_GAME || {
      targetWidth: 640,
      contrast: 1.25,
      quality: 78,
    },
  });

  // Debug: Save V-PREP processed image (what LLM sees)
  await debugScreenshot("before-stateC", state.screenshot);

  const vprepWidth = state.vprepStats?.outputDimensions?.width || 640;
  const vprepHeight = state.vprepStats?.outputDimensions?.height || 360;
  const vprepScaleFactor = viewport.width / vprepWidth;

  // Get prompt from modular system
  const promptPackage = getStatePrompt("C", {
    vprepWidth,
    vprepHeight,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    mode: "action",
  });

  const messages = [
    { role: "system", content: promptPackage.messages[0].content },
    {
      role: "user",
      content: [
        { type: "text", text: promptPackage.messages[1].content },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${state.screenshot}` },
        },
      ],
    },
  ];

  let result = { x: 0, y: 0, success: false };

  try {
    const owbClient = await getOwbLlmClient();
    const llmResult = await owbClient.generateCompletion(messages);
    logger.info(`[State C] LLM result: ${JSON.stringify(llmResult)}`);

    const parsed = parseCoordinates(llmResult);
    if (parsed) {
      let x = parsed.x;
      let y = parsed.y;

      // Scale coordinates
      if (vprepScaleFactor !== 1.0) {
        x = Math.round(x * vprepScaleFactor);
        y = Math.round(y * vprepScaleFactor);
      }

      // Validate and execute
      if (
        x >= 10 &&
        x <= viewport.width - 10 &&
        y >= 10 &&
        y <= viewport.height - 10
      ) {
        result.x = x;
        result.y = y;

        logger.info(
          `[State C] Valid coords: (${x}, ${y}), clicking to open build menu...`,
        );
        await api.clickAt(x, y, { speed: "fast" });
        await api.wait(1000);
        await debugScreenshot(
          `state-c-verified-${Date.now()}`,
          state.screenshot,
        );

        result.success = true;
        logger.info(`[State C] Build menu opened`);
      }
    }
  } catch (e) {
    logger.error(`[State C] Failed: ${e.message}`);
  }

  return result;
}

/**
 * State D: Building Menu - Upgrade or close menu
 */
async function executeStateD() {
  logger.info(`[State D] Building Menu - Upgrade or Close`);

  const viewport = await getViewportDimensions();
  logger.info(`[State D] Viewport: ${viewport.width}x${viewport.height}`);

  // Capture state with V-PREP
  const state = await api.agent.captureState({
    screenshot: true,
    vprep: true,
    vprepConfig: api.vprep?.presets?.OWB_GAME || {
      targetWidth: 640,
      contrast: 1.25,
      quality: 78,
    },
  });

  // Debug: Save V-PREP processed image (what LLM sees)
  await debugScreenshot("before-stateD", state.screenshot);

  const vprepWidth = state.vprepStats?.outputDimensions?.width || 640;
  const vprepHeight = state.vprepStats?.outputDimensions?.height || 360;
  const vprepScaleFactor = viewport.width / vprepWidth;

  // Get prompt from modular system (with gold info if available)
  const promptPackage = getStatePrompt("D", {
    vprepWidth,
    vprepHeight,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    gold: 180, // TODO: Get actual gold from game state
    mode: "action",
  });

  const messages = [
    { role: "system", content: promptPackage.messages[0].content },
    {
      role: "user",
      content: [
        { type: "text", text: promptPackage.messages[1].content },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${state.screenshot}` },
        },
      ],
    },
  ];

  let result = { x: 0, y: 0, success: false, action: null };

  try {
    const owbClient = await getOwbLlmClient();
    const llmResult = await owbClient.generateCompletion(messages);
    logger.info(`[State D] LLM result: ${JSON.stringify(llmResult)}`);

    const parsed = parseLLMJson(llmResult);
    if (parsed && parsed.found !== false) {
      let x = parsed.x;
      let y = parsed.y;

      // Scale coordinates
      if (vprepScaleFactor !== 1.0) {
        x = Math.round(x * vprepScaleFactor);
        y = Math.round(y * vprepScaleFactor);
      }

      // Validate and execute
      if (
        x >= 10 &&
        x <= viewport.width - 10 &&
        y >= 10 &&
        y <= viewport.height - 10
      ) {
        result.x = x;
        result.y = y;
        result.action = parsed.action;

        logger.info(
          `[State D] Valid coords: (${x}, ${y}), action: ${parsed.action}...`,
        );
        await api.clickAt(x, y, { speed: "fast" });
        await api.wait(1000);
        await debugScreenshot(
          `state-d-verified-${Date.now()}`,
          state.screenshot,
        );

        result.success = true;
        logger.info(`[State D] ${parsed.action} completed`);
      }
    }
  } catch (e) {
    logger.error(`[State D] Failed: ${e.message}`);
  }

  return result;
}

/**
 * State E: Build Options - Select building from three choices
 */
async function executeStateE() {
  logger.info(`[State E] Build Options - Select Building`);

  const viewport = await getViewportDimensions();
  logger.info(`[State E] Viewport: ${viewport.width}x${viewport.height}`);

  // Capture state with V-PREP
  const state = await api.agent.captureState({
    screenshot: true,
    vprep: true,
    vprepConfig: api.vprep?.presets?.OWB_GAME || {
      targetWidth: 640,
      contrast: 1.25,
      quality: 78,
    },
  });

  // Debug: Save V-PREP processed image (what LLM sees)
  await debugScreenshot("before-stateE", state.screenshot);

  const vprepWidth = state.vprepStats?.outputDimensions?.width || 640;
  const vprepHeight = state.vprepStats?.outputDimensions?.height || 360;
  const vprepScaleFactor = viewport.width / vprepWidth;

  // Get prompt from modular system
  const promptPackage = getStatePrompt("E", {
    vprepWidth,
    vprepHeight,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    gold: 180, // TODO: Get actual gold from game state
    strategy: "balanced",
    mode: "action",
  });

  const messages = [
    { role: "system", content: promptPackage.messages[0].content },
    {
      role: "user",
      content: [
        { type: "text", text: promptPackage.messages[1].content },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${state.screenshot}` },
        },
      ],
    },
  ];

  let result = { x: 0, y: 0, success: false, building: null };

  try {
    const owbClient = await getOwbLlmClient();
    const llmResult = await owbClient.generateCompletion(messages);
    logger.info(`[State E] LLM result: ${JSON.stringify(llmResult)}`);

    const parsed = parseLLMJson(llmResult);
    if (parsed && parsed.found !== false) {
      let x = parsed.x;
      let y = parsed.y;

      // Scale coordinates
      if (vprepScaleFactor !== 1.0) {
        x = Math.round(x * vprepScaleFactor);
        y = Math.round(y * vprepScaleFactor);
      }

      // Validate and execute
      if (
        x >= 10 &&
        x <= viewport.width - 10 &&
        y >= 10 &&
        y <= viewport.height - 10
      ) {
        result.x = x;
        result.y = y;
        result.building = parsed.building;

        logger.info(
          `[State E] Valid coords: (${x}, ${y}), selecting ${parsed.building}...`,
        );
        await api.clickAt(x, y, { speed: "fast" });
        await api.wait(1000);
        await debugScreenshot(
          `state-e-verified-${Date.now()}`,
          state.screenshot,
        );

        result.success = true;
        logger.info(`[State E] Selected ${parsed.building} building`);
      }
    }
  } catch (e) {
    logger.error(`[State E] Failed: ${e.message}`);
  }

  return result;
}

/**
 * State F: Go Home - Scroll down and click home icon
 */
async function executeStateF() {
  logger.info(`[State F] Go Home`);
  await debugScreenshot("before-stateF");

  const viewport = await getViewportDimensions();
  logger.info(`[State F] Viewport: ${viewport.width}x${viewport.height}`);

  const result = {
    success: false,
    error: null,
  };

  try {
    const page = getCurrentPage();
    if (!page) {
      throw new Error("No page available");
    }

    // Step 1: Scroll down using mouse wheel events on canvas (Unity games need this)
    logger.info("[State F] Scrolling down via canvas wheel events...");

    // Send multiple scroll events to simulate scrolling 2000px
    // Unity typically scrolls ~100px per wheel delta
    const scrollSteps = 20; // 20 * 100 = 2000px
    const scrollDelta = 100;

    for (let i = 0; i < scrollSteps; i++) {
      await page.evaluate((delta) => {
        const canvas = document.querySelector("canvas");
        const _target = canvas || document;
        const event = new WheelEvent("wheel", {
          deltaY: delta,
          deltaMode: 0, // pixel mode
          bubbles: true,
          cancelable: true,
          view: window,
        });
        (canvas || document.body).dispatchEvent(event);
      }, scrollDelta);
      await api.wait(50); // Small delay between scrolls for smooth effect
    }

    await api.wait(1000); // Wait for scroll to complete

    // Step 2: Click blue home icon in bottom-left corner
    // Home icon is typically at bottom-left: x=50, y=viewport.height-50
    const homeX = 30;
    const homeY = viewport.height - 30;

    logger.info(`[State F] Clicking home icon at (${homeX}, ${homeY})...`);
    await api.clickAt(homeX, homeY, { speed: "fast" });
    await api.wait(1000);

    // Step 3: Scroll down a little after clicking home
    logger.info("[State F] Scrolling down a little after home click...");
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        const event = new WheelEvent("wheel", {
          deltaY: 20,
          deltaMode: 0,
          bubbles: true,
          cancelable: true,
          view: window,
        });
        (canvas || document.body).dispatchEvent(event);
      });
      await api.wait(50);
    }
    await api.wait(500);

    await debugScreenshot("stateF-after-click");

    result.success = true;
    logger.info(`[State F] Home navigation completed`);
  } catch (e) {
    logger.error(`[State F] Failed: ${e.message}`);
    result.error = e.message;
  }

  return result;
}

/**
 * Buy land/territory - State 1: Select Territory
 * @param {number} count - Number of lands to buy
 * @returns {Promise<object>}
 */
export async function buyLand(count = 1) {
  logger.info(`State 1: Select Territory - Buying ${count} land(s)`);

  const result = await api.gameAgent.run(
    `<INSTRUCTIONS>
You are a territory expansion agent. Your goal is to purchase GREY unowned land adjacent to your BLUE territory.

CRITICAL RULES:
1. Use ONLY clickAt actions with exact x,y coordinates
2. NEVER use CSS selectors - this is a CANVAS game
3. If no valid target exists, output {"action": "done", "rationale": "No valid target found"}
4. Coordinates must be within viewport bounds
</INSTRUCTIONS>

<CONTEXT>
Game Type: Territory Expansion Strategy (Canvas-based)
You own BLUE territory
GREY land is unowned and purchasable
RED land is enemy territory (do not target)
</CONTEXT>

<OBJECTIVE>
Find and click on GREY land squares with "Free" text that are NEXT TO your BLUE territory.
</OBJECTIVE>

<OUTPUT_FORMAT>
Return ONLY a JSON object or array of JSON objects:
{"action": "clickAt", "x": <integer>, "y": <integer>, "rationale": "<explanation>"}

If no valid target exists, return:
{"action": "done", "rationale": "No valid GREY land found"}
</OUTPUT_FORMAT>`,
    { maxSteps: 10, stepDelay: 500, stuckDetection: true, useAXTree: false },
  );

  return result;
}

/**
 * Build a building on owned land - State 2: Build/Upgrade Menu
 * @param {string} buildingType - Building type (longrange, melee, healer)
 * @param {number} count - Number of buildings
 * @returns {Promise<object>}
 */
export async function buildBuilding(buildingType, count = 1) {
  const building = GAME_MECHANICS.buildings[buildingType];
  const cost = BUILDING_COSTS[buildingType];

  logger.info(
    `State 2: Build/Upgrade Menu - Building ${count} ${building.name}(s) - cost: ${cost} gold`,
  );

  const result = await api.gameAgent.run(
    `<INSTRUCTIONS>
You are a building placement agent. Your goal is to build ${building.name} structures on empty BLUE territory.

CRITICAL RULES:
1. Use ONLY clickAt actions with exact x,y coordinates
2. NEVER use CSS selectors - this is a CANVAS game
3. If no empty BLUE hex is found, output {"action": "done", "rationale": "No empty hex found"}
4. Coordinates must be within viewport bounds
5. Repeat ${count} times if you have enough gold (${cost} each)
</INSTRUCTIONS>

<CONTEXT>
Game Type: Territory Expansion Strategy (Canvas-based)
Building: ${building.name}
Cost: ${cost} gold per building
You own BLUE territory
Empty BLUE hexes are available for building
</CONTEXT>

<OBJECTIVE>
1. Click the "${building.name}" building icon at the bottom menu
2. Scan the map for an EMPTY BLUE hex in your territory
3. Click the exact coordinates of that empty blue hex
</OBJECTIVE>

<OUTPUT_FORMAT>
Return ONLY a JSON object or array of JSON objects:
[
  {"action": "clickAt", "x": <integer>, "y": <integer>, "rationale": "<explanation>"},
  {"action": "wait", "value": "1000", "rationale": "Waiting for menu"},
  {"action": "clickAt", "x": <integer>, "y": <integer>, "rationale": "Clicking empty hex"}
]

If no empty BLUE hex is found, return:
{"action": "done", "rationale": "No empty BLUE hex found for building"}
</OUTPUT_FORMAT>`,
    { maxSteps: 10, stepDelay: 2000, stuckDetection: true, useAXTree: false },
  );

  return result;
}

/**
 * Upgrade a building - State 2: Build/Upgrade Menu
 * @param {string} buildingType - Building type to upgrade
 * @returns {Promise<object>}
 */
export async function upgradeBuilding(buildingType) {
  const building = GAME_MECHANICS.buildings[buildingType];

  logger.info(`State 2: Build/Upgrade Menu - Upgrading ${building.name}`);

  const result = await api.gameAgent.run(
    `<INSTRUCTIONS>
You are a building upgrade agent. Your goal is to upgrade an existing ${building.name} structure.

CRITICAL RULES:
1. Use ONLY clickAt actions with exact x,y coordinates
2. NEVER use CSS selectors - this is a CANVAS game
3. If no building or upgrade button is found, output {"action": "done", "rationale": "Building not found"}
4. Coordinates must be within viewport bounds
</INSTRUCTIONS>

<CONTEXT>
Game Type: Territory Expansion Strategy (Canvas-based)
Building: ${building.name}
You own BLUE territory
</CONTEXT>

<OBJECTIVE>
1. Scan your BLUE territory for an existing "${building.name}" building
2. Click its exact coordinates using clickAt to open its menu
3. Click the UPGRADE button that appears below it using clickAt
</OBJECTIVE>

<OUTPUT_FORMAT>
Return ONLY a JSON object or array of JSON objects:
[
  {"action": "clickAt", "x": <integer>, "y": <integer>, "rationale": "Select building"},
  {"action": "wait", "value": "1000", "rationale": "Wait for upgrade menu"},
  {"action": "clickAt", "x": <integer>, "y": <integer>, "rationale": "Click upgrade button"}
]

If no building or upgrade button is found, return:
{"action": "done", "rationale": "Building not found or upgrade unavailable"}
</OUTPUT_FORMAT>`,
    { maxSteps: 10, stepDelay: 2000, stuckDetection: true, useAXTree: false },
  );

  return result;
}

/**
 * Wait for gold
 * @param {number} minGold - Minimum gold to wait for
 * @returns {Promise<boolean>}
 */
export async function waitForGold(minGold = 100) {
  logger.info(`Waiting for ${minGold} gold...`);
  await api.wait(2000);
  return true;
}

/**
 * Gather gold (collect from buildings)
 * @returns {Promise<object>}
 */
export async function gatherGold() {
  logger.info("Collecting gold from buildings");

  const result = await api.gameAgent.run(
    `<INSTRUCTIONS>
You are a resource collector. Your goal is to collect gold from available sources.

CRITICAL RULES:
1. Use ONLY clickAt actions with exact x,y coordinates
2. NEVER use CSS selectors - this is a CANVAS game
3. If no gold icons are found, output {"action": "done", "rationale": "No gold found"}
4. Coordinates must be within viewport bounds
</INSTRUCTIONS>

<CONTEXT>
Game Type: Territory Expansion Strategy (Canvas-based)
You own BLUE territory
Gold icons appear as yellow/gold symbols on the map
</CONTEXT>

<OBJECTIVE>
Click on any gold icons or gold-generating buildings to collect gold.
</OBJECTIVE>

<OUTPUT_FORMAT>
Return ONLY a JSON object or array of JSON objects:
{"action": "clickAt", "x": <integer>, "y": <integer>, "rationale": "<explanation>"}

If no gold is found, return:
{"action": "done", "rationale": "No gold icons found"}
</OUTPUT_FORMAT>`,
    { maxSteps: 10, stepDelay: 500, stuckDetection: true, useAXTree: false },
  );

  return result;
}

/**
 * Run custom goal
 */
export async function runGoal(goal, options = {}) {
  logger.info(`Running: ${goal}`);

  return await api.gameAgent.run(goal, {
    maxSteps: options.maxSteps || 20,
    stepDelay: options.stepDelay || 500,
    stuckDetection: options.stuckDetection !== false,
    useAXTree: false,
  });
}

/**
 * Auto-play using state machine (randomized every 5 requests)
 */
export async function autoPlay(_strategyName = null, options = {}) {
  const config = {
    loopDelay: options.loopDelay || GAME_CONFIG.loopDelay,
    maxLoops: options.maxLoops || GAME_CONFIG.maxLoops,
  };

  logger.info(`=== Starting State Machine Auto-Play ===`);
  logger.info(
    `States: A=GreyFree, B=EnemyNoBuilding, C=BlueNoBuilding, D=OwnBlue, E=MenuBuildUpgrade`,
  );
  logger.info(`Randomizing order every 5 requests...`);

  isRunning = true;
  shouldStop = false;
  stateOrder = shuffleArray(Object.keys(STATES));

  let successCount = 0;
  let failCount = 0;

  for (let loop = 1; loop <= config.maxLoops && !shouldStop; loop++) {
    logger.info(`=== Loop ${loop}/${config.maxLoops} ===`);
    logger.info(`State order: ${stateOrder.join(" → ")}`);

    try {
      const stateInfo = await detectState();
      logger.info(`>>> Detected: State ${stateInfo.key} - ${stateInfo.desc}`);

      const result = await executeState(stateInfo);

      if (result?.success) {
        successCount++;
        logger.info(`✓ State ${stateInfo.key} completed`);
      } else {
        failCount++;
        logger.warn(`✗ State ${stateInfo.key} failed`);
      }
    } catch (error) {
      logger.error(`Loop error: ${error.message}`);
      failCount++;
    }

    if (loop < config.maxLoops && !shouldStop) {
      logger.info(`Waiting ${config.loopDelay}ms...`);
      await api.wait(config.loopDelay);
    }
  }

  isRunning = false;

  logger.info("=== Auto-Play Summary ===");
  logger.info(`Success: ${successCount}/${config.maxLoops}`);
  logger.info(`Failed: ${failCount}`);

  return {
    success: successCount > 0,
    loops: config.maxLoops,
    successCount,
    failCount,
  };
}

/**
 * Infinite auto-play using state machine
 */
export async function autoPlayInfinite(_strategyName = null, options = {}) {
  const config = {
    loopDelay: options.loopDelay || GAME_CONFIG.loopDelay,
  };

  logger.info(`=== Starting Infinite State Machine Auto-Play ===`);
  logger.info("Press Ctrl+C to stop");

  isRunning = true;
  shouldStop = false;
  stateOrder = shuffleArray(Object.keys(STATES));
  let loop = 0;

  while (!shouldStop) {
    loop++;
    logger.info(`=== Loop ${loop} ===`);

    try {
      const stateInfo = await detectState();
      logger.info(`>>> Detected: State ${stateInfo.key} - ${stateInfo.desc}`);

      await executeState(stateInfo);
    } catch (error) {
      logger.error(`Loop error: ${error.message}`);
    }

    if (!shouldStop) {
      logger.info(`Loop ${loop} complete. Waiting ${config.loopDelay}ms...`);
      await api.wait(config.loopDelay);
    }
  }

  logger.info(`Stopped after ${loop} loops`);
  isRunning = false;
}

// Aliases for compatibility
export async function buildStructure(name) {
  return await buildBuilding(name, 1);
}
export async function trainUnits(name, count) {
  return await buildBuilding(name, count);
}
export async function attack() {
  return await runGoal("Attack enemy buildings");
}
export async function gatherResources() {
  return await gatherGold();
}
export async function buildEconomy(count) {
  return await buyLand(count);
}
export async function trainArmy() {
  return await buildBuilding("defensive", 5);
}
export async function explore() {
  return await runGoal("Explore the map");
}
export async function rushStrategy() {
  return await autoPlay("rush", { maxLoops: 5 });
}
export async function turtleStrategy() {
  return await autoPlay("turtle", { maxLoops: 5 });
}

// State machine exports (named exports for individual functions)
export {
  executeStateA,
  executeStateB,
  executeStateC,
  executeStateD,
  executeStateE,
};

export default {
  STATES,
  stop,
  isAutoPlaying,
  detectState,
  executeState,
  executeStateA,
  executeStateB,
  executeStateC,
  executeStateD,
  executeStateE,
  debugScreenshot,
  getViewportCenter,
  dragToCenterAndClick,
  buyLand,
  buildBuilding,
  upgradeBuilding,
  waitForGold,
  gatherGold,
  runGoal,
  autoPlay,
  autoPlayInfinite,
  buildStructure,
  trainUnits,
  attack,
  gatherResources,
  buildEconomy,
  trainArmy,
  explore,
  rushStrategy,
  turtleStrategy,
};
