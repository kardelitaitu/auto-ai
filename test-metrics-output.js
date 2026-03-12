
import { MetricsCollector } from './api/utils/metrics.js';

const metrics = new MetricsCollector();
metrics.recordTaskExecution('test-task', 1500, true, 'session-123');

const recent = metrics.getRecentTasks(1);
console.log('Recorded Task Structure:', JSON.stringify(recent[0], null, 2));

if (recent[0].taskName === 'test-task') {
    console.log('SUCCESS: taskName field is present');
} else {
    console.log('FAILURE: taskName field is missing or named differently');
}
