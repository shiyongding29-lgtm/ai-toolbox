import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Typography, Input, Button, Segmented, Spin, message } from 'antd'
import { MailOutlined, SendOutlined, DownloadOutlined } from '@ant-design/icons'
import { llmService } from '../../services/llmService'
import MarkdownRenderer from '../../components/MarkdownRenderer'
import VoiceInput from '../../shared/VoiceInput'

const { Title, Text } = Typography
const { TextArea } = Input

const MODES = [
  { value: 'email', label: 'Email 郵件' },
  { value: 'official', label: 'Official 公文' },
  { value: 'report', label: 'Report 報告' },
  { value: 'notice', label: 'Notice 通知' },
]

function EmailDocPage() {
  const [searchParams] = useSearchParams()
  const presetTo = searchParams.get('to') || ''
  const presetHint = searchParams.get('hint') || ''
  const presetFull = searchParams.get('full') || ''
  const presetSubject = searchParams.get('subject') || ''
  const presetMode = searchParams.get('mode') || 'email'
  const presetStyle = searchParams.get('style') || ''

  const [mode, setMode] = useState(presetMode)
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)

  // Auto-generate when params are provided
  useEffect(() => {
    if (presetHint || presetTo || presetFull) {
      const parts: string[] = []
      if (presetTo) parts.push(`收件人: ${presetTo}`)
      if (presetSubject) parts.push(`主题: ${presetSubject}`)
      if (presetHint) parts.push(`内容: ${presetHint}`)
      if (presetFull && !presetHint) parts.push(`${presetFull}`)
      if (presetStyle) parts.push(`风格: ${presetStyle === 'formal' ? '正式' : '随意'}`)
      const prompt = parts.join('\n')
      setInput(prompt)
      setEditing(true)
      const timer = setTimeout(() => {
        setLoading(true)
        llmService.call('/api/email-doc/run', { text: prompt, mode: presetMode })
          .then((resp: any) => { setOutput(resp.data.result) })
          .catch(() => { message.error('生成失败，点击 Generate 重试') })
          .finally(() => setLoading(false))
      }, 500)
      return () => clearTimeout(timer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = async () => {
    if (!input.trim()) return
    setLoading(true)
    try {
      const resp: any = await llmService.call('/api/email-doc/run', { text: input, mode })
      setOutput(resp.data.result); setEditing(false)
    } catch { message.error('Failed 調用失敗') } finally { setLoading(false) }
  }

  const sendToMailApp = () => {
    const lines = output.split('\n')
    let subject = ''
    for (const l of lines) {
      const s = l.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
      if (s && !s.startsWith('-') && !s.startsWith('|') && s.length > 2) { subject = s.substring(0, 200); break }
    }
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(output)}`, '_blank')
    message.success('Opened email client 已打開郵件客戶端')
  }

  const downloadMarkdown = () => {
    const blob = new Blob([output], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'document.md'; a.click()
    URL.revokeObjectURL(url)
    message.success('Markdown downloaded 已下載')
  }

  return (
    <div className="tool-header">
      <Title level={3}><MailOutlined /> Email & Document Generator 郵件公文生成</Title>
      <Text type="secondary">4 formats: email, official document, report, notice  |  4種格式：郵件、公文、報告、通知</Text>

      <Segmented value={mode} onChange={v => setMode(v as string)} options={MODES} style={{ marginTop: 16, marginBottom: 12 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <VoiceInput onResult={(text) => setInput(text)} autoRun />
        <Text type="secondary" style={{ fontSize: 11 }}>Click 🎤 to speak — auto-fills & generates</Text>
      </div>
      <TextArea rows={8} value={input} onChange={e => setInput(e.target.value)}
        placeholder="Describe your needs, e.g. Write an invitation for the product launch event... 描述你嘅需求..." style={{ borderRadius: 10 }} />

      <div style={{ marginTop: 14 }}>
        <Button type="primary" onClick={handleRun} loading={loading} style={{ borderRadius: 100, paddingLeft: 24, paddingRight: 24 }}>Generate 生成</Button>
      </div>

      {loading && <Spin style={{ margin: '28px auto', display: 'block' }} />}

      {output && (
        <div className="output-panel" style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
            <Button size="small" icon={<DownloadOutlined />} onClick={downloadMarkdown} style={{ borderRadius: 100 }}>Download MD 下載</Button>
            <Button size="small" onClick={() => setEditing(!editing)}>{editing ? 'Preview 預覽' : 'Edit 編輯'}</Button>
            <Button type="primary" size="small" icon={<SendOutlined />} onClick={sendToMailApp}>Send via Email 發送到郵件</Button>
          </div>
          {editing ? <TextArea rows={18} value={output} onChange={e => setOutput(e.target.value)} style={{ borderRadius: 8 }} /> : <MarkdownRenderer content={output} />}
        </div>
      )}
    </div>
  )
}

export default EmailDocPage
