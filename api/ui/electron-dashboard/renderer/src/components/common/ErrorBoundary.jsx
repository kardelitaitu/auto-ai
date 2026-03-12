import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[Dashboard Error]', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="glass" style={{ margin: '20px', padding: '40px', textAlign: 'center', border: '1px solid var(--accent-error)' }}>
                    <h2 style={{ color: 'var(--accent-error)' }}>System Error Detected</h2>
                    <p style={{ color: 'var(--text-dim)', marginBottom: '20px' }}>
                        The dashboard encountered a runtime exception.
                    </p>
                    <pre style={{
                        background: 'rgba(0,0,0,0.3)',
                        padding: '10px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        textAlign: 'left',
                        overflow: 'auto',
                        maxHeight: '200px'
                    }}>
                        {this.state.error?.toString()}
                    </pre>
                    <button
                        className="glass glass-interactive"
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '20px', padding: '10px 20px', color: 'var(--accent-primary)' }}
                    >
                        REBOOT DASHBOARD
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
