import { useState } from 'react'
import { Typography, Input, Button, Spin, Upload, message, Card } from 'antd'
import { DiffOutlined, UploadOutlined } from '@ant-design/icons'
import MarkdownRenderer from '../../components/MarkdownRenderer'
import VoiceInput from '../../shared/VoiceInput'

const { Title, Text } = Typography
const { TextArea } = Input

function DocumentComparisonPage() {
  const [textA, setTextA] = useState(''); const [textB, setTextB] = useState('')
  const [fileA, setFileA] = useState<File | null>(null); const [fileB, setFileB] = useState<File | null>(null)
  const [result, setResult] = useState(''); const [loading, setLoading] = useState(false)

  const handleCompare = async () => {
    if (!textA.trim() && !fileA) return; if (!textB.trim() && !fileB) return; setLoading(true)
    try {
      const formData = new FormData(); formData.append('text_a', textA); formData.append('text_b', textB)
      if (fileA) formData.append('file_a', fileA); if (fileB) formData.append('file_b', fileB)
      const d = await (await fetch('/api/document-comparison/compare', { method: 'POST', body: formData })).json()
      if (d.code === 0) setResult(d.data.result); else message.error(d.msg || 'Failed 對比失敗')
    } catch { message.error('Request failed 請求失敗') } finally { setLoading(false) }
  }

  return (
    <div className="tool-header" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Title level={3}><DiffOutlined /> Document Comparison 文件對比分析</Title>
      <Text type="secondary">Compare two documents side-by-side — AI identifies additions, deletions & modifications  |  將兩份文件逐項對比，AI 自動識別新增、刪除、修改內容</Text>
      <div style={{ display: 'flex', gap: 18, marginTop: 16 }}>
        <Card size="small" title="Document A 文件 A" style={{ flex: 1, borderRadius: 14 }} styles={{ body: { padding: 14 } }}>
          <VoiceInput onResult={(text) => setTextA(text)} />
          <TextArea rows={10} value={textA} onChange={e => setTextA(e.target.value)} placeholder="Paste Document A... 粘貼文件 A..." style={{ borderRadius: 8 }} />
          <Upload beforeUpload={f => { setFileA(f); return false }} showUploadList={!!fileA}><Button icon={<UploadOutlined />} size="small" style={{ marginTop: 8, borderRadius: 100 }}>Upload PDF 上傳 PDF</Button></Upload>
        </Card>
        <Card size="small" title="Document B 文件 B" style={{ flex: 1, borderRadius: 14 }} styles={{ body: { padding: 14 } }}>
          <VoiceInput onResult={(text) => setTextB(text)} />
          <TextArea rows={10} value={textB} onChange={e => setTextB(e.target.value)} placeholder="Paste Document B... 粘貼文件 B..." style={{ borderRadius: 8 }} />
          <Upload beforeUpload={f => { setFileB(f); return false }} showUploadList={!!fileB}><Button icon={<UploadOutlined />} size="small" style={{ marginTop: 8, borderRadius: 100 }}>Upload PDF 上傳 PDF</Button></Upload>
        </Card>
      </div>
      <div style={{ marginTop: 16 }}><Button type="primary" onClick={handleCompare} loading={loading} style={{ borderRadius: 100, paddingLeft: 24, paddingRight: 24 }}>Compare 開始對比</Button></div>
      {loading && <Spin style={{ display: 'block', marginTop: 24 }} />}
      {result && <Card style={{ marginTop: 20, borderRadius: 14, border: 'none' }} styles={{ body: { padding: '22px 28px' } }}><MarkdownRenderer content={result} /></Card>}
    </div>
  )
}

export default DocumentComparisonPage
