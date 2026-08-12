import { useState, useRef } from 'react'
import { Typography, Input, Select, Button, Card, Spin, message, Space, Image, Upload, Tag } from 'antd'
import { BarChartOutlined, DownloadOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons'

const { Title, Text } = Typography
const { TextArea } = Input
const { Dragger } = Upload

export default function ChartGeneratorPage() {
  const [data, setData] = useState('')
  const [chartType, setChartType] = useState('bar')
  const [chartTitle, setChartTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const handleGenerate = async () => {
    if (!data.trim() && !uploadedFile) return
    setLoading(true); setResult(null)
    try {
      let r: Response
      if (uploadedFile) {
        const fd = new FormData()
        fd.append('file', uploadedFile)
        fd.append('chart_type', chartType)
        fd.append('title', chartTitle.trim())
        r = await fetch('/api/chart/upload', { method: 'POST', body: fd })
      } else {
        r = await fetch('/api/chart/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: data.trim(), chart_type: chartType, title: chartTitle.trim() }),
        })
      }
      const j = await r.json()
      if (j.code === 0) { setResult(j.data); message.success('Chart generated') }
      else message.error(j.msg || 'Failed')
    } catch { message.error('Generation failed') }
    finally { setLoading(false) }
  }

  const handleUpload = (file: File) => {
    setUploadedFile(file)
    const reader = new FileReader()
    reader.onload = (e) => { if (e.target?.result) setData(e.target.result as string) }
    reader.readAsText(file)
    return false
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title level={3}><BarChartOutlined /> Chart Generator 圖表生成</Title>
      <Text type="secondary">Describe your data + choose chart type — AI generates a professional chart  |  描述數據 + 選擇圖表類型，AI 生成專業圖表</Text>

      <Card size="small" style={{ marginTop: 16, borderRadius: 14 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <Select value={chartType} onChange={setChartType} style={{ width: 160, borderRadius: 8 }}
            options={[
              { label: '📊 Bar 柱狀圖', value: 'bar' },
              { label: '📈 Line 折線圖', value: 'line' },
              { label: '🥧 Pie 餅圖', value: 'pie' },
              { label: '📍 Scatter 散點圖', value: 'scatter' },
            ]} />
          <Input placeholder="Chart title 圖表標題" value={chartTitle} onChange={e => setChartTitle(e.target.value)}
            style={{ flex: 1, minWidth: 200, borderRadius: 8 }} />
        </div>

        {/* File upload area */}
        <Dragger accept=".csv,.tsv,.txt" maxCount={1} showUploadList={false}
          beforeUpload={handleUpload}
          style={{ marginBottom: 12, borderRadius: 12, background: uploadedFile ? 'rgba(0,229,255,0.04)' : undefined }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">{uploadedFile ? uploadedFile.name : 'Upload CSV/TSV file 上傳表格文件'}</p>
          <p className="ant-upload-hint">.csv / .tsv / .txt</p>
        </Dragger>
        {uploadedFile && (
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag closable onClose={() => { setUploadedFile(null); setData('') }} style={{ borderRadius: 100 }}>{uploadedFile.name}</Tag>
            <Text type="secondary" style={{ fontSize: 10 }}>File loaded — edit below or just click Generate</Text>
          </div>
        )}

        <TextArea rows={6} value={data} onChange={e => setData(e.target.value)}
          placeholder={`Describe your data or paste CSV:\nMonth, Sales, Profit\nJan, 100, 20\nFeb, 150, 35\nMar, 120, 28\n\nOr natural language: "Show monthly sales for Q1 with bar chart"\n描述數據或貼上 CSV...`}
          style={{ borderRadius: 10 }} />
        <div style={{ marginTop: 12 }}>
          <Button type="primary" icon={<BarChartOutlined />} loading={loading} onClick={handleGenerate}
            style={{ borderRadius: 100, paddingLeft: 24, paddingRight: 24, background: 'linear-gradient(135deg, #22c55e, #10b981)', border: 'none' }}>
            Generate Chart 生成圖表
          </Button>
        </div>
      </Card>

      {loading && <Spin style={{ margin: '28px auto', display: 'block' }} />}

      {result && result.chart_url && (
        <Card title={chartTitle || 'Chart'} style={{ marginTop: 20, borderRadius: 14, textAlign: 'center' }}
          extra={<Button icon={<DownloadOutlined />} style={{ borderRadius: 100 }}
            onClick={() => { const a = document.createElement('a'); a.href = result.chart_url; a.download = 'chart.png'; a.click() }}>Download</Button>}>
          <Image src={result.chart_url} alt="Chart" style={{ maxWidth: '100%', borderRadius: 8 }} />
        </Card>
      )}

      {result && !result.chart_url && (
        <Card style={{ marginTop: 20, borderRadius: 14 }}>
          <Text type="danger">{result.result || 'Generation failed'}</Text>
        </Card>
      )}
    </div>
  )
}
