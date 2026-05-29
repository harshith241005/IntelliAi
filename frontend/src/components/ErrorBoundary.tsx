import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught react component tree crash:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '40px',
            margin: '20px auto',
            maxWidth: '600px',
            backgroundColor: 'rgba(255, 23, 68, 0.05)',
            border: '1px solid rgba(255, 23, 68, 0.2)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <AlertOctagon size={48} color="#ff1744" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Viewport Pipeline Render Crash</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            The operational telemetry processor encountered an unexpected rendering error.
          </p>
          <pre
            className="monospace"
            style={{
              padding: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '6px',
              width: '100%',
              overflowX: 'auto',
              fontSize: '0.75rem',
              textAlign: 'left',
              color: '#f43f5e',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}
          >
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="ops-btn ops-btn-primary"
            style={{ fontSize: '0.8rem', padding: '8px 16px' }}
          >
            RELOAD OPERATIONS CONSOLE
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
