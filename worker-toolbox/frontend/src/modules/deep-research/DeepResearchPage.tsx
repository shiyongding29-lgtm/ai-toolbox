import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Typography, Input, Button, Spin, message, Card, List } from 'antd'
import { GlobalOutlined, LinkOutlined } from '@ant-design/icons'
import MarkdownRenderer from '../../components/MarkdownRenderer'
import VoiceInput from '../../shared/VoiceInput'

const { Title, Text } = Typography
const { TextArea } = Input

function DeepResearchPage() {
  const [searchParams] = useSearchParams()
  const presetTopic = searchParams.get('topic') || ''

  const [topic, setTopic] = useState(presetTopic); const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(''); const [sources, setSources] = useState<{ title: string; url: string }[]>([])

  // Auto-run if topic was passed
  useEffect(() => {
    if (presetTopic) handleResearch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResearch = async () => {
    if (!topic.trim()) return; setLoading(true); setReport(''); setSources([])
    try {
      const r = await fetch('/api/deep-research/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic }) })
      const d = await r.json()
      if (d.code === 0) { setReport(d.data.report); setSources(d.data.sources || []) } else message.error(d.msg || 'Failed 調研失敗')
    } catch { message.error('Request failed 請求失敗') } finally { setLoading(false) }
  }

  return (
    <div className="tool-header" style={{ maxWidth: 960, margin: '0 auto' }}>
      <Title level={3}><GlobalOutlined /> Deep Research 深度調研</Title>
      <Text type="secondary">Enter a topic, AI auto-searches the web, reads, analyses & writes a full report with citations  |  輸入主題，AI 自動搜索、閱讀、分析，生成完整研究報告（含引用來源）</Text>
      <VoiceInput onResult={(text) => setTopic(text)} />
      <TextArea rows={3} value={topic} onChange={e => setTopic(e.target.value)}
        placeholder="Enter a research topic, e.g. Quantum computing applications in financial risk... 輸入調研主題..." style={{ borderRadius: 10, marginTop: 16 }} />
      <div style={{ marginTop: 14 }}>
        <Button type="primary" onClick={handleResearch} loading={loading} style={{ borderRadius: 100, paddingLeft: 24, paddingRight: 24 }}>Start Research 開始調研</Button>
      </div>
      {loading && <Card style={{ marginTop: 24, borderRadius: 14, border: 'none', boxShadow: 'none' }}><Spin tip="Researching: Search → Fetch → Analyse → Report... 調研中..." style={{ display: 'block', padding: 40 }} /></Card>}
      {sources.length > 0 && (
        <Card size="small" title={<span><LinkOutlined /> Sources 參考來源</span>} style={{ marginTop: 20, borderRadius: 14 }}>
          <List size="small" dataSource={sources} renderItem={s => <List.Item><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></List.Item>} />
        </Card>
      )}
      {report && <Card style={{ marginTop: 20, borderRadius: 14, border: 'none' }} styles={{ body: { padding: '24px 28px' } }}><MarkdownRenderer content={report} /></Card>}
    </div>
  )
}

export default DeepResearchPage
