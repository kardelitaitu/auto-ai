import timers from 'timers/promises';

// The BUGGY version
class BuggyAsyncQueue {
    constructor(maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
        this.queue = [];
        this.active = new Map();
        this.processingPromise = null;
    }

    async add(taskFn) {
        return new Promise((resolve) => {
            this.queue.push({ id: Math.random(), taskFn, resolve });
            this._processQueue();
        });
    }

    async _processQueue() {
        if (this.processingPromise) return this.processingPromise;
        this.processingPromise = this._processItems().finally(() => {
            this.processingPromise = null;
        });
        return this.processingPromise;
    }

    async _processItems() {
        while (this.queue.length > 0 && this.active.size < this.maxConcurrent) {
            const item = this.queue.shift();
            this.active.set(item.id, item);

            // BUG: Await inside the while loop prevents concurrency
            const result = await item.taskFn();

            this.active.delete(item.id);
            item.resolve(result);
        }
    }
}

// The FIXED version
class FixedAsyncQueue {
    constructor(maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
        this.queue = [];
        this.active = new Map();
        this.processingPromise = null;
    }

    async add(taskFn) {
        return new Promise((resolve) => {
            this.queue.push({ id: Math.random(), taskFn, resolve });
            this._processQueue();
        });
    }

    async _processQueue() {
        if (this.processingPromise) return this.processingPromise;
        // We do not wait for all items to finish here, we just kickstart the loop
        this.processingPromise = this._processItems();
        return this.processingPromise;
    }

    async _processItems() {
        while (this.queue.length > 0 && this.active.size < this.maxConcurrent) {
            const item = this.queue.shift();
            this.active.set(item.id, item);

            // Execute without awaiting so the while loop continues to fill active slots
            item.taskFn().then((result) => {
                this.active.delete(item.id);
                item.resolve(result);
                // Trigger queue processing again to pick up next tasks
                this._processQueue();
            }).catch(e => {
                this.active.delete(item.id);
                item.resolve(e);
                this._processQueue();
            });
        }
        this.processingPromise = null;
    }
}

async function runTest() {
    console.log('Testing Buggy Queue (Max 5 Concurrent, 10 tasks, 1s each)...');
    const buggyStart = Date.now();
    const buggyQueue = new BuggyAsyncQueue(5);
    const buggyPromises = [];
    for (let i = 0; i < 10; i++) {
        buggyPromises.push(buggyQueue.add(() => timers.setTimeout(100))); // Using 100ms for faster test
    }
    await Promise.all(buggyPromises);
    console.log(`Buggy Queue took: ${Date.now() - buggyStart}ms`);

    console.log('\nTesting Fixed Queue (Max 5 Concurrent, 10 tasks, 1s each)...');
    const fixedStart = Date.now();
    const fixedQueue = new FixedAsyncQueue(5);
    const fixedPromises = [];
    for (let i = 0; i < 10; i++) {
        fixedPromises.push(fixedQueue.add(() => timers.setTimeout(100)));
    }
    await Promise.all(fixedPromises);
    console.log(`Fixed Queue took: ${Date.now() - fixedStart}ms`);
}

runTest();
