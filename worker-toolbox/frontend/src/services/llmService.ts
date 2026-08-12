import http from './http'

export interface LlmCallParams {
  text: string
  mode?: string
  extra_context?: string
}

export const llmService = {
  call: (endpoint: string, params: LlmCallParams) =>
    http.post(endpoint, params),
}
