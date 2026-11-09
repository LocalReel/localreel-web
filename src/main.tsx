import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './app/App'
import { SettingsProvider } from './app/settings'
import { AuthGate } from './features/auth/AuthGate'
import { PublicSharePage } from './features/share/PublicSharePage'
import { ConfirmProvider, ToastProvider } from './ui/Feedback'

import './fonts/fonts.css'
import './ui/tokens.css'
import './ui/base.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

// A share link is read by people who have no account here, so it never goes
// through the authentication gate: one page, one endpoint, nothing to sign in.
const shareToken = window.location.pathname.match(/^\/s\/([^/]+)\/?$/)?.[1]

createRoot(root).render(
  <StrictMode>
    <SettingsProvider>
      <ToastProvider>
        <ConfirmProvider>
          {shareToken ? (
            <PublicSharePage token={shareToken} />
          ) : (
            <AuthGate>
              <App />
            </AuthGate>
          )}
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  </StrictMode>,
)
