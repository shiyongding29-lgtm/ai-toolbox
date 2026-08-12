import { useState } from 'react'
import { Typography, Upload, Select, Button, Card, Spin, message } from 'antd'
import { SwapOutlined, InboxOutlined } from '@ant-design/icons'
const { Title, Text } = Typography; const { Dragger } = Upload

const FORMATS = [
  { label: 'PDF → TXT', value: 'pdf-txt' },
  { label: 'PDF → DOCX', value: 'pdf-docx' },
  { label: 'DOCX → TXT', value: 'docx-txt' },
  { label: 'DOCX → PDF', value: 'docx-pdf' },
  { label: 'PPTX → PDF', value: 'pptx-pdf' },
  { label: 'HTML → PDF', value: 'html-pdf' },
  { label: 'XLSX → CSV', value: 'xlsx-csv' },
  { label: 'CSV → XLSX', value: 'csv-xlsx' },
]

export default function FileConverterPage() {
  const [fmt, setFmt] = useState('pdf-txt')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleUpload = async (file: File) => {
    setLoading(true); setResult(null)
    try {
      const [src, dst] = fmt.split('-')
      const fd = new FormData(); fd.append('file', file); fd.append('to_format', dst)
      const r = await fetch('/api/convert/convert', { method: 'POST', body: fd })
      const j = await r.json()
      if (j.code === 0) { setResult(j.data); message.success('Done') }
      else message.error(j.msg)
    } catch { message.error('Failed') }
    finally { setLoading(false) }
    return false
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}><SwapOutlined /> File Converter 文件轉換</Title>
      <Text type="secondary">Convert between PDF, Word, Excel, CSV, TXT</Text>
      <div style={{ marginTop: 12 }}>
        <Select value={fmt} onChange={setFmt} style={{ width: 220, borderRadius: 8 }}
          options={FORMATS} />
      </div>
      <Dragger accept=".pdf,.docx,.pptx,.html,.xlsx,.xls,.csv,.txt" maxCount={1} showUploadList={false}
        beforeUpload={handleUpload} style={{ marginTop: 16, borderRadius: 14 }}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Drop file here</p>
      </Dragger>
      {loading && <Spin style={{ margin: '20px auto', display: 'block' }} />}
      {result?.url && (
        <Card title="Converted File" style={{ marginTop: 20, borderRadius: 14 }}>
          <a href={result.url} download>⬇ Download {result.to?.toUpperCase()} File</a>
          {result.note && <Text type="secondary" style={{ display:'block',marginTop:8 }}>{result.note}</Text>}
        </Card>
      )}
    </div>
  )
}
