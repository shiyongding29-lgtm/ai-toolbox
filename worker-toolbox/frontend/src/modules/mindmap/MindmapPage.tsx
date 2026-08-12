import { useState, useEffect, useRef, useCallback } from 'react'
import { Typography, Input, Button, Spin, message, Segmented, Space, theme, Upload, Modal, List, Tag, Card } from 'antd'
import { BranchesOutlined, AudioOutlined, BulbOutlined, FileTextOutlined, UploadOutlined, HistoryOutlined, DownloadOutlined } from '@ant-design/icons'
import { Markmap } from 'markmap-view'
import { Transformer } from 'markmap-lib'
import { llmService } from '../../services/llmService'
import http from '../../services/http'
import VoiceInput from '../../shared/VoiceInput'

const { Title, Text } = Typography
const { TextArea } = Input
const { Dragger } = Upload

const MODES = [
  { value: 'auto', label: 'Auto 自動', icon: <BranchesOutlined /> },
  { value: 'meeting', label: 'Meeting 會議', icon: <AudioOutlined /> },
  { value: 'ideas', label: 'Ideas 靈感', icon: <BulbOutlined /> },
  { value: 'document', label: 'Document 文檔', icon: <FileTextOutlined /> },
]

interface Meeting { id: number; mode: string; summary: string; transcript_preview: string; duration_seconds: number; created_at: string }

const transformer = new Transformer()

function MindmapPage() {
  const { token } = theme.useToken()
  const [input, setInput] = useState(''); const [mode, setMode] = useState<string>('auto')
  const [markdown, setMarkdown] = useState(''); const [loading, setLoading] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const [meetings, setMeetings] = useState<Meeting[]>([]); const [meetingModalOpen, setMeetingModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  const loadMeetings = useCallback(async () => {
    try { const d: any = await http.get('/api/meeting-recorder/list'); if (d.code === 0) setMeetings(d.data.items || []) } catch {}
  }, [])
  useEffect(() => { loadMeetings() }, [loadMeetings])

  const renderMindmap = useCallback(() => {
    if (!svgRef.current || !markdown) return
    const { root } = transformer.transform(markdown)
    const mm = Markmap.create(svgRef.current, undefined, root)
    mm.fit()
  }, [markdown])
  useEffect(() => { renderMindmap() }, [renderMindmap])

  const handleGenerate = async () => {
    if (!input.trim()) return; setLoading(true)
    try { const r: any = await llmService.call('/api/mindmap/generate', { text: input, mode }); setMarkdown(r.data.markdown || '') }
    catch { message.error('Generation failed 生成失敗') } finally { setLoading(false) }
  }

  const handleGenerateFromMeeting = async (meetingId: number, label: string) => {
    setMeetingModalOpen(false); setLoading(true)
    try {
      const formData = new FormData(); formData.append('meeting_id', String(meetingId))
      formData.append('content_type', label === 'Summary 總結' ? 'summary' : 'transcript')
      const r: any = await http.post('/api/mindmap/from-meeting', formData)
      if (r.code === 0) { setMarkdown(r.data.markdown || ''); setMode('meeting') }
    } catch { message.error('Generation failed 生成失敗') } finally { setLoading(false) }
  }

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData(); formData.append('file', file)
      const r: any = await http.post('/api/mindmap/from-file', formData)
      if (r.code === 0) { setMarkdown(r.data.markdown || ''); setMode('document'); message.success('Mind map generated 已生成') }
      else message.error(r.msg || 'Failed 失敗')
    } catch { message.error('Upload failed 上傳失敗') } finally { setUploading(false) }
    return false
  }

  const formatTime = (s: number) => { const m = Math.floor(s / 60); return `${m}:${(s % 60).toString().padStart(2, '0')}` }

  const downloadSvg = () => {
    if (!svgRef.current) return
    const svg = svgRef.current
    const clone = svg.cloneNode(true) as SVGSVGElement
    const data = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'mindmap.svg'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    message.success('SVG downloaded 已下載')
  }

  const downloadPng = () => {
    if (!svgRef.current) return
    const svg = svgRef.current
    const box = svg.getBoundingClientRect()
    const W = box.width * 2
    const H = box.height * 2

    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(box.width))
    clone.setAttribute('height', String(box.height))

    const svgStr = new XMLSerializer().serializeToString(clone)
    const dataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)))

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)
      ctx.drawImage(img, 0, 0, W, H)
      const pngUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a'); a.href = pngUrl; a.download = 'mindmap.png'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      message.success('PNG downloaded 已下載')
    }
    img.onerror = () => { message.error('PNG生成失败，请使用SVG格式') }
    img.src = dataUri
  }

  return (
    <div className="tool-header" style={{ maxWidth: 1440, margin: '0 auto' }}>
      <Title level={3}><BranchesOutlined /> AI Mind Map 思維導圖</Title>
      <Text type="secondary">Input text, meeting notes, ideas or upload a document — AI generates an interactive mind map  |  輸入文字、選擇會議記錄、上傳文檔或靈感筆記，AI 自動生成可交互思維導圖</Text>

      <Segmented value={mode} onChange={v => setMode(v as string)}
        options={MODES.map(m => ({ value: m.value, label: m.label, icon: m.icon }))} style={{ marginTop: 16, marginBottom: 14 }} />

      {mode === 'document' ? (
        <Card size="small" style={{ borderRadius: 14 }} styles={{ body: { padding: 20 } }}>
          <Dragger accept=".txt,.md,.pdf" showUploadList={false} beforeUpload={handleFileUpload} disabled={uploading} style={{ borderRadius: 12 }}>
            {uploading ? <Spin tip="Parsing... 解析中..." /> : (
              <><p style={{ margin: 0 }}><UploadOutlined style={{ fontSize: 32, color: token.colorPrimary }} /></p>
                <Text type="secondary">Click or drag to upload TXT / MD / PDF 點擊或拖拽上傳文件</Text></>
            )}
          </Dragger>
        </Card>
      ) : (
        <>
          <VoiceInput onResult={(text) => setInput(text)} />
          <TextArea rows={7} value={input} onChange={e => setInput(e.target.value)}
            placeholder={mode === 'meeting' ? 'Paste meeting content or select from history... 粘貼會議內容，或從歷史記錄中選擇...' : mode === 'ideas' ? 'Enter your ideas & brainstorm notes... 輸入靈感、想法...' : 'Enter text — AI will generate a mind map... 輸入文字，AI 自動生成思維導圖...'}
            style={{ borderRadius: 10 }} />
          <Space style={{ marginTop: 14, marginBottom: 18 }} wrap>
            <Button type="primary" onClick={handleGenerate} loading={loading} icon={<BranchesOutlined />} style={{ borderRadius: 100, paddingLeft: 22, paddingRight: 22 }}>Generate 生成導圖</Button>
            {mode === 'meeting' && <Button icon={<HistoryOutlined />} onClick={() => { setMeetingModalOpen(true); loadMeetings() }} style={{ borderRadius: 100 }}>Select from History 從會議記錄選擇</Button>}
            <Button onClick={() => {
              const ex: Record<string, string> = { auto: 'Q3 Product Planning: DAU growth 20%, subscription launch, homepage load <2s 產品規劃', meeting: 'Zhang: Conversion dropped 5%, payment page slow. Li: Optimization releasing next week. Wang: New user onboarding redesign. 會議紀錄', ideas: 'New products: 1. AI meeting assistant 2. Smart knowledge base 3. Code review AI 4. Data analysis platform 新產品' }
              setInput(ex[mode] || ex.auto)
            }} style={{ borderRadius: 100 }}>Load Example 載入示例</Button>
          </Space>
        </>
      )}

      <Modal title="Select Meeting 選擇會議記錄" open={meetingModalOpen} onCancel={() => setMeetingModalOpen(false)} footer={null} width={600}>
        {meetings.length === 0 && <Text type="secondary">No meetings yet 暫無會議記錄</Text>}
        <List dataSource={meetings} renderItem={m => (
          <List.Item style={{ padding: '10px 0' }} actions={[
            <Button key="ts" size="small" onClick={() => handleGenerateFromMeeting(m.id, 'Transcript 轉寫稿')} loading={loading} style={{ borderRadius: 100 }}>Transcript 轉寫稿</Button>,
            <Button key="sum" size="small" type="primary" onClick={() => handleGenerateFromMeeting(m.id, 'Summary 總結')} loading={loading} disabled={!m.summary} style={{ borderRadius: 100 }}>Summary 總結</Button>,
          ]}>
            <List.Item.Meta title={<span>{m.mode === 'online' ? '💻' : '🏢'} {m.created_at} <Tag style={{ marginLeft: 8, borderRadius: 100 }}>{formatTime(m.duration_seconds)}</Tag></span>}
              description={m.summary ? m.summary.slice(0, 80) + '...' : m.transcript_preview.slice(0, 80) + '...'} />
          </List.Item>
        )} />
      </Modal>

      {loading && <Spin style={{ margin: '40px auto', display: 'block' }} />}

      {markdown && !loading && (
        <div style={{ display: 'flex', gap: 18, height: 'calc(100vh - 360px)', minHeight: 500 }}>
          <Card size="small" style={{ width: 300, flexShrink: 0, overflow: 'auto', borderRadius: 14 }}
            title="Markdown Source 源碼" styles={{ body: { padding: '14px 18px' } }}>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, lineHeight: 1.6, fontFamily: "'SF Mono', monospace" }}>{markdown}</pre>
          </Card>
          <Card style={{ flex: 1, borderRadius: 14, overflow: 'hidden', border: 'none' }}
            title={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Mind Map 導圖</span>
              <Space size={8}>
                <Button size="small" icon={<DownloadOutlined />} onClick={downloadSvg} style={{ borderRadius: 100 }}>SVG</Button>
                <Button size="small" icon={<DownloadOutlined />} onClick={downloadPng} style={{ borderRadius: 100 }}>PNG</Button>
              </Space>
            </div>}
            styles={{ body: { padding: 0, height: '100%' } }}>
            <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          </Card>
        </div>
      )}
    </div>
  )
}

export default MindmapPage
