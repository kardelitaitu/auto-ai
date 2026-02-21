import VisionInterpreter from './core/vision-interpreter.js';
// import { createLogger } from './utils/logger.js';

const interpreter = new VisionInterpreter();

const mockTree = [
    { role: 'button', name: 'Search', coordinates: { x: 500, y: 100 } },
    { role: 'textbox', name: 'Query Input', coordinates: { x: 500, y: 300 } },
    { role: 'link', name: 'About', coordinates: { x: 100, y: 10 } }
];

const context = {
    goal: "Search for 'semangka'",
    semanticTree: mockTree
};

const prompt = interpreter.buildPrompt(context);

console.log("=== GENERATED PROMPT ===");
console.log(prompt);
console.log("========================");
