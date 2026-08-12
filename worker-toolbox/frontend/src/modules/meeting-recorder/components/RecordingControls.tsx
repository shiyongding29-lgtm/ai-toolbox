import { Button, Spin, Typography, theme } from 'antd'
import { AudioOutlined, StopOutlined } from '@ant-design/icons'
import AudioVisualizer from '../../../components/AudioVisualizer'

const { Text } = Typography

interface Props {
  status: 'idle' | 'recording' | 'transcribing' | 'done'
  mode: 'live' | 'online'
  duration: string
  stream: MediaStream | null
  onStart: () => void
  onStop: () => void
  onReset: () => void
}

export default function RecordingControls({ status, mode, duration, stream, onStart, onStop, onReset }: Props) {
  const { token } = theme.useToken()

  if (status === 'recording') {
    return (
      <div>
        {mode === 'live' && <AudioVisualizer stream={stream} width={320} height={44} barColor={token.colorPrimary} />}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(239,68,68,0.1)', margin: '12px auto', animation: 'pulse 1.5s infinite',
        }}>
          <AudioOutlined style={{ fontSize: 30, color: token.colorError }} />
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, fontFamily: "'SF Mono', monospace", color: token.colorText, letterSpacing: -1 }}>
          {duration}
        </div>
        <Text style={{ color: token.colorTextSecondary, display: 'block', marginTop: 4, marginBottom: 20 }}>
          {mode === 'online' ? 'Online meeting recording... 線上會議錄製中...' : 'Recording... 錄製中...'}
        </Text>
        <Button danger icon={<StopOutlined />} size="large" onClick={onStop} style={{ borderRadius: 100 }}>Stop 停止錄製</Button>
        <style>{`@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35) } 50% { box-shadow: 0 0 0 14px rgba(239,68,68,0) } }`}</style>
      </div>
    )
  }

  if (status === 'transcribing') {
    return (
      <div style={{ padding: 30 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: token.colorTextSecondary }}>Transcribing & generating meeting notes... AI 正在轉寫並生成會議紀要...</div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div>
        <div style={{ color: '#10b981', fontSize: 32, marginBottom: 4 }}>✓</div>
        <Text style={{ display: 'block', marginBottom: 14 }}>Recording complete 錄製完成 · {duration}</Text>
        <Button onClick={onReset} style={{ borderRadius: 100 }}>New Recording 開始新錄製</Button>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: token.colorFillSecondary, margin: '0 auto 12px',
      }}>
        <AudioOutlined style={{ fontSize: 30, color: token.colorTextSecondary }} />
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Click to start recording 點擊開始錄製會議</Text>
      <Button type="primary" icon={<AudioOutlined />} size="large" onClick={onStart} style={{ borderRadius: 100, paddingLeft: 28, paddingRight: 28 }}>
        Start Recording 開始錄製
      </Button>
    </div>
  )
}
