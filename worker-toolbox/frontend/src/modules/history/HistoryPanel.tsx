import { useState, useEffect, useCallback } from 'react'
import { Typography, Button, Card, theme } from 'antd'
import { ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import http from '../../services/http'
import { TOOL_LABELS, TOOL_COLORS } from '../../shared'

const { Title, Text } = Typography

interface HistoryItem { id: number; tool_type: string; title: string; input_preview: string; output_preview: string; created_at: string }

function HistoryPanel() {
  const { token } = theme.useToken()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [detail, setDetail] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { const d: any = await http.get('/api/history/list', { params: { page_size: 50 } }); if (d.code === 0) setItems(d.data || []) } catch {}
  }, [])
  useEffect(() => { load() }, [load])

  const view = async (id: number) => {
    try { const d: any = await http.get(`/api/history/${id}`); if (d.code === 0) setDetail(d.data.full_output || '(No content 無內容)') } catch {}
  }

  return (
    <div className="tool-header" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3}><ClockCircleOutlined /> History 歷史記錄</Title>
          <Text type="secondary">All tool usage records — auto-clears monthly  |  所有工具使用記錄，每月自動清零</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} style={{ borderRadius: 100 }}>Refresh 刷新</Button>
      </div>
      {items.length === 0 && <div style={{ textAlign: 'center', padding: 40 }}><Text type="secondary">No records yet 暫無記錄</Text></div>}
      <div style={{ marginTop: 16 }}>
        {items.map(i => (
          <Card key={i.id} size="small" hoverable onClick={() => view(i.id)}
            style={{ marginBottom: 8, borderRadius: 12, border: 'none' }}
            styles={{ body: { padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14 } }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: TOOL_COLORS[i.tool_type] || token.colorPrimary }} />
            <Text strong style={{ fontSize: 11, color: TOOL_COLORS[i.tool_type] || token.colorPrimary, minWidth: 70 }}>{TOOL_LABELS[i.tool_type] || i.tool_type}</Text>
            <Text style={{ flex: 1, fontSize: 13 }} ellipsis>{i.title}</Text>
            <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>{i.created_at}</Text>
          </Card>
        ))}
      </div>
      {detail !== null && (
        <Card title={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Detail 詳情</span><Button size="small" onClick={() => setDetail(null)} style={{ borderRadius: 100 }}>Close 關閉</Button></div>}
          style={{ marginTop: 16, borderRadius: 14, border: 'none' }}
          styles={{ body: { padding: '18px 22px', whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', fontSize: 13, lineHeight: 1.8 } }}>{detail}</Card>
      )}
    </div>
  )
}

export default HistoryPanel
