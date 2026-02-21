import fs from 'fs';
import path from 'path';

const filePath = path.resolve('c:/My Script/auto-ai/utils/human-interaction.js');
let code = fs.readFileSync(filePath, 'utf8');

// The issue is that there is a missing closing brace `}` before `async twitterVerifyReply`.
// We can find `return { sent: false, method: null }` and replace it with `return { sent: false, method: null }; }`
// But we must be careful not to create double braces if there's already one.

const target1 = "return { sent: false, method: null };\r\n\r\n    /**\r\n     * Verify reply";
const target2 = "return { sent: false, method: null }\r\n\r\n    /**\r\n     * Verify reply";
const target3 = "return { sent: false, method: null };\n\n    /**\n     * Verify reply";
const target4 = "return { sent: false, method: null }\n\n    /**\n     * Verify reply";
const target5 = "return { sent: false, method: null }\n\n    /**\r\n     * Verify reply";

let replaced = false;

// Regex to find `return { sent: false, method: null }` possibly with semicolon, followed by `/** Verify reply` without a `}` in between.
const regex = /return\s*\{\s*sent:\s*false,\s*method:\s*null\s*\}\s*;?\s*\n\s*\/\*\*\s*\n\s*\*\s*Verify reply/;

if (regex.test(code)) {
    code = code.replace(
        /return\s*\{\s*sent:\s*false,\s*method:\s*null\s*\}\s*;?\s*\n\s*\/\*\*\s*\n\s*\*\s*Verify reply/,
        "return { sent: false, method: null };\n    }\n\n    /**\n     * Verify reply"
    );
    replaced = true;
    console.log("Fixed missing closing brace via Regex.");
}

if (replaced) {
    fs.writeFileSync(filePath, code);
} else {
    console.log("Could not find the missing brace spot.");
}

