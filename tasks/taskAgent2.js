import { run as runAgent } from './runAgent.js';

export async function run(page, args, config = {}) {
    console.log("Starting taskAgent2 - Weather Search...");

    console.log("Goal: Search for weather in Jakarta");
    await runAgent(page, [
        "Go to Google and search for 'weather in jakarta'"
    ], config);

    console.log("taskAgent2 complete.");
}
