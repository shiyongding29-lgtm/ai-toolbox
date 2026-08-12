import { useState } from 'react'
import { Typography, Input, Button, Spin, message, Select, DatePicker, Card, Space, theme, Modal, List, Tag, Checkbox } from 'antd'
import { CheckSquareOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { llmService } from '../../services/llmService'
import http from '../../services/http'
import VoiceInput from '../../shared/VoiceInput'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

interface ExtractedItem { task: string; owner: string; deadline: string; priority: number; checked: boolean }

function TodoExtractionPage() {
  const { token } = theme.useToken()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [items, setItems] = useState<ExtractedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const handleRun = async () => {
    if (!input.trim()) return
    setLoading(true); setItems([])
    try {
      const resp: any = await llmService.call('/api/todo-extraction/run', { text: input })
      setOutput(resp.data.result)
      const extracted = (resp.data.items || []).map((item: any) => ({
        task: item.task || '', owner: item.owner || 'TBD', deadline: item.deadline || '', priority: item.priority || 2, checked: true,
      }))
      setItems(extracted)
      // 有提取结果直接弹确认框
      if (extracted.length > 0) {
        setConfirmOpen(true)
      }
    } catch { message.error('Extraction failed 提取失敗') } finally { setLoading(false) }
  }

  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const toggleCheck = (index: number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, checked: !item.checked } : item))
  }

  const checkAll = () => setItems(prev => prev.map(i => ({ ...i, checked: true })))
  const uncheckAll = () => setItems(prev => prev.map(i => ({ ...i, checked: false })))

  const confirmAdd = async () => {
    const selected = items.filter(i => i.checked && i.task.trim())
    if (!selected.length) { message.warning('No items selected 未選擇任何待辦'); return }
    setConfirmLoading(true)
    try {
      await http.post('/api/todos/batch-create', selected.map(i => ({
        task: i.task, owner: i.owner, deadline: i.deadline, priority: i.priority, source: 'todo-extraction',
      })))
      message.success(`Added ${selected.length} todos 已添加 ${selected.length} 條待辦`)
      setItems([])
      setConfirmOpen(false)
    } catch { message.error('Failed 添加失敗') } finally { setConfirmLoading(false) }
  }

  const checkedCount = items.filter(i => i.checked).length

  return (
    <div className="tool-header">
      <Title level={3}><CheckSquareOutlined /> Todo Extraction 待辦事項提取</Title>
      <Text type="secondary">Paste meeting notes/emails, AI extracts structured todos — review & confirm to add  |  粘貼會議紀要或郵件，AI 自動提取結構化待辦事項，審核確認後加入待辦列表</Text>

      <VoiceInput onResult={(text) => setInput(text)} />
      <TextArea rows={8} value={input} onChange={e => setInput(e.target.value)}
        placeholder="Paste meeting notes, emails, or any task-related text... 粘貼會議紀要、郵件或任何包含任務資訊嘅文字..." style={{ borderRadius: 10, marginTop: 16 }} />

      <div style={{ marginTop: 14 }}>
        <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleRun} loading={loading} style={{ borderRadius: 100, paddingLeft: 24, paddingRight: 24 }}>
          Extract & Review 提取並審核
        </Button>
      </div>

      {loading && <Spin style={{ margin: '28px auto', display: 'block' }} />}

      {/* Preview cards before confirm */}
      {items.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <Text strong>{items.length} todos extracted 已提取 {items.length} 條待辦</Text>
            <Space>
              <Button size="small" onClick={() => setConfirmOpen(true)} type="primary" icon={<CheckCircleOutlined />} style={{ borderRadius: 100 }}>
                Confirm ({checkedCount}) 確認
              </Button>
            </Space>
          </div>
          <Space style={{ width: '100%', display: 'flex', flexDirection: 'column' }} size={10}>
            {items.map((item, index) => (
              <Card key={index} size="small"
                styles={{ body: { padding: '14px 18px' } }}
                style={{ borderLeft: `3px solid ${token.colorPrimary}`, borderRadius: 12, border: 'none', boxShadow: token.boxShadow, opacity: item.checked ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Checkbox checked={item.checked} onChange={() => toggleCheck(index)} />
                  <Input value={item.task} onChange={e => updateItem(index, 'task', e.target.value)}
                    style={{ flex: 2, minWidth: 180 }} placeholder="Task 任務描述" />
                  <Input value={item.owner} onChange={e => updateItem(index, 'owner', e.target.value)}
                    style={{ width: 100 }} placeholder="Owner 負責人" />
                  <Select value={item.priority} onChange={v => updateItem(index, 'priority', v)} style={{ width: 100 }}>
                    <Select.Option value={1}>P1 High 高</Select.Option>
                    <Select.Option value={2}>P2 Med 中</Select.Option>
                    <Select.Option value={3}>P3 Low 低</Select.Option>
                  </Select>
                  <DatePicker value={item.deadline ? dayjs(item.deadline) : null}
                    onChange={d => updateItem(index, 'deadline', d ? d.format('YYYY-MM-DD') : '')}
                    placeholder="Deadline 截止日期" style={{ width: 150 }} allowClear />
                </div>
              </Card>
            ))}
          </Space>
        </div>
      )}

      {output && items.length === 0 && !loading && (
        <div className="output-panel" style={{ marginTop: 22 }}><pre>{output}</pre></div>
      )}

      {/* Confirmation Modal */}
      <Modal
        title={<span><CheckCircleOutlined /> Confirm & Add Todos 確認並添加待辦</span>}
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setConfirmOpen(false)} style={{ borderRadius: 100 }}>Cancel 取消</Button>,
          <Button key="add" type="primary" icon={<CheckCircleOutlined />} loading={confirmLoading}
            onClick={confirmAdd} style={{ borderRadius: 100 }}>
            Confirm & Add {checkedCount} {checkedCount > 0 ? `Items 個待辦` : ''}
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary">Review below before adding — uncheck items you don't need 請審核以下待辦，取消不需要的項目</Text>
          <Space size={4}>
            <Button size="small" onClick={checkAll} style={{ borderRadius: 100 }}>All 全選</Button>
            <Button size="small" onClick={uncheckAll} style={{ borderRadius: 100 }}>None 清空</Button>
          </Space>
        </div>

        <List
          dataSource={items}
          style={{ maxHeight: 400, overflow: 'auto' }}
          renderItem={(item, index) => (
            <List.Item style={{ padding: '8px 0', opacity: item.checked ? 1 : 0.4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                <Checkbox checked={item.checked} onChange={() => toggleCheck(index)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: 13 }}>{item.task || '(empty 空)'}</Text>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                    {item.owner && item.owner !== 'TBD' && <Tag style={{ borderRadius: 100, fontSize: 10 }}>{item.owner}</Tag>}
                    <Tag color={['red','orange','green'][item.priority-1] || 'blue'} style={{ borderRadius: 100, fontSize: 10 }}>
                      {['P1 High','P2 Med','P3 Low'][item.priority-1] || ''}
                    </Tag>
                    {item.deadline && <Tag style={{ borderRadius: 100, fontSize: 10 }}>{item.deadline}</Tag>}
                  </div>
                </div>
              </div>
            </List.Item>
          )}
        />
      </Modal>
    </div>
  )
}

export default TodoExtractionPage
