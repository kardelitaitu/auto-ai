import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const getSocketUrl = () => {
  if (window.DASHBOARD_URL) {
    return window.DASHBOARD_URL;
  }
  const params = new URLSearchParams(window.location.search);
  const port = params.get('port');
  return port ? `http://localhost:${port}` : 'http://localhost:3001';
};

const SOCKET_URL = getSocketUrl();

const safeGet = (obj, path, defaultValue = 'N/A') => {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result == null) return defaultValue;
    result = result[key];
  }
  return result ?? defaultValue;
};

const safeArray = (arr) => Array.isArray(arr) ? arr : [];
const safeObject = (obj) => (obj && typeof obj === 'object') ? obj : {};

const formatNumber = (num) => {
  if (num == null || num === 0) return '0';
  return num.toLocaleString();
};

const formatUptime = (seconds) => {
  if (seconds == null || seconds === 0) return 'N/A';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

const getPercentColor = (percent) => {
  if (percent < 40) return '#00ff88';
  if (percent < 70) return '#ffa502';
  return '#ff4d4d';
};

const App = () => {
  const [socket, setSocket] = useState(null);
  const [connectionState, setConnectionState] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [data, setData] = useState({
    sessions: [],
    queue: { queueLength: 0, isProcessing: false, maxQueueSize: 500 },
    metrics: {},
    recentTasks: [],
    errors: [],
    system: {}
  });
  const socketRef = useRef(null);
  const reconnectAttemptRef = useRef(0);

  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

    console.log('[Dashboard] Connecting to:', SOCKET_URL);
    
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 10000
    });

    newSocket.on('connect', () => {
      console.log('[Dashboard] Connected');
      setConnectionState('connected');
      reconnectAttemptRef.current = 0;
    });

    newSocket.on('disconnect', () => {
      console.log('[Dashboard] Disconnected');
      setConnectionState('connecting');
    });

    newSocket.on('connect_error', (err) => {
      console.log('[Dashboard] Connection error:', err.message);
      setConnectionState('waiting');
      reconnectAttemptRef.current += 1;
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Dashboard] Reconnection attempt:', attemptNumber);
      setConnectionState('connecting');
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('[Dashboard] Reconnected after', attemptNumber, 'attempts');
      setConnectionState('connected');
    });

    newSocket.on('metrics', (newData) => {
      try {
        if (!newData || typeof newData !== 'object') {
          console.warn('[Dashboard] Invalid metrics data received');
          return;
        }

        const normalized = {
          sessions: safeArray(newData?.sessions),
          queue: safeObject(newData?.queue),
          metrics: safeObject(newData?.metrics),
          recentTasks: safeArray(newData?.recentTasks),
          errors: safeArray(newData?.errors || safeObject(newData?.metrics)?.errors),
          system: safeObject(newData?.system)
        };
        setData(normalized);
        setLastUpdate(Date.now());
      } catch (err) {
        console.error('[Dashboard] Error processing metrics:', err);
      }
    });

    socketRef.current = newSocket;
    setSocket(newSocket);
  }, []);

  const handleRefresh = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('requestUpdate');
    }
  }, []);

  useEffect(() => {
    connectSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connectSocket]);

  const sessions = safeArray(data.sessions);
  const onlineSessions = sessions.filter(s => s?.status === 'online');
  const queue = safeObject(data.queue);
  const metrics = safeObject(data.metrics);
  const recentTasks = safeArray(data.recentTasks);
  const system = safeObject(data.system);
  
  const twitter = safeObject(metrics.twitter);
  const twitterActions = safeObject(twitter?.actions);
  
  const uptimeSeconds = safeGet(metrics, 'system.uptime', 0);
  const queueLength = safeGet(data, 'queue.queueLength', 0);
  const maxQueueSize = safeGet(data, 'queue.maxQueueSize', 500);
  const queuePercent = maxQueueSize > 0 ? Math.round((queueLength / maxQueueSize) * 100) : 0;
  
  const cpuUsage = safeGet(system, 'cpu.usage', 0);
  const memPercent = safeGet(system, 'memory.percent', 0);
  const memUsed = safeGet(system, 'memory.used', 0);
  const memTotal = safeGet(system, 'memory.total', 0);
  const cpuCores = safeGet(system, 'cpu.cores', 0);

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected': return '#00ff88';
      case 'connecting': return '#ffa502';
      default: return '#ff4d4d';
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      default: return 'Disconnected';
    }
  };

  const getStatusPulseStyle = () => {
    switch (connectionState) {
      case 'connected': return { backgroundColor: '#00ff88' };
      case 'connecting': return { backgroundColor: '#ffa502' };
      default: return { backgroundColor: '#ff4d4d' };
    }
  };

  const getLastUpdateText = () => {
    if (!lastUpdate) return 'Never';
    const seconds = Math.floor((Date.now() - lastUpdate) / 1000);
    if (seconds < 5) return 'Just now';
    return `${seconds}s ago`;
  };

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#0a0a0f',
      color: '#e0e0e0',
      fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
      padding: '16px',
      boxSizing: 'border-box',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '1px solid #1e1e2e',
    },
    logo: {
      fontSize: '24px',
      fontWeight: '700',
      color: '#ffffff',
      margin: 0,
    },
    logoAccent: {
      color: '#4da6ff',
    },
    headerRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    connectionStatus: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '12px',
      color: '#888',
    },
    statusDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
    },
    refreshBtn: {
      backgroundColor: '#12121a',
      border: '1px solid #1e1e2e',
      color: '#e0e0e0',
      padding: '6px 12px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
    topStatusBar: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      marginBottom: '16px',
      padding: '8px 12px',
      backgroundColor: '#12121a',
      borderRadius: '8px',
      border: '1px solid #1e1e2e',
    },
    metricBar: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    barLabel: {
      fontSize: '11px',
      color: '#888',
      width: '32px',
    },
    barContainer: {
      width: '80px',
      height: '6px',
      backgroundColor: '#1e1e2e',
      borderRadius: '3px',
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: '3px',
      transition: 'width 0.3s ease',
    },
    barValue: {
      fontSize: '12px',
      fontFamily: "'Consolas', 'Monaco', monospace",
      width: '36px',
      textAlign: 'right',
    },
    lastUpdate: {
      marginLeft: 'auto',
      fontSize: '12px',
      color: '#666',
      fontFamily: "'Consolas', 'Monaco', monospace",
    },
    metricsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '12px',
      marginBottom: '12px',
    },
    actionsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: '12px',
      marginBottom: '16px',
    },
    card: {
      backgroundColor: '#12121a',
      borderRadius: '8px',
      padding: '12px',
      border: '1px solid #1e1e2e',
    },
    cardLabel: {
      fontSize: '10px',
      color: '#666',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: '4px',
    },
    cardValue: {
      fontSize: '18px',
      fontWeight: '600',
      fontFamily: "'Consolas', 'Monaco', monospace",
    },
    cardValueGreen: { color: '#00ff88' },
    cardValueBlue: { color: '#4da6ff' },
    cardValueOrange: { color: '#ffa502' },
    cardValuePurple: { color: '#a855f7' },
    cardSubtext: {
      fontSize: '11px',
      color: '#555',
      marginTop: '2px',
    },
    sectionTitle: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#888',
      marginBottom: '8px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    compactList: {
      backgroundColor: '#12121a',
      borderRadius: '8px',
      border: '1px solid #1e1e2e',
      overflow: 'hidden',
    },
    listItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderBottom: '1px solid #1e1e2e',
      fontSize: '12px',
    },
    listItemLast: {
      borderBottom: 'none',
    },
    taskIcon: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
    },
    taskIconSuccess: { backgroundColor: '#00ff88' },
    taskIconError: { backgroundColor: '#ff4d4d' },
    taskName: {
      flex: 1,
      color: '#e0e0e0',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    taskDuration: {
      color: '#666',
      fontFamily: "'Consolas', 'Monaco', monospace",
      fontSize: '11px',
    },
    taskStatusIcon: {
      width: '14px',
      height: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
    },
    statusDotList: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
    },
    statusOnline: { backgroundColor: '#00ff88' },
    statusOffline: { backgroundColor: '#ff4d4d' },
    statusIdle: { backgroundColor: '#ffa502' },
    sessionName: {
      flex: 1,
      color: '#e0e0e0',
    },
    workerCount: {
      color: '#4da6ff',
      fontFamily: "'Consolas', 'Monaco', monospace",
      fontSize: '11px',
    },
    currentTask: {
      color: '#a855f7',
      maxWidth: '120px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    sessionStatus: {
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '10px',
      textTransform: 'uppercase',
    },
    statusOnlineBg: { backgroundColor: 'rgba(0,255,136,0.15)', color: '#00ff88' },
    statusOfflineBg: { backgroundColor: 'rgba(255,77,77,0.15)', color: '#ff4d4d' },
    statusIdleBg: { backgroundColor: 'rgba(255,165,2,0.15)', color: '#ffa502' },
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <header style={styles.header}>
        <h1 style={styles.logo}>Auto<span style={styles.logoAccent}>-AI</span></h1>
        <div style={styles.headerRight}>
          <div style={styles.connectionStatus}>
            <div style={{...styles.statusDot, ...getStatusPulseStyle()}}></div>
            <span>{getStatusText()}</span>
          </div>
          <button style={styles.refreshBtn} onClick={handleRefresh}>
            ↻ Refresh
          </button>
        </div>
      </header>

      <div style={styles.topStatusBar}>
        <div style={styles.metricBar}>
          <span style={styles.barLabel}>CPU</span>
          <div style={styles.barContainer}>
            <div style={{
              ...styles.barFill,
              width: `${Math.min(cpuUsage, 100)}%`,
              backgroundColor: getPercentColor(cpuUsage),
            }}></div>
          </div>
          <span style={{...styles.barValue, color: getPercentColor(cpuUsage)}}>{cpuUsage}%</span>
        </div>
        <div style={styles.metricBar}>
          <span style={styles.barLabel}>RAM</span>
          <div style={styles.barContainer}>
            <div style={{
              ...styles.barFill,
              width: `${Math.min(memPercent, 100)}%`,
              backgroundColor: getPercentColor(memPercent),
            }}></div>
          </div>
          <span style={{...styles.barValue, color: getPercentColor(memPercent)}}>{memPercent}%</span>
        </div>
        <span style={styles.lastUpdate}>Last: {getLastUpdateText()}</span>
      </div>

      <div style={styles.metricsGrid}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Sessions</div>
          <div style={{...styles.cardValue, ...styles.cardValueGreen}}>
            {onlineSessions.length}/{sessions.length}
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Queue</div>
          <div style={{...styles.cardValue, ...styles.cardValueBlue}}>
            {queueLength} <span style={{fontSize: '12px', color: '#666'}}>({queuePercent}%)</span>
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Uptime</div>
          <div style={{...styles.cardValue, ...styles.cardValueOrange}}>
            {formatUptime(uptimeSeconds)}
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>AI Requests</div>
          <div style={{...styles.cardValue, ...styles.cardValuePurple}}>
            {formatNumber(safeGet(twitterActions, 'total', 0))}
          </div>
        </div>
      </div>

      <div style={styles.actionsRow}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Likes</div>
          <div style={{...styles.cardValue, ...styles.cardValueGreen}}>
            {formatNumber(safeGet(twitterActions, 'likes', 0))}
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Retweet</div>
          <div style={{...styles.cardValue, ...styles.cardValueBlue}}>
            {formatNumber(safeGet(twitterActions, 'retweets', 0))}
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Reply</div>
          <div style={{...styles.cardValue, ...styles.cardValueOrange}}>
            {formatNumber(safeGet(twitterActions, 'replies', 0))}
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Quotes</div>
          <div style={{...styles.cardValue, ...styles.cardValuePurple}}>
            {formatNumber(safeGet(twitterActions, 'quotes', 0))}
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Follow</div>
          <div style={{...styles.cardValue, color: '#4da6ff'}}>
            {formatNumber(safeGet(twitterActions, 'follows', 0))}
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Bookmark</div>
          <div style={{...styles.cardValue, color: '#a855f7'}}>
            {formatNumber(safeGet(twitterActions, 'bookmarks', 0))}
          </div>
        </div>
      </div>

      <div style={styles.sectionTitle}>Recent Tasks</div>
      <div style={styles.compactList}>
        {recentTasks.length === 0 ? (
          <div style={{...styles.listItem, justifyContent: 'center', color: '#555'}}>No recent tasks</div>
        ) : (
          recentTasks.slice(0, 6).map((task, index) => {
            const isSuccess = task?.status === 'completed';
            const isError = task?.status === 'failed';
            return (
              <div key={task?.id || index} style={{
                ...styles.listItem,
                ...(index === Math.min(recentTasks.length - 1, 5) ? styles.listItemLast : {}),
              }}>
                <div style={{
                  ...styles.taskIcon,
                  ...(isSuccess ? styles.taskIconSuccess : isError ? styles.taskIconError : { backgroundColor: '#ffa502' }),
                }}></div>
                <span style={styles.taskName}>{safeGet(task, 'name', 'Unknown')}</span>
                <span style={styles.taskDuration}>{safeGet(task, 'duration', '0s')}</span>
                <span style={styles.taskStatusIcon}>
                  {isSuccess ? '✓' : isError ? '✗' : '○'}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div style={{...styles.sectionTitle, marginTop: '16px'}}>Browser Sessions</div>
      <div style={styles.compactList}>
        {sessions.length === 0 ? (
          <div style={{...styles.listItem, justifyContent: 'center', color: '#555'}}>No browser sessions</div>
        ) : (
          sessions.slice(0, 6).map((session, index) => {
            const isOnline = session?.status === 'online';
            const isIdle = session?.status === 'idle';
            return (
              <div key={session?.id || index} style={{
                ...styles.listItem,
                ...(index === Math.min(sessions.length - 1, 5) ? styles.listItemLast : {}),
              }}>
                <div style={{
                  ...styles.statusDotList,
                  ...(isOnline ? styles.statusOnline : isIdle ? styles.statusIdle : styles.statusOffline),
                }}></div>
                <span style={styles.sessionName}>{safeGet(session, 'name', 'Unknown')}</span>
                <span style={styles.workerCount}>
                  {safeGet(session, 'workers', 0)}w
                </span>
                <span style={styles.currentTask}>
                  {safeGet(session, 'currentTask', '-')}
                </span>
                <span style={{
                  ...styles.sessionStatus,
                  ...(isOnline ? styles.statusOnlineBg : isIdle ? styles.statusIdleBg : styles.statusOfflineBg),
                }}>
                  {session?.status || 'unknown'}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default App;
