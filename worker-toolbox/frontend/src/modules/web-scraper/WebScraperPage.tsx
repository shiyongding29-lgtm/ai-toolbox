import { useState } from 'react'
import { Typography, Input, Button, Card, Spin, message } from 'antd'
import { GlobalOutlined, SendOutlined } from '@ant-design/icons'
const { Title, Text } = Typography; const { TextArea } = Input

export default function WebScraperPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const scrape = async () => {
    if (!url.trim()) return; setLoading(true); setResult(null)
    try {
      const r = await fetch('/api/scraper/scrape', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:url.trim()}) })
      const j = await r.json()
      if (j.code===0) setResult(j.data); else message.error(j.msg)
    } catch { message.error('Failed') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth:900, margin:'0 auto' }}>
      <Title level={3}><GlobalOutlined /> Web Scraper 網頁抓取</Title>
      <Text type="secondary">Enter a URL to extract page content</Text>
      <div style={{ display:'flex', gap:8, marginTop:16 }}>
        <Input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." onKeyDown={e=>e.key==='Enter'&&scrape()} style={{ borderRadius:8 }} />
        <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={scrape} style={{ borderRadius:100,flexShrink:0 }}>Scrape</Button>
      </div>
      {loading && <Spin style={{ margin:'20px auto', display:'block' }} />}
      {result?.combined_text && (
        <Card title={`Scraped Content (${result.combined_text.length} chars)`} style={{ marginTop:20, borderRadius:14 }}>
          <pre style={{ whiteSpace:'pre-wrap', maxHeight:500, overflow:'auto', fontSize:12 }}>{result.combined_text}</pre>
        </Card>
      )}
    </div>
  )
}
