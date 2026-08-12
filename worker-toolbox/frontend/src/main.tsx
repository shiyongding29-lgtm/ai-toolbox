import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// Apply theme immediately so body background renders before React mounts
const saved = localStorage.getItem('theme-mode')
const isDarkOnLoad = saved === 'dark'
if (isDarkOnLoad) {
  document.documentElement.setAttribute('data-theme', 'dark')
  document.body.style.backgroundColor = '#0d1117'
  document.body.style.color = '#e6edf3'
} else {
  document.body.style.backgroundColor = '#f5f6fa'
  document.body.style.color = '#1f2328'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
