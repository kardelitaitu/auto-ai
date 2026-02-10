# Project Overview

This project is a JavaScript application designed for multi-browser automation using Playwright. It integrates with various anti-detect browsers (such as Roxybrowser, AdsPower, Multilogin, etc.) by connecting to their local APIs to manage and automate browser profiles. The `browserAPI.json` file acts as a central configuration, detailing the types and API endpoints for each supported browser profile. The `main.js` file provides a foundational example of how to establish a connection to a Roxybrowser profile, retrieve its connection details, and subsequently use Playwright for automation tasks, with support for running multiple tasks concurrently in tabs within each profile.

# Building and Running

This project is a Node.js application.

## Dependencies

The primary dependency is `playwright`. Install dependencies using:

```bash
npm install
```


## Running the Automation

The main automation script (`main.js`) can be executed directly using Node.js:

```bash
node main.js taskName1 taskName2
or
auto taskName1 taskName2
```

This script will discover all running browsers specified in `config/browserAPI.json`, connect to them, and then execute the specified tasks (`taskName1`, `taskName2`, etc.) on all of them. The number of tasks that run in parallel within each browser can be configured in `config/settings.json` via the `concurrencyPerBrowser` property. (1 task for each tab)

## Logging

Every console log should be start with [Scriptname] ... error_content

## patchnotes.md format (append everytime we make changes)
    # vx.x.xx
    (dd Month yyyy) Title
    - changes
    - changes
    - changes
        
## Testing

The `package.json` includes a placeholder test script:

```bash
npm test
```

Currently, this script does not contain any actual tests.

# Development Conventions

*   **Browser Automation:** Playwright is the chosen library for browser automation.
*   **API Interaction:** The project interacts with local browser APIs using the `fetch` API for retrieving browser profile connection information.
*   **Module System:** The project uses ES module syntax (`import/export`) as indicated by `"type": "module"` in `package.json`.
*   **Error Handling:** Error handling has been improved to log concise messages for common network failures.
*   **Concurrency Model:** The framework uses a 'Concurrent Checklist' model. Each connected browser profile receives the full list of tasks and executes them in parallel tabs, up to the limit defined by `concurrencyPerBrowser` in `config/settings.json`.