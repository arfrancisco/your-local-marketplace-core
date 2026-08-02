import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth'
import { ErrorBoundary } from './components/ErrorBoundary'
import { reportClientError } from './api/client'

// ErrorBoundary only sees errors thrown during render. A rejected promise with
// no .catch() (a failed fetch in an effect, say) never reaches the render tree,
// so it is reported here instead. A third-party SDK would install this hook for
// us; doing it by hand is a few lines and avoids the dependency.
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  reportClientError(
    reason instanceof Error
      ? { name: reason.name, message: reason.message, stack: reason.stack }
      : { name: 'UnhandledRejection', message: String(reason) },
  )
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
