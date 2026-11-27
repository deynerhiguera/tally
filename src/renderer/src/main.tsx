import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { ApiProvider } from './api/ApiProvider'
import { DemoProvider } from './api/DemoProvider'
import { getApi } from './api/client'
import { AppRoutes } from './AppRoutes'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

// Hash routing works with the file:// URL the packaged app loads from.
createRoot(root).render(
  <StrictMode>
    <ApiProvider api={getApi()}>
      <DemoProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </DemoProvider>
    </ApiProvider>
  </StrictMode>,
)
