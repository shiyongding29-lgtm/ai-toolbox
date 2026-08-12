import { useState, useEffect, useCallback } from 'react'
import { Typography, Input, Button, Checkbox, Select, Space, Popconfirm, theme, DatePicker, Tag, Card, Tabs, message } from 'antd'
import { CheckSquareOutlined, DeleteOutlined, PlusOutlined, ClockCircleOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import http from '../../services/http'
import dayjs from 'dayjs'

const { Title, Text } = Typography

interface Todo { id: number; task: string; owner: string; deadline: string; priority: number; completed: boolean; source: string; created_at: string; is_overdue: boolean }

function TodoBoard() {
  const { token } = theme.useToken()
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTask, setNewTask] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [newPriority, setNewPriority] = useState(2)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [filterTab, setFilterTab] = useState('all')

  const load = useCallback(async () => {
    try { const d: any = await http.get('/api/todos'); if (d.code === 0) setTodos(d.data || []) } catch {}
  }, [])
  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!newTask.trim()) return
    await http.post('/api/todos', { task: newTask, owner: newOwner, deadline: newDeadline, priority: newPriority })
    setNewTask(''); setNewOwner(''); setNewDeadline(''); setNewPriority(2); load()
  }
  const toggle = async (id: number, completed: boolean) => { await http.put(`/api/todos/${id}`, { completed: !completed }); load() }
  const setDeadline = async (id: number, deadline: string) => { await http.put(`/api/todos/${id}`, { deadline }); load() }
  const del = async (id: number) => { await http.delete(`/api/todos/${id}`); load() }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  const selectAll = () => setSelectedIds(new Set(filteredTodos.map(t => t.id)))
  const clearSelection = () => setSelectedIds(new Set())

  const batchComplete = async () => {
    await Promise.all(Array.from(selectedIds).map(id => http.put(`/api/todos/${id}`, { completed: true })))
    message.success(`Completed ${selectedIds.size} items 已完成 ${selectedIds.size} 條`)
    setSelectedIds(new Set()); load()
  }
  const batchDelete = async () => {
    await Promise.all(Array.from(selectedIds).map(id => http.delete(`/api/todos/${id}`)))
    message.success(`Deleted ${selectedIds.size} items 已刪除 ${selectedIds.size} 條`)
    setSelectedIds(new Set()); load()
  }

  const priorityTags: Record<number, React.ReactNode> = { 1: <Tag color="red" style={{ borderRadius: 100 }}>P1</Tag>, 2: <Tag color="orange" style={{ borderRadius: 100 }}>P2</Tag>, 3: <Tag color="green" style={{ borderRadius: 100 }}>P3</Tag> }

  const filteredTodos = (() => {
    switch (filterTab) {
      case 'active': return todos.filter(t => !t.completed)
      case 'completed': return todos.filter(t => t.completed)
      case 'overdue': return todos.filter(t => t.is_overdue && !t.completed)
      default: return todos
    }
  })()

  return (
    <div className="tool-header" style={{ maxWidth: 960, margin: '0 auto' }}>
      <Title level={3}><CheckSquareOutlined /> Todo List 待辦事項</Title>
      <Text type="secondary">Manage tasks with priority, deadline & overdue alerts  |  管理個人待辦，支援優先級、截止日期、逾期自動提醒</Text>

      {/* Add form */}
      <Card size="small" style={{ marginTop: 16, borderRadius: 14, border: 'none', boxShadow: token.boxShadowSecondary }}
        styles={{ body: { padding: '14px 18px' } }}>
        <Space.Compact style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
          <Input placeholder="New task 新任務" value={newTask} onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }} style={{ flex: 3, minWidth: 160 }} />
          <Input placeholder="Owner 負責人" value={newOwner} onChange={e => setNewOwner(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }} style={{ flex: 1, minWidth: 80 }} />
          <DatePicker value={newDeadline ? dayjs(newDeadline) : null}
            onChange={d => setNewDeadline(d ? d.format('YYYY-MM-DD') : '')}
            placeholder="Deadline 截止日期" style={{ width: 150 }} allowClear />
          <Select value={newPriority} onChange={setNewPriority} style={{ width: 90 }}>
            <Select.Option value={1}>P1 High 高</Select.Option>
            <Select.Option value={2}>P2 Med 中</Select.Option>
            <Select.Option value={3}>P3 Low 低</Select.Option>
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={add} style={{ borderRadius: '0 10px 10px 0' }}>Add 添加</Button>
        </Space.Compact>
      </Card>

      {/* Batch bar + filter tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
        <Tabs activeKey={filterTab} onChange={setFilterTab} size="small"
          items={[
            { key: 'all', label: `All 全部 (${todos.length})` },
            { key: 'active', label: `Active 進行中 (${todos.filter(t => !t.completed).length})` },
            { key: 'overdue', label: `Overdue 逾期 (${todos.filter(t => t.is_overdue && !t.completed).length})` },
            { key: 'completed', label: `Done 已完成 (${todos.filter(t => t.completed).length})` },
          ]}
          style={{ marginBottom: 0 }}
        />
        {selectedIds.size > 0 && (
          <Space size={6}>
            <Text type="secondary" style={{ fontSize: 12 }}>{selectedIds.size} selected 已選</Text>
            <Button size="small" onClick={selectAll} style={{ borderRadius: 100 }}>All 全選</Button>
            <Button size="small" onClick={clearSelection} style={{ borderRadius: 100 }}>Clear 取消</Button>
            <Button size="small" icon={<CheckOutlined />} onClick={batchComplete} style={{ borderRadius: 100 }}>Done 完成</Button>
            <Popconfirm title={`Delete ${selectedIds.size} items? 確定刪除 ${selectedIds.size} 條嗎？`} onConfirm={batchDelete}>
              <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 100 }}>Delete 刪除</Button>
            </Popconfirm>
          </Space>
        )}
      </div>

      {filteredTodos.length === 0 && <div style={{ textAlign: 'center', padding: 40 }}><Text type="secondary">No todos 暫無待辦事項</Text></div>}

      <Space style={{ width: '100%', marginTop: 8, display: 'flex', flexDirection: 'column' }} size={6}>
        {filteredTodos.map(t => (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 12,
            background: t.is_overdue && !t.completed ? 'rgba(239,68,68,0.08)' : token.colorBgContainer,
            border: t.is_overdue && !t.completed ? '1px solid rgba(239,68,68,0.3)' : `1px solid ${token.colorBorderSecondary}`,
            boxShadow: t.is_overdue && !t.completed ? '0 0 0 1px rgba(239,68,68,0.1)' : 'none',
            opacity: t.completed ? 0.4 : 1, transition: 'all 0.2s',
          }}>
            <Checkbox checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} style={{ transform: 'scale(1.1)' }} />
            <Checkbox checked={t.completed} onChange={() => toggle(t.id, t.completed)} style={{ transform: 'scale(1.15)' }} />
            <Text delete={t.completed} style={{ flex: 1, fontSize: 14, fontWeight: t.is_overdue && !t.completed ? 600 : 400 }}>{t.task}</Text>
            {t.owner && <Tag style={{ borderRadius: 100 }}>{t.owner}</Tag>}
            <DatePicker size="small" value={t.deadline ? dayjs(t.deadline) : null}
              onChange={d => setDeadline(t.id, d ? d.format('YYYY-MM-DD') : '')}
              placeholder="Deadline 截止日" style={{ width: 140 }} allowClear
              status={t.is_overdue && !t.completed ? 'error' : undefined} />
            {t.is_overdue && !t.completed && <Tag color="red" icon={<ClockCircleOutlined />} style={{ borderRadius: 100 }}>Overdue 逾期</Tag>}
            {priorityTags[t.priority]}
            {t.source && <Text type="secondary" style={{ fontSize: 10 }}>{t.source}</Text>}
            <Text type="secondary" style={{ fontSize: 10 }}>{t.created_at}</Text>
            <Popconfirm title="Delete 刪除?" onConfirm={() => del(t.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} type="text" />
            </Popconfirm>
          </div>
        ))}
      </Space>
    </div>
  )
}

export default TodoBoard
