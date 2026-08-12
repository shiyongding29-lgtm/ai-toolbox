import { useState } from 'react'
import { Typography, Input, Button, Card, Spin, message, Image } from 'antd'
import { QrcodeOutlined, DownloadOutlined } from '@ant-design/icons'
const { Title, Text } = Typography; const { TextArea } = Input

export default function QrGeneratorPage() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const generate = async () => {
    if (!text.trim()) return; setLoading(true); setResult(null)
    try {
      const r = await fetch('/api/qr/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:text.trim()}) })
      const j = await r.json()
      if (j.code===0) setResult(j.data); else message.error(j.msg)
    } catch { message.error('Failed') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth:700, margin:'0 auto', textAlign:'center' }}>
      <Title level={3}><QrcodeOutlined /> QR Generator 二維碼</Title>
      <Text type="secondary">Generate QR code from text or URL</Text>
      <TextArea rows={3} value={text} onChange={e=>setText(e.target.value)} placeholder="Enter text or URL..."
        style={{ borderRadius:10, marginTop:16 }} />
      <div style={{ marginTop:12 }}><Button type="primary" onClick={generate} loading={loading} style={{ borderRadius:100 }}>Generate QR</Button></div>
      {loading && <Spin style={{ margin:'20px auto', display:'block' }} />}
      {result?.url && (
        <Card style={{ marginTop:20, borderRadius:14, display:'inline-block' }}
          extra={<Button icon={<DownloadOutlined />} style={{ borderRadius:100 }} onClick={()=>{ const a=document.createElement('a'); a.href=result.url; a.download='qr.png'; a.click() }}>Download</Button>}>
          <Image src={result.url} alt="QR" width={260} style={{ borderRadius:8 }} />
        </Card>
      )}
    </div>
  )
}
