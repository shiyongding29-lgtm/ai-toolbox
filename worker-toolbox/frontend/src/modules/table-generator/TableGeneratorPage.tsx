import { useState } from 'react'
import { Typography, Input, Button, Card, Spin, message, Space } from 'antd'
import { TableOutlined, DownloadOutlined } from '@ant-design/icons'
import http from '../../services/http'

const { Title, Text } = Typography
const { TextArea } = Input

export default function TableGeneratorPage() {
  const [text, setText] = useState('')
  const [columns, setColumns] = useState('')
  const [hint, setHint] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleGenerate = async () => {
    if (!text.trim()) return
    setLoading(true); setResult(null)
    try {
      const r = await http.post('/api/ai/parse-intent', { text: text.trim() })
    } catch {}
    // Use LLM directly
    try {
      const fd = new FormData()
      // Call chart/table endpoint via simple approach: use workflow run
      const r = await fetch('/api/workflow/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: {
            nodes: [{ id: 't1', tool: 'table_generator', label: '表格生成', config: { columns, hint } }],
            edges: []
          },
          input: { text: text.trim(), columns, hint }
        })
      })
      const j = await r.json()
      if (j.code === 0) {
        // Poll for result
        const wid = j.data.workflow_id
        const poll = setInterval(async () => {
          const s = await fetch(`/api/workflow/status/${wid}`)
          const d = await s.json()
          if (d.code === 0 && d.data?.status === 'done') {
            clearInterval(poll)
            const res = d.data.results || {}
            const flat: any = {}
            for (const k of Object.keys(res)) {
              if (typeof res[k] === 'object' && res[k]) Object.assign(flat, res[k])
            }
            setResult(flat)
            setLoading(false)
          } else if (d.data?.status === 'error') {
            clearInterval(poll); setLoading(false)
            message.error('Generation failed')
          }
        }, 600)
        setTimeout(() => { clearInterval(poll); setLoading(false) }, 30000)
      } else {
        setLoading(false); message.error(j.msg || 'Failed')
      }
    } catch { setLoading(false); message.error('Failed') }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title level={3}><TableOutlined /> Table Generator 表格生成</Title>
      <Text type="secondary">Paste report or text — AI extracts structured CSV data  |  貼上報告或文字，AI 提取結構化表格數據</Text>

      <Card size="small" style={{ marginTop: 16, borderRadius: 14 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <Input placeholder="列名, e.g. Year,Revenue,Profit" value={columns} onChange={e => setColumns(e.target.value)}
            style={{ flex: 1, minWidth: 200, borderRadius: 8 }} />
          <Input placeholder="提取要求, e.g. 近五年财务数据" value={hint} onChange={e => setHint(e.target.value)}
            style={{ flex: 1, minWidth: 200, borderRadius: 8 }} />
        </div>
        <TextArea rows={8} value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste report or text here... 貼上報告或文字..."
          style={{ borderRadius: 10 }} />
        <div style={{ marginTop: 12 }}>
          <Button type="primary" icon={<TableOutlined />} loading={loading} onClick={handleGenerate}
            style={{ borderRadius: 100, paddingLeft: 24, paddingRight: 24, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none' }}>
            Generate Table 生成表格
          </Button>
        </div>
      </Card>

      {loading && <Spin style={{ margin: '28px auto', display: 'block' }} />}
      {result?.table_csv && (
        <Card title="📋 Table 表格數據" style={{ marginTop: 20, borderRadius: 14 }}
          extra={<Button icon={<DownloadOutlined />} style={{ borderRadius: 100 }}
            onClick={() => {
              const b = new Blob([result.table_csv], { type: 'text/csv' })
              const u = URL.createObjectURL(b)
              const a = document.createElement('a'); a.href = u; a.download = 'table.csv'; a.click()
              URL.revokeObjectURL(u)
            }}>Download CSV</Button>}>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, fontFamily: 'monospace', maxHeight: 300, overflow: 'auto' }}>{result.table_csv}</pre>
        </Card>
      )}
    </div>
  )
}
