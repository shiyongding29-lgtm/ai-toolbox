import { useState, useEffect, useCallback } from 'react'
import { Typography, Row, Col, Card, Statistic, Progress, Table, Tag, theme, Spin, Empty } from 'antd'
import {
  BarChartOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ThunderboltOutlined, FireOutlined, PieChartOutlined,
} from '@ant-design/icons'
import http from '../../services/http'
import { TOOL_LABELS, TOOL_COLORS } from '../../shared'

const { Title, Text } = Typography

interface DashboardData {
  total_history: number
  today_count: number
  weekly_counts: { tool_type: string; count: number }[]
  todo_stats: { total: number; completed: number; active: number; overdue: number }
  recent_activity: { tool_type: string; title: string; created_at: string }[]
}

export default function DashboardPage() {
  const { token } = theme.useToken()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await http.get('/api/dashboard')
      if (res.code === 0) setData(res.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  if (!data) return <Empty description="No data yet 暫無數據" />

  const weeklyColumns = [
    { title: 'Tool 工具', dataIndex: 'tool_type', key: 'tool',
      render: (t: string) => (
        <span>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: TOOL_COLORS[t] || token.colorPrimary, marginRight: 8,
          }} />
          {TOOL_LABELS[t] || t}
        </span>
      ),
    },
    { title: 'Uses 使用次數', dataIndex: 'count', key: 'count',
      render: (c: number) => <Text strong>{c}</Text>,
    },
    { title: 'Share 佔比', dataIndex: 'count', key: 'share',
      render: (c: number) => {
        const total = data.weekly_counts.reduce((s, i) => s + i.count, 0) || 1
        return <Progress percent={Math.round((c / total) * 100)} size="small" style={{ minWidth: 80 }} />
      },
    },
  ]

  const doneRate = data.todo_stats.total > 0
    ? Math.round((data.todo_stats.completed / data.todo_stats.total) * 100)
    : 0

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 0 40px 0' }}>
      <Title level={3}><BarChartOutlined /> Dashboard 數據看板</Title>
      <Text type="secondary">Overview of tool usage, tasks, and productivity  |  工具使用、任務完成、生產力總覽</Text>

      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 14, border: 'none', background: 'rgba(59,92,204,0.06)' }}
            styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Total Actions 總操作" value={data.total_history}
              prefix={<ThunderboltOutlined style={{ fontSize: 14, color: '#3b5ccc' }} />}
              styles={{ content: { fontSize: 28, fontWeight: 700, color: '#3b5ccc' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 14, border: 'none', background: 'rgba(16,185,129,0.06)' }}
            styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Today 今日" value={data.today_count}
              prefix={<FireOutlined style={{ fontSize: 14, color: '#10b981' }} />}
              styles={{ content: { fontSize: 28, fontWeight: 700, color: '#10b981' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 14, border: 'none', background: 'rgba(245,158,11,0.06)' }}
            styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Active Todos 進行中" value={data.todo_stats.active}
              prefix={<ClockCircleOutlined style={{ fontSize: 14, color: '#f59e0b' }} />}
              styles={{ content: { fontSize: 28, fontWeight: 700, color: '#f59e0b' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 14, border: 'none', background: 'rgba(99,102,241,0.06)' }}
            styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Done Rate 完成率" value={doneRate} suffix="%"
              prefix={<CheckCircleOutlined style={{ fontSize: 14, color: '#6366f1' }} />}
              styles={{ content: { fontSize: 28, fontWeight: 700, color: '#6366f1' } }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={<span><PieChartOutlined style={{ marginRight: 8 }} /> Todo Progress 待辦進度</span>}
        style={{ marginTop: 16, borderRadius: 14, border: 'none' }}
        styles={{ body: { padding: '16px 20px' } }}>
        <Row gutter={[16, 8]}>
          <Col xs={8} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#ef4444' }}>{data.todo_stats.overdue}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>Overdue 逾期</Text>
          </Col>
          <Col xs={8} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#3b5ccc' }}>{data.todo_stats.active}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>Active 進行中</Text>
          </Col>
          <Col xs={8} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#10b981' }}>{data.todo_stats.completed}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>Done 已完成</Text>
          </Col>
        </Row>
        <Progress percent={doneRate} strokeColor="#10b981" railColor={token.colorFillSecondary}
          style={{ marginTop: 12 }} />
      </Card>

      <Card size="small" title={<span><BarChartOutlined style={{ marginRight: 8 }} /> Weekly Tool Usage 本週工具使用</span>}
        style={{ marginTop: 16, borderRadius: 14, border: 'none' }}
        styles={{ body: { padding: '8px 8px' } }}>
        {data.weekly_counts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, opacity: 0.5 }}>No usage data this week 本週暫無使用記錄</div>
        ) : (
          <Table dataSource={data.weekly_counts} columns={weeklyColumns}
            rowKey="tool_type" size="small" pagination={false} showHeader={false}
            style={{ borderRadius: 12 }} />
        )}
      </Card>

      <Card size="small" title={<span><ClockCircleOutlined style={{ marginRight: 8 }} /> Recent Activity 最近活動</span>}
        style={{ marginTop: 16, borderRadius: 14, border: 'none' }}
        styles={{ body: { padding: '8px 0' } }}>
        {data.recent_activity.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, opacity: 0.5 }}>No recent activity 暫無最近活動</div>
        ) : (
          data.recent_activity.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 20px',
              borderBottom: i < data.recent_activity.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: TOOL_COLORS[item.tool_type] || token.colorPrimary,
              }} />
              <Tag style={{ borderRadius: 100, fontSize: 10, margin: 0 }}>
                {TOOL_LABELS[item.tool_type] || item.tool_type}
              </Tag>
              <Text ellipsis style={{ flex: 1, fontSize: 13 }}>{item.title}</Text>
              <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>{item.created_at}</Text>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
