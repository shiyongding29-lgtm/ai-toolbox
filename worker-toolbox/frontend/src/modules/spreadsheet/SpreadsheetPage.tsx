import { useState } from 'react'
import { Typography, Input, Button, Upload, Card, Spin, message, Space, Table, Tag, theme } from 'antd'
import { TableOutlined, UploadOutlined, SendOutlined } from '@ant-design/icons'
import http from '../../services/http'

const { Title, Text } = Typography

function SpreadsheetPage() {
  const { token } = theme.useToken()
  const [fileId, setFileId] = useState('')
  const [columns, setColumns] = useState<any[]>([])
  const [data, setData] = useState<any[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [codeLog, setCodeLog] = useState('')

  const handleUpload = async (file: File) => {
    setLoading(true)
    const formData = new FormData(); formData.append('file', file)
    try {
      const r: any = await http.post('/api/spreadsheet/upload', formData)
      if (r.code === 0) {
        setFileId(r.data.file_id)
        setColumns(r.data.columns || [])
        setData(r.data.all_data || r.data.preview || [])
        setRowCount(r.data.row_count)
        setCodeLog('')
        message.success(`Loaded: ${r.data.row_count} rows, ${r.data.col_count} cols`)
      } else {
        message.error(r.msg || 'Upload failed')
      }
    } catch { message.error('Upload failed 上傳失敗') }
    finally { setLoading(false) }
    return false
  }

  const handleCommand = async () => {
    if (!command.trim() || !fileId) return
    setLoading(true)
    try {
      const r: any = await http.post('/api/spreadsheet/command', { file_id: fileId, command })
      if (r.code === 0) {
        setData(r.data.all_data || r.data.preview || [])
        setRowCount(r.data.row_count)
        setCodeLog(r.data.code || '')
        if (r.data.error) {
          message.warning(`Note: ${r.data.error}`)
        } else {
          message.success(`Done. ${r.data.row_count} rows`)
        }
      } else {
        message.error(r.msg)
      }
    } catch { message.error('Command failed 指令執行失敗') }
    finally { setLoading(false) }
    setCommand('')
  }

  const tableColumns = columns.length > 0
    ? columns.map((c: any) => ({
        title: c.name,
        dataIndex: c.name,
        key: c.name,
        ellipsis: true,
        width: Math.max(120, Math.min(200, c.name.length * 15)),
        sorter: (a: any, b: any) => {
          const va = a[c.name], vb = b[c.name]
          if (typeof va === 'number' && typeof vb === 'number') return va - vb
          return String(va).localeCompare(String(vb))
        },
      }))
    : []

  return (
    <div className="tool-header" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Title level={3}><TableOutlined /> Spreadsheet AI 智能表格</Title>
      <Text type="secondary">Upload Excel/CSV, then use natural language to manipulate data — sort, filter, transform  |  上傳表格文件，用自然語言指令操作數據</Text>

      <Card size="small" style={{ marginTop: 16, borderRadius: 14 }} styles={{ body: { padding: 14 } }}>
        <Space>
          <Upload beforeUpload={handleUpload} showUploadList={false} accept=".csv,.xlsx,.xls">
            <Button icon={<UploadOutlined />} style={{ borderRadius: 100 }}>Upload Excel / CSV 上傳文件</Button>
          </Upload>
          {fileId && <Tag color="green" style={{ borderRadius: 100 }}>{fileId} — {rowCount} rows</Tag>}
        </Space>
      </Card>

      {data.length > 0 && (
        <>
          <Card size="small" style={{ marginTop: 16, borderRadius: 14 }} styles={{ body: { padding: '10px 14px' } }}>
            <Space.Compact style={{ display: 'flex', width: '100%' }}>
              <Input
                value={command}
                onChange={e => setCommand(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCommand() }}
                placeholder='e.g. "Sort by sales descending" "篩選出北京的客戶" "Add a total row" ...'
                style={{ borderRadius: '10px 0 0 10px' }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleCommand}
                loading={loading}
                style={{ borderRadius: '0 10px 10px 0' }}
              >
                Run 執行
              </Button>
            </Space.Compact>
            {codeLog && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 10 }}>Generated code:</Text>
                <pre style={{ fontSize: 10, background: token.colorFillSecondary, padding: '4px 10px', borderRadius: 6, margin: '2px 0 0', whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'auto' }}>{codeLog}</pre>
              </div>
            )}
          </Card>

          <Card size="small" style={{ marginTop: 12, borderRadius: 14 }} styles={{ body: { padding: 0 } }}>
            <Table
              dataSource={data.map((row, i) => ({ ...row, _key: i }))}
              columns={tableColumns}
              rowKey="_key"
              size="small"
              scroll={{ x: 'max-content', y: 'calc(100vh - 450px)' }}
              pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `${t} rows` }}
              style={{ borderRadius: 14 }}
            />
          </Card>
        </>
      )}

      {loading && !fileId && <Spin style={{ display: 'block', marginTop: 40 }} />}
    </div>
  )
}

export default SpreadsheetPage
