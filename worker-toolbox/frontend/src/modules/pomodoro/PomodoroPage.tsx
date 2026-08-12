import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Typography, Button, Slider, Space, Card, message, theme } from 'antd'
import { ClockCircleOutlined, PauseCircleOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const TOMATO = '🍅'

function PomodoroPage() {
  const [searchParams] = useSearchParams()
  const { token } = theme.useToken()
  const isDark = token.colorBgLayout?.toString().includes('dark') || false
  const presetWork = parseInt(searchParams.get('work') || '') || 25
  const [workMin, setWorkMin] = useState(presetWork)
  const [breakMin, setBreakMin] = useState(5)
  const [phase, setPhase] = useState<'work' | 'break'>('work')
  const [seconds, setSeconds] = useState(presetWork * 60)
  const [running, setRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const totalSeconds = phase === 'work' ? workMin * 60 : breakMin * 60
  const progress = 1 - seconds / totalSeconds
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  // Timer — keep state updater pure
  const countdownRef = useRef(seconds)
  countdownRef.current = seconds
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      if (countdownRef.current <= 1) {
        clearInterval(t)
        setSeconds(0)
      } else {
        setSeconds(s => s - 1)
      }
    }, 1000)
    return () => clearInterval(t)
  }, [running])

  // Phase transition
  useEffect(() => {
    if (!running || seconds > 0) return
    // Try to play sound
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    }
    message.success(phase === 'work' ? 'Work done! Take a break 🍵 工作完成，休息一下！' : 'Break over! Back to work 💪 休息結束，繼續工作！', 3)

    if (phase === 'work') {
      setPhase('break')
      setSeconds(breakMin * 60)
      setSessionCount(s => s + 1)
    } else {
      setPhase('work')
      setSeconds(workMin * 60)
    }
  }, [seconds, phase])

  const toggle = () => setRunning(r => !r)
  const reset = () => {
    setRunning(false)
    setPhase('work')
    setSeconds(workMin * 60)
    setSessionCount(0)
  }

  const skip = () => {
    setSeconds(0)
  }

  // Circular SVG parameters
  const r = 110
  const circ = 2 * Math.PI * r
  const strokeDash = circ * progress
  const strokeColor = phase === 'work' ? '#f43f5e' : '#10b981'
  const bgColor = isDark ? '#21262d' : '#f0f0f4'

  return (
    <div className="tool-header" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <Title level={3}><ClockCircleOutlined /> Pomodoro Timer 番茄鐘</Title>
      <Text type="secondary">Focus on work, then take a break — stay productive 🍅 專注工作，適時休息</Text>

      <Card style={{ borderRadius: 20, border: 'none', marginTop: 20, padding: '30px 0' }} styles={{ body: { padding: '30px 20px' } }}>
        {/* Tomato SVG */}
        <div style={{ position: 'relative', width: 260, height: 260, margin: '0 auto' }}>
          <svg width="260" height="260" viewBox="0 0 260 260" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="130" cy="130" r={r} fill="none" stroke={bgColor} strokeWidth="12" />
            <circle cx="130" cy="130" r={r} fill="none" stroke={strokeColor} strokeWidth="12"
              strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - strokeDash}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{phase === 'work' ? 'Focus 專注' : 'Break 休息'}</Text>
            <div style={{ fontSize: 52, fontWeight: 800, fontFamily: "'SF Mono', monospace", color: strokeColor, letterSpacing: -2 }}>
              {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
            </div>
            <div style={{ fontSize: 13, color: strokeColor, marginTop: 4 }}>
              {sessionCount > 0 && <span>{TOMATO.repeat(Math.min(sessionCount, 6))} {sessionCount}</span>}
            </div>
          </div>
        </div>

        {/* Controls */}
        <Space size={12} style={{ marginTop: 24 }}>
          <Button size="large" shape="circle" icon={running ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={toggle} style={{
              width: 56, height: 56, background: strokeColor, border: 'none', color: '#fff',
              boxShadow: `0 4px 14px ${strokeColor}40`,
            }} />
          <Button size="large" shape="circle" icon={<ReloadOutlined />} onClick={reset} style={{ width: 48, height: 48 }} />
        </Space>
        {running && <Button type="link" onClick={skip} style={{ marginTop: 8 }}>Skip 跳過</Button>}
      </Card>

      {/* Settings */}
      <Card size="small" title="Settings 設定" style={{ marginTop: 18, borderRadius: 14, textAlign: 'left' }} styles={{ body: { padding: '14px 20px' } }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Text style={{ fontSize: 12 }}>Focus 專注: <strong>{workMin} min</strong></Text>
            <Slider min={5} max={60} value={workMin}
              onChange={v => { setWorkMin(v); if (!running && phase === 'work') setSeconds(v * 60) }}
              trackStyle={{ background: '#f43f5e' }} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Text style={{ fontSize: 12 }}>Break 休息: <strong>{breakMin} min</strong></Text>
            <Slider min={1} max={30} value={breakMin}
              onChange={v => { setBreakMin(v); if (!running && phase === 'break') setSeconds(v * 60) }}
              trackStyle={{ background: '#10b981' }} />
          </div>
        </div>
      </Card>

      {/* Hidden audio for notification */}
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+AgH9/gH9/f3+Af39/gIB/f3+Af39/gH9/f4B/gH9/f3+Af39/gIB/f3+Af39/gH9/f4B/gH9/f3+Af39/gIB/f3+Af39/gH9/f4B/gH9/f3+Af39/gIB/f3+Af39/gH9/f4B/gH9/f3+Af39/gIB/f3+Af39/gH9/f4B/gH9/f3+Af39/gIB/f3+Af39/gH9/f4B/gH9/f3+Af39/gIA=" type="audio/wav" />
      </audio>
    </div>
  )
}

export default PomodoroPage
