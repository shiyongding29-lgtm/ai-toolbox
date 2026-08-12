import { useState, useCallback } from 'react'
import { message } from 'antd'
import { llmService, type LlmCallParams } from '../services/llmService'
import http from '../services/http'

interface UseToolOptions {
  onSuccess?: (data: any) => void
  onError?: (err: any) => void
}

export function useTool(endpoint: string, options?: UseToolOptions) {
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  const run = useCallback(async (params: LlmCallParams) => {
    if (!params.text.trim()) return
    setLoading(true)
    try {
      const resp: any = await llmService.call(endpoint, params)
      setOutput(resp.data.result)
      options?.onSuccess?.(resp.data)
    } catch {
      message.error('Request failed 請求失敗')
      options?.onError?.(null)
    } finally {
      setLoading(false)
    }
  }, [endpoint, options])

  return { output, loading, setOutput, run }
}

export function useTodoList() {
  const [todos, setTodos] = useState<any[]>([])
  const load = useCallback(async () => {
    try { const d: any = await http.get('/api/todos'); if (d.code === 0) setTodos(d.data) } catch {}
  }, [])
  return { todos, load, setTodos }
}

export function useHistory(pageSize = 50) {
  const [items, setItems] = useState<any[]>([])
  const load = useCallback(async () => {
    try { const d: any = await http.get('/api/history/list', { params: { page_size: pageSize } }); if (d.code === 0) setItems(d.data || []) } catch {}
  }, [pageSize])
  return { items, load }
}
