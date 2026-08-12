import { useState } from 'react'
import { Typography, Input, Button, Upload, Spin, message, Card } from 'antd'
import { ReadOutlined, UploadOutlined, LinkOutlined } from '@ant-design/icons'
import VoiceInput from '../../shared/VoiceInput'

const { Title, Text } = Typography
const { TextArea } = Input

function MultiSourceReaderPage() {
  const [urls, setUrls] = useState(''); const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState(''); const [sources, setSources] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const handleRead = async () => {
    if (!urls.trim() && files.length === 0) return; setLoading(true)
    try {
      const formData = new FormData(); formData.append('urls', urls)
      files.forEach(f => formData.append('files', f))
      const d = await (await fetch('/api/multi-source-reader/read', { method: 'POST', body: formData })).json()
      if (d.code === 0) { setResult(d.data.result); setSources(d.data.sources || []) } else message.error(d.msg || 'Failed 失敗')
    } catch { message.error('Request failed 請求失敗') } finally { setLoading(false) }
  }

  return (
    <div className="tool-header" style={{ maxWidth: 960, margin: '0 auto' }}>
      <Title level={3}><ReadOutlined /> Multi-Source Reader 多源聚合閱讀</Title>
      <Text type="secondary">Submit multiple URLs + files — AI reads everything and produces a cross-document synthesis report  |  同時提交多個網頁網址同文件，AI 綜合閱讀後輸出跨文檔分析報告</Text>
      <Card size="small" title={<span><LinkOutlined /> URLs 網址 (One per line 每行一個)</span>} style={{ marginTop: 16, borderRadius: 14 }}>
        <VoiceInput onResult={(text) => setUrls(text)} />
        <TextArea rows={3} value={urls} onChange={e => setUrls(e.target.value)} placeholder="https://example.com/article1&#10;https://example.com/article2" style={{ borderRadius: 10 }} />
      </Card>
      <Card size="small" title={<span><UploadOutlined /> Upload Files 上傳文件</span>} style={{ marginTop: 12, borderRadius: 14 }}>
        <Upload multiple beforeUpload={f => { setFiles(prev => [...prev, f]); return false }}
          fileList={files.map((f, i) => ({ uid: `${i}`, name: f.name, status: 'done' } as any))}>
          <Button icon={<UploadOutlined />} style={{ borderRadius: 100 }}>Select PDF / TXT 選擇文件</Button>
        </Upload>
      </Card>
      <div style={{ marginTop: 14 }}><Button type="primary" onClick={handleRead} loading={loading} style={{ borderRadius: 100, paddingLeft: 24, paddingRight: 24 }}>Read All 開始綜合閱讀</Button></div>
      {sources.length > 0 && <div style={{ marginTop: 12 }}><Text type="secondary">{sources.length} sources read 個來源已讀取</Text></div>}
      {loading && <Spin style={{ display: 'block', marginTop: 24 }} />}
      {result && <Card style={{ marginTop: 20, borderRadius: 14, border: 'none' }} styles={{ body: { padding: '22px 28px' } }}><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{result}</div></Card>}
    </div>
  )
}

export default MultiSourceReaderPage
