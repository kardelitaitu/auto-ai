
import { DashboardServer } from './dashboard.js';

const server = new DashboardServer(3001);
server.start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
