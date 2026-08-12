import { Component, type ReactNode } from 'react'
import { Button, Result } from 'antd'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return (
        <Result status="error" title="Something went wrong 發生錯誤"
          subTitle={this.state.error?.message}
          extra={<Button type="primary" onClick={() => this.setState({ hasError: false, error: null })}>Try Again 重試</Button>} />
      )
    }
    return this.props.children
  }
}
