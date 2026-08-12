import { useState } from 'react'
import { Typography, Input, Button, Card, Spin, message, Tag, Progress } from 'antd'
import { SmileOutlined, SendOutlined } from '@ant-design/icons'
const { Title, Text } = Typography; const { TextArea } = Input

export default function SentimentAnalyzerPage() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const analyze = async () => {
    if (!text.trim()) return; setLoading(true); setResult(null)
    try {
      const r = await fetch('/api/sentiment/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:text.trim()}) })
      const j = await r.json()
      if (j.code===0) setResult(j.data); else message.error(j.msg)
    } catch { message.error('Failed') }
    finally { setLoading(false) }
  }

  const colors: Record<string,string> = {positive:'#10b981',negative:'#ef4444',neutral:'#f59e0b'}

  return (
    <div style={{ maxWidth:800, margin:'0 auto' }}>
      <Title level={3}><SmileOutlined /> Sentiment Analyzer 情感分析</Title>
      <Text type="secondary">Analyze sentiment: positive / negative / neutral</Text>
      <TextArea rows={6} value={text} onChange={e=>setText(e.target.value)}
        placeholder="Enter text to analyze... 輸入要分析的文本..."
        style={{ borderRadius:10, marginTop:16 }} />
      <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={analyze}
        style={{ borderRadius:100, marginTop:12, background:'linear-gradient(135deg,#8b5cf6,#6366f1)',border:'none' }}>Analyze 分析</Button>
      {loading && <Spin style={{ margin:'20px auto', display:'block' }} />}
      {result && (
        <Card style={{ marginTop:20, borderRadius:14, textAlign:'center' }}>
          <div style={{ fontSize:48 }}>{result.sentiment==='positive'?'😊':result.sentiment==='negative'?'😡':'😐'}</div>
          <Tag color={colors[result.sentiment]||'default'} style={{ fontSize:18, padding:'4px 20px', borderRadius:100 }}>{result.sentiment?.toUpperCase()}</Tag>
          <div style={{ marginTop:12 }}><Progress percent={Math.round(result.confidence*100)} strokeColor={colors[result.sentiment]} size="small" /></div>
          {result.scores && <div style={{ marginTop:8, display:'flex', gap:12, justifyContent:'center' }}>
            {Object.entries(result.scores).map(([k,v])=> <Text key={k} style={{ fontSize:11, color:colors[k] }}>{k}: {(v as number*100).toFixed(1)}%</Text>)}
          </div>}
        </Card>
      )}
    </div>
  )
}
