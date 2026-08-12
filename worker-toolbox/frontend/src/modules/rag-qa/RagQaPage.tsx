import { useState, useEffect } from 'react'
import { Typography, Input, Button, Upload, Spin, message, Card, List, Tag, theme } from 'antd'
import { SearchOutlined, UploadOutlined, FileTextOutlined } from '@ant-design/icons'
import http from '../../services/http'
import VoiceInput from '../../shared/VoiceInput'

const { Title, Text } = Typography

function RagQaPage() {
  const { token } = theme.useToken()
  const [docs, setDocs] = useState<{ name: string; chunks: number }[]>([])
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<{ doc_name: string; score: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const loadDocs = async () => { try { const d: any = await http.get('/api/rag-qa/docs'); setDocs(d.data?.documents || []) } catch {} }
  useEffect(() => { loadDocs() }, [])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const r = await fetch('/api/rag-qa/upload', { method: 'POST', body: (() => { const f = new FormData(); f.append('file', file); return f })() })
      const d = await r.json()
      if (d.code === 0) { message.success(d.msg); loadDocs() } else message.error(d.msg)
    } catch { message.error('Upload failed 上傳失敗') } finally { setUploading(false) }
    return false
  }

  const handleAsk = async () => {
    if (!question.trim()) return; setLoading(true)
    try { const d: any = await http.post('/api/rag-qa/ask', { question }); setAnswer(d.data.answer); setSources(d.data.sources || []) } catch { message.error('Query failed 查詢失敗') } finally { setLoading(false) }
  }

  return (
    <div className="tool-header" style={{ maxWidth: 860, margin: '0 auto' }}>
      <Title level={3}><SearchOutlined /> Knowledge Q&A (RAG) 知識庫問答</Title>
      <Text type="secondary">Upload PDF/TXT docs to build a local knowledge base — AI answers based on your documents  |  上傳文件構建本地知識庫，AI 基於文檔內容回答提問</Text>
      <Card size="small" title={<span><FileTextOutlined /> Knowledge Base 知識庫文檔</span>} style={{ marginTop: 16, borderRadius: 14 }} styles={{ body: { padding: '8px 0' } }}>
        {docs.length === 0 ? <div style={{ padding: '16px 20px' }}><Text type="secondary">No documents yet 暫無文檔</Text></div> : (
          <List size="small" dataSource={docs} renderItem={d => <List.Item style={{ paddingLeft: 20, paddingRight: 20 }}><FileTextOutlined style={{ marginRight: 8 }} /> {d.name} <Tag style={{ marginLeft: 8, borderRadius: 100 }}>{d.chunks} chunks 片段</Tag></List.Item>} />
        )}
        <div style={{ padding: '10px 20px' }}><Upload beforeUpload={handleUpload} showUploadList={false}><Button icon={<UploadOutlined />} loading={uploading} style={{ borderRadius: 100 }}>Upload Doc 上傳文檔</Button></Upload></div>
      </Card>
      <Card size="small" style={{ marginTop: 16, borderRadius: 14 }} styles={{ body: { padding: 16 } }}>
        <VoiceInput onResult={(text) => setQuestion(text)} />
        <Input.TextArea rows={3} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a question... 向知識庫提問..." style={{ borderRadius: 10 }} />
        <div style={{ marginTop: 12 }}><Button type="primary" icon={<SearchOutlined />} onClick={handleAsk} loading={loading} style={{ borderRadius: 100, paddingLeft: 20, paddingRight: 20 }}>Ask 提問</Button></div>
      </Card>
      {loading && <Spin style={{ display: 'block', marginTop: 20 }} />}
      {answer && (
        <Card style={{ marginTop: 20, borderRadius: 14, border: 'none' }} styles={{ body: { padding: '22px 28px' } }}>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{answer}</div>
          {sources.length > 0 && <div style={{ marginTop: 16, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 12 }}><Text type="secondary" style={{ fontSize: 12 }}>Sources 參考來源：</Text>{sources.map((s, i) => <div key={i} style={{ fontSize: 12, marginTop: 2 }}>{s.doc_name} <Tag color="blue" style={{ borderRadius: 100 }}>Relevance 相關度: {s.score.toFixed(2)}</Tag></div>)}</div>}
        </Card>
      )}
    </div>
  )
}

export default RagQaPage
