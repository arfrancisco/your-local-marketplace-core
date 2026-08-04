import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportClientError } from '../api/client'

interface Props {
  children: ReactNode
}

interface State {
  crashed: boolean
  // Set once the fire-and-forget report to /client_errors resolves — the crash
  // UI already rendered before this arrives, so it appears a beat later.
  errorId?: number
}

// Catches render-time crashes anywhere below it and reports them to our own
// API (see reportClientError) rather than a third-party monitoring SDK.
//
// React only routes render/lifecycle errors here — async failures never touch
// the render tree, so main.tsx also listens for 'unhandledrejection'.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void reportClientError({
      name: error.name,
      // componentStack is the useful one when a minified build gives a thin
      // error.stack — it names the component that actually blew up.
      message: error.message,
      stack: error.stack ?? info.componentStack ?? undefined,
    }).then((errorId) => {
      if (errorId !== undefined) this.setState({ errorId })
    })
  }

  render(): ReactNode {
    if (!this.state.crashed) return this.props.children

    return (
      <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p>Please refresh the page to try again.</p>
        {this.state.errorId !== undefined && (
          <p style={{ fontSize: '0.85rem', color: '#888' }}>
            Error ID: {this.state.errorId} — mention this if you report the issue.
          </p>
        )}
        <button type="button" onClick={() => window.location.reload()}>
          Refresh
        </button>
      </div>
    )
  }
}
