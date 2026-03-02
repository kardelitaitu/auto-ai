// WebSocket connection to dashboard server
let socket;
let connectionStatus;
let sessionsContainer;

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    connectionStatus = document.getElementById('connection-status');
    sessionsContainer = document.getElementById('sessions-container');
    
    // Try to connect to dashboard server
    connectToDashboard();
});

/**
 * Connect to the dashboard WebSocket server
 */
function connectToDashboard() {
    try {
        const settings = getDashboardSettings();
        const url = settings?.url || 'http://localhost:3001';
        
        socket = new WebSocket(`${url.replace(/^http/, 'ws')}/`);
        
        socket.onopen = () => {
            updateConnectionStatus('online');
            console.log('Dashboard WebSocket connected');
        };
        
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleMetricsUpdate(data);
            } catch (error) {
                console.error('Error parsing dashboard data:', error);
            }
        };
        
        socket.onclose = () => {
            updateConnectionStatus('offline');
            console.log('Dashboard WebSocket disconnected');
            
            // Try to reconnect after 5 seconds
            setTimeout(connectToDashboard, 5000);
        };
        
        socket.onerror = (error) => {
            console.error('Dashboard WebSocket error:', error);
            updateConnectionStatus('no-connection');
        };
        
    } catch (error) {
        console.error('Failed to connect to dashboard:', error);
        updateConnectionStatus('no-connection');
        
        // Try to reconnect after 10 seconds
        setTimeout(connectToDashboard, 10000);
    }
}

/**
 * Update connection status display
 * @param {string} status - online, offline, or no-connection
 */
function updateConnectionStatus(status) {
    if (!connectionStatus) return;
    
    connectionStatus.textContent = status === 'online' ? 'Online' : 
                                 status === 'offline' ? 'Offline' : 'No Connection';
    
    connectionStatus.className = status;
}

/**
 * Handle metrics update from dashboard server
 * @param {object} data - Metrics data from server
 */
function handleMetricsUpdate(data) {
    if (!data?.sessions) {
        showNoSessionsMessage();
        return;
    }
    
    renderSessions(data.sessions);
}

/**
 * Render session boxes
 * @param {Array} sessions - Array of session objects
 */
function renderSessions(sessions) {
    // Clear existing sessions
    sessionsContainer.innerHTML = '';
    
    if (sessions.length === 0) {
        showNoSessionsMessage();
        return;
    }
    
    sessions.forEach(session => {
        const sessionBox = createSessionBox(session);
        sessionsContainer.appendChild(sessionBox);
    });
}

/**
 * Create a session box element
 * @param {object} session - Session data
 * @returns {HTMLElement}
 */
function createSessionBox(session) {
    const box = document.createElement('div');
    box.className = `session-box ${session.status || 'unknown'}`;
    
    const statusClass = session.status === 'online' ? 'online' : 
                      session.status === 'offline' ? 'offline' : 'unknown';
    
    box.innerHTML = `
        <div class="session-name">${session.name || 'Unknown'}</div>
        <div class="session-stats">
            Workers: ${session.activeWorkers || 0}/${session.totalWorkers || 0}<br>
            Tasks: ${session.completedTasks || 0}
        </div>
        <div class="session-tasks ${session.currentTask ? 'running' : 'idle'}">
            ${session.currentTask ? `Running: ${session.currentTask}` : 'Idle'}
        </div>
    `;
    
    return box;
}

/**
 * Show message when no sessions are available
 */
function showNoSessionsMessage() {
    sessionsContainer.innerHTML = `
        <div class="no-sessions">
            No browser sessions found
        </div>
    `;
}

/**
 * Get dashboard settings from localStorage
 * @returns {object}
 */
function getDashboardSettings() {
    try {
        const settings = localStorage.getItem('dashboard-settings');
        return settings ? JSON.parse(settings) : {};
    } catch (error) {
        console.warn('Error reading dashboard settings:', error);
        return {};
    }
}

/**
 * Handle window resize events
 */
window.addEventListener('resize', () => {
    // Adjust grid layout if needed
    const container = document.getElementById('sessions-container');
    if (container) {
        const width = container.clientWidth;
        // Update grid template columns if needed
    }
});

/**
 * Handle window close
 */
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.close();
    }
});

// Export functions for potential testing
003cscript>
window.dashboardFunctions = {
    createSessionBox,
    renderSessions,
    handleMetricsUpdate,
    updateConnectionStatus
};</script>