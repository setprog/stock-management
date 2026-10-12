import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './data/store.jsx'
import App from './App.jsx'
import { applyTheme } from './lib/theme.js'
import './index.css'

applyTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
