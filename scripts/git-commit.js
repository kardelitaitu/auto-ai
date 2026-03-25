#!/usr/bin/env node
/**
 * Auto-AI Framework - Git Commit Helper
 * Stage → Lint → Commit → Push (automatic)
 *
 * Usage: pnpm commit "message" [--no-verify]
 */

import { execSync } from "child_process";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.magenta}▸${colors.reset} ${msg}`),
};

const args = process.argv.slice(2);
const skipVerify = args.includes("--no-verify") || args.includes("-n");

const message = args.filter((arg) => !arg.startsWith("-")).join(" ");

if (!message) {
  log.error('Usage: pnpm commit "message" [--no-verify]');
  console.log(`\n${colors.bright}Options:${colors.reset}`);
  console.log("  --no-verify, -n  Skip lint-staged");
  console.log('\nExample: pnpm commit "feat: new feature"');
  process.exit(1);
}

let attempt = 0;
const maxAttempts = 2;
let lintPassed = false;

while (attempt < maxAttempts) {
  attempt++;

  try {
    log.step("Staging files...");
    execSync("git add -A", { stdio: "inherit" });

    if (skipVerify) {
      log.info("Skipping lint-staged (--no-verify)");
    } else {
      log.step("Running lint-staged (auto-fix + format)...");
      try {
        execSync("pnpm lint-staged", { stdio: "inherit" });
        lintPassed = true;
      } catch (lintError) {
        if (attempt >= maxAttempts) {
          log.error(
            "Lint failed - files have issues that cannot be auto-fixed",
          );
          console.log(`\n${colors.yellow}📋 To fix manually:${colors.reset}`);
          console.log("   1. Check the eslint errors above");
          console.log("   2. Run: pnpm lint:fix");
          console.log("   3. Run: pnpm format");
          console.log(`   4. Then retry: pnpm commit "${message}"`);
        }
        throw lintError;
      }

      log.step("Re-staging lint-fixed files...");
      execSync("git add -A", { stdio: "inherit" });
    }

    const status = execSync("git status --porcelain").toString().trim();
    if (!status) {
      log.warn("No changes to commit");
      process.exit(0);
    }

    log.step("Committing...");
    execSync(`git commit -m "${message}"`, { stdio: "inherit" });

    log.success("Commit successful!");
    console.log(`   ${colors.bright}Message:${colors.reset} "${message}"`);

    log.step("Pushing to remote...");
    execSync("git push", { stdio: "inherit" });
    log.success("Pushed to remote!");

    process.exit(0);
  } catch (error) {
    if (attempt < maxAttempts) {
      log.warn(`Attempt ${attempt} failed, retrying...`);
    } else {
      log.error("Commit failed after 2 attempts");

      if (!lintPassed && !skipVerify) {
        console.log(`\n${colors.yellow}📋 To fix:${colors.reset}`);
        console.log("   1. Run: pnpm lint:fix");
        console.log("   2. Run: pnpm format");
        console.log(`   3. Run: pnpm commit "${message}"`);
      }
      process.exit(1);
    }
  }
}
