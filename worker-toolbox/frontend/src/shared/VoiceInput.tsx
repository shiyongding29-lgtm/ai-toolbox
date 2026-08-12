import { useState, useRef, useCallback, useEffect } from 'react'
import { Button, theme } from 'antd'
import { AudioOutlined, LoadingOutlined } from '@ant-design/icons'

interface Props {
  onResult: (transcript: string) => void
  autoRun?: boolean
  disabled?: boolean
  size?: 'small' | 'default'
}

/**
 * 语音输入 — 一句话，点一次说一句
 * 交互流程：
 *   点击 → 红色脉冲 ●正在听... → 说话 → 实时预览文字 → 说完自动停止 → 内容填入 TextArea
 *   autoRun=true 时：填入后自动点击 Generate
 */
export default function VoiceInput({ onResult, autoRun = false, disabled = false, size = 'default' }: Props) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState('')
  const cancelRef = useRef(false)
  const recogRef = useRef<any>(null)
  const onResultRef = useRef(onResult)
  const autoRunRef = useRef(autoRun)
  const { token } = theme.useToken()

  onResultRef.current = onResult
  autoRunRef.current = autoRun

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('浏览器不支持语音识别')
      return
    }

    setError(null)
    setPreview('')
    cancelRef.current = false

    const r = new SpeechRecognition()
    recogRef.current = r
    r.lang = 'zh-CN'
    r.interimResults = true       // 实时预览
    r.continuous = false          // 一句话自动停

    r.onresult = (event: any) => {
      if (cancelRef.current) return
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      if (text.trim()) {
        setPreview(text.trim())
        if (event.results[event.results.length - 1]?.isFinal) {
          cancelRef.current = true
          onResultRef.current(text.trim())
          recogRef.current?.abort()
          recogRef.current = null
          setListening(false)
          setPreview('')
        }
      }
    }

    r.onerror = (e: any) => {
      if (cancelRef.current) return
      if (e.error === 'no-speech') setError('未检测到语音')
      else if (e.error !== 'aborted') setError(e.error)
      setListening(false)
      setPreview('')
    }

    r.onend = () => {
      if (!cancelRef.current) setListening(false)
      setPreview('')
    }

    try {
      r.start()
      setListening(true)
    } catch {
      setError('启动失败')
      setListening(false)
    }
  }, [])

  const stopListening = useCallback(() => {
    cancelRef.current = true
    recogRef.current?.abort()
    recogRef.current = null
    setListening(false)
    setPreview('')
  }, [])

  const toggle = useCallback(() => {
    listening ? stopListening() : startListening()
  }, [listening, startListening, stopListening])

  useEffect(() => {
    return () => { cancelRef.current = true; recogRef.current?.abort() }
  }, [])

  const btnSize = size === 'small' ? 28 : 36

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Button
        type={listening ? 'primary' : 'default'}
        danger={listening}
        shape="circle"
        size={size === 'small' ? 'small' : 'middle'}
        icon={listening ? <LoadingOutlined spin /> : <AudioOutlined />}
        onClick={toggle}
        disabled={disabled}
        style={{
          width: btnSize, height: btnSize, minWidth: btnSize,
          borderRadius: '50%',
          transition: 'all 0.2s',
          ...(listening ? {
            boxShadow: '0 0 0 4px rgba(239,68,68,0.3)',
            animation: 'pulse 1.5s infinite',
            background: '#ef4444',
            borderColor: '#ef4444',
            color: '#fff',
          } : {}),
        }}
        title={listening ? '停止' : '语音输入'}
      />
      {listening && preview && (
        <span title={preview}
          style={{ fontSize: 11, color: token.colorPrimary, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          "{preview}"
        </span>
      )}
      {listening && !preview && (
        <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, animation: 'blink 1s infinite' }}>
          ● 正在听...
        </span>
      )}
      {!listening && error && (
        <span style={{ fontSize: 10, color: token.colorError, maxWidth: 120, lineHeight: 1.3 }}>{error}</span>
      )}
    </span>
  )
}
