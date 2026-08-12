import { useState } from 'react'
import { Typography, Upload, Button, Card, Spin, message, Space, Select } from 'antd'
import { FilePdfOutlined, InboxOutlined, ScissorOutlined, MergeCellsOutlined } from '@ant-design/icons'
const { Title, Text } = Typography; const { Dragger } = Upload

export default function PdfToolkitPage() {
  const [action, setAction] = useState('extract')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleUpload = async (file: File) => {
    setLoading(true); setResult(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      let url = '/api/pdf/extract'
      if (action === 'split') { url = '/api/pdf/split'; fd.append('pages', '1') }
      const r = await fetch(url, { method: 'POST', body: fd })
      const j = await r.json()
      if (j.code === 0) { setResult(j.data); message.success('Done') }
      else message.error(j.msg)
    } catch { message.error('Failed') }
    finally { setLoading(false) }
    return false
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}><FilePdfOutlined /> PDF Toolkit</Title>
      <Text type="secondary">Extract text, merge or split PDF files</Text>
      <Space style={{ marginTop: 12 }}><Text>Action:</Text>
        <Select value={action} onChange={setAction} style={{ width: 160, borderRadius: 8 }}
          options={[{label:'📄 Extract 提取',value:'extract'},{label:'🔗 Merge 合併',value:'merge'},{label:'✂️ Split 拆分',value:'split'}]} />
      </Space>
      <Dragger accept=".pdf" maxCount={action === 'split' ? 1 : 10} showUploadList={false}
        beforeUpload={handleUpload} style={{ marginTop: 16, borderRadius: 14 }}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Drop PDF here</p>
      </Dragger>
      {loading && <Spin style={{ margin: '20px auto', display: 'block' }} />}
      {result?.text && <Card title="Extracted Text" style={{ marginTop: 20, borderRadius: 14 }}><pre style={{ whiteSpace:'pre-wrap',maxHeight:400,overflow:'auto',fontSize:12 }}>{result.text}</pre></Card>}
      {result?.url && <Card title="Output File" style={{ marginTop: 20, borderRadius: 14 }}><a href={result.url} download>Download</a></Card>}
    </div>
  )
}
