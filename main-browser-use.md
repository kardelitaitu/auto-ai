# Main Browser Use (`main-browser-use.js`)

This script acts as the **central entry point** for the automation framework. It implements a "Broadcast Execution" model where *every* provided task is executed on *every* connected browser session concurrently.

## Execution Flowchart

```mermaid
flowchart TD
    Start([Start: node main-browser-use.js task1.js task2.js]) --> Init[Initialize Logger & Process Handlers]
    Init --> CheckArgs{Args Valid?}
    CheckArgs -- No --> ErrorExit([Exit: Show Usage])
    CheckArgs -- Yes --> ModelCheck[LLM: Ensure Model Running]
    
    subgraph Global Setup
        ModelCheck -->|Start Docker/Ollama if needed| ModelReady[Model Ready]
        ModelReady --> OrchInit[Init Orchestrator]
        OrchInit --> Disco[Start Discovery]
        Disco -->|Find Browsers| Sessions[Get All Sessions]
    end

    Sessions --> SessionCheck{Sessions > 0?}
    SessionCheck -- No --> ErrorNoBrowser([Error: No Browsers])
    SessionCheck -- Yes --> LoadTasks[Load Task Modules]

    subgraph Broadcast Execution Strategy
        LoadTasks -->|Loop: For Each Session| SessionLoop
        SessionLoop -->|Loop: For Each Task| TaskLoop
        TaskLoop --> NewTab[Create New Tab on Session]
        NewTab --> RunTask[Execute Module.run()]
        RunTask -->|Parallel Execution| TaskPromise(Task Promise)
    end

    TaskPromise --> AwaitAll[Wait for ALL Tasks]
    
    AwaitAll -->|Success| LogSuccess[Log Task Completion]
    AwaitAll -->|Error| LogError[Log Task Failure]

    LogSuccess --> Cleanup[Shutdown Orchestrator]
    LogError --> Cleanup
    
    Cleanup --> CloseTabs[Close All Tabs]
    CloseTabs --> StopSess[Disconnect Sessions]
    StopSess --> End([End])

    subgraph Error Handling & Safety
        SigInt[SIGINT / Ctrl+C] --> ForceShutdown[Force Shutdown]
        ForceShutdown --> Cleanup
    end
```

## detailed Execution Steps

1.  **Initialization**:
    *   The script starts by parsing command-line arguments to identify which task modules (`tasks/taskAgent.js`, etc.) need to be run.
    *   It sets up a global `SIGINT` listener to handle graceful shutdowns if the user presses Ctrl+C.

2.  **Global Pre-flight (LLM Check)**:
    *   Before touching any browser, it calls `llmClient.ensureModelRunning()`.
    *   This checks if the AI Model Server (Docker/Ollama) is active. If not, it auto-starts it.
    *   *Why here?* To perform this expensive check only once globally, rather than having 8 concurrent tasks check it simultaneously.

3.  **Browser Discovery & Session Management**:
    *   The `Orchestrator` spins up discovery connectors (Roxy, Multilogin, Local, etc.).
    *   It establishes connection to all found browsers and wraps them in `Session` objects.

4.  **Task Loading**:
    *   Dynamic imports (`await import(fileUrl)`) load the specified task files.
    *   Checks if each module exports a `run` function.

5.  **Broadcast Distribution (The "Matrix")**:
    *   The script creates a Cartesian product of **Sessions × Tasks**.
    *   **Example**: If you have 4 connected browsers and 2 tasks:
        *   Session 1 runs Task A (Tab 1)
        *   Session 1 runs Task B (Tab 2)
        *   ...
        *   Session 4 runs Task B (Tab 8)
    *   All 8 executions start effectively simultaneously (`Promise.all` logic via `executionPromises` array).

6.  **Concurrency & Logging**:
    *   Each task receives a unique `sessionId` in its config.
    *   The `Agent` inside the task uses this ID to tag logs (e.g., `[local-agent.js][session-1]`).
    *   Since tasks run in separate tabs, they do not interfere with each other's navigation, though they share the same browser resource (CPU/RAM).

7.  **Completion**:
    *   The script waits for all promises to resolve or reject.
    *   Upon completion, it triggers a clean shutdown, closing tabs and disconnecting from debug ports.
