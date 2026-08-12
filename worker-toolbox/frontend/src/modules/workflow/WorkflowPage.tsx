import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { Typography, Button, Card, Tag, message, Space, theme, Modal, Select, InputNumber, Input, Tooltip, Popconfirm, Segmented, Empty, Alert } from 'antd'
import {
  PlayCircleOutlined, StopOutlined, ReloadOutlined, CheckCircleOutlined,
  LoadingOutlined, CloseCircleOutlined, DownloadOutlined, SaveOutlined, DeleteOutlined,
  ThunderboltOutlined, BulbOutlined, BranchesOutlined, CheckSquareOutlined,
  CloseOutlined, SendOutlined, PlusOutlined, UploadOutlined, FilePptOutlined, CodeOutlined, SearchOutlined,
} from '@ant-design/icons'
import { Markmap } from 'markmap-view'
import { Transformer } from 'markmap-lib'
import http from '../../services/http'
import { autoLayout, canvasSize } from './workflowLayout'

const { Title, Text } = Typography
const { TextArea } = Input

// ── Types ──
interface ToolDef {
  id: string; name: string; description: string; icon: string; color: string;
  inputs: string[]; outputs: string[]; output_labels: Record<string, string>;
  category: string; config_schema: { key: string; label: string; type: string; options?: { label: string; value: string }[]; placeholder?: string }[];
}
interface WorkflowNode { id: string; tool: string; label: string; config?: Record<string, any> }
interface WorkflowEdge { id: string; from: string; to: string; fromOutput: string }
interface WorkflowPlan { title: string; description: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] }

let _nid = 0
function genNodeId() { return 'n' + (++_nid) }

function downloadFile(content: string, filename: string, ext: string) {
  const blob = new Blob([content], { type: 'text/' + ext + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename + '.' + ext
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url); message.success(filename + '.' + ext + ' downloaded')
}

export default function WorkflowPage() {
  const { token } = theme.useToken()
  const [tools, setTools] = useState<ToolDef[]>([])
  const [mode, setMode] = useState<'build' | 'ai'>('build')

  const [plan, setPlan] = useState<WorkflowPlan>({ title: '', description: '', nodes: [], edges: [] })
  const [planTitle, setPlanTitle] = useState('')
  const [planDesc, setPlanDesc] = useState('')

  // Recording
  const [meetingMode, setMeetingMode] = useState<'live' | 'online'>('live')
  const [recording, setRecording] = useState(false)
  const [recordDuration, setRecordDuration] = useState(0)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Execution
  const [processing, setProcessing] = useState(false)
  const [steps, setSteps] = useState<any[]>([])
  const [results, setResults] = useState<Record<string, any>>({})
  const [wfError, setWfError] = useState<string | null>(null)
  const [pollTimer, setPollTimer] = useState<ReturnType<typeof setInterval> | null>(null)

  // UI
  const [savedFlows, setSavedFlows] = useState<any[]>(() => loadSaved())
  const [showSaved, setShowSaved] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteSearch, setPaletteSearch] = useState('')
  const [downloading, setDownloading] = useState<'pptx' | 'html' | null>(null)
  const [pickingFor, setPickingFor] = useState<{ nodeId: string; outputKey: string } | null>(null)
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Node result preview modal
  const [previewNode, setPreviewNode] = useState<string | null>(null)

  // Robot config
  const [robotOpen, setRobotOpen] = useState(false)
  const [robotFlow, setRobotFlow] = useState<any>(null)
  const [robotSchedule, setRobotSchedule] = useState('daily')
  const [robotTime, setRobotTime] = useState('09:00')
  const [robotWeekday, setRobotWeekday] = useState(0)
  const [robotMonthDay, setRobotMonthDay] = useState(1)
  const [robotInput, setRobotInput] = useState('')

  // Input modal for non-meeting first tool
  const [inputModalOpen, setInputModalOpen] = useState(false)
  const [inputModalText, setInputModalText] = useState('')
  const [inputModalFile, setInputModalFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // SVG connector paths
  const dagContainerRef = useRef<HTMLDivElement>(null)
  const [connectorPaths, setConnectorPaths] = useState<{ id: string; d: string; color: string; label: string }[]>([])

  // Drag & drop
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({})
  const [dragging, setDragging] = useState<{ nodeId: string; startX: number; startY: number; mx: number; my: number } | null>(null)

  // Zoom
  const [zoom, setZoom] = useState(1) // 0.25 ~ 2.0
  const zoomStep = 0.1

  // Ctrl+wheel zoom
  useEffect(() => {
    const el = dagContainerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setZoom(z => Math.max(0.25, Math.min(2.0, z - Math.sign(e.deltaY) * zoomStep)))
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Auto-init node positions when nodes/edges change (only for new nodes)
  useEffect(() => {
    if (plan.nodes.length === 0) { setNodePositions({}); return }
    const auto = autoLayout(plan.nodes, plan.edges)
    setNodePositions(prev => {
      const next: Record<string, { x: number; y: number }> = {}
      for (const n of plan.nodes) {
        // Keep existing position if node was already positioned (user dragged it)
        if (prev[n.id]) {
          next[n.id] = prev[n.id]
        } else {
          next[n.id] = auto[n.id] || { x: 0, y: 0 }
        }
      }
      return next
    })
  }, [plan.nodes.length]) // Only re-auto-layout when node count changes

  // Handle auto-layout
  const handleAutoLayout = useCallback(() => {
    if (plan.nodes.length === 0) return
    setNodePositions(autoLayout(plan.nodes, plan.edges))
  }, [plan.nodes, plan.edges])

  // Drag handlers
  const handleDragStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault()
    const pos = nodePositions[nodeId] || { x: 0, y: 0 }
    setDragging({ nodeId, startX: pos.x, startY: pos.y, mx: e.clientX, my: e.clientY })
  }, [nodePositions])

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: MouseEvent) => {
      setNodePositions(prev => {
        const p = prev[dragging.nodeId] || { x: 0, y: 0 }
        const dx = e.clientX - dragging.mx
        const dy = e.clientY - dragging.my
        const nx = Math.max(0, dragging.startX + dx)
        const ny = Math.max(0, dragging.startY + dy)
        return { ...prev, [dragging.nodeId]: { x: nx, y: ny } }
      })
    }
    const handleUp = () => setDragging(null)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging])

  // Recompute SVG connector paths when plan or results change
  useLayoutEffect(() => {
    if (!dagContainerRef.current || plan.nodes.length === 0) { setConnectorPaths([]); return }
    const container = dagContainerRef.current
    const paths: { id: string; d: string; color: string; label: string }[] = []
    const cr = container.getBoundingClientRect()
    plan.edges.forEach(e => {
      const fromEl = container.querySelector(`[data-nid="${e.from}"]`) as HTMLElement | null
      const toEl = container.querySelector(`[data-nid="${e.to}"]`) as HTMLElement | null
      if (!fromEl || !toEl) return
      const fr = fromEl.getBoundingClientRect(); const tr = toEl.getBoundingClientRect()
      const x1 = fr.right - cr.left + 2
      const y1 = fr.top - cr.top + fr.height / 2
      const x2 = tr.left - cr.left - 2
      const y2 = tr.top - cr.top + tr.height / 2
      const dx = Math.max(30, Math.abs(x2 - x1) * 0.45)
      const d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
      const fromTool = tools.find(t => t.id === plan.nodes.find(n => n.id === e.from)?.tool)
      const color = fromTool?.color || '#8b5cf6'
      const label = fromTool?.output_labels?.[e.fromOutput] || e.fromOutput
      paths.push({ id: e.id, d, color, label })
    })
    setConnectorPaths(paths)
  }, [plan.nodes, plan.edges, tools, steps, results, nodePositions])

  // Load tools
  useEffect(() => { http.get('/api/workflow/tools').then((r: any) => { if (r.code === 0) setTools(r.data) }).catch(() => {}) }, [])
  useEffect(() => () => { if (pollTimer) clearInterval(pollTimer) }, [pollTimer])

  // Load pending workflow from AI Assistant
  useEffect(() => {
    const raw = localStorage.getItem('pending_workflow')
    if (raw) {
      try {
        const wf = JSON.parse(raw)
        setPlan(wf); setPlanTitle(wf.title || ''); setPlanDesc(wf.description || '')
        setMode('build'); setSteps([]); setResults({})
        localStorage.removeItem('pending_workflow')
        message.success('AI workflow loaded')
      } catch {}
    }
  }, [])

  // Edit Robot mode: load robot plan into canvas
  const [editingRobot, setEditingRobot] = useState<any>(null)
  useEffect(() => {
    const raw = localStorage.getItem('editing_robot')
    if (raw) {
      try {
        const robot = JSON.parse(raw)
        setEditingRobot(robot)
        if (robot.plan?.nodes?.length) {
          setPlan(robot.plan)
          setPlanTitle(robot.name || '')
          setPlanDesc(robot.first_input || '')
          setMode('build'); setSteps([]); setResults({})
        }
        localStorage.removeItem('editing_robot')
      } catch {}
    }
  }, [])

  const saveToRobot = useCallback(async () => {
    if (!editingRobot?.id) return
    try {
      await http.post(`/api/robot/create?robot_id=${editingRobot.id}`, {
        name: planTitle || editingRobot.name || 'Robot',
        plan, schedule_type: editingRobot.schedule_type || 'daily',
        time: editingRobot.time || '09:00',
        weekday: editingRobot.weekday || 0,
        month_day: editingRobot.month_day || 1,
        first_input: planDesc || editingRobot.first_input || '',
        enabled: editingRobot.enabled !== false,
      })
      message.success('Robot saved!')
      setEditingRobot(null)
      window.location.href = '/tools/robot'
    } catch { message.error('Failed') }
  }, [editingRobot, plan, planTitle, planDesc])

  // ── Recording ──
  const startLiveRecording = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = s
      const rec = new MediaRecorder(s, { mimeType: 'audio/webm' }); const chunks: Blob[] = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      rec.onstop = () => { s.getTracks().forEach(t => t.stop()); streamRef.current = null; const blob = new Blob(chunks, { type: 'audio/webm' }); setAudioChunks([blob]); setAudioUrl(URL.createObjectURL(blob)) }
      rec.start(1000); setMediaRecorder(rec); setAudioChunks([]); setAudioUrl(null)
      setRecording(true); setRecordDuration(0)
      timerRef.current = setInterval(() => setRecordDuration(d => d + 1), 1000)
    } catch { message.error('Microphone permission denied') }
  }, [])
  const stopRecording = useCallback(() => { mediaRecorder?.stop(); setMediaRecorder(null); setRecording(false); if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }, [mediaRecorder])
  const startOnlineRecording = useCallback(async () => {
    try { const r = await http.post('/api/meeting-recorder/start-system'); if (r.code !== 0) { message.error(r.msg); return }; setRecording(true); setRecordDuration(0); timerRef.current = setInterval(() => setRecordDuration(d => d + 1), 1000) } catch { message.error('Failed') }
  }, [])
  const stopOnlineRecording = useCallback(async () => {
    try { const r = await http.post('/api/meeting-recorder/stop-system'); if (r.code !== 0) { message.error(r.msg); return }; if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }; setRecording(false); const jid = r.data?.job_id; if (jid) { setProcessing(true); const poll = setInterval(async () => { const s = await http.get('/api/meeting-recorder/transcription-status/' + jid); if (s.code === 0 && s.data?.transcript) { clearInterval(poll); setResults(p => ({ ...p, transcript: s.data.transcript })); await runWorkflow({ text: s.data.transcript, node_configs: nodeConfigsFromPlan() }) } }, 2000); setTimeout(() => clearInterval(poll), 120000) } } catch { message.error('Failed') }
  }, [plan])

  useEffect(() => {
    if (audioUrl && !recording && audioChunks.length > 0) {
      setProcessing(true); const fd = new FormData(); fd.append('file', audioChunks[0], 'recording.webm')
      http.post('/api/meeting-recorder/upload', fd).then((r: any) => {
        if (r.code === 0 && r.data?.transcript) {
          setResults(p => ({ ...p, transcript: r.data.transcript }))
          runWorkflow({ text: r.data.transcript, node_configs: nodeConfigsFromPlan() })
        }
        else { message.error('Transcription failed'); setProcessing(false) }
      }).catch(() => { message.error('Upload failed'); setProcessing(false) })
    }
  }, [audioUrl, recording, audioChunks, plan])

  // Helper to collect node configs from current plan
  function nodeConfigsFromPlan(): Record<string, any> {
    const cfgs: Record<string, any> = {}
    plan.nodes.forEach(n => { if (n.config) cfgs[n.id] = n.config })
    return cfgs
  }

  // ── Run workflow ──
  const runWorkflow = useCallback(async (input: Record<string, any>) => {
    setProcessing(true); setWfError(null); setSteps([]); setResults({})
    const nodeConfigs = input.node_configs || nodeConfigsFromPlan()
    try {
      const r = await http.post('/api/workflow/run', { plan, input: { ...input, node_configs: nodeConfigs } })
      if (r.code !== 0) { message.error(r.msg); setProcessing(false); return }
      const poll = setInterval(async () => {
        const s = await http.get('/api/workflow/status/' + r.data.workflow_id)
        if (s.code === 0) {
          setSteps(s.data.nodes || [])
          const res = s.data.results || {}
          const flat: Record<string, any> = {}
          for (const k of Object.keys(res)) {
            if (k.startsWith('__tool_')) continue
            if (typeof res[k] === 'object' && res[k] && !res[k].error) Object.assign(flat, res[k])
            else if (typeof res[k] === 'string') flat[k] = res[k]
          }
          setResults(flat)
          if (s.data.status === 'done' || s.data.status === 'error') { clearInterval(poll); setProcessing(false); if (s.data.status === 'error') setWfError(s.data.error || 'Error') }
        }
      }, 600)
      setPollTimer(poll); setTimeout(() => { clearInterval(poll); setProcessing(false) }, 300000)
    } catch { message.error('Start failed'); setProcessing(false) }
  }, [plan])

  const firstNode = plan.nodes[0]
  const isMeetingFirst = firstNode?.tool === 'meeting_recorder'

  const handleStart = () => {
    if (isMeetingFirst) {
      const m = firstNode.config?.mode || 'live'; setMeetingMode(m)
      if (m === 'live') startLiveRecording(); else startOnlineRecording()
    } else {
      // Open input modal so user can paste text, upload file, etc.
      setInputModalText('')
      setInputModalFile(null)
      setInputModalOpen(true)
    }
  }

  const handleStartWithInput = () => {
    setInputModalOpen(false)
    const inp: Record<string, any> = {}
    plan.nodes.forEach(n => { if (n.config) Object.assign(inp, n.config) })
    if (inputModalText.trim()) {
      inp.text = inputModalText.trim()
    }
    if (inputModalFile) {
      inp.file = inputModalFile
    }
    runWorkflow(inp)
  }
  const handleStopMeeting = () => { const m = firstNode?.config?.mode || 'live'; if (m === 'live') stopRecording(); else stopOnlineRecording() }

  // ── Build ops ──
  const addNode = (tool: ToolDef) => {
    const nd: WorkflowNode = { id: genNodeId(), tool: tool.id, label: tool.name.split(' ')[0], config: {} }
    for (const f of tool.config_schema) { nd.config![f.key] = f.type === 'select' ? (f.options?.[0]?.value || '') : f.type === 'number' ? 12 : '' }
    setPlan(p => ({ ...p, nodes: [...p.nodes, nd] })); setPaletteOpen(false)
  }
  const removeNode = (nodeId: string) => setPlan(p => ({ ...p, nodes: p.nodes.filter(n => n.id !== nodeId), edges: p.edges.filter(e => e.from !== nodeId && e.to !== nodeId) }))
  const updateNodeConfig = (nodeId: string, key: string, value: any) => setPlan(p => ({ ...p, nodes: p.nodes.map(n => n.id === nodeId ? { ...n, config: { ...n.config, [key]: value } } : n) }))
  const removeEdge = (edgeId: string) => setPlan(p => ({ ...p, edges: p.edges.filter(e => e.id !== edgeId) }))

  const addEdgeConnection = (fromNodeId: string, toNodeId: string, fromOutput: string) => {
    // Allow same fromOutput → multiple different downstream nodes
    setPlan(p => ({ ...p, edges: [...p.edges, { id: 'e_' + fromNodeId + '_' + toNodeId + '_' + fromOutput + '_' + Date.now(), from: fromNodeId, to: toNodeId, fromOutput }] }))
  }

  const getNodeTool = (nid: string) => { const n = plan.nodes.find(nd => nd.id === nid); return n ? tools.find(t => t.id === n.tool) : undefined }
  const getIncomingEdges = (nid: string) => plan.edges.filter(e => e.to === nid)
  const getNodeOutputEdges = (nid: string, outputKey: string) => plan.edges.filter(e => e.from === nid && e.fromOutput === outputKey)
  const getNodeConnectionsForOutput = (nid: string, outputKey: string) => getNodeOutputEdges(nid, outputKey).map(e => { const tn = plan.nodes.find(nd => nd.id === e.to); return { edge: e, target: tn } })

  const allConfigFilled = () => {
    for (const n of plan.nodes) {
      const t = tools.find(tt => tt.id === n.tool); if (!t) continue
      for (const f of t.config_schema) { if (n.config?.[f.key] == null || n.config?.[f.key] === '') return false }
    }
    return plan.nodes.length > 0
  }

  // ── Save/Load ──
  const saveCurrent = () => { const list = loadSaved(); list.unshift({ plan, title: planTitle || plan.title || 'Workflow', description: planDesc || plan.description || '', savedAt: new Date().toISOString() }); saveFlows(list); setSavedFlows(list); message.success('Saved') }
  const loadFlow = (item: any) => { setPlan(item.plan); setPlanTitle(item.title || ''); setPlanDesc(item.description || ''); setShowSaved(false); setSteps([]); setResults({}); message.success('Loaded') }
  const delSaved = (idx: number) => { const lst = loadSaved(); lst.splice(idx, 1); saveFlows(lst); setSavedFlows(lst) }
  const resetAll = () => { setRecording(false); setProcessing(false); setWfError(null); setSteps([]); setResults({}); setAudioUrl(null); setRecordDuration(0); setAudioChunks([]); setPlan({ title: '', description: '', nodes: [], edges: [] }); setPlanTitle(''); setPlanDesc(''); if (pollTimer) clearInterval(pollTimer); if (timerRef.current) clearInterval(timerRef.current); if (mediaRecorder) mediaRecorder.stop(); streamRef.current?.getTracks().forEach(t => t.stop()); setMediaRecorder(null) }

  const handleAiPlan = async () => {
    const t = aiInput.trim(); if (!t || aiLoading) return; setAiLoading(true)
    try { const r = await http.post('/api/workflow/plan', { text: t }); if (r.code === 0) { const newPlan = { ...r.data, edges: (r.data.edges || []).map((e: any) => ({ ...e, id: e.id || ('e_' + e.from + '_' + e.to + '_' + (e.data || 'text')), fromOutput: e.fromOutput || e.data || 'text' })) }; setPlan(newPlan); setPlanTitle(r.data.title || ''); setPlanDesc(r.data.description || ''); setSteps([]); setResults({}); message.success('AI workflow generated'); const list = loadSaved(); list.unshift({ plan: newPlan, title: r.data.title || 'AI Workflow', description: r.data.description || '', savedAt: new Date().toISOString() }); saveFlows(list); setSavedFlows(list) } else { message.error(r.msg) } } catch { message.error('Failed') }
    finally { setAiLoading(false) }
  }

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  const recordingNode = plan.nodes.find(n => n.tool === 'meeting_recorder')

  return (
    <div style={{ padding: '0 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Title level={3} style={{ margin: 0 }}><ThunderboltOutlined /> Workflow Builder</Title>
          <Segmented value={mode} onChange={v => setMode(v as any)} options={[
            { label: 'Build 手动构建', value: 'build', icon: <BranchesOutlined /> },
            { label: 'AI Plan AI规划', value: 'ai', icon: <BulbOutlined /> },
          ]} />
        </div>
        <Space>
          {planTitle && <Tag color="blue" style={{ borderRadius: 100 }}>{planTitle || plan.title}</Tag>}
          {editingRobot ? (
            <Button type="primary" icon={<SaveOutlined />} onClick={saveToRobot}
              style={{ borderRadius: 100, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>💾 Save Robot</Button>
          ) : (
            <>
              <Button size="small" icon={<SaveOutlined />} onClick={saveCurrent} disabled={plan.nodes.length === 0} style={{ borderRadius: 100 }}>Save</Button>
              <Button size="small" icon={<ReloadOutlined />} onClick={resetAll} style={{ borderRadius: 100 }}>Reset</Button>
            </>
          )}
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Robot edit config bar */}
          {editingRobot && (
            <Card size="small" style={{ borderRadius: 14, marginBottom: 12, border: '1px solid rgba(0,229,255,0.2)', background: 'rgba(0,229,255,0.03)' }}>
              <Space wrap>
                <Text strong style={{ color: '#00e5ff' }}>🤖 Editing Robot</Text>
                <Input size="small" prefix="Name:" value={planTitle} onChange={e => setPlanTitle(e.target.value)} style={{ width: 180, borderRadius: 8 }} />
                <Select size="small" value={editingRobot.schedule_type || 'daily'} onChange={v => setEditingRobot({...editingRobot, schedule_type: v})} style={{ width: 100, borderRadius: 8 }}
                  options={[{label:'Daily',value:'daily'},{label:'Weekly',value:'weekly'},{label:'Monthly',value:'monthly'}]} />
                <Input size="small" type="time" value={editingRobot.time || '09:00'} onChange={e => setEditingRobot({...editingRobot, time: e.target.value})} style={{ width: 100, borderRadius: 8 }} />
                {editingRobot.schedule_type === 'weekly' && (
                  <Select size="small" value={editingRobot.weekday || 0} onChange={v => setEditingRobot({...editingRobot, weekday: v})} style={{ width: 90, borderRadius: 8 }}
                    options={['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>({label:d,value:i}))} />
                )}
                {editingRobot.schedule_type === 'monthly' && (
                  <Select size="small" value={editingRobot.month_day || 1} onChange={v => setEditingRobot({...editingRobot, month_day: v})} style={{ width: 80, borderRadius: 8 }}
                    options={Array.from({length:28},(_,i)=>({label:`${i+1}`,value:i+1}))} />
                )}
                <Input size="small" prefix="Input:" value={planDesc} onChange={e => setPlanDesc(e.target.value)}
                  placeholder="First tool input..." style={{ width: 260, borderRadius: 8 }} />
                <Button size="small" style={{ borderRadius: 100 }} onClick={() => { setEditingRobot(null); setPlan({title:'',description:'',nodes:[],edges:[]}); setPlanTitle(''); setPlanDesc(''); window.location.href='/tools/robot' }}>Cancel</Button>
              </Space>
            </Card>
          )}
          {/* Name inputs */}
          {plan.nodes.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Input size="small" placeholder="Workflow name" value={planTitle} onChange={e => setPlanTitle(e.target.value)} style={{ width: 200, borderRadius: 8 }} />
              <Input size="small" placeholder="Description" value={planDesc} onChange={e => setPlanDesc(e.target.value)} style={{ flex: 1, borderRadius: 8 }} />
            </div>
          )}

          {/* AI mode input */}
          {mode === 'ai' && (
            <Card size="small" style={{ borderRadius: 16, border: 'none', boxShadow: token.boxShadowSecondary, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <TextArea value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="Describe your workflow..." rows={2} style={{ flex: 1, borderRadius: 12 }} />
                <Button type="primary" icon={<SendOutlined />} onClick={handleAiPlan} loading={aiLoading} style={{ borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, #3b5ccc, #8b5cf6)', border: 'none' }}>Generate</Button>
              </div>
            </Card>
          )}

          {/* Pipeline canvas — free-drag DAG layout */}
          {plan.nodes.length > 0 && (() => {
            const cSize = canvasSize(plan.nodes, plan.edges)
            const nodeW = 260

            return (
              <Card title={<span><BranchesOutlined style={{ marginRight: 8 }} />Pipeline</span>}
                extra={<Space>
                  <Tooltip title="Auto-arrange by topological order"><Button size="small" icon={<ReloadOutlined />} onClick={handleAutoLayout} style={{ borderRadius: 100 }}>Auto Layout</Button></Tooltip>
                  {!processing ? <Button size="small" icon={<PlusOutlined />} onClick={() => setPaletteOpen(true)} style={{ borderRadius: 100 }}>Add Tool</Button>
                    : <Tag color="processing" style={{ borderRadius: 100 }}><LoadingOutlined spin /> Processing</Tag>}
                </Space>}
                style={{ borderRadius: 16, border: 'none', boxShadow: token.boxShadowSecondary, marginBottom: 16 }}
              >
                {/* START / recording controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  {!processing && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {allConfigFilled() ? (
                        <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={handleStart}
                          style={{ borderRadius: 100, paddingLeft: 28, paddingRight: 28, height: 48, fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>
                          START
                        </Button>
                      ) : (
                        <Tooltip title="Configure all tool params first"><Button disabled size="large" icon={<PlayCircleOutlined />} style={{ borderRadius: 100, paddingLeft: 28, paddingRight: 28, height: 48 }}>START</Button></Tooltip>
                      )}
                    </div>
                  )}
                  {recording && recordingNode && (
                    <div>
                      <Button type="primary" danger size="large" icon={<StopOutlined />} onClick={handleStopMeeting}
                        style={{ borderRadius: 100, paddingLeft: 28, paddingRight: 28, height: 48, fontSize: 15, fontWeight: 700, animation: 'pulse 1.5s infinite' }}>
                        Stop & Process
                      </Button>
                      <div style={{ marginTop: 8 }}><Tag color="red" style={{ borderRadius: 100, fontSize: 14, padding: '4px 14px' }}>● {fmt(recordDuration)}</Tag></div>
                    </div>
                  )}
                  {!processing && <Text type="secondary" style={{ fontSize: 11 }}>Tip: drag cards to rearrange 拖动卡片可重新排列</Text>}
                </div>

                {/* Canvas with absolute positioning */}
                <div ref={dagContainerRef} style={{
                  position: 'relative', width: cSize.width, height: cSize.height,
                  overflow: 'auto', cursor: dragging ? 'grabbing' : 'default',
                  background: token.colorBgLayout, borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}`,
                  userSelect: 'none',
                }}>
                  {/* Zoomed content wrapper */}
                  <div style={{
                    transform: `scale(${zoom})`, transformOrigin: 'top left',
                    width: cSize.width, height: cSize.height,
                  }}>
                  {plan.nodes.map((node) => {
                    const td = getNodeTool(node.id)
                    const ss = steps.find(s => s.id === node.id)
                    const sDone = ss?.status === 'done'; const sRunning = ss?.status === 'running'; const sError = ss?.status === 'error'
                    const incoming = getIncomingEdges(node.id)
                    const pos = nodePositions[node.id] || { x: 0, y: 0 }
                    const idx = plan.nodes.findIndex(n => n.id === node.id)
                    const isDragging = dragging?.nodeId === node.id

                    return (
                      <div key={node.id} data-nid={node.id} style={{
                        position: 'absolute', left: 0, top: 0,
                        transform: `translate(${pos.x}px, ${pos.y}px)`,
                        width: nodeW, zIndex: isDragging ? 100 : 1,
                        transition: isDragging ? 'none' : 'box-shadow 0.3s',
                      }}>
                        {/* Input indicators */}
                        {incoming.length > 0 && (
                          <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            {incoming.map(e => {
                              const fn = plan.nodes.find(n => n.id === e.from)
                              const ft = getNodeTool(e.from)
                              const ol = ft?.output_labels?.[e.fromOutput] || e.fromOutput
                              return (
                                <Tooltip key={e.id} title={`← ${fn?.label}: ${ol}`}>
                                  <Tag color="orange" style={{ borderRadius: 100, fontSize: 9, margin: 0, padding: '0 6px', lineHeight: '16px' }}>
                                    ← {ol}
                                  </Tag>
                                </Tooltip>
                              )
                            })}
                          </div>
                        )}

                        {/* Node card — click completed to preview */}
                        <Card size="small"
                          onClick={() => { if (sDone) setPreviewNode(node.id) }}
                          title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'grab' }}
                              onMouseDown={e => { if (!processing) handleDragStart(node.id, e) }}>
                              <span>{td?.icon || '⬜'}</span><Text strong style={{ fontSize: 13, color: token.colorText }}>{node.label}</Text>
                            </div>
                          }
                          extra={!processing ? <Button type="text" size="small" danger icon={<CloseOutlined />} onClick={() => removeNode(node.id)} /> : null}
                          style={{
                            borderRadius: 14, background: token.colorBgContainer,
                            border: sRunning ? `2px solid ${token.colorPrimary}` : sDone ? '1.5px solid #10b981' : sError ? '1.5px solid #ef4444' : idx === 0 ? `1.5px dashed ${token.colorPrimary}` : `1px solid ${token.colorBorderSecondary}`,
                            boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.3)' : sRunning ? `0 0 12px ${token.colorPrimary}30` : 'none',
                            transition: isDragging ? 'none' : 'all 0.3s',
                          }}
                        >
                          {/* Tool description */}
                          {td?.description && (
                            <Text style={{ fontSize: 10, color: token.colorTextSecondary, display: 'block', marginBottom: 6, lineHeight: 1.4 }}>
                              {td.description}
                            </Text>
                          )}
                          {sRunning && <Tag color="processing" style={{ marginBottom: 4, borderRadius: 100, fontSize: 10 }}><LoadingOutlined spin /> Running</Tag>}
                          {sDone && <Tag color="success" style={{ marginBottom: 4, borderRadius: 100, fontSize: 10 }}><CheckCircleOutlined /> Done</Tag>}
                          {sError && <Tag color="error" style={{ marginBottom: 4, borderRadius: 100, fontSize: 10 }}>Failed</Tag>}
                          {sError && ss?.error && <Text type="danger" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>{String(ss.error).substring(0, 80)}</Text>}

                          {/* Config fields */}
                          {!processing && td && td.config_schema.map(f => {
                            return (
                              <div key={f.key} style={{ marginBottom: 6 }}>
                                <Text style={{ fontSize: 10, display: 'block', marginBottom: 2, color: '#8899bb' }}>{f.label}</Text>
                                {f.type === 'select' ? (
                                  <Select size="small" value={node.config?.[f.key]} onChange={v => updateNodeConfig(node.id, f.key, v)} style={{ width: '100%' }} options={f.options?.map(o => ({ label: o.label, value: o.value }))} />
                                ) : f.type === 'number' ? (
                                  <InputNumber size="small" value={node.config?.[f.key]} onChange={v => updateNodeConfig(node.id, f.key, v)} placeholder={f.placeholder} style={{ width: '100%' }} min={1} max={100} />
                                ) : (
                                  <Input size="small" value={node.config?.[f.key] || ''} onChange={e => updateNodeConfig(node.id, f.key, e.target.value)} placeholder={f.placeholder} />
                                )}
                              </div>
                            )
                          })}

                          {/* Inputs display */}
                          {incoming.length > 0 && (
                            <div style={{ marginTop: 4, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 4 }}>
                              <Text style={{ fontSize: 9, color: '#8899bb' }}>Inputs:</Text>
                              {incoming.map(e => { const fn = plan.nodes.find(n => n.id === e.from); const ft = getNodeTool(e.from); return <Tag key={e.id} color="orange" style={{ borderRadius: 100, fontSize: 9, marginRight: 4, marginTop: 2 }}>↑ {fn?.label}: {ft?.output_labels?.[e.fromOutput] || e.fromOutput}</Tag> })}
                            </div>
                          )}

                          {/* Outputs — MULTI-CONNECT */}
                          {td && td.outputs.length > 0 && (
                            <div style={{ marginTop: 4, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 4 }}>
                              <Text style={{ fontSize: 10, display: 'block', marginBottom: 4, color: '#8899bb' }}>Outputs 输出:</Text>
                              {td.outputs.map(o => {
                                const conns = getNodeConnectionsForOutput(node.id, o)
                                return (
                                  <div key={o} style={{ marginTop: 3 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                      <Tag style={{
                                        borderRadius: 100, fontSize: 10, margin: 0, cursor: 'pointer',
                                        border: conns.length > 0 ? '2px solid #10b981' : '1px dashed #ccc',
                                        background: conns.length > 0 ? 'rgba(16,185,129,0.1)' : 'transparent'
                                      }} onClick={() => setPickingFor({ nodeId: node.id, outputKey: o })}>
                                        {conns.length > 0 && <CheckCircleOutlined style={{ color: '#10b981', marginRight: 4, fontSize: 10 }} />}
                                        {td.output_labels?.[o] || o}
                                        {conns.length > 0 && <span style={{ marginLeft: 4, color: '#10b981', fontWeight: 700 }}>×{conns.length}</span>}
                                      </Tag>
                                      <Button type="text" size="small" icon={<PlusOutlined />} style={{ fontSize: 10, height: 18, padding: 0, color: token.colorPrimary }}
                                        onClick={() => setPickingFor({ nodeId: node.id, outputKey: o })} />
                                    </div>
                                    {conns.length > 0 && (
                                      <div style={{ marginLeft: 8, marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                        {conns.map(c => (
                                          <Tag key={c.edge.id} color="green" style={{ borderRadius: 100, fontSize: 9, margin: 0, cursor: 'pointer' }}
                                            closable onClose={(e: any) => { e.preventDefault(); removeEdge(c.edge.id) }}>
                                            → {c.target?.label || '?'}
                                          </Tag>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </Card>
                      </div>
                    )
                  })}

                  {/* SVG connector overlay */}
                  <svg style={{
                    position: 'absolute', top: 0, left: 0, width: cSize.width, height: cSize.height,
                    pointerEvents: 'none', zIndex: 0, overflow: 'visible',
                  }}>
                    <defs>
                      {connectorPaths.map(p => (
                        <marker key={`m-${p.id}`} id={`arrow-${p.id}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto">
                          <path d="M0,0 L10,5 L0,10 Z" fill={p.color} />
                        </marker>
                      ))}
                    </defs>
                    {connectorPaths.map(p => (
                      <g key={p.id}>
                        <path d={p.d} fill="none" stroke={p.color} strokeWidth={2} strokeOpacity={0.7}
                          markerEnd={`url(#arrow-${p.id})`} />
                        <text fontSize={9} fill={p.color} textAnchor="middle" opacity={0.9}>
                          <textPath href={`#labelpath-${p.id}`} startOffset="50%">{p.label}</textPath>
                        </text>
                        <path id={`labelpath-${p.id}`} d={p.d} fill="none" stroke="none" />
                      </g>
                    ))}
                  </svg>
                </div>{/* end zoomed content wrapper */}
                {/* Zoom controls */}
                <div style={{
                  position: 'absolute', bottom: 12, right: 12, zIndex: 10,
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: token.colorBgContainer, borderRadius: 100, padding: '2px 8px',
                  boxShadow: token.boxShadowSecondary,
                }}>
                  <Button type="text" size="small" onClick={() => setZoom(z => Math.max(0.25, z - zoomStep))}
                    style={{ fontSize: 14, width: 28, height: 28, borderRadius: '50%' }}>−</Button>
                  <Text style={{ fontSize: 11, minWidth: 40, textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</Text>
                  <Button type="text" size="small" onClick={() => setZoom(z => Math.min(2.0, z + zoomStep))}
                    style={{ fontSize: 14, width: 28, height: 28, borderRadius: '50%' }}>+</Button>
                </div>
              </div>
              </Card>
            )
          })()}

          {/* Empty state */}
          {plan.nodes.length === 0 && (
            <Card style={{ borderRadius: 16, border: 'none', boxShadow: token.boxShadowSecondary, textAlign: 'center', padding: '60px 0' }}>
              <Empty description="Add tools to build your workflow" imageStyle={{ height: 60 }}>
                <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setPaletteOpen(true)} style={{ borderRadius: 100, background: 'linear-gradient(135deg, #3b5ccc, #8b5cf6)', border: 'none' }}>Add First Tool</Button>
              </Empty>
            </Card>
          )}

          {/* Error */}
          {wfError && <Alert type="error" message={wfError} banner closable onClose={() => setWfError(null)} style={{ borderRadius: 10, marginBottom: 16 }} />}

          {/* Results */}
          {!processing && results && (results.transcript || results.summary || results.markdown || results.todos || results.added_count != null || results.outline || results.translated_text || results.document || results.report || results.diff || results.plan || results.chart_url || results.description) && (
            <div style={{ marginTop: 16 }}>
              {results.transcript && <Card size="small" title="🎙️ Transcript" extra={<DownloadOutlined onClick={() => downloadFile(results.transcript, 'transcript', 'txt')} style={{ cursor: 'pointer' }} />} style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12 }} styles={{ body: { maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 12 } }}>{results.transcript}</Card>}
              {results.summary && <Card size="small" title="📝 Summary" extra={<DownloadOutlined onClick={() => downloadFile(results.summary, 'summary', 'md')} style={{ cursor: 'pointer' }} />} style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12 }} styles={{ body: { maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' } }}>{results.summary}</Card>}
              {results.markdown && <MindmapResult markdown={results.markdown} onDownload={downloadFile} />}
              {results.outline && <Card size="small" title="📽️ PPT Outline"
                extra={
                  <Space>
                    <Button size="small" icon={<FilePptOutlined />} loading={downloading === 'pptx'} style={{ borderRadius: 100 }}
                      onClick={async () => {
                        setDownloading('pptx')
                        try {
                          const r = await fetch('/api/ppt-outline/generate-pptx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outline: results.outline, slide_count: 12 }) })
                          if (!r.ok) throw new Error('Failed')
                          const blob = await r.blob(); const url = URL.createObjectURL(blob)
                          const a = document.createElement('a'); a.href = url; a.download = 'presentation.pptx'; a.click(); URL.revokeObjectURL(url)
                          message.success('PPTX downloaded')
                        } catch { message.error('PPTX generation failed') } finally { setDownloading(null) }
                      }}>PPTX</Button>
                    <Button size="small" icon={<CodeOutlined />} loading={downloading === 'html'} style={{ borderRadius: 100 }}
                      onClick={async () => {
                        setDownloading('html')
                        try {
                          const r = await fetch('/api/ppt-outline/generate-html', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outline: results.outline }) })
                          if (!r.ok) throw new Error('Failed')
                          const blob = await r.blob(); const url = URL.createObjectURL(blob)
                          const a = document.createElement('a'); a.href = url; a.download = 'presentation.html'; a.click(); URL.revokeObjectURL(url)
                          message.success('HTML downloaded')
                        } catch { message.error('HTML generation failed') } finally { setDownloading(null) }
                      }}>HTML</Button>
                    <DownloadOutlined onClick={() => downloadFile(results.outline, 'outline', 'md')} style={{ cursor: 'pointer' }} />
                  </Space>
                }
                style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12 }} styles={{ body: { maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' } }}>{results.outline}</Card>}
              {results.translated_text && <Card size="small" title="🌐 Translation" style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12 }} styles={{ body: { whiteSpace: 'pre-wrap' } }}>{results.translated_text}</Card>}
              {results.document && <Card size="small" title="✉️ Document" style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12 }} styles={{ body: { maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' } }}>{results.document}</Card>}
              {results.report && <Card size="small" title="📊 Report" style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12 }} styles={{ body: { maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' } }}>{results.report}</Card>}
              {results.diff && <Card size="small" title="⚖️ Diff" style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12 }} styles={{ body: { maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' } }}>{results.diff}</Card>}
              {results.plan && <Card size="small" title="🗓️ Plan" style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12 }} styles={{ body: { maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' } }}>{results.plan}</Card>}
              {results.chart_url && <Card size="small" title="📊 Chart 圖表" style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12, textAlign: 'center' }}><img src={results.chart_url} alt="Chart" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }} /></Card>}
              {results.description && !results.transcript && !results.summary && <Card size="small" title="🖼️ Image Analysis 圖片分析" style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12 }} styles={{ body: { maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' } }}>{results.description}</Card>}
              {results.todos && Array.isArray(results.todos) && results.todos.length > 0 && (
                <Card size="small" title={<span>✅ Todos ({results.todos.length})</span>} style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12 }} styles={{ body: { padding: '8px 20px' } }}>
                  {results.todos.map((t: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < results.todos.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none' }}>
                      <CheckSquareOutlined style={{ color: '#10b981' }} /><Text style={{ flex: 1, fontSize: 13 }}>{t.task}</Text>
                      {t.owner && t.owner !== 'TBD' && <Tag style={{ borderRadius: 100 }}>{t.owner}</Tag>}{t.deadline && <Tag color="blue" style={{ borderRadius: 100 }}>{t.deadline}</Tag>}
                    </div>
                  ))}
                  {results.added_count != null && <Tag color="green" style={{ borderRadius: 100, marginTop: 8 }}>✅ {results.added_count} added</Tag>}
                </Card>
              )}
              {audioUrl && <Card size="small" title="🔊 Recording" style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12 }}><audio controls src={audioUrl} style={{ width: '100%', maxWidth: 500 }} /></Card>}
              <div style={{ textAlign: 'center', marginTop: 16 }}><Space><Button icon={<SaveOutlined />} onClick={saveCurrent} type="primary" style={{ borderRadius: 100 }}>Save Workflow</Button><Button icon={<ReloadOutlined />} onClick={resetAll} style={{ borderRadius: 100 }}>New</Button></Space></div>
            </div>
          )}
        </div>

        {/* Saved sidebar — collapsible */}
        <div style={{ width: showSaved ? 260 : 0, flexShrink: 0, transition: 'width 0.3s', overflow: 'hidden' }}>
          {showSaved && (
            <Card size="small" title="💾 Saved" extra={<Button size="small" type="text" onClick={() => setShowSaved(false)}>Hide</Button>} style={{ borderRadius: 16, border: 'none', boxShadow: token.boxShadowSecondary }}>
              {savedFlows.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>No saved workflows</Text>}
              {savedFlows.map((item, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: i < savedFlows.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text strong style={{ fontSize: 12 }} ellipsis>{item.title || 'Untitled'}</Text>
                    <Space size={0}>
                      <Tooltip title="Set as Robot"><Button type="text" size="small" icon={<span>🤖</span>}
                        onClick={() => { setRobotFlow(item); setRobotOpen(true) }} /></Tooltip>
                      <Popconfirm title="Delete?" onConfirm={() => delSaved(i)}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
                    </Space></div>
                  <Text type="secondary" style={{ fontSize: 10 }}>{item.description}</Text>
                  <div style={{ marginTop: 4 }}><Text type="secondary" style={{ fontSize: 9 }}>{item.plan?.nodes?.length || 0} tools · {(item.savedAt || '').substring(0, 10)}</Text>
                    <Button size="small" block onClick={() => loadFlow(item)} style={{ borderRadius: 100, marginTop: 4, fontSize: 11 }}>Load</Button></div>
                </div>
              ))}
            </Card>
          )}
        </div>
        {/* Toggle saved sidebar button */}
        {!showSaved && (
          <Tooltip title="Show saved workflows">
            <Button type="text" icon={<SaveOutlined />} onClick={() => setShowSaved(true)}
              style={{ position: 'fixed', right: 16, top: 120, zIndex: 10, borderRadius: 100, boxShadow: token.boxShadowSecondary }} />
          </Tooltip>
        )}
      </div>

      {/* Output → target picker modal — stays open for multi-connect */}
      <Modal title={<span>Connect <Text strong>"{plan.nodes.find(n => n.id === pickingFor?.nodeId)?.label}"</Text> output: <Text code>{getNodeTool(pickingFor?.nodeId || '')?.output_labels?.[pickingFor?.outputKey || ''] || pickingFor?.outputKey}</Text></span>}
        open={!!pickingFor} onCancel={() => setPickingFor(null)}
        footer={<Button onClick={() => setPickingFor(null)} type="primary" style={{ borderRadius: 100 }}>Done 完成</Button>}
        width={500}>
        {pickingFor && (() => {
          const existingConns = getNodeOutputEdges(pickingFor.nodeId, pickingFor.outputKey)
          const connectedIds = new Set(existingConns.map(e => e.to))
          return (
            <>
              {existingConns.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Connected to 已连接到:</Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {existingConns.map(e => {
                      const tn = plan.nodes.find(n => n.id === e.to)
                      const ttd = getNodeTool(e.to)
                      return (
                        <Tag key={e.id} color="success" closable style={{ borderRadius: 100 }}
                          onClose={(ev: any) => { ev.preventDefault(); removeEdge(e.id) }}>
                          {ttd?.icon} {tn?.label || '?'}
                        </Tag>
                      )
                    })}
                  </div>
                </div>
              )}
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                Click tools below to connect / disconnect — 点击下方工具连接或断开:
              </Text>
              {plan.nodes.filter(n => n.id !== pickingFor!.nodeId).map(n => {
                const isConnected = connectedIds.has(n.id)
                const td = getNodeTool(n.id)
                return (
                  <Card key={n.id} size="small" hoverable onClick={() => {
                    if (isConnected) {
                      const e = plan.edges.find(ee => ee.from === pickingFor!.nodeId && ee.to === n.id && ee.fromOutput === pickingFor!.outputKey)
                      if (e) removeEdge(e.id)
                    } else {
                      addEdgeConnection(pickingFor!.nodeId, n.id, pickingFor!.outputKey)
                    }
                  }}
                    style={{ marginBottom: 8, borderRadius: 12, cursor: 'pointer', border: isConnected ? '2px solid #10b981' : `1px solid ${token.colorBorderSecondary}`, background: isConnected ? 'rgba(16,185,129,0.05)' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 20 }}>{td?.icon || '⬜'}</span><div style={{ flex: 1 }}><Text strong style={{ fontSize: 13 }}>{n.label}</Text><br /><Text type="secondary" style={{ fontSize: 10 }}>{td?.name}</Text></div>
                      {isConnected ? <Tag color="success" style={{ borderRadius: 100 }}><CheckCircleOutlined /> Connected</Tag> : <Tag style={{ borderRadius: 100 }}>Click to connect</Tag>}</div>
                  </Card>
                )
              })}
            </>
          )
        })()}
      </Modal>

      {/* Node result preview modal */}
      <Modal title={<span>{(plan.nodes.find(n => n.id === previewNode))?.label || 'Result'} 執行結果</span>}
        open={!!previewNode} onCancel={() => setPreviewNode(null)} footer={null} width={700}>
        {previewNode && (() => {
          const node = plan.nodes.find(n => n.id === previewNode)
          const td = node ? getNodeTool(node.id) : undefined
          const nodeResult = results
          const relevant: [string, any][] = []
          if (td) {
            for (const o of td.outputs) {
              if (nodeResult[o] !== undefined) relevant.push([o, nodeResult[o]])
            }
          }
          for (const k of Object.keys(nodeResult)) {
            if (['transcript','summary','markdown','todos','outline','translated_text','document','report','diff','plan','answer','sources','added_count'].includes(k)) {
              if (!relevant.find(r => r[0] === k)) relevant.push([k, nodeResult[k]])
            }
          }
          if (!relevant.length) return <Empty description="No output data for this node" />
          return relevant.map(([key, val]) => (
            <Card key={key} size="small" title={td?.output_labels?.[key] || key} style={{ marginBottom: 8, borderRadius: 12 }}>
              {key === 'todos' && Array.isArray(val) ? (
                <div>{val.map((t: any, i: number) => <div key={i} style={{ padding: '4px 0' }}><CheckSquareOutlined style={{ color: '#10b981', marginRight: 6 }} />{t.task} {t.owner && t.owner !== 'TBD' && <Tag style={{ borderRadius: 100, marginLeft: 6 }}>{t.owner}</Tag>}</div>)}</div>
              ) : key === 'outline' ? (
                <div>
                  <div style={{ maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 12, marginBottom: 8 }}>{String(val)}</div>
                  <Space><Button size="small" icon={<FilePptOutlined />} style={{ borderRadius: 100 }} onClick={async () => { try { const r = await fetch('/api/ppt-outline/generate-pptx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outline: String(val), slide_count: 12 }) }); if (r.ok) { const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'presentation.pptx'; a.click(); URL.revokeObjectURL(url) } } catch {} }}>PPTX</Button>
                  <Button size="small" icon={<CodeOutlined />} style={{ borderRadius: 100 }} onClick={async () => { try { const r = await fetch('/api/ppt-outline/generate-html', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outline: String(val) }) }); if (r.ok) { const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'presentation.html'; a.click(); URL.revokeObjectURL(url) } } catch {} }}>HTML</Button></Space>
                </div>
              ) : typeof val === 'object' ? (
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, maxHeight: 300, overflow: 'auto' }}>{JSON.stringify(val, null, 2)}</pre>
              ) : (
                <div style={{ maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 12 }}>{String(val)}</div>
              )}
            </Card>
          ))
        })()}
      </Modal>

      {/* Input modal — for non-meeting first tool */}
      <Modal
        title={<span>"{firstNode?.label || 'First Tool'}" — Provide Input 提供内容</span>}
        open={inputModalOpen}
        onCancel={() => setInputModalOpen(false)}
        onOk={handleStartWithInput}
        okText="Start Workflow 启动工作流"
        okButtonProps={{ disabled: !inputModalText.trim() && !inputModalFile }}
        width={560}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Paste text, enter text or upload a file — this will be processed by the first tool and passed down the pipeline.
            输入文本或上传文件，第一个工具处理后传给下游。
          </Text>
        </div>
        <TextArea
          value={inputModalText}
          onChange={e => setInputModalText(e.target.value)}
          rows={8}
          placeholder="Enter or paste text to process... 输入要处理的文字..."
          style={{ borderRadius: 10, marginBottom: 12 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) setInputModalFile(f) }}
          />
          <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()} style={{ borderRadius: 100 }}>
            Upload File 上传文件
          </Button>
          {inputModalFile && (
            <Tag closable onClose={() => setInputModalFile(null)} style={{ borderRadius: 100 }}>
              {inputModalFile.name}
            </Tag>
          )}
        </div>
      </Modal>

      {/* Tool Palette — searchable + categorized */}
      <Modal title="Add Tool" open={paletteOpen} onCancel={() => { setPaletteOpen(false); setPaletteSearch('') }} footer={null} width={750}>
        <Input size="middle" prefix={<SearchOutlined />} placeholder="Search tools 搜索工具..." value={paletteSearch}
          onChange={e => setPaletteSearch(e.target.value)} allowClear
          style={{ borderRadius: 8, marginBottom: 16 }} />
        {(() => {
          const q = paletteSearch.toLowerCase()
          const filtered = tools.filter(t =>
            !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.id.includes(q)
          )
          const cats = [
            { key: 'input', label: '📥 Input 输入', tools: filtered.filter(t => t.category === 'input') },
            { key: 'process', label: '⚙️ Process 处理', tools: filtered.filter(t => t.category === 'process') },
            { key: 'output', label: '📤 Output 输出', tools: filtered.filter(t => t.category === 'output') },
          ].filter(c => c.tools.length > 0)
          if (!cats.length) return <Empty description="No tools match 无匹配工具" />
          return cats.map(cat => (
            <div key={cat.key} style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: token.colorTextSecondary }}>{cat.label}</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {cat.tools.map(t => (
                  <Card key={t.id} hoverable size="small" onClick={() => { addNode(t); setPaletteSearch('') }}
                    style={{ width: 210, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 22 }}>{t.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ fontSize: 12, color: '#e0e8ff' }} ellipsis>{t.name}</Text>
                        <br /><Text style={{ fontSize: 10, color: '#8899bb' }}>{t.description.substring(0, 50)}</Text>
                        <div style={{ marginTop: 2 }}>
                          {t.outputs.map(o => <Tag key={o} style={{ borderRadius: 100, fontSize: 9, margin: '2px 2px 0 0', padding: '0 5px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#c8d6e5' }}>{t.output_labels?.[o] || o}</Tag>)}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))
        })()}
      </Modal>

      {/* 🤖 Robot config modal */}
      <Modal title={<span>🤖 Robot: {robotFlow?.title || 'Workflow'}</span>}
        open={robotOpen} onCancel={() => setRobotOpen(false)} width={500}
        footer={<Button type="primary" onClick={async () => {
          if (!robotFlow) return
          try {
            const list = await http.get('/api/robot/list')
            const count = (list.data?.length || 0) + 1
            const autoName = `Robot ${String(count).padStart(3, '0')}`
            await http.post('/api/robot/create', {
              name: autoName, plan: robotFlow.plan,
              schedule_type: robotSchedule, time: robotTime,
              weekday: robotWeekday, month_day: robotMonthDay,
              first_input: robotInput, enabled: true,
            })
            message.success('Robot created!')
            setRobotOpen(false)
          } catch { message.error('Failed') }
        }} style={{ borderRadius: 100, background: 'linear-gradient(135deg, #00e5ff, #7c3aed)', border: 'none' }}>🤖 Enable Robot</Button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>⏰ Schedule</Text>
            <Space wrap>
              <Select size="small" value={robotSchedule} onChange={setRobotSchedule} style={{ width: 100, borderRadius: 8 }}
                options={[{label:'Daily',value:'daily'},{label:'Weekly',value:'weekly'},{label:'Monthly',value:'monthly'}]} />
              <Input size="small" type="time" value={robotTime} onChange={e => setRobotTime(e.target.value)} style={{ width: 100, borderRadius: 8 }} />
              {robotSchedule === 'weekly' && (
                <Select size="small" value={robotWeekday} onChange={setRobotWeekday} style={{ width: 100, borderRadius: 8 }}
                  options={['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>({label:d,value:i}))} />
              )}
              {robotSchedule === 'monthly' && (
                <Select size="small" value={robotMonthDay} onChange={setRobotMonthDay} style={{ width: 100, borderRadius: 8 }}
                  options={Array.from({length:28},(_,i)=>({label:`${i+1}`,value:i+1}))} />
              )}
            </Space>
          </div>
          <div>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>📝 First Tool Input</Text>
            <TextArea rows={3} value={robotInput} onChange={e => setRobotInput(e.target.value)}
              placeholder="e.g. 调研{上周一}至{上周日}竞品动态..." style={{ borderRadius: 10 }} />
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <Text type="secondary" style={{ fontSize: 10, width: '100%', marginBottom: 2 }}>Variables:</Text>
              {['{今天}','{昨天}','{明天}','{上周一}','{上周日}','{本周一}','{本月一号}'].map(v => (
                <Tag key={v} style={{ borderRadius: 100, fontSize: 10, cursor: 'pointer' }}
                  onClick={() => setRobotInput(prev => prev + v)}>{v}</Tag>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function loadSaved(): any[] {
  try {
    const raw = localStorage.getItem('workflows')
    let list = raw ? JSON.parse(raw) : []
    // 确保是数组
    if (!Array.isArray(list)) list = []
    // 检查是否已有 5 个预设模板（按 title 判断），若没有则写入
    const hasTemplate = (title: string) => list.some((item: any) => item.title === title)
    const needsInit = !DEFAULT_TEMPLATES.every(t => hasTemplate(t.title))
    if (needsInit || list.length === 0) {
      // 把模板放在最前面，保留用户自定义的
      const userItems = list.filter((item: any) => !DEFAULT_TEMPLATES.some(t => t.title === item.title))
      list = [...DEFAULT_TEMPLATES, ...userItems]
      localStorage.setItem('workflows', JSON.stringify(list))
    }
    return list
  } catch {
    const list = [...DEFAULT_TEMPLATES]
    localStorage.setItem('workflows', JSON.stringify(list))
    return list
  }
}
function saveFlows(list: any[]) { localStorage.setItem('workflows', JSON.stringify(list)) }

// 5 个常用预设工作流模板
const DEFAULT_TEMPLATES = [
  {
    title: 'Meeting → Summary → Mindmap → Todos → Add',
    description: '会议录音 → AI总结 → 思维导图 → 提取待办 → 添加到列表',
    savedAt: new Date().toISOString(),
    plan: {
      title: 'Meeting → Summary → Mindmap → Todos',
      description: '录音转写 → AI总结 → 思维导图 → 提取待办 → 添加到列表',
      nodes: [
        { id: 'n1', tool: 'meeting_recorder', label: 'Meeting Recorder', config: { mode: 'live' } },
        { id: 'n2', tool: 'document_summary', label: 'Doc Summary', config: {} },
        { id: 'n3', tool: 'mindmap', label: 'Mind Map', config: { mode: 'meeting' } },
        { id: 'n4', tool: 'todo_extraction', label: 'Extract Todos', config: {} },
        { id: 'n5', tool: 'todo_add', label: 'Add Todos', config: {} },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', fromOutput: 'transcript' },
        { id: 'e2', from: 'n1', to: 'n3', fromOutput: 'summary' },
        { id: 'e3', from: 'n1', to: 'n4', fromOutput: 'transcript' },
        { id: 'e4', from: 'n4', to: 'n5', fromOutput: 'todos' },
      ],
    },
    nodeConfigs: { n1: { mode: 'live' }, n2: {}, n3: { mode: 'meeting' }, n4: {}, n5: {} },
  },
  {
    title: 'Translation → Email / Document',
    description: '翻译文本（中↔英/润色/改写）→ 生成邮件或公文',
    savedAt: new Date().toISOString(),
    plan: {
      title: 'Translation → Email',
      description: '翻译 → 邮件/公文生成',
      nodes: [
        { id: 'n1', tool: 'translation', label: 'Translation', config: { mode: 'translate_zh_en' } },
        { id: 'n2', tool: 'email_doc', label: 'Email / Doc', config: { doc_mode: 'email', to: '' } },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', fromOutput: 'translated_text' },
      ],
    },
    nodeConfigs: { n1: { mode: 'translate_zh_en' }, n2: { doc_mode: 'email', to: '' } },
  },
  {
    title: 'Doc Summary → Mindmap + Todos → Add',
    description: '文档摘要 → 分支：思维导图 + 待办提取 → 添加到待办列表',
    savedAt: new Date().toISOString(),
    plan: {
      title: 'Summary → Mindmap + Todos → Add',
      description: '文档摘要 → 思维导图 & 待办提取 → 添加到列表',
      nodes: [
        { id: 'n1', tool: 'document_summary', label: 'Doc Summary', config: {} },
        { id: 'n2', tool: 'mindmap', label: 'Mind Map', config: { mode: 'auto' } },
        { id: 'n3', tool: 'todo_extraction', label: 'Extract Todos', config: {} },
        { id: 'n4', tool: 'todo_add', label: 'Add Todos', config: {} },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', fromOutput: 'summary' },
        { id: 'e2', from: 'n1', to: 'n3', fromOutput: 'summary' },
        { id: 'e3', from: 'n3', to: 'n4', fromOutput: 'todos' },
      ],
    },
    nodeConfigs: { n1: {}, n2: { mode: 'auto' }, n3: {}, n4: {} },
  },
  {
    title: 'PPT Outline → Doc Summary',
    description: '生成PPT大纲 → AI摘要提炼要点',
    savedAt: new Date().toISOString(),
    plan: {
      title: 'PPT → Summary',
      description: 'PPT大纲生成 → 文档摘要',
      nodes: [
        { id: 'n1', tool: 'ppt_outline', label: 'PPT Outline', config: { slides: 12, style: '' } },
        { id: 'n2', tool: 'document_summary', label: 'Doc Summary', config: {} },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', fromOutput: 'outline' },
      ],
    },
    nodeConfigs: { n1: { slides: 12, style: '' }, n2: {} },
  },
  {
    title: 'Deep Research → Email Report',
    description: '深度调研（含网络搜索） → 调研结果整理为结构化报告文档',
    savedAt: new Date().toISOString(),
    plan: {
      title: 'Research → Report',
      description: '深度调研 → 报告生成',
      nodes: [
        { id: 'n1', tool: 'deep_research', label: 'Deep Research', config: {} },
        { id: 'n2', tool: 'email_doc', label: 'Report Doc', config: { doc_mode: 'report', to: '' } },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', fromOutput: 'report' },
      ],
    },
    nodeConfigs: { n1: {}, n2: { doc_mode: 'report', to: '' } },
  },
]

// ── Mindmap result component (renders SVG interactively) ──
function MindmapResult({ markdown, onDownload }: { markdown: string; onDownload: (content: string, name: string, ext: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { token } = theme.useToken()
  const transformer = new Transformer()

  useEffect(() => {
    if (!svgRef.current || !markdown) return
    try {
      const { root } = transformer.transform(markdown)
      const mm = Markmap.create(svgRef.current, undefined, root)
      mm.fit()
    } catch {}
  }, [markdown])

  return (
    <Card
      size="small"
      title="🧠 Mind Map 思维导图"
      extra={<DownloadOutlined onClick={() => onDownload(markdown, 'mindmap', 'md')} style={{ cursor: 'pointer' }} />}
      style={{ borderRadius: 16, border: 'none', boxShadow: 'none', marginBottom: 12 }}
    >
      <svg ref={svgRef} style={{ width: '100%', height: 400, display: 'block', borderRadius: 8, background: token.colorBgContainer }} />
    </Card>
  )
}
