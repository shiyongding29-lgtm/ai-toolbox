import { useState, useEffect, useMemo } from 'react'
import { ConfigProvider, theme as antdTheme, App as AntApp } from 'antd'
import { XProvider } from '@ant-design/x'
import AppRoutes from './routes/AppRoutes'
import './index.css'

type ThemeMode = 'light' | 'dark'

function App() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-mode')
    return (saved === 'light' ? 'light' : 'dark') as ThemeMode
  })

  const isDark = mode === 'dark'

  useEffect(() => {
    localStorage.setItem('theme-mode', mode)
    document.documentElement.setAttribute('data-theme', mode)
    if (isDark) {
      document.body.className = 'dark tech-theme'
      document.body.style.background = '#060913'
    } else {
      document.body.className = 'light tech-theme'
      document.body.style.background = '#f0f4ff'
    }
  }, [mode])

  const toggleTheme = () => setMode((m) => (m === 'light' ? 'dark' : 'light'))

  const themeConfig = useMemo(() => ({
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: isDark ? '#00e5ff' : '#0098c7',
      colorSuccess: '#10b981',
      colorWarning: '#f59e0b',
      colorError: isDark ? '#ff4d6a' : '#e11d48',
      colorInfo: isDark ? '#00e5ff' : '#0098c7',
      colorBgBase: isDark ? '#060913' : '#f0f4ff',
      colorTextBase: isDark ? '#c8d6e5' : '#1a1a2e',
      colorBgContainer: isDark ? '#0d1125' : '#ffffff',
      colorBgElevated: isDark ? '#131940' : '#f8faff',
      colorBorderSecondary: isDark ? 'rgba(0,229,255,0.10)' : 'rgba(0,152,199,0.10)',
      colorBorder: isDark ? 'rgba(0,229,255,0.12)' : 'rgba(0,152,199,0.12)',
      borderRadius: 12,
      borderRadiusSM: 8,
      borderRadiusLG: 16,
      fontFamily: "'Inter', 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      fontSize: 14,
      lineHeight: 1.6,
      controlHeight: 38,
      boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.06)',
      boxShadowSecondary: isDark ? '0 2px 12px rgba(0,229,255,0.06)' : '0 2px 12px rgba(0,152,199,0.06)',
    },
    components: {
      Layout: {
        bodyBg: isDark ? '#060913' : '#f0f4ff',
        siderBg: isDark ? 'rgba(10,15,40,0.85)' : 'rgba(255,255,255,0.85)',
        headerBg: isDark ? 'rgba(10,15,40,0.85)' : 'rgba(255,255,255,0.85)',
      },
      Card: {
        colorBgContainer: isDark ? 'rgba(13,17,37,0.8)' : 'rgba(255,255,255,0.9)',
        borderRadiusLG: 16,
      },
      Button: {
        colorBgContainer: isDark ? 'rgba(20,28,55,0.8)' : '#ffffff',
        borderRadius: 100,
        controlHeight: 38,
        primaryShadow: isDark ? '0 0 20px rgba(0,229,255,0.25)' : '0 0 16px rgba(0,152,199,0.2)',
      },
      Input: {
        colorBgContainer: isDark ? 'rgba(6,9,19,0.8)' : 'rgba(240,244,255,0.6)',
        borderRadius: 10,
        activeShadow: isDark ? '0 0 12px rgba(0,229,255,0.15)' : '0 0 12px rgba(0,152,199,0.12)',
        activeBorderColor: isDark ? '#00e5ff' : '#0098c7',
        hoverBorderColor: isDark ? 'rgba(0,229,255,0.4)' : 'rgba(0,152,199,0.3)',
      },
      Menu: {
        itemBorderRadius: 10,
        itemMarginInline: 6,
        itemHeight: 40,
        iconSize: 17,
        collapsedIconSize: 20,
        darkItemBg: 'transparent',
        darkItemSelectedBg: isDark ? 'rgba(0,229,255,0.10)' : 'rgba(0,152,199,0.08)',
        darkItemHoverBg: isDark ? 'rgba(0,229,255,0.05)' : 'rgba(0,152,199,0.04)',
        darkItemColor: isDark ? '#8899bb' : '#5a6d8a',
        darkItemSelectedColor: isDark ? '#00e5ff' : '#0098c7',
      },
      Select: {
        colorBgContainer: isDark ? 'rgba(13,17,37,0.8)' : '#ffffff',
        borderRadius: 10,
        activeBorderColor: isDark ? '#00e5ff' : '#0098c7',
      },
      Tabs: { inkBarColor: isDark ? '#00e5ff' : '#0098c7', itemSelectedColor: isDark ? '#00e5ff' : '#0098c7' },
      Modal: {
        contentBg: isDark ? '#0d1125' : '#ffffff',
        headerBg: isDark ? '#0d1125' : '#ffffff',
        borderRadiusLG: 18,
      },
      Tag: { borderRadiusSM: 100 },
      Segmented: {
        itemSelectedBg: isDark ? 'rgba(0,229,255,0.15)' : 'rgba(0,152,199,0.1)',
        itemSelectedColor: isDark ? '#00e5ff' : '#0098c7',
      },
    },
  }), [isDark])

  return (
    <ConfigProvider theme={themeConfig}>
      <AntApp>
        <XProvider>
          <AppRoutes themeMode={mode} onToggleTheme={toggleTheme} />
        </XProvider>
      </AntApp>
    </ConfigProvider>
  )
}

export default App
