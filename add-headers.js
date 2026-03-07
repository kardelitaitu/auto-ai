import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEADER = `/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

`;

const EXCLUDE_DIRS = ['node_modules', '.git', 'coverage', 'api/coverage', 'api/docs', '.llm-context'];
const ROOT_EXTENSIONS = ['.js', '.mjs'];

function shouldExclude(filePath) {
    return EXCLUDE_DIRS.some(dir => filePath.includes(path.sep + dir + path.sep) || filePath.endsWith(path.sep + dir));
}

function getAllJsFiles(dir, files = []) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        
        if (shouldExclude(fullPath)) continue;
        
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            getAllJsFiles(fullPath, files);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.mjs')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

function hasHeader(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.includes('Copyright (c) 2025 gantengmaksimal');
}

function addHeader(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if already has header
    if (hasHeader(filePath)) {
        console.log(`  [SKIP] ${filePath} (already has header)`);
        return false;
    }
    
    // Add header
    const newContent = HEADER + content;
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`  [ADDED] ${filePath}`);
    return true;
}

// Get all JS files in project (excluding node_modules, etc.)
const projectRoot = path.resolve(__dirname);
console.log('Scanning for JS files in:', projectRoot);

const jsFiles = getAllJsFiles(projectRoot);
console.log(`Found ${jsFiles.length} JS files\n`);

// Add headers
console.log('Adding copyright headers...\n');
let addedCount = 0;
let skipCount = 0;

for (const file of jsFiles) {
    if (addHeader(file)) {
        addedCount++;
    } else {
        skipCount++;
    }
}

console.log(`\n=== Summary ===`);
console.log(`Files processed: ${jsFiles.length}`);
console.log(`Headers added: ${addedCount}`);
console.log(`Skipped (already had header): ${skipCount}`);
