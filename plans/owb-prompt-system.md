# OWB Prompt System Architecture Plan

## Overview

Design a comprehensive prompt system for the OWB (Open World Browser) territory conquest game that enables reliable AI-driven gameplay through structured visual analysis and action determination.

---

## Current State Analysis

### Existing Implementation
- **Single State (A)**: Only handles "Grey Free land" detection
- **Hardcoded Prompts**: Prompts embedded in agent code
- **Limited Visual Context**: Basic color-based detection

### Identified Game States (from images)

| State | Visual Signature | Current Action |
|-------|------------------|----------------|
| **A** - Free Territory | Grey hexes with price numbers (00, 80, 50, 100, 200) | Buy land |
| **B** - Enemy Territory | Red/pink hexes | Attack |
| **C** - Own Territory | Blue hexes without buildings | Build |
| **D** - Building Menu | Large white hex with cost (2400), building icons | Select/Upgrade |
| **E** - Build Options | Three hex options (300, 200, 500 gold) | Choose building |

---

## Proposed Architecture

### 1. Prompt Module Structure

```
prompts/
├── index.js                 # Export all prompts
├── base/
│   ├── system.js           # Base system prompts
│   └── visual-guide.js     # Common visual elements
├── states/
│   ├── state-a.js          # Free territory detection + action
│   ├── state-b.js          # Enemy territory detection + action
│   ├── state-c.js          # Own territory detection + action
│   ├── state-d.js          # Building menu detection + action
│   └── state-e.js          # Build options detection + action
└── shared/
    ├── coordinates.js      # Coordinate formatting helpers
    └── validation.js       # Output validation rules
```

### 2. Prompt Design Principles

#### A. Visual-First Approach
```
< VISUAL ELEMENTS >
Describe what each element LOOKS LIKE, not just what it means.

Example:
- "Grey hexagon with WHITE number '50' centered"
- "Blue solid hexagon (no text)"
- "Large white hex with black building icon and '2400' below"
```

#### B. Three-Check Verification
```
CHECK 1: Identify the visual element (color, shape, text)
CHECK 2: Verify context (adjacency, surrounding elements)
CHECK 3: Validate action (can we afford? is it valid?)
```

#### C. Structured JSON Output
```json
{
  "state": "A",
  "confidence": 0.95,
  "action": {
    "type": "clickAt",
    "x": 450,
    "y": 320,
    "target": "grey_tile_with_50"
  },
  "reasoning": "Grey tile with '50' touches blue territory at (300, 400)"
}
```

---

## State-Specific Prompt Designs

### State A: Free Territory (Buying Land)

**Detection Criteria:**
- Grey/dark hexagons
- White/light number text: "00", "50", "80", "100", "200"
- Adjacent to blue territory

**Action Logic:**
1. Find all grey tiles WITH numbers
2. Check adjacency to blue tiles
3. Select cheapest affordable tile
4. Return coordinates of the NUMBER text

**Prompt Structure:**
```
< TASK > Find purchasable grey tiles with prices

< VISUAL GUIDE >
TARGET (click these):
- Grey hexagon with WHITE number: "50", "100", "200"
- Number is CENTERED in the hex
- Must TOUCH a blue hex

IGNORE:
- Grey hexes WITHOUT numbers
- Numbers that don't touch blue
- Red/pink hexes (enemy)

< OUTPUT >
{"x": <number_x>, "y": <number_y>, "found": true, "price": "50"}
```

### State B: Enemy Territory (Attacking)

**Detection Criteria:**
- Red/pink hexagons
- May have enemy buildings
- Adjacent to blue territory

**Action Logic:**
1. Identify enemy tiles adjacent to owned territory
2. Select strategic target (weakest or most valuable)
3. Execute attack

### State C: Own Territory (Building)

**Detection Criteria:**
- Blue hexagons
- No existing buildings
- Sufficient gold

**Action Logic:**
1. Find buildable blue tiles
2. Check gold availability
3. Select optimal building location
4. Open build menu

### State D: Building Menu Open

**Detection Criteria:**
- Large white hex with cost number
- Building icon visible
- Upgrade option available

**Action Logic:**
1. Read upgrade cost
2. Check if affordable
3. Click upgrade or close menu

### State E: Build Options Menu

**Detection Criteria:**
- Three hexagonal options visible
- Each with icon and cost (300, 200, 500)
- Menu overlay on game

**Action Logic:**
1. Read all three options and costs
2. Check gold availability
3. Select best affordable option
4. Click selected building

---

## Implementation Plan

### Phase 1: Prompt Infrastructure
1. Create `prompts/` directory structure
2. Build base system prompts
3. Create visual guide templates
4. Implement coordinate helpers

### Phase 2: State A Enhancement
1. Extract current State A prompt to module
2. Add visual examples from screenshots
3. Implement 3-check verification
4. Add price validation logic

### Phase 3: State Detection System
1. Create state detection prompts for all 5 states
2. Implement state transition logic
3. Add confidence scoring
4. Create fallback mechanisms

### Phase 4: State-Specific Actions
1. Implement State B (attack) prompt
2. Implement State C (build) prompt
3. Implement State D (upgrade) prompt
4. Implement State E (build menu) prompt

### Phase 5: Integration & Testing
1. Integrate prompts with state machine
2. Add logging for prompt performance
3. Create A/B testing framework
4. Document prompt tuning guidelines

---

## Prompt Template Format

```javascript
// prompts/states/state-a.js

export const STATE_A_PROMPT = {
    system: `You are analyzing a hexagonal territory conquest game.
             The image is {width}x{height} pixels.
             Your job is to find purchasable grey tiles with prices.`,

    user: (vprepWidth, vprepHeight, viewport) => `
< YOUR JOB > Find ONE grey hex tile with a price number that touches a blue hex.

< IMAGE SIZE >
This image is ${vprepWidth}x${vprepHeight} pixels.
ALL coordinates must be within this image size.

< VISUAL GUIDE >

BLUE TILES (yours):
- Solid blue colored hexagons
- These are YOUR territory

GREY TILES WITH NUMBER (TARGET):
- Grey hexagon with WHITE number: "50", "100", "200"
- Number is CENTERED in the hex
- Must TOUCH a blue hex

GREY TILES WITHOUT NUMBER (SKIP):
- Grey hexagons with NO number
- NOT purchasable

< OUTPUT >
{"x": <number_center_x>, "y": <number_center_y>, "found": true, "price": "<number>"}
or
{"x": 0, "y": 0, "found": false, "price": null}

< COORDINATES >
- x must be between 10 and ${vprepWidth - 10}
- y must be between 10 and ${vprepHeight - 10}
    `.trim(),

    validation: (response) => {
        // Validate JSON structure
        // Check coordinate bounds
        // Verify price format
    }
};
```

---

## Visual Reference Database

Based on screenshots, document exact visual appearances:

### Tile Types
| Type | Color | Text | Icon | Action |
|------|-------|------|------|--------|
| Own (Blue) | #4A90D9 | None | None | Build |
| Free (Grey) | #808080 | "50", "100", "200" | None | Buy |
| Enemy (Red) | #FF6B6B | None | None | Attack |
| Building Menu | White | Cost number | Building | Select |

### UI Elements
| Element | Position | Size | Content |
|---------|----------|------|---------|
| Gold counter | Bottom-left | Small | "180" |
| Build options | Center | 3 hexes | Icons + costs |
| Upgrade menu | Center | Large hex | Cost "2400" |

---

## Success Metrics

1. **Detection Accuracy**: >90% correct state identification
2. **Action Success Rate**: >85% successful actions
3. **Response Time**: <3 seconds per decision
4. **False Positive Rate**: <5% invalid clicks

---

## Next Steps

1. Review and approve plan
2. Create prompt directory structure
3. Implement State A prompt module
4. Test with live tester
5. Iterate based on results
