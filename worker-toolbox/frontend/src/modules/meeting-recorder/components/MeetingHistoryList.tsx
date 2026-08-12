import { Button, List, Typography, theme } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'

const { Text } = Typography

interface MeetingItem {
  id: number
  mode: string
  summary: string
  transcript_preview: string
  duration_seconds: number
  created_at: string
}

interface MeetingHistoryListProps {
  meetings: MeetingItem[]
  selectedId: number | null
  onSelect: (item: MeetingItem) => void
  onRefresh: () => void
  formatTime: (s: number) => string
}

export default function MeetingHistoryList({
  meetings, selectedId, onSelect, onRefresh, formatTime,
}: MeetingHistoryListProps) {
  const { token } = theme.useToken()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong><HistoryOutlined /> History 歷史記錄</Text>
        <Button size="small" onClick={onRefresh}>Refresh 刷新</Button>
      </div>
      {meetings.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>No meetings yet 暫無記錄</Text>
      ) : (
        <List
          size="small"
          dataSource={meetings}
          renderItem={(item) => (
            <List.Item style={{ padding: 0, borderBottom: 'none' }}>
              <button
                style={{
                  cursor: 'pointer', padding: '8px', borderRadius: 4, border: 'none',
                  width: '100%', textAlign: 'left' as const, font: 'inherit',
                  background: selectedId === item.id ? token.colorFillSecondary : 'transparent',
                  color: token.colorText,
                }}
                onClick={() => onSelect(item)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item) } }}
                tabIndex={0}
              >
                <div>
                  <div style={{ fontSize: 13 }}>
                    {item.mode === 'online' ? '💻' : '🏢'} {item.created_at}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{formatTime(item.duration_seconds || 0)}</Text>
                </div>
              </button>
            </List.Item>
          )}
        />
      )}
    </div>
  )
}
