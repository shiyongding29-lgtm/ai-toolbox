import { Routes, Route } from 'react-router-dom'
import Home from '../pages/Home'
import ToolLayout from '../pages/ToolLayout'

interface AppRoutesProps {
  themeMode: 'light' | 'dark'
  onToggleTheme: () => void
}

function AppRoutes({ themeMode, onToggleTheme }: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<Home themeMode={themeMode} onToggleTheme={onToggleTheme} />} />
      <Route path="/tools/*" element={<ToolLayout themeMode={themeMode} onToggleTheme={onToggleTheme} />} />
    </Routes>
  )
}

export default AppRoutes
