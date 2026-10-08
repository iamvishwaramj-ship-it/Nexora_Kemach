import React from 'react';

// The app has never had a top-level error boundary — before this, ANY
// uncaught error anywhere in the render tree (a null/undefined access, a
// stale ref, a DOM race) took the WHOLE React root down to a blank white
// screen with no way back short of a manual reload. That is exactly the
// "print sometimes goes to a white screen, reload fixes it" symptom
// reported against printing: window.print() blocks the main thread while
// the OS print dialog is open, and any state update that lands right
// around that point (a query resolving, a timer, a KeepAlive tab's own
// effect) can hit React mid-commit in a way a plain click never would.
// Print is the easiest way to trigger the timing, but nothing here is
// print-specific — this catches that whole CLASS of crash, from any cause,
// app-wide, and turns "blank page, panic, reload" into "one click, carry
// on" instead of a full page reload (which would also lose whatever tabs
// KeepAliveOutlet was holding open).
//
// Deliberately plain HTML/inline styles, no MUI: a crash can originate from
// anywhere in the tree, including inside the ThemeProvider itself, so the
// fallback cannot assume theme context is in a working state.
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[AppErrorBoundary] caught a render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Arial, Helvetica, sans-serif', background: '#0b0f19', color: '#e6e8ee', padding: 24,
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 20, lineHeight: 1.5 }}>
            This screen ran into an unexpected error and stopped responding. Your data on the
            server is unaffected — this only affects what was on screen. Try again below, or
            reload if the same thing happens again.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              style={{
                padding: '8px 16px', borderRadius: 6, border: '1px solid #3a4256', background: '#1c2333',
                color: '#e6e8ee', cursor: 'pointer', fontSize: 13,
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px', borderRadius: 6, border: 'none', background: '#3b82f6',
                color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
