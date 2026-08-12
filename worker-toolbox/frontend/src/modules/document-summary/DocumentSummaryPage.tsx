import { useState } from 'react'
import { Typography, Input, Button, Radio, Spin, Upload, message, Card } from 'antd'
import { FileTextOutlined, UploadOutlined } from '@ant-design/icons'
import MarkdownRenderer from '../../components/MarkdownRenderer'
import VoiceInput from '../../shared/VoiceInput'

const { Title, Text } = Typography
const { TextArea } = Input

function DocumentSummaryPage() {
  const [mode, setMode] = useState<'text' | 'url'>('text')
  const [input, setInput] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRun = async () => {
    if (!input.trim() && !file) return; setLoading(true)
    try {
      const formData = new FormData()
      if (mode === 'url') formData.append('url', input); else formData.append('text', input)
      if (file) formData.append('file', file)
      const d = await (await fetch('/api/document-summary/run', { method: 'POST', body: formData })).json()
      if (d.code === 0) setOutput(d.data.result); else message.error(d.msg || 'Failed 失敗')
    } catch { message.error('Failed 調用失敗') } finally { setLoading(false) }
  }

  return (
    <div className="tool-header" style={{ maxWidth: 860, margin: '0 auto' }}>
      <Title level={3}><FileTextOutlined /> Document Summary 文件摘要</Title>
      <Text type="secondary">Paste text, enter a URL, or upload a PDF — AI generates a structured summary  |  粘貼文字、輸入網址或上傳 PDF，AI 自動生成結構化摘要</Text>

      <Radio.Group value={mode} onChange={e => setMode(e.target.value)} style={{ marginTop: 16, marginBottom: 12 }}>
        <Radio.Button value="text">Paste Text 粘貼文字</Radio.Button>
        <Radio.Button value="url">URL 網址</Radio.Button>
      </Radio.Group>

      <VoiceInput onResult={(text) => setInput(text)} />
      <TextArea rows={mode === 'text' ? 12 : 2} value={input} onChange={e => setInput(e.target.value)}
        placeholder={mode === 'url' ? 'Enter webpage URL... 輸入網頁網址...' : 'Paste text to summarize... 粘貼要摘要嘅文字...'} style={{ borderRadius: 10 }} />

      <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Upload beforeUpload={f => { setFile(f); return false }} maxCount={1} showUploadList={!!file}>
          <Button icon={<UploadOutlined />}>Upload PDF 上傳 PDF</Button>
        </Upload>
        <Button type="primary" onClick={handleRun} loading={loading} style={{ borderRadius: 100, paddingLeft: 24, paddingRight: 24 }}>Generate Summary 生成摘要</Button>
      </div>

      {loading && <Spin style={{ margin: '28px auto', display: 'block' }} />}

      {output && (
        <Card style={{ marginTop: 22, borderRadius: 14, border: 'none' }} styles={{ body: { padding: '22px 28px' } }}>
          <MarkdownRenderer content={output} />
        </Card>
      )}
    </div>
  )
}

export default DocumentSummaryPage
