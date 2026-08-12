import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Input, Typography, theme, Spin, message } from 'antd'
import { SendOutlined, CloseOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import http from '../services/http'

const { Text } = Typography

// ── Action config — maps tool types to URL params ──
const TOOL_PARAMS: Record<string, { route: string; params?: string[] }> = {
  'todo':           { route: '',          params: ['task','deadline','owner'] },
  'pomodoro':       { route: 'pomodoro', params: ['work'] },
  'email':          { route: 'email-doc', params: ['to','hint','mode','style','subject'] },
  'translation':    { route: 'translation-assistant', params: ['text','mode'] },
  'research':       { route: 'deep-research', params: ['topic'] },
  'ppt':            { route: 'ppt-outline', params: ['slides','style'] },
  'summary':        { route: 'document-summary' },
  'mindmap':        { route: 'mindmap' },
  'data':           { route: 'data-analysis' },
  'spreadsheet':    { route: 'spreadsheet' },
  'meeting':        { route: 'meeting-recorder' },
  'weekly_report':  { route: 'weekly-report', params: ['auto'] },
  'task_planning':  { route: 'task-planning' },
  'image-analyzer': { route: 'image-analyzer' },
  'chart-generator':{ route: 'chart-generator' },
  'doc-compare':    { route: 'document-comparison' },
  'multi-source':   { route: 'multi-source-reader' },
  'rag-qa':         { route: 'rag-qa' },
  'info-extraction': { route: 'info-extraction' },
  'table-generator': { route: 'table-generator' },
  'pdf-toolkit': { route: 'pdf-toolkit' },
  'sentiment-analyzer': { route: 'sentiment-analyzer' },
  'file-converter': { route: 'file-converter' },
  'todo-add': { route: '' },
  'web-scraper': { route: 'web-scraper' },
  'qr-generator': { route: 'qr-generator' },
}

interface Action { type: string; label: string; run: () => Promise<void> }
interface Message { role: 'user' | 'assistant'; content: string; actions?: Action[] }

function buildActions(parsed: any, navigate: ReturnType<typeof useNavigate>, onClose: () => void, originalText: string): Action[] {
  let { tool, params = {} } = parsed
  const cfg = TOOL_PARAMS[tool]
  if (!cfg || !cfg.route) {
    // todo — special case: create directly via API
    if (tool === 'todo') {
      // Extract task from user input, remove date words
      let task = params.task || originalText
      task = task.replace(/提醒我|记得|别忘了|帮我记|帮我记录|帮我.*记/g, '').replace(/[：:，,\s]+/g, ' ').trim()
      // Clean date words from task
      task = task.replace(/明天|后天|今天/g, '').replace(/\s+/g, ' ').trim() || originalText

      // Parse deadline from original text
      const today = new Date()
      let deadline = params.deadline || ''
      if (!deadline) {
        if (/后天/.test(originalText)) { const t = new Date(today); t.setDate(t.getDate()+2); deadline = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}` }
        else if (/明天/.test(originalText)) { const t = new Date(today); t.setDate(t.getDate()+1); deadline = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}` }
        else if (/今天/.test(originalText)) { deadline = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}` }
      }

      const dueLabel = deadline ? ` 📅 ${deadline}` : ''
      return [{
        type: 'create_todo', label: `✅ 添加待办: ${task}${dueLabel}`,
        run: async () => {
          try {
            await http.post('/api/todos', { task, owner: '', deadline, priority: 2, source: 'ai-assistant' })
            message.success(`已添加: ${task}`)
          } catch { message.error('添加失败') }
        },
      }]
    }
    return []
  }

  const qs: string[] = []
  // Extract numeric params from user input if not provided by model
  if (tool === 'pomodoro' && !params.work) {
    const m = originalText.match(/(\d+)\s*(分钟|分|min)/i)
    if (m) params = { ...params, work: parseInt(m[1]) }
  }
  if (tool === 'ppt' && !params.slides) {
    const m = originalText.match(/(\d+)\s*(页|张|slides?|pages?)/i)
    if (m) params = { ...params, slides: parseInt(m[1]) }
  }
  ;(cfg.params || []).forEach((k: string) => { if (params[k] != null) qs.push(`${k}=${encodeURIComponent(String(params[k]))}`) })
  // Always send the full user text
  qs.push(`${tool === 'email' ? 'full' : 'topic'}=${encodeURIComponent(originalText.substring(0, 200))}`)

  const labelMap: Record<string, string> = {
    'pomodoro': `🍅 ${params.work || 25} 分钟番茄钟`,
    'email': `✉️ 写邮件`,
    'translation': `🌐 翻译`,
    'research': `🔍 调研: ${params.topic || ''}`,
    'ppt': `📽️ ${params.slides || ''} 页 PPT`,
    'meeting': `🎙️ 会议记录`,
    'summary': `📄 文档摘要`,
    'todo': `✅ 添加待办`,
    'mindmap': `🧠 思维导图`,
    'data': `📈 数据分析`,
    'spreadsheet': `📊 智能表格`,
    'weekly_report': `📋 周报`,
    'task_planning': `🗓️ 任务规划`,
    'image-analyzer': `🖼️ 图片分析`,
    'chart-generator': `📊 图表生成`,
    'doc-compare': `⚖️ 文档对比`,
    'multi-source': `📖 多源阅读`,
    'rag-qa': `📚 知识库问答`,
    'info-extraction': `📋 信息提取`,
    'table-generator': `📋 表格生成`,
    'pdf-toolkit': `📑 PDF工具`,
    'sentiment-analyzer': `💬 情感分析`,
    'file-converter': `🔄 文件轉換`,
    'todo-add': `✅ 待辦列表`,
    'web-scraper': `🕷️ 網頁抓取`,
    'qr-generator': `📱 QR二維碼`,
  }

  return [{
    type: 'open_tool', label: labelMap[tool] || `✅ 打开 ${cfg.route}`,
    run: async () => { navigate(`/tools/${cfg.route}?${qs.join('&')}`); onClose() },
  }]
}

// ── Fallback parser (LLM unavailable) ──
function fallbackParse(text: string): { tool: string; params: Record<string, string>; reply: string } {
  const today = new Date()
  const tmr = new Date(today); tmr.setDate(tmr.getDate() + 1)
  const yyyy = String(tmr.getFullYear()), mm = String(tmr.getMonth() + 1).padStart(2, '0'), dd = String(tmr.getDate()).padStart(2, '0')

  // Todo
  if (/提醒我|记得|别忘了|帮我记|创建待办|添加待办/.test(text)) {
    let task = text.replace(/提醒我|记得|别忘了|帮我记|创建(?:一个)?待办|添加(?:一个)?待办/g, '').replace(/^要|^去|^给|^的|^了|^做|^：|^:/, '').trim()
    let deadline = ''
    if (/明天/.test(text)) deadline = `${yyyy}-${mm}-${dd}`
    else if (/后天/.test(text)) { const d2 = new Date(today); d2.setDate(d2.getDate()+2); deadline = `${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}` }
    else if (/今天/.test(text)) deadline = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    return { tool: 'todo', params: { task: task.substring(0, 200), deadline }, reply: `好的，帮你记下了 📋` }
  }
  // Pomodoro
  const pm = text.match(/(\d+)\s*(分钟|分|min)/i)
  if (pm && /番茄|pomodoro|专注|计时|timer|focus/.test(text.toLowerCase())) return { tool: 'pomodoro', params: { work: String(parseInt(pm[1])) }, reply: `帮你打开 ${pm[1]} 分钟番茄钟 🍅` }
  // Email
  if (/写.*邮件|发.*邮件|请假.*邮件|给.*写/.test(text)) {
    const to = (text.match(/(?:给|帮)\s*(\S{1,6})\s*(?:写|发|回)/) || [])[1] || ''
    let hint = text.replace(/^(?:帮|给|替)\S{0,6}(?:写|发|回).*?(?:邮件|email|信|通知)?/i, '').trim().substring(0, 80)
    return { tool: 'email', params: { to, hint }, reply: `帮你${to ? '给' + to : ''}写邮件 ✉️` }
  }
  // Translation
  const tm = text.match(/(?:翻译|翻译一下)\s*[:：]?\s*(.+)/i)
  if (tm) return { tool: 'translation', params: { text: tm[1].trim(), mode: 'translate_zh_en' }, reply: '帮你翻译 ✨' }
  // Research
  const rm = text.match(/(?:调研|帮我搜|搜索|帮我查|了解)\s*(.+)/i)
  if (rm) return { tool: 'research', params: { topic: rm[1].trim() }, reply: `帮你调研「${rm[1].trim().substring(0, 30)}」🔍` }
  // PPT
  let slides = (text.match(/(\d+)\s*(页|张|slides?|pages?)/i) || [])[1]
  if (/ppt|演示|幻灯片|简报|presentation/.test(text.toLowerCase())) return { tool: 'ppt', params: { slides: slides || '0' }, reply: '帮你生成 PPT 大纲 📽️' }

  return { tool: 'none', params: {}, reply: '试试说：\n• "提醒我明天交报告"\n• "设置30分钟番茄"\n• "给张三写请假邮件"\n• "翻译：Hello World"' }
}

// ── Component ──
export default function AiChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)

  useEffect(() => {
    if (open) {
      setMessages([{
        role: 'assistant',
        content: '你好！我是你的 AI 助手。随便说，我能理解你的意思。\n\n• "提醒我明天改顾客样品"\n• "30分钟番茄"\n• "给刘浩写个请假邮件"\n• "翻译 Hello World"\n• "帮我搜 React 19"\n• "做一个10页PPT"\n\n无论你怎么说都行 👇',
      }])
      setInput(''); setThinking(false)
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || thinking) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setThinking(true)

    http.post('/api/ai/parse-intent', { text })
      .then((res: any) => {
        setThinking(false)
        const data = res.code === 0 ? res.data : fallbackParse(text)

        // ── 工作流响应 ──
        if (data.type === 'workflow' && data.plan) {
          const nodes = data.plan.nodes || []
          const nodeList = nodes.map((n: any) => n.label).join(' → ')
          const questions = data.questions || data.plan.questions || []
          const qText = questions.length ? '\n\n' + questions.map((q: string) => `💡 ${q}`).join('\n') : ''
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `🔀 **${data.plan.title || 'Workflow'}**\n${data.plan.description || ''}\n\n${nodeList}${qText}`,
            actions: [
              { type: 'open_workflow', label: '✅ 确认执行', run: async () => { localStorage.setItem('pending_workflow', JSON.stringify(data.plan)); navigate('/tools/workflow?load=ai-plan'); onClose() } },
              { type: 'open_workflow_edit', label: '✏️ 修改', run: async () => { localStorage.setItem('pending_workflow', JSON.stringify(data.plan)); navigate('/tools/workflow?load=ai-plan'); onClose() } },
            ],
          }])
          return
        }

        const parsed = data.tool !== 'none' ? data : fallbackParse(text)
        const actions = buildActions(parsed, navigate, onClose, text)
        if (actions.length === 0) {
          setMessages(prev => [...prev, { role: 'assistant', content: '试试说：\n• "提醒我明天交报告"\n• "设置30分钟番茄钟"\n• "给张三写封请假邮件"\n• "翻译：Hello World"' }])
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: parsed.reply || '好的', actions }])
        }
      })
      .catch(() => {
        setThinking(false)
        const fb = fallbackParse(text)
        const actions = buildActions(fb, navigate, onClose, text)
        setMessages(prev => [...prev, { role: 'assistant', content: fb.reply || '好的', actions: actions.length > 0 ? actions : undefined }])
      })
  }, [input, thinking, navigate, onClose])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', bottom: 90, right: 24, zIndex: 1001, width: 480, maxHeight: 680, borderRadius: 20, overflow: 'hidden', background: 'linear-gradient(180deg, rgba(10,15,40,0.98), rgba(13,17,37,0.95))', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', boxShadow: '0 0 60px rgba(0,229,255,0.1), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.12)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(124,58,237,0.06))', borderBottom: '1px solid rgba(0,229,255,0.08)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #00e5ff, #7c3aed)', fontSize: 16, fontWeight: 900, color: '#fff', boxShadow: '0 0 16px rgba(0,229,255,0.3)' }}>AI</div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ color: '#e0e8ff', fontSize: 14, display: 'block' }}>AI Assistant</Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>多步骤工作流 | 智能意图识别</Text>
        </div>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px', maxHeight: 460, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '92%', padding: '10px 16px', borderRadius: 16, fontSize: 13, lineHeight: 1.7, background: msg.role === 'user' ? 'linear-gradient(135deg, #00e5ff, #7c3aed)' : 'rgba(255,255,255,0.04)', color: msg.role === 'user' ? '#0a0e27' : '#c8d6e5', borderBottomRightRadius: msg.role === 'user' ? 4 : 16, borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 16, border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.06)' : 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: msg.role === 'user' ? 600 : 400 }}>
              {msg.content}
            </div>
            {msg.actions?.map((act, j) => (
              <Button key={j} size="small" onClick={act.run} style={{ borderRadius: 12, textAlign: 'left', fontSize: 12, height: 'auto', padding: '8px 14px', marginTop: 6, ...(j === 0 ? { background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', fontWeight: 600 } : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#c8d6e5' }) }}>
                {act.label}
              </Button>
            ))}
          </div>
        ))}
        {thinking && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', opacity: 0.5 }}><Spin size="small" /><Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>思考中...</Text></div>}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,229,255,0.08)', display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(0,229,255,0.02)' }}>
        <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} placeholder="输入你的需求..." variant="borderless" disabled={thinking} style={{ fontSize: 13, color: '#c8d6e5' }} />
        <Button type="primary" shape="circle" size="small" icon={<SendOutlined />} onClick={handleSend} loading={thinking} disabled={!input.trim()} style={{ flexShrink: 0, borderRadius: '50%', width: 36, height: 36, background: input.trim() ? 'linear-gradient(135deg, #00e5ff, #7c3aed)' : 'rgba(255,255,255,0.06)', border: 'none', boxShadow: input.trim() ? '0 0 12px rgba(0,229,255,0.3)' : 'none' }} />
      </div>
    </div>
  )
}
