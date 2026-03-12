import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import io from 'socket.io-client';

// Layout & Components
import DashboardLayout from './components/layout/DashboardLayout';
import MetricCard from './components/metrics/MetricCard';
import SessionItem from './components/sessions/SessionItem';
import TaskList from './components/common/TaskList';

// Helper to safely get nested values
const safeGet = (obj, path, defaultValue = 'N/A') => {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result == null) return defaultValue;
        result = result[key];
    }
    return result ?? defaultValue;
};

const Icons = {
    CPU: '⚡',
    RAM: '🧠',
    Tasks: '📋',
    Twitter: '🐦',
    API: '🌐',
    Uptime: '⏱️',
    Queue: '📥'
};

const getAdaptiveColor = (value) => {
    if (value < 40) return 'var(--accent-success)'; // Green: 0-39%
    if (value < 80) return 'var(--accent-warning)'; // Orange: 40-79%
    return 'var(--accent-error)'; // Red: 80-100%
};

function App() {
    const [data, setData] = useState({
        sessions: [],
        queue: { queueLength: 0 },
        metrics: {},
        recentTasks: [],
        system: {},
        cumulative: {}
    });
    const [status, setStatus] = useState('connecting');
    const [cpuHistory, setCpuHistory] = useState([]);
    const [ramHistory, setRamHistory] = useState([]);
    const [serverUrl, setServerUrl] = useState(null);
    const [activeTab, setActiveTab] = useState('fleet');
    const socketRef = useRef(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    useEffect(() => {
        // Get server URL from query params or electron API
        const initSocket = async () => {
            let url = 'http://localhost:3001';

            const params = new URLSearchParams(window.location.search);
            const urlParam = params.get('server');
            if (urlParam) {
                url = urlParam;
            } else if (window.electronAPI?.getConfig) {
                try {
                    const config = await window.electronAPI.getConfig();
                    if (config?.serverUrl) {
                        url = config.serverUrl;
                    }
                } catch (e) {
                    console.warn('[Dashboard] Could not get config from Electron:', e);
                }
            }

            setServerUrl(url);
            console.log('[Dashboard] Connecting to:', url);

            const socket = io(url, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 2000
            });

            socket.on('connect', () => setStatus('online'));
            socket.on('disconnect', () => setStatus('offline'));
            socket.on('connect_error', (err) => {
                console.warn('[Dashboard] Connection error:', err.message);
                setStatus('no-connection');
            });

            socketRef.current = socket;

            socket.on('metrics', (newData) => {
                setData(newData);

                // Track history (max 60 points)
                const cpuUsage = safeGet(newData, 'system.cpu.usage', 0);
                const ramPercent = safeGet(newData, 'system.memory.percent', 0);

                setCpuHistory(prev => [...prev, cpuUsage].slice(-25));
                setRamHistory(prev => [...prev, ramPercent].slice(-25));
            });

            return () => socket.close();
        };

        initSocket();
    }, []);

    const system = data.system || {};
    const cumulative = data.cumulative || {};
    const twitterActions = safeGet(data, 'metrics.twitter.actions', {});
    const apiMetrics = safeGet(data, 'metrics.api', {});
    const queueLength = safeGet(data, 'queue.queueLength', 0);
    const activeTasksCount = safeGet(data, 'queue.activeTaskCount', 0);
    const totalActiveWork = queueLength + activeTasksCount;
    const sessions = data.sessions || [];

    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
    const [isCompact, setIsCompact] = useState(false);

    const toggleAlwaysOnTop = () => {
        window.electronAPI?.toggleAlwaysOnTop();
        setIsAlwaysOnTop(!isAlwaysOnTop);
    };

    const toggleCompact = () => {
        if (isCompact) {
            window.electronAPI?.setWindowSize(1200, 800, false);
        } else {
            window.electronAPI?.setWindowSize(400, 600, true);
        }
        setIsCompact(!isCompact);
    };

    const renderTabContent = () => {
        if (activeTab === 'fleet') {
            return (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '4px'
                }}>
                    {sessions.map(session => (
                        <SessionItem key={session.id} session={session} />
                    ))}
                    {sessions.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', gridColumn: 'span 3' }}>
                            No active sessions.
                        </div>
                    )}
                </div>
            );
        } else {
            return (
                <TaskList tasks={data.recentTasks || []} />
            );
        }
    };

    return (
        <>
            <DashboardLayout
                header={
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h1>The <span style={{ color: 'var(--accent-primary)' }}>Dashboard</span></h1>
                            <button
                                onClick={toggleAlwaysOnTop}
                                className="glass glass-interactive"
                                style={{ padding: '4px 8px', fontSize: '10px', color: isAlwaysOnTop ? 'var(--accent-primary)' : 'var(--text-dim)', border: '1px solid var(--glass-border)' }}
                            >
                                PIN {isAlwaysOnTop ? 'ON' : 'OFF'}
                            </button>
                            <button
                                onClick={toggleCompact}
                            className="glass glass-interactive"
                            style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--text-dim)', border: '1px solid var(--glass-border)' }}
                        >
                            {isCompact ? 'EXPAND' : 'COMPACT'}
                        </button>
                        <button
                            onClick={() => {
                                console.log('[Dashboard] Header CLEAR button clicked');
                                setShowClearConfirm(true);
                            }}
                            className="glass glass-interactive"
                            style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--accent-error)', border: '1px solid var(--glass-border)' }}
                        >
                            CLEAR
                        </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="status" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className={`heartbeat ${status}`} />
                            <span className={status}>{status === 'online' ? 'Connected' : status}</span>
                        </div>
                        {!isCompact && (
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                                V1.0.0-PRO
                            </div>
                        )}
                    </div>
                </>
            }
        >
            {/* Top Level Vital Metrics - 4 equal columns (2 in compact) */}
            <section style={{
                display: 'grid',
                gridTemplateColumns: isCompact ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                gap: '8px',
                paddingBottom: '12px',
                flexShrink: 0
            }}>
                {/* Column 1: CPU - spans full height */}
                <div style={{ display: 'flex', minHeight: '140px' }}>
                    {(() => {
                        const cpuUsage = safeGet(system, 'cpu.usage', 0);
                        return (
                            <MetricCard
                                title="CPU"
                                value={cpuUsage}
                                unit="%"
                                icon={Icons.CPU}
                                color={getAdaptiveColor(cpuUsage)}
                                history={!isCompact ? cpuHistory : null}
                                maxValue={100}
                            />
                        );
                    })()}
                </div>

                {/* Column 2: Memory - spans full height */}
                <div style={{ display: 'flex', minHeight: '140px' }}>
                    {(() => {
                        const ramPercent = safeGet(system, 'memory.percent', 0);
                        return (
                            <MetricCard
                                title="Memory"
                                value={`${safeGet(system, 'memory.used', 0).toFixed(1)}/${safeGet(system, 'memory.total', 0).toFixed(0)}`}
                                unit="GB"
                                icon={Icons.RAM}
                                color={getAdaptiveColor(ramPercent)}
                                history={!isCompact ? ramHistory : null}
                                maxValue={100}
                            />
                        );
                    })()}
                </div>

                {/* Column 3: Active Queue + Total Tasks */}
                {!isCompact && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
                        <div style={{ flex: 1 }}>
                            <MetricCard
                                title="Active Queue"
                                value={totalActiveWork}
                                icon={Icons.Queue}
                                color="var(--accent-warning)"
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <MetricCard
                                title="Completed Tasks"
                                value={cumulative.completedTasks || 0}
                                icon={Icons.Tasks}
                                color="var(--accent-success)"
                            />
                        </div>
                    </div>
                )}

                {/* Column 4: API Health + Uptime */}
                {!isCompact && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
                        <div style={{ flex: 1 }}>
                            <MetricCard
                                title="API Health"
                                value={`${apiMetrics.successRate || 100}%`}
                                icon={Icons.API}
                                color={apiMetrics.successRate >= 90 ? 'var(--accent-success)' : apiMetrics.successRate >= 70 ? 'var(--accent-warning)' : 'var(--accent-error)'}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <MetricCard
                                title="Uptime"
                                value={Math.floor(cumulative.sessionUptimeMs / 1000 / 60) || 0}
                                unit="min"
                                icon={Icons.Uptime}
                                color="var(--accent-primary)"
                            />
                        </div>
                    </div>
                )}
            </section>

            {/* Main Content Area - Option C Layout */}
            {!isCompact ? (
                <section style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    {/* Left: Tabbed Content Area (85%) */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    onClick={() => setActiveTab('fleet')}
                                    style={{
                                        padding: '8px 16px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        background: activeTab === 'fleet' ? 'var(--accent-primary)' : 'transparent',
                                        color: activeTab === 'fleet' ? '#000' : 'var(--text-secondary)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '4px 4px 0 0',
                                        cursor: 'pointer',
                                        transition: 'all 0.1s'
                                    }}
                                >
                                    Status
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    style={{
                                        padding: '8px 16px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        background: activeTab === 'history' ? 'var(--accent-primary)' : 'transparent',
                                        color: activeTab === 'history' ? '#000' : 'var(--text-secondary)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '4px 4px 0 0',
                                        cursor: 'pointer',
                                        transition: 'all 0.1s'
                                    }}
                                >
                                    History
                                </button>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                {activeTab === 'fleet' ? `${sessions.length} Browser(s) Discovered` : `${(data.recentTasks || []).length} Events`}
                            </span>
                        </div>
                        <div className="glass" style={{
                            flex: 1,
                            padding: '16px',
                            overflowY: 'auto',
                            minHeight: '200px'
                        }}>
                            {renderTabContent()}
                        </div>
                    </div>

                    {/* Right: Mission Control Stats (15%) */}
                    <div style={{ width: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                            {/* Twitter Engagement - 6 metrics */}
                            <div className="glass" style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase' }}>Twitter</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '16px', fontWeight: '500', color: '#f97316' }}>{twitterActions.likes || 0}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Like</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '16px', fontWeight: '500', color: '#f97316' }}>{twitterActions.retweets || 0}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Retweet</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '16px', fontWeight: '500', color: '#f97316' }}>{twitterActions.replies || 0}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Reply</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '16px', fontWeight: '500', color: '#f97316' }}>{twitterActions.quotes || 0}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Quote</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '16px', fontWeight: '500', color: '#f97316' }}>{twitterActions.follows || 0}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Follow</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '16px', fontWeight: '500', color: '#f97316' }}>{twitterActions.bookmarks || 0}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Mark</div>
                                    </div>
                                </div>
                            </div>


                        </div>
                    </div>
                </section>
            ) : (
                /* Compact Mode - Simple grid */
                <section style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                        gap: '12px'
                    }}>
                        {sessions.map(session => (
                            <SessionItem key={session.id} session={session} />
                        ))}
                        {sessions.length === 0 && (
                            <div className="glass" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                                No active sessions.
                            </div>
                        )}
                    </div>
                </section>
            )}
        </DashboardLayout>

        {showClearConfirm && (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }}>
                <div className="glass" style={{
                    padding: '24px',
                    maxWidth: '400px',
                    textAlign: 'center',
                    border: '1px solid var(--accent-error)'
                }}>
                    <h3 style={{ color: 'var(--accent-error)', marginBottom: '16px' }}>Clear History?</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
                        This will reset all tasks, Twitter actions, and metrics. This action cannot be undone.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button
                            onClick={() => setShowClearConfirm(false)}
                            className="glass glass-interactive"
                            style={{ padding: '8px 16px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                console.log('[Dashboard] Clear button clicked, socket:', socketRef.current?.connected);
                                if (socketRef.current) {
                                    socketRef.current.emit('clear-history');
                                    console.log('[Dashboard] clear-history event emitted');
                                } else {
                                    console.log('[Dashboard] Socket is null!');
                                }
                                setShowClearConfirm(false);
                            }}
                            style={{
                                padding: '8px 16px',
                                background: 'var(--accent-error)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: '600'
                            }}
                        >
                            Clear All
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

export default App;
