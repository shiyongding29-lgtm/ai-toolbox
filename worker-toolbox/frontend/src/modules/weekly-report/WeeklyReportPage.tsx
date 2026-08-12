import { useState, useEffect } from 'react'
import { Typography, Input, Button, Spin, message, Card, List, Divider, theme } from 'antd'
import { CalendarOutlined, ThunderboltOutlined, HistoryOutlined } from '@ant-design/icons'
import { llmService } from '../../services/llmService'
import MarkdownRenderer from '../../components/MarkdownRenderer'
import VoiceInput from '../../shared/VoiceInput'

const { Title, Text } = Typography
const { TextArea } = Input

interface WeeklyItem { id: number; week_start: string; week_end: string; content: string; created_at: string }

function WeeklyReportPage() {
  const { token } = theme.useToken()
  const [input, setInput] = useState(''); const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false); const [autoLoading, setAutoLoading] = useState(false)
  const [reports, setReports] = useState<WeeklyItem[]>([]); const [viewing, setViewing] = useState<WeeklyItem | null>(null)
  const [tab, setTab] = useState<'generate' | 'history' | 'view'>('generate')

  const loadReports = async () => { try { const d = await (await fetch('/api/weekly-report/list')).json(); if (d.code === 0) setReports(d.data || []) } catch {} }
  useEffect(() => { loadReports() }, [])

  const handleRun = async () => {
    if (!input.trim()) return; setLoading(true)
    try { const r: any = await llmService.call('/api/weekly-report/run', { text: input }); setOutput(r.data.result) } catch { message.error('Failed 調用失敗') } finally { setLoading(false) }
  }

  const handleAuto = async () => {
    setAutoLoading(true)
    try { const d = await (await fetch('/api/weekly-report/auto', { method: 'POST' })).json(); if (d.code === 0) { setOutput(d.data.result); loadReports(); message.success('Weekly report auto-generated 周報已自動生成') } } catch { message.error('Auto-generate failed 自動生成失敗') } finally { setAutoLoading(false) }
  }

  const viewReport = (r: WeeklyItem) => { setViewing(r); setTab('view') }

  if (tab === 'view' && viewing) {
    return (
      <div className="tool-header" style={{ maxWidth: 860, margin: '0 auto' }}>
        <Title level={3}><CalendarOutlined /> {viewing.week_start} ~ {viewing.week_end}</Title>
        <Button onClick={() => setTab('history')} style={{ marginBottom: 16, borderRadius: 100 }}>← Back 返回列表</Button>
        <Card style={{ borderRadius: 14, border: 'none' }} styles={{ body: { padding: '22px 28px' } }}><MarkdownRenderer content={viewing.content} /></Card>
      </div>
    )
  }

  if (tab === 'history') {
    return (
      <div className="tool-header" style={{ maxWidth: 860, margin: '0 auto' }}>
        <Title level={3}><HistoryOutlined /> Report History 歷史周報 ({reports.length})</Title>
        <Button onClick={() => setTab('generate')} style={{ marginBottom: 16, borderRadius: 100 }}>← Back 生成週報</Button>
        <List dataSource={reports} renderItem={r => (
          <List.Item onClick={() => viewReport(r)} style={{ cursor: 'pointer', padding: '14px 20px', borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}`, marginBottom: 8 }}>
            <List.Item.Meta title={<Text strong>{r.week_start} ~ {r.week_end}</Text>} description={r.content?.substring(0, 120) + '...'} />
            <Text type="secondary" style={{ fontSize: 12 }}>{r.created_at}</Text>
          </List.Item>
        )} />
      </div>
    )
  }

  return (
    <div className="tool-header" style={{ maxWidth: 860, margin: '0 auto' }}>
      <Title level={3}><CalendarOutlined /> Weekly Report 週報</Title>
      <Text type="secondary">Auto-generate from this week's data or write manually — AI produces a professional report  |  AI 自動匯總本週工具使用記錄、會議同待辦，或根據要點手動生成週報</Text>
      <Card size="small" style={{ marginTop: 16, borderRadius: 14 }} styles={{ body: { padding: 18 } }}>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleAuto} loading={autoLoading} style={{ borderRadius: 100, paddingLeft: 20, paddingRight: 20 }}>Auto-Generate from This Week 根據本週數據自動生成</Button>
        <Text type="secondary" style={{ marginLeft: 12 }}>Aggregates meetings, tool usage & todos 自動匯總會議、工具記錄、待辦</Text>
      </Card>
      <Divider plain>Or enter manually 或手動輸入</Divider>
      <VoiceInput onResult={(text) => setInput(text)} />
      <TextArea rows={8} value={input} onChange={e => setInput(e.target.value)} placeholder="Enter weekly highlights... 輸入本週工作要點..." style={{ borderRadius: 10 }} />
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <Button type="primary" onClick={handleRun} loading={loading} style={{ borderRadius: 100, paddingLeft: 24, paddingRight: 24 }}>Generate 生成週報</Button>
        <Button onClick={() => { loadReports(); setTab('history') }} icon={<HistoryOutlined />} style={{ borderRadius: 100 }}>History 歷史 ({reports.length})</Button>
      </div>
      {loading && <Spin style={{ margin: '28px auto', display: 'block' }} />}
      {output && <Card style={{ marginTop: 20, borderRadius: 14, border: 'none' }} styles={{ body: { padding: '22px 28px' } }}><MarkdownRenderer content={output} /></Card>}
    </div>
  )
}

export default WeeklyReportPage
