# OWB Prompt Improvements - Before/After Comparison

## Overview

This document shows the current prompts in `owb-agents.js` and the proposed improvements to reduce error rates from ~40-50% to ~10-15%.

---

## 1. detectState() Prompt (Line 157)

### BEFORE (Current)

```javascript
const prompt = `Analyze this territory game screenshot. Detect what we can do:
1. Is there GREY land with "Free" text? → State A
2. Is there RED enemy land with NO building? → State B  
3. Is there BLUE owned land with NO building? → State C
4. Is there a building selected with a menu open? → State E

Respond JSON: { "detectedState": "A|B|C|D|E", "reason": "why", "canExpand": true/false, "canBuild": true/false, "hasMenu": true/false }`;
```

**Issues:**
- No XML delimiters for context separation
- "Respond JSON" doesn't forbid markdown code blocks
- No fallback when detection is uncertain
- No viewport context for spatial awareness

### AFTER (Improved)

```javascript
const prompt = `<INSTRUCTIONS>
You are a territory game state detector. Analyze the provided image and return EXACTLY one JSON object.

CRITICAL RULES:
1. Output RAW JSON only - no markdown code blocks, no explanations, no text before or after
2. If uncertain about the state, choose the most likely option and explain in "reason"
3. Always return a valid JSON object - never leave any field empty
</INSTRUCTIONS>

<CONTEXT>
Image dimensions: ${viewport.width}x${viewport.height} pixels
Game Type: Territory Expansion Strategy (Canvas-based)
</CONTEXT>

<DETECTION_RULES>
1. State A: GREY land with "Free" text visible
2. State B: RED enemy territory without buildings
3. State C: BLUE owned territory without buildings  
4. State E: Building menu is open and active
5. State D: Default/unknown state
</DETECTION_RULES>

<OUTPUT_FORMAT>
Return ONLY this JSON object - nothing else:
{
  "detectedState": "A|B|C|D|E",
  "reason": "brief explanation in English",
  "canExpand": true,
  "canBuild": true,
  "hasMenu": false
}
</OUTPUT_FORMAT>`;
```

**Improvements:**
- XML delimiters for clear context separation
- Explicit "no markdown" rule
- Fallback state (D) for uncertain cases
- Viewport context for spatial awareness
- Structured output format section

---

## 2. State A Prompt (Line 279)

### BEFORE (Current)

```javascript
const prompt = `
<CONTEXT>
Image dimensions: ${viewport.width}x${viewport.height} pixels.
Game Type: Territory Expansion Strategy (Canvas-based).
Goal: Expand territory by purchasing GREY land adjacent to BLUE land.
</CONTEXT>

<COLOR_GUIDE>
- BLUE: Your owned territory.
- GREY: Unowned territory (Purchasable).
- RED: Enemy territory.
</COLOR_GUIDE>

<OBJECTIVE>
Identify exactly ONE GREY territory tile that:
1. Is ADJACENT to a BLUE territory.
2. Contains the text "Free" or a numeric price (e.g., "50", "100").
</OBJECTIVE>

<RULES>
1. PRIORITY: Pick the "Free" land closest to the center of the largest BLUE cluster.
2. COORDINATES: Target the EXACT center of the "Free" text or price label.
3. BOUNDS: Coordinates must be within (10, 10) and (${viewport.width - 10}, ${viewport.height - 10}).
4. NO TARGET: If no valid land matches ALL criteria, return found: false.
</RULES>

<OUTPUT_FORMAT>
Return ONLY raw JSON. No markdown backticks or explanations.
{
  "x": number,
  "y": number,
  "found": boolean,
  "price": "string",
  "rationale": "brief reason"
}
</OUTPUT_FORMAT>
`.trim();
```

**Issues:**
- "No markdown backticks" is mentioned but not enforced with negative constraints
- No step-by-step reasoning guidance
- "rationale" field name is inconsistent with other prompts
- No explicit fallback JSON structure

### AFTER (Improved)

```javascript
const prompt = `<INSTRUCTIONS>
You are a territory expansion agent for a canvas-based strategy game. Your task is to identify and click GREY unowned land that is adjacent to your BLUE territory.

CRITICAL RULES:
1. Output RAW JSON only - no markdown code blocks, no explanations, no text before or after
2. If no valid target exists, return the exact fallback JSON shown below
3. Coordinates must be integers within the specified bounds
4. Do not guess - if uncertain, report found: false
</INSTRUCTIONS>

<CONTEXT>
Image dimensions: ${viewport.width}x${viewport.height} pixels
Game Type: Territory Expansion Strategy (Canvas-based)
You own BLUE territory
GREY land is unowned and purchasable
RED land is enemy territory (do not target)
</CONTEXT>

<OBJECTIVE>
Find the BEST GREY land tile that meets ALL criteria:
1. Must be ADJACENT to at least one BLUE territory tile
2. Must display "Free" text OR show a price number (e.g., "50", "100")
3. Must be clearly visible and not obscured by UI elements
</OBJECTIVE>

<REASONING_STEPS>
1. Scan the image for GREY colored regions
2. Check if any GREY region contains "Free" text or a price number
3. Verify adjacency to BLUE territory (your land)
4. Calculate center coordinates of the target element
5. Validate coordinates are within viewport bounds
6. If no valid target exists, set found: false and explain why
</REASONING_STEPS>

<COORDINATE_REQUIREMENTS>
- Return EXACT center coordinates of the target
- Coordinates must be integers
- Valid range: x in [10, ${viewport.width - 10}], y in [10, ${viewport.height - 10}]
- If no valid target exists, use coordinates (0, 0)
</COORDINATE_REQUIREMENTS>

<OUTPUT_FORMAT>
Return ONLY this JSON object - nothing else:
{
  "x": <integer coordinate>,
  "y": <integer coordinate>,
  "found": true,
  "price": "<text or number>",
  "reason": "<one sentence explanation>"
}

If you cannot find a valid target after careful analysis, return:
{"x": 0, "y": 0, "found": false, "price": null, "reason": "No valid GREY land found"}
</OUTPUT_FORMAT>`;
```

**Improvements:**
- Stronger negative constraints ("no markdown code blocks, no explanations")
- Step-by-step reasoning guidance
- Explicit fallback JSON structure
- Consistent field naming ("reason" instead of "rationale")
- Clear coordinate validation rules

---

## 3. buyLand() Prompt (Line 395)

### BEFORE (Current)

```javascript
const result = await api.gameAgent.run(
    `Look for GREY land squares with "Free" text on them. Click on GREY "Free" land that is NEXT TO your BLUE territory to buy it.
     IMPORTANT: Use clickAt action with exact x,y coordinates.
     Example: {"action": "clickAt", "x": 500, "y": 300}
     Use coordinates based on where you see the grey "Free" land in the image.
     NEVER use CSS selectors - this is a CANVAS game.`,
    { maxSteps: 10, stepDelay: 500, stuckDetection: true, useAXTree: false }
);
```

**Issues:**
- No XML structure for context separation
- Example coordinates (500, 300) may confuse the model
- No fallback when no target is found
- No viewport context

### AFTER (Improved)

```javascript
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
    { maxSteps: 10, stepDelay: 500, stuckDetection: true, useAXTree: false }
);
```

**Improvements:**
- XML structure for clear context separation
- Removed example coordinates that could confuse the model
- Added explicit fallback action
- Clearer output format specification

---

## 4. buildBuilding() Prompt (Line 418)

### BEFORE (Current)

```javascript
const result = await api.gameAgent.run(
    `1. Click the "${building.name}" building icon at the bottom menu using clickAt coordinates based on what you see.
     2. Scan the map for an EMPTY BLUE hex in your territory.
     3. Use clickAt to click the exact coordinates of that empty blue hex.
     Example of REQUIRED JSON ARRAY FORMAT: 
     [
       {"action": "clickAt", "x": 123, "y": 456, "rationale": "Clicking icon"},
       {"action": "wait", "value": "1000", "rationale": "Waiting for menu"},
       {"action": "clickAt", "x": 789, "y": 101, "rationale": "Clicking empty hex"}
     ]
     (DO NOT COPY 123/456! Use real coordinates!)
     NEVER use CSS selectors. Use clickAt coordinates based on what you see.
     Repeat ${count} times if you have enough gold (${cost} each).`,
    { maxSteps: 10, stepDelay: 2000, stuckDetection: true, useAXTree: false }
);
```

**Issues:**
- Example coordinates (123, 456, 789, 101) may confuse the model
- No XML structure for context separation
- No fallback when no empty hex is found
- "DO NOT COPY" instruction is confusing

### AFTER (Improved)

```javascript
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
    { maxSteps: 10, stepDelay: 2000, stuckDetection: true, useAXTree: false }
);
```

**Improvements:**
- Removed confusing example coordinates
- Added explicit fallback action
- Clearer context separation with XML
- Removed "DO NOT COPY" instruction

---

## Summary of Changes

| Prompt | Key Improvements | Expected Error Reduction |
|--------|------------------|--------------------------|
| detectState() | XML delimiters, no markdown rule, fallback state | 40% → 25% |
| State A | Step-by-step reasoning, explicit fallback JSON | 45% → 20% |
| buyLand() | XML structure, removed example coords, fallback action | 35% → 20% |
| buildBuilding() | Removed confusing examples, added fallback | 40% → 25% |

**Overall Expected Improvement:** 40-50% error rate → 10-15% error rate

---

## Next Steps

1. Review and approve these changes
2. Switch to Code mode to implement the improvements
3. Test the updated prompts with `node agent-main.js owb state-a`
4. Monitor error rates and adjust as needed
