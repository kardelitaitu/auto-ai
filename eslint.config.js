import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
    // 1. GLOBAL IGNORES (Must be its own object at the top!)
    {
        ignores: [
            "coverage/",
            "docs/",
            "dist/",
            "build/",
            ".aider.tags.cache.v4/",
            ".qodo/",
            "config/",
            "data/",
            "examples/",
            "local-agent/",
            "node_modules/",
            "tests/",
            "screenshots/",
            "ui/",
            "tools/",
            "coverage/",
            "backup/",

            "**/*.min.js" // Ignore minified files to save CPU
        ]
    },

    // 2. Base Configs
    js.configs.recommended,

    // 3. Your Custom Configuration
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.browser,
                ...globals.es2021,
                // Manually defining Vitest globals is fine, 
                // but you can also use `globals.jest` or similar if supported.
                describe: "readonly",
                it: "readonly",
                expect: "readonly",
                vi: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
                beforeAll: "readonly",
                afterAll: "readonly",
                test: "readonly"
            }
        },
        rules: {
            // Your smart unused-vars rule (Excellent choice)
            "no-unused-vars": ["warn", { 
                "argsIgnorePattern": "^_", 
                "varsIgnorePattern": "^_", 
                "caughtErrorsIgnorePattern": "^_" 
            }],

            // Performance: Allow console.log, but warn so you don't miss them in Prod
            "no-console": "off", 
            
            // Speed: Turn off strict equality checks (as per your request)
            "eqeqeq": "off",
        }
    },

    // 4. Prettier (Must be last to override others)
    prettier
];