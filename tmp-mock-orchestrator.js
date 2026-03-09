import { EventEmitter } from 'events';
import timers from 'timers/promises';

// The BUGGY version
class BuggyOrchestrator {
    constructor(maxConcurrency) {
        this.maxConcurrency = maxConcurrency;
        this.globalActiveTasks = 0;
        this.tasks = [];
    }

    async startTasks(numTasks) {
        for (let i = 0; i < numTasks; i++) {
            this.tasks.push(i);
        }
        await this.processTasks();
    }

    async processTasks() {
        while (this.tasks.length > 0) {
            // BUG: Busy-waiting loops
            while (this.globalActiveTasks >= this.maxConcurrency) {
                // Sleep for a whole second, even if a task finishes in 1ms!
                await timers.setTimeout(1000);
            }

            const task = this.tasks.shift();
            this.globalActiveTasks++;

            // Stagger delay!
            await timers.setTimeout(500); // Wait 500ms before starting the next

            // Run task in background
            this.runTask(task);
        }
    }

    async runTask(id) {
        await timers.setTimeout(100); // Task takes 100ms
        this.globalActiveTasks--;
        console.log(`[Buggy] Finished task ${id}`);
    }
}

// The FIXED version
class FixedOrchestrator extends EventEmitter {
    constructor(maxConcurrency) {
        super();
        this.maxConcurrency = maxConcurrency;
        this.globalActiveTasks = 0;
        this.tasks = [];
        this.isProcessing = false;

        // Listen to worker freeds to immediately dispatch next task
        this.on('workerFreed', () => {
            this.dispatchTasks();
        });
    }

    async startTasks(numTasks) {
        for (let i = 0; i < numTasks; i++) {
            this.tasks.push(i);
        }
        this.dispatchTasks();
    }

    dispatchTasks() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.tasks.length > 0 && this.globalActiveTasks < this.maxConcurrency) {
            // Check if queue empty inside loop to be totally safe
            if (this.tasks.length === 0) break;

            const task = this.tasks.shift();
            this.globalActiveTasks++;

            // Run task in background
            this.runTask(task);
        }

        this.isProcessing = false;
    }

    async runTask(id) {
        await timers.setTimeout(100); // Task takes 100ms
        this.globalActiveTasks--;
        console.log(`[Fixed] Finished task ${id}`);
        this.emit('workerFreed'); // IMMEDIATELY trigger next dispatch
    }
}

async function runTest() {
    console.log('Testing Buggy Orchestrator (Max 2, 5 Tasks)...');
    const buggyStartTime = Date.now();
    const buggy = new BuggyOrchestrator(2);
    // Wait for all to finish dispatch (not finish totally)
    await buggy.startTasks(5);
    // Wait for the backgrounded tasks
    await timers.setTimeout(1500);
    console.log(`Buggy Orchestrator took approx: ${Date.now() - buggyStartTime}ms`);

    console.log('\nTesting Fixed Orchestrator (Max 2, 5 Tasks)...');
    const fixedStartTime = Date.now();
    const fixed = new FixedOrchestrator(2);
    fixed.startTasks(5);

    // Wait for all to finish
    await new Promise(resolve => {
        const check = setInterval(() => {
            if (fixed.tasks.length === 0 && fixed.globalActiveTasks === 0) {
                clearInterval(check);
                resolve();
            }
        }, 50);
    });
    console.log(`Fixed Orchestrator took exactly: ${Date.now() - fixedStartTime}ms`);
}

runTest();
