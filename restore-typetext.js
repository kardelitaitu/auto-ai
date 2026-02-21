import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const filePath = path.resolve('c:/My Script/auto-ai/utils/human-interaction.js');
let code = fs.readFileSync(filePath, 'utf8');

// Get old human-interaction.js typeText
const oldContent = execSync('git show HEAD:utils/human-interaction.js').toString();
const startIdx = oldContent.indexOf('    async typeText(page, text, inputEl) {');
const endIdx = oldContent.indexOf('    // =====================================', startIdx);
let typeTextCode = '';

if (startIdx !== -1 && endIdx !== -1) {
    typeTextCode = oldContent.substring(startIdx, endIdx);

    // Inject it back before postTweet or at the end of fallback methods
    const insertPoint = code.indexOf('    async postTweet(page, type = \'tweet\') {');
    if (insertPoint !== -1) {
        let newCode = code.substring(0, insertPoint) + typeTextCode + '\n' + code.substring(insertPoint);
        fs.writeFileSync(filePath, newCode);
        console.log("RESTORED typeText successfully.");
    } else {
        console.log("Could not find insert point.");
    }
} else {
    console.log("Could not find typeText in git HEAD.");
}
