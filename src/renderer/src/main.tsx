import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { AppRoutes } from './AppRoutes'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

// Hash routing works with the file:// URL the packaged app loads from.
createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  </StrictMode>,
)
