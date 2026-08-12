import { useState, useCallback } from 'react'

interface MeetingItem {
  id: number
  mode: string
  summary: string
  transcript_preview: string
  duration_seconds: number
  created_at: string
}

interface MeetingDetail {
  id: number
  mode: string
  transcript: string
  summary: string
  duration_seconds: number
  audio_path: string
  created_at: string
}

interface UseMeetingHistoryReturn {
  meetings: MeetingItem[]
  selectedDetail: MeetingDetail | null
  loading: boolean
  loadMeetings: () => Promise<void>
  loadDetail: (id: number) => Promise<void>
  clearDetail: () => void
}

export function useMeetingHistory(): UseMeetingHistoryReturn {
  const [meetings, setMeetings] = useState<MeetingItem[]>([])
  const [selectedDetail, setSelectedDetail] = useState<MeetingDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const loadMeetings = useCallback(async () => {
    try {
      const resp = await fetch('/api/meeting-recorder/list')
      const data = await resp.json()
      if (data.code === 0) setMeetings(data.data.items || [])
    } catch {
      // silent — list is non-critical
    }
  }, [])

  const loadDetail = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/meeting-recorder/${id}`)
      const data = await resp.json()
      if (data.code === 0) setSelectedDetail(data.data)
    } catch {
      // handled by caller
    } finally {
      setLoading(false)
    }
  }, [])

  const clearDetail = useCallback(() => setSelectedDetail(null), [])

  return { meetings, selectedDetail, loading, loadMeetings, loadDetail, clearDetail }
}
