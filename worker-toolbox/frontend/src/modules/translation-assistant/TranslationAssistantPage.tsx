import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Typography, Input, Button, Spin, message, Segmented } from 'antd'
import { TranslationOutlined } from '@ant-design/icons'
import { llmService } from '../../services/llmService'
import VoiceInput from '../../shared/VoiceInput'

const { Title, Text } = Typography
const { TextArea } = Input

const MODES = [
  { value: 'translate_zh_en', label: 'ZH→EN 中→英' },
  { value: 'translate_en_zh', label: 'EN→ZH 英→中' },
  { value: 'polish', label: 'Polish 潤色' },
  { value: 'rewrite', label: 'Rewrite 改寫' },
  { value: 'expand', label: 'Expand 擴寫' },
  { value: 'summarize', label: 'Condense 縮寫' },
  { value: 'style_casual', label: 'Formal→Casual 正式→口語' },
  { value: 'style_formal', label: 'Casual→Formal 口語→正式' },
  { value: 'generate_reply', label: 'Reply 生成回覆' },
]

function TranslationAssistantPage() {
  const [searchParams] = useSearchParams()
  const presetText = searchParams.get('text') || ''
  const presetMode = searchParams.get('mode') || 'translate_zh_en'

  const [mode, setMode] = useState(presetMode)
  const [input, setInput] = useState(presetText)
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  // Auto-run if text was passed
  useEffect(() => {
    if (presetText) {
      const run = async () => {
        setLoading(true)
        try {
          const resp: any = await llmService.call('/api/translation-assistant/run', { text: presetText, mode: presetMode })
          setOutput(resp.data.result)
        } catch { message.error('Failed 調用失敗') } finally { setLoading(false) }
      }
      run()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = async () => {
    if (!input.trim()) return
    setLoading(true)
    try {
      const resp: any = await llmService.call('/api/translation-assistant/run', { text: input, mode })
      setOutput(resp.data.result)
    } catch { message.error('Failed 調用失敗') } finally { setLoading(false) }
  }

  return (
    <div className="tool-header">
      <Title level={3}><TranslationOutlined /> Translation & Writing 翻譯寫作助手</Title>
      <Text type="secondary">9 modes: translate, polish, rewrite, expand, condense, style shift  |  9種模式：中英互譯、潤色、改寫、擴寫、縮寫、風格轉換</Text>

      <Segmented value={mode} onChange={v => setMode(v as string)}
        options={MODES} style={{ marginTop: 16, marginBottom: 12 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <VoiceInput onResult={(text) => setInput(text)} autoRun />
        <Text type="secondary" style={{ fontSize: 11 }}>Click 🎤 to speak — auto-fills & generates</Text>
      </div>
      <TextArea rows={8} value={input} onChange={e => setInput(e.target.value)}
        placeholder="Enter text to process... 輸入要處理嘅文字..." style={{ borderRadius: 10 }} />

      <div style={{ marginTop: 14 }}>
        <Button type="primary" onClick={handleRun} loading={loading} style={{ borderRadius: 100, paddingLeft: 24, paddingRight: 24 }}>Process 開始處理</Button>
      </div>

      {loading && <Spin style={{ margin: '28px auto', display: 'block' }} />}

      {output && (
        <div className="output-panel" style={{ marginTop: 22 }}>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8 }}>{output}</div>
        </div>
      )}
    </div>
  )
}

export default TranslationAssistantPage
