/**
 * @fileoverview Semangka Search Task (The "String Driver")
 * Demonstrates how to use the Universal Agent with a simple text command.
 */

import agent from './agent.js';

async function semangka(page, payload) {
    // 1. Define the Goal & Steps
    payload.goal = "search google for blueberry";
    payload.steps = [
        "1. navigate to google.com",
        "2. search for 'blueberry'",
        "3. click the 2nd result",
        "4. DONE"
    ];

    // Force fresh start (Universal Agent Requirement)
    await page.goto('about:blank');

    // 2. Run the Universal Agent
    await agent(page, payload);
}

export default semangka;
