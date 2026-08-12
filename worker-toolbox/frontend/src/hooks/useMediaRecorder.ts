import { useRef, useState, useCallback, useEffect } from 'react'

type MeetingMode = 'live' | 'online'

interface UseMediaRecorderReturn {
  status: 'idle' | 'recording' | 'transcribing' | 'done'
  duration: number
  transcript: string
  summary: string
  audioUrl: string
  stream: MediaStream | null
  extractedTodos: any[]
  startRecording: (mode: MeetingMode) => Promise<void>
  stopRecording: () => void
  reset: () => void
}

export function useMediaRecorder(): UseMediaRecorderReturn {
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing' | 'done'>('idle')
  const [duration, setDuration] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [summary, setSummary] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [extractedTodos, setExtractedTodos] = useState<any[]>([])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number>(0)

  const summarizeMeeting = async (text: string) => {
    try {
      const resp = await fetch('/api/meeting-recorder/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      if (data.code === 0) { setSummary(data.data.summary || data.data.result || ''); setExtractedTodos(data.data.extracted_todos || []) }
    } catch {
      // summary failure is non-blocking
    }
    setStatus('done')
  }

  const startLiveRecording = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = s
      setStream(s)
      const recorder = new MediaRecorder(s, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        s.getTracks().forEach((t) => t.stop())
        setStream(null)
        streamRef.current = null
        setStatus('transcribing')

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioUrl(URL.createObjectURL(blob))
        const formData = new FormData()
        formData.append('file', blob, 'recording.webm')

        try {
          const resp = await fetch('/api/meeting-recorder/upload', { method: 'POST', body: formData })
          const data = await resp.json()
          if (data.code === 0) {
            setTranscript(data.data.transcript)
            summarizeMeeting(data.data.transcript)
          } else {
            setStatus('done')
          }
        } catch {
          setStatus('done')
        }
      }

      recorder.start(1000)
      setStatus('recording')
      setDuration(0)
      setTranscript('')
      setSummary('')
      setAudioUrl('')
      timerRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000)
    } catch (e: any) {
      if (e.name === 'NotAllowedError' || e.name === 'NotFoundError') {
        // handled by caller
      }
      throw e
    }
  }

  const startOnlineRecording = async () => {
    const resp = await fetch('/api/meeting-recorder/start-system', { method: 'POST' })
    const data = await resp.json()
    if (data.code !== 0) throw new Error(data.msg || '启动失败')
    setStatus('recording')
    setDuration(0)
    setTranscript('')
    setSummary('')
    setAudioUrl('')
    timerRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000)
  }

  const stopOnlineRecording = useCallback(() => {
    clearInterval(timerRef.current)
    setStatus('transcribing')
    fetch('/api/meeting-recorder/stop-system', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 0 && data.data.job_id) {
          pollJob(data.data.job_id)
        } else {
          setStatus('done')
        }
      })
      .catch(() => setStatus('done'))
  }, [])

  const pollJob = (jobId: string) => {
    const poll = () => {
      fetch(`/api/meeting-recorder/transcription-status/${jobId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.code !== 0) return
          const j = data.data
          if (j.transcript) setTranscript(j.transcript)
          if (j.summary) setSummary(j.summary)
          if (j.duration_seconds) setDuration(j.duration_seconds)
          if (j.status === 'done' || j.status === 'failed') {
            setStatus('done')
          } else {
            setTimeout(poll, 2000)
          }
        })
        .catch(() => setStatus('done'))
    }
    poll()
  }

  const startRecording = useCallback(async (mode: MeetingMode) => {
    try {
      if (mode === 'online') await startOnlineRecording()
      else await startLiveRecording()
    } catch (e: any) {
      throw e
    }
  }, [stopOnlineRecording])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      clearInterval(timerRef.current)
    } else {
      stopOnlineRecording()
    }
  }, [stopOnlineRecording])

  const reset = useCallback(() => {
    setStatus('idle')
    setTranscript('')
    setSummary('')
    setAudioUrl('')
    setDuration(0)
    setStream(null)
    setExtractedTodos([])
  }, [])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { status, duration, transcript, summary, audioUrl, stream, extractedTodos, startRecording, stopRecording, reset }
}
