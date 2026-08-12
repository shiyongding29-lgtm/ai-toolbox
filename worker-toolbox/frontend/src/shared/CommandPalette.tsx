import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Modal, Input, List, Tag, theme } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  AudioOutlined, FileTextOutlined, MailOutlined, TranslationOutlined,
  CalendarOutlined, SearchOutlined, CheckSquareOutlined, IdcardOutlined,
  HomeOutlined, GlobalOutlined, BarChartOutlined, DiffOutlined,
  ScheduleOutlined, ReadOutlined, FilePptOutlined, ClockCircleOutlined,
  OrderedListOutlined, BranchesOutlined, TableOutlined, ThunderboltOutlined,
} from '@ant-design/icons'

interface CommandItem {
  key: string
  label: string
  icon: React.ReactNode
  action: () => void
  keywords: string[]
  group: string
}

interface Props {
  open: boolean
  onClose: () => void
}

const TOOLS: { key: string; label: string; icon: React.ReactNode; keywords: string[] }[] = [
  { key: 'meeting-recorder', label: 'Meeting Notes 會議記錄', icon: <AudioOutlined />, keywords: ['meeting', 'record', 'audio', '会议', '录音'] },
  { key: 'document-summary', label: 'Doc Summary 文件摘要', icon: <FileTextOutlined />, keywords: ['summary', 'document', 'pdf', '摘要', '文件'] },
  { key: 'email-doc', label: 'Email & Docs 郵件公文', icon: <MailOutlined />, keywords: ['email', 'mail', '邮件', '公文'] },
  { key: 'translation-assistant', label: 'Translation 翻譯寫作', icon: <TranslationOutlined />, keywords: ['translate', '翻译', '写作', 'polish'] },
  { key: 'weekly-report', label: 'Weekly Report 週報', icon: <CalendarOutlined />, keywords: ['weekly', 'report', '周报', '报告'] },
  { key: 'ppt-outline', label: 'PPT / HTML 簡報生成', icon: <FilePptOutlined />, keywords: ['ppt', 'presentation', 'slide', '演示', '简报'] },
  { key: 'spreadsheet', label: 'Spreadsheet AI 智能表格', icon: <TableOutlined />, keywords: ['excel', 'csv', 'spreadsheet', '表格', '数据'] },
  { key: 'mindmap', label: 'Mind Map 思維導圖', icon: <BranchesOutlined />, keywords: ['mindmap', 'mind', '思维导图', '导图'] },
  { key: 'todo-extraction', label: 'Todo Extract 待辦提取', icon: <CheckSquareOutlined />, keywords: ['todo', 'extract', '待办', '提取'] },
  { key: 'todos', label: 'Todo List 待辦事項', icon: <OrderedListOutlined />, keywords: ['todo', 'list', 'task', '待办', '任务'] },
  { key: 'pomodoro', label: 'Pomodoro 番茄鐘', icon: <ClockCircleOutlined />, keywords: ['pomodoro', 'timer', 'focus', '番茄', '计时'] },
  { key: 'info-extraction', label: 'Info Extract 資訊提取', icon: <IdcardOutlined />, keywords: ['extract', 'info', 'card', '提取', '名片'] },
  { key: 'rag-qa', label: 'Knowledge Q&A 知識庫問答', icon: <SearchOutlined />, keywords: ['knowledge', 'qa', 'rag', '知识库', '问答'] },
  { key: 'deep-research', label: 'Deep Research 深度調研', icon: <GlobalOutlined />, keywords: ['research', 'deep', 'search', '调研', '研究'] },
  { key: 'data-analysis', label: 'Data Analysis 數據分析', icon: <BarChartOutlined />, keywords: ['data', 'analysis', 'chart', '数据分析', '图表'] },
  { key: 'document-comparison', label: 'Doc Compare 文件對比', icon: <DiffOutlined />, keywords: ['compare', 'diff', '对比', '比较'] },
  { key: 'task-planning', label: 'Task Planning 任務規劃', icon: <ScheduleOutlined />, keywords: ['plan', 'planning', 'task', '规划', '计划'] },
  { key: 'multi-source-reader', label: 'Multi-Source 多源閱讀', icon: <ReadOutlined />, keywords: ['multi', 'source', 'read', '阅读', '多源'] },
  { key: 'history', label: 'History 歷史記錄', icon: <ClockCircleOutlined />, keywords: ['history', 'log', '历史', '记录'] },
  { key: 'home', label: 'Home 首頁', icon: <HomeOutlined />, keywords: ['home', 'dashboard', '首页', '主页'] },
]

function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<any>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return TOOLS
    return TOOLS.filter(t =>
      t.label.toLowerCase().includes(q) ||
      t.key.toLowerCase().includes(q) ||
      t.keywords.some(k => k.toLowerCase().includes(q))
    )
  }, [query])

  const execute = useCallback((item: typeof TOOLS[0]) => {
    navigate(item.key === 'home' ? '/' : `/tools/${item.key}`)
    onClose()
  }, [navigate, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) execute(filtered[selectedIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [filtered, selectedIndex, execute, onClose])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      closable={false}
      styles={{
        body: { padding: 0 },
        content: { borderRadius: 16, overflow: 'hidden' },
      }}
      style={{ top: '15%' }}
      modalRender={(node) => (
        <div onKeyDown={handleKeyDown}>
          {node}
        </div>
      )}
    >
      <div style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <ThunderboltOutlined style={{ fontSize: 16, color: token.colorPrimary, opacity: 0.7 }} />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
          placeholder="Search tools... 搜索工具或操作..."
          variant="borderless"
          size="large"
          style={{ fontSize: 15, padding: 0 }}
        />
        <Tag style={{ borderRadius: 100, fontSize: 10, opacity: 0.5, margin: 0 }}>⌘K</Tag>
      </div>

      <div style={{ maxHeight: 360, overflow: 'auto', padding: '6px 8px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, opacity: 0.5, fontSize: 13 }}>
            No tools found 未找到匹配工具
          </div>
        )}
        {filtered.map((item, idx) => (
          <div
            key={item.key}
            onClick={() => execute(item)}
            onMouseEnter={() => setSelectedIndex(idx)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              fontSize: 14, transition: 'all 0.12s',
              background: idx === selectedIndex ? token.colorFillSecondary : 'transparent',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 8, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: token.colorFillSecondary, fontSize: 15, flexShrink: 0,
            }}>
              {item.icon}
            </div>
            <span style={{ flex: 1 }}>{item.label}</span>
            {idx === selectedIndex && (
              <Tag style={{ borderRadius: 100, fontSize: 10, margin: 0 }}>↵</Tag>
            )}
          </div>
        ))}
      </div>

      <div style={{
        padding: '8px 16px', borderTop: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex', gap: 16, fontSize: 11, opacity: 0.4,
      }}>
        <span>↑↓ Navigate 導航</span>
        <span>↵ Open 打開</span>
        <span>Esc Close 關閉</span>
      </div>
    </Modal>
  )
}

export default CommandPalette
