import { useState, useEffect, useCallback } from 'react'
import { Typography, Space, message, Radio, Tabs, Spin, Button, Card, Select } from 'antd'
import { AudioOutlined, BranchesOutlined, PlusOutlined } from '@ant-design/icons'
import { theme } from 'antd'
import { useNavigate } from 'react-router-dom'
import MarkdownRenderer from '../../components/MarkdownRenderer'
import { useMediaRecorder } from '../../hooks/useMediaRecorder'
import { useMeetingHistory } from '../../hooks/useMeetingHistory'
import RecordingControls from './components/RecordingControls'
import MeetingHistoryList from './components/MeetingHistoryList'
import MeetingTabs from './components/MeetingTabs'
import http from '../../services/http'

const { Title, Text } = Typography

type MeetingMode = 'live' | 'online'

function MeetingRecorderPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const [mode, setMode] = useState<MeetingMode>('live')

  const recorder = useMediaRecorder()
  const history = useMeetingHistory()

  const { status, duration, transcript, summary, audioUrl, stream, extractedTodos, startRecording, stopRecording, reset } = recorder
  const { meetings, selectedDetail, loading: historyLoading, loadMeetings, loadDetail, clearDetail } = history
  const selectedId = selectedDetail?.id ?? null

  useEffect(() => { loadMeetings() }, [loadMeetings])

  const handleStart = useCallback(async () => {
    try {
      if (mode === 'online') await startRecording('online')
      else await startRecording('live')
    } catch (e: any) {
      if (e.name === 'NotAllowedError') message.error('Microphone access denied 麥克風權限被拒絕')
      else if (e.name === 'NotFoundError') message.error('No microphone detected 未檢測到麥克風')
      else if (e.message) message.error(e.message)
      else message.error('Failed to start recording 啟動錄製失敗')
    }
  }, [mode, startRecording])

  const handleSelectMeeting = useCallback((item: { id: number }) => { loadDetail(item.id) }, [loadDetail])
  const handleReset = useCallback(() => { reset(); clearDetail() }, [reset, clearDetail])

  const handleAddTodo = async (item: any, idx: number) => {
    let priority = item.priority || 2
    try {
      await http.post('/api/todos', { task: item.task, owner: item.owner || 'TBD', deadline: item.deadline || '', priority, source: 'meeting' })
      message.success(`Added: ${item.task} 已添加`)
    } catch { message.error('Failed 添加失敗') }
  }

  const formatTime = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}` }

  return (
    <div className="tool-header">
      <Title level={3}><AudioOutlined /> Meeting Notes 會議記錄</Title>
      <Text type="secondary">In-room recording & online meeting, AI transcription + auto-generated meeting summary  |  支持現場錄音同線上會議雙模式，AI 自動轉寫並生成紀要</Text>

      <Space style={{ marginTop: 16, marginBottom: 16 }}>
        <Radio.Group value={mode} onChange={e => setMode(e.target.value)}
          disabled={status === 'recording' || status === 'transcribing'}>
          <Radio.Button value="live">In-Room 現場會議</Radio.Button>
          <Radio.Button value="online">Online 線上會議</Radio.Button>
        </Radio.Group>
      </Space>

      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ width: 260, flexShrink: 0, maxHeight: 'calc(100vh - 240px)', overflow: 'auto' }}>
          <Card size="small" styles={{ body: { padding: 0 } }} style={{ borderRadius: 14, border: 'none', boxShadow: token.boxShadowSecondary }}>
            <MeetingHistoryList meetings={meetings} selectedId={selectedId}
              onSelect={handleSelectMeeting} onRefresh={loadMeetings} formatTime={formatTime} />
          </Card>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Card style={{ textAlign: 'center', borderRadius: 14, border: 'none', boxShadow: token.boxShadowSecondary, marginBottom: 16 }}
            styles={{ body: { padding: '28px 24px' } }}>
            <RecordingControls status={status} mode={mode} duration={formatTime(duration)}
              stream={stream} onStart={handleStart} onStop={stopRecording} onReset={handleReset} />
          </Card>

          {status === 'done' && (
            <Card style={{ borderRadius: 14, border: 'none', boxShadow: token.boxShadowSecondary }}
              styles={{ body: { padding: '20px 24px' } }}>
              <MeetingTabs summary={summary} transcript={transcript} audioUrl={audioUrl} mode={mode} loading={false} />
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Button icon={<BranchesOutlined />} onClick={() => navigate('/tools/mindmap')}>Generate Mind Map 生成思維導圖</Button>
              </div>

              {extractedTodos.length > 0 && (
                <Card size="small" title="Extracted Todos 已提取待辦" style={{ marginTop: 16, borderRadius: 12 }}
                  styles={{ body: { padding: '8px 14px' } }}>
                  {extractedTodos.map((item: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                      <span style={{ flex: 1, fontSize: 13 }}>{item.task}</span>
                      <Select size="small" defaultValue={item.priority || 2} style={{ width: 110 }}
                        options={[
                          { value: 1, label: 'P1 High' },
                          { value: 2, label: 'P2 Med' },
                          { value: 3, label: 'P3 Low' },
                        ]}
                      />
                      <Button size="small" type="primary" icon={<PlusOutlined />}
                        onClick={() => handleAddTodo(item, idx)}>
                        Add 添加
                      </Button>
                    </div>
                  ))}
                </Card>
              )}
            </Card>
          )}

          {historyLoading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}

          {selectedDetail && !historyLoading && (
            <Card style={{ borderRadius: 14, border: 'none', boxShadow: token.boxShadowSecondary, marginTop: 16 }}
              styles={{ body: { padding: '20px 24px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Title level={5} style={{ margin: 0 }}>
                  {selectedDetail.created_at} ({formatTime(selectedDetail.duration_seconds || 0)})
                </Title>
                <Button size="small" icon={<BranchesOutlined />} onClick={() => navigate('/tools/mindmap')}>Mind Map 思維導圖</Button>
              </div>
              <Tabs items={[
                { key: 'summary', label: 'Summary 會議總結', children: selectedDetail.summary ? <MarkdownRenderer content={selectedDetail.summary} /> : <Text type="secondary">No summary 暫無總結</Text> },
                { key: 'transcript', label: 'Transcript 會議內容', children: selectedDetail.transcript ? <div style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', fontSize: 13, lineHeight: 1.7 }}>{selectedDetail.transcript}</div> : <Text type="secondary">No content 暫無內容</Text> },
                { key: 'audio', label: 'Recording 會議錄音', children: selectedDetail.audio_path ? <audio controls src={selectedDetail.audio_path} style={{ width: '100%', maxWidth: 500 }} /> : <Text type="secondary">Playback not supported 暫不支援回放</Text> },
              ]} />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default MeetingRecorderPage
