import { useState } from 'react'
import { Typography, Input, Button, Upload, message, Card, Table, Image } from 'antd'
import { BarChartOutlined, UploadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import VoiceInput from '../../shared/VoiceInput'

const { Title, Text } = Typography

function DataAnalysisPage() {
  const [fileId, setFileId] = useState(''); const [preview, setPreview] = useState<any>(null)
  const [question, setQuestion] = useState(''); const [result, setResult] = useState('')
  const [chartUrl, setChartUrl] = useState(''); const [loading, setLoading] = useState(false)

  const handleUpload = async (file: File) => {
    const formData = new FormData(); formData.append('file', file)
    const d = await (await fetch('/api/data-analysis/upload', { method: 'POST', body: formData })).json()
    if (d.code === 0) { setFileId(d.data.file_id); setPreview(d.data.preview) } else message.error(d.msg)
    return false
  }

  const handleQuery = async () => {
    if (!question.trim()) return; setLoading(true); setResult(''); setChartUrl('')
    try {
      const d = await (await fetch('/api/data-analysis/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_id: fileId, question }) })).json()
      if (d.code === 0) { setResult(d.data.result); setChartUrl(d.data.chart_url || '') } else message.error(d.msg)
    } catch { message.error('Request failed 請求失敗') } finally { setLoading(false) }
  }

  const handleInsights = async () => {
    setLoading(true)
    try {
      const d = await (await fetch('/api/data-analysis/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_id: fileId }) })).json()
      if (d.code === 0) setResult(d.data.result)
    } catch { message.error('Request failed 請求失敗') } finally { setLoading(false) }
  }

  return (
    <div className="tool-header" style={{ maxWidth: 960, margin: '0 auto' }}>
      <Title level={3}><BarChartOutlined /> Data Analysis 數據分析</Title>
      <Text type="secondary">Upload CSV/Excel, ask questions in natural language — AI writes code, executes, draws charts  |  上傳 CSV/Excel，用自然語言提問，AI 自動生成分析程式碼、執行並繪製圖表</Text>
      <Card size="small" style={{ marginTop: 16, borderRadius: 14 }} styles={{ body: { padding: 16 } }}>
        <Upload beforeUpload={handleUpload} showUploadList={false}><Button icon={<UploadOutlined />} style={{ borderRadius: 100 }}>Upload Excel / CSV 上傳</Button></Upload>
        {preview && <div style={{ marginTop: 14 }}><Text strong>{preview.row_count} rows 行, {preview.columns?.length || 0} cols 列</Text>{preview.preview?.length > 0 && <Table dataSource={preview.preview} columns={Object.keys(preview.preview[0]).map(k => ({ title: k, dataIndex: k, key: k }))} size="small" style={{ marginTop: 8 }} pagination={false} />}</div>}
      </Card>
      {fileId && (
        <Card size="small" style={{ marginTop: 14, borderRadius: 14 }} styles={{ body: { padding: 16 } }}>
          <VoiceInput onResult={(text) => setQuestion(text)} />
          <Input.TextArea rows={2} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a question, e.g. Which column has the highest average? 用自然語言提問..." style={{ borderRadius: 10 }} />
          <div style={{ marginTop: 10 }}><Button type="primary" onClick={handleQuery} loading={loading} style={{ borderRadius: 100, paddingLeft: 20, paddingRight: 20 }}>Query 查詢</Button><Button icon={<ThunderboltOutlined />} onClick={handleInsights} loading={loading} style={{ marginLeft: 8, borderRadius: 100 }}>AI Insights 洞察</Button></div>
        </Card>
      )}
      {chartUrl && <Card style={{ marginTop: 16, borderRadius: 14 }} styles={{ body: { padding: 16 } }}><Image src={chartUrl} style={{ maxWidth: '100%' }} /></Card>}
      {result && <Card style={{ marginTop: 16, borderRadius: 14, border: 'none' }} styles={{ body: { padding: '20px 26px' } }}><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{result}</div></Card>}
    </div>
  )
}

export default DataAnalysisPage
