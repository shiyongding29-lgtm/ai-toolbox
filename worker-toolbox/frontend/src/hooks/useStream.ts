import { useState, useCallback, useRef } from 'react'

interface UseStreamOptions {
  onChunk?: (chunk: string) => void
  onDone?: (fullText: string) => void
  onError?: (err: string) => void
}

export function useStream(endpoint = '/api/stream/chat') {
  const [streaming, setStreaming] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const stream = useCallback(async (system: string, text: string, options?: UseStreamOptions) => {
    setStreaming(true)
    setStreamedText('')
    const controller = new AbortController()
    abortRef.current = controller
    let full = ''

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system, text }),
        signal: controller.signal,
      })
      const reader = resp.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const { chunk, error } = JSON.parse(data)
              if (error) { options?.onError?.(error); break }
              full += chunk || ''
              setStreamedText(full)
              options?.onChunk?.(chunk || '')
            } catch { /* ignore malformed JSON */ }
          }
        }
      }
      options?.onDone?.(full)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        options?.onError?.(err.message || 'Stream failed')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [endpoint])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { stream, abort, streaming, streamedText, setStreamedText }
}
