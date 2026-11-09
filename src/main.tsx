import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './app/App'
import { SettingsProvider } from './app/settings'
import { AuthGate } from './features/auth/AuthGate'
import { ConfirmProvider, ToastProvider } from './ui/Feedback'

import './fonts/fonts.css'
import './ui/tokens.css'
import './ui/base.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <SettingsProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthGate>
            <App />
          </AuthGate>
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  </StrictMode>,
)
