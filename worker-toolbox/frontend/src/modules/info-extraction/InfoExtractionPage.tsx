import { useState } from 'react'
import { Typography, Input, Button, Radio, Spin, Upload, message, Card } from 'antd'
import { IdcardOutlined, UploadOutlined } from '@ant-design/icons'
import VoiceInput from '../../shared/VoiceInput'

const { Title, Text } = Typography
const { TextArea } = Input

function InfoExtractionPage() {
  const [mode, setMode] = useState('business_card'); const [input, setInput] = useState('')
  const [file, setFile] = useState<File | null>(null); const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRun = async () => {
    if (!input.trim() && !file) return; setLoading(true)
    try {
      const formData = new FormData(); formData.append('text', input); formData.append('mode', mode)
      if (file) formData.append('file', file)
      const d = await (await fetch('/api/info-extraction/run', { method: 'POST', body: formData })).json()
      if (d.code === 0) setOutput(d.data.result); else message.error(d.msg || 'Failed 失敗')
    } catch { message.error('Failed 調用失敗') } finally { setLoading(false) }
  }

  return (
    <div className="tool-header" style={{ maxWidth: 860, margin: '0 auto' }}>
      <Title level={3}><IdcardOutlined /> Info Extraction 資訊提取</Title>
      <Text type="secondary">Extract structured info from text/PDF — business card, contract, or general  |  從文字或 PDF 中提取結構化資訊，支援名片、合約、通用三種模式</Text>
      <Radio.Group value={mode} onChange={e => setMode(e.target.value)} style={{ marginTop: 16, marginBottom: 12 }}>
        <Radio.Button value="business_card">Business Card 名片</Radio.Button>
        <Radio.Button value="contract">Contract 合約</Radio.Button>
        <Radio.Button value="general">General 通用</Radio.Button>
      </Radio.Group>
      <VoiceInput onResult={(text) => setInput(text)} />
      <TextArea rows={8} value={input} onChange={e => setInput(e.target.value)} placeholder="Paste text to extract... 粘貼要提取嘅文字..." style={{ borderRadius: 10 }} />
      <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Upload beforeUpload={f => { setFile(f); return false }} maxCount={1} showUploadList={!!file}><Button icon={<UploadOutlined />}>Upload PDF 上傳 PDF</Button></Upload>
        <Button type="primary" onClick={handleRun} loading={loading} style={{ borderRadius: 100, paddingLeft: 24, paddingRight: 24 }}>Extract Info 提取資訊</Button>
      </div>
      {loading && <Spin style={{ margin: '28px auto', display: 'block' }} />}
      {output && <Card style={{ marginTop: 20, borderRadius: 14, border: 'none' }} styles={{ body: { padding: '20px 26px' } }}><pre style={{ whiteSpace: 'pre-wrap', fontFamily: "'SF Mono', monospace", fontSize: 13, lineHeight: 1.7 }}>{output}</pre></Card>}
    </div>
  )
}

export default InfoExtractionPage
