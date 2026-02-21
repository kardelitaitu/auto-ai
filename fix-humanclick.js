import fs from 'fs';
import path from 'path';

const filePath = path.resolve('c:/My Script/auto-ai/utils/human-interaction.js');
let code = fs.readFileSync(filePath, 'utf8');

const targetStr = `        // Click the button\r\n        this.logDebug(\`[Post] Clicking button: \${targetSelector}\`);\r\n        await this.humanClick(targetBtn, 'Post Button', { precision: 'high' });`;
const replaceStr = `        // Click the button\n        this.logDebug(\`[Post] Clicking button: \${targetSelector}\`);\n        try {\n            await this.humanClick(targetBtn, 'Post Button', { precision: 'high' });\n        } catch (e) {\n            this.logWarn(\`[Post] humanClick failed: \${e.message}\`);\n        }`;

const targetStrLF = `        // Click the button\n        this.logDebug(\`[Post] Clicking button: \${targetSelector}\`);\n        await this.humanClick(targetBtn, 'Post Button', { precision: 'high' });`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replaceStr);
    console.log("Replaced with CRLF match");
} else if (code.includes(targetStrLF)) {
    code = code.replace(targetStrLF, replaceStr);
    console.log("Replaced with LF match");
} else {
    // Brute force regex just in case
    code = code.replace(
        /await this\.humanClick\(targetBtn, 'Post Button', \{ precision: 'high' \}\);/g,
        `try {\n            await this.humanClick(targetBtn, 'Post Button', { precision: 'high' });\n        } catch (e) {\n            this.logWarn(\`[Post] humanClick failed: \${e.message}\`);\n        }`
    );
    console.log("Replaced with regex fallback");
}

fs.writeFileSync(filePath, code);
console.log('Update humanClick catch successful');
