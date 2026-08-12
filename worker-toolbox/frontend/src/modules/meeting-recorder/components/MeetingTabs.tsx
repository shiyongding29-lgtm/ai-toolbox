import { Tabs, Typography } from 'antd'
import { ReadOutlined, FileTextOutlined, SoundOutlined } from '@ant-design/icons'
import MarkdownRenderer from '../../../components/MarkdownRenderer'

const { Text } = Typography

interface MeetingTabsProps {
  summary: string
  transcript: string
  audioUrl: string
  mode: 'live' | 'online'
  loading: boolean
}

export default function MeetingTabs({ summary, transcript, audioUrl, mode, loading }: MeetingTabsProps) {
  const items = [
    {
      key: 'summary',
      label: <span><ReadOutlined /> Summary 會議總結</span>,
      children: summary
        ? <MarkdownRenderer content={summary} />
        : <Text type="secondary">{loading ? 'Generating... 生成中...' : 'No summary yet 暫無總結'}</Text>,
    },
    {
      key: 'transcript',
      label: <span><FileTextOutlined /> Transcript 會議內容</span>,
      children: transcript
        ? <div style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', fontSize: 13 }}>{transcript}</div>
        : <Text type="secondary">No content yet 暫無內容</Text>,
    },
    {
      key: 'audio',
      label: <span><SoundOutlined /> Recording 會議錄音</span>,
      children: audioUrl
        ? <audio controls src={audioUrl} style={{ width: '100%', maxWidth: 500 }} />
        : <Text type="secondary">{mode === 'online' ? 'Playback not supported 暫不支援回放' : 'No recording 暫無錄音'}</Text>,
    },
  ]

  return <Tabs items={items} />
}
