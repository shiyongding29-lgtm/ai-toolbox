import { useState } from 'react'
import { Typography, Input, Button, Spin, message, Card } from 'antd'
import { ScheduleOutlined } from '@ant-design/icons'
import VoiceInput from '../../shared/VoiceInput'

const { Title, Text } = Typography
const { TextArea } = Input

function TaskPlanningPage() {
  const [tasks, setTasks] = useState(''); const [constraints, setConstraints] = useState('')
  const [result, setResult] = useState(''); const [loading, setLoading] = useState(false)

  const handlePlan = async () => {
    if (!tasks.trim()) return; setLoading(true)
    try {
      const d = await (await fetch('/api/task-planning/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks, constraints }) })).json()
      if (d.code === 0) setResult(d.data.result); else message.error(d.msg || 'Failed 規劃失敗')
    } catch { message.error('Request failed 請求失敗') } finally { setLoading(false) }
  }

  return (
    <div className="tool-header" style={{ maxWidth: 960, margin: '0 auto' }}>
      <Title level={3}><ScheduleOutlined /> Task Planning 智能任務規劃</Title>
      <Text type="secondary">Input a task list + constraints — AI breaks down subtasks, estimates hours & identifies dependencies  |  輸入任務清單同約束條件，AI 自動拆解子任務、估算工時、識別依賴關係</Text>
      <Card size="small" title="Task List 任務清單" style={{ marginTop: 16, borderRadius: 14 }} styles={{ body: { padding: 14 } }}>
        <VoiceInput onResult={(text) => setTasks(text)} />
        <TextArea rows={5} value={tasks} onChange={e => setTasks(e.target.value)} placeholder="One task per line 每行一個任務：&#10;- Develop login module 開發登錄模組&#10;- Design database schema 設計數據庫架構" style={{ borderRadius: 10 }} />
      </Card>
      <Card size="small" title="Constraints 約束條件 (Optional 選填)" style={{ marginTop: 12, borderRadius: 14 }} styles={{ body: { padding: 14 } }}>
        <Input value={constraints} onChange={e => setConstraints(e.target.value)} placeholder="e.g. Complete in 5 days, 1 frontend + 1 backend 例如：5天內完成，前端1人+後端1人" style={{ borderRadius: 8 }} />
      </Card>
      <div style={{ marginTop: 14 }}><Button type="primary" onClick={handlePlan} loading={loading} style={{ borderRadius: 100, paddingLeft: 24, paddingRight: 24 }}>Generate Plan 生成計劃</Button></div>
      {loading && <Spin style={{ display: 'block', marginTop: 24 }} />}
      {result && <Card style={{ marginTop: 20, borderRadius: 14, border: 'none' }} styles={{ body: { padding: '22px 28px' } }}><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{result}</div></Card>}
    </div>
  )
}

export default TaskPlanningPage
