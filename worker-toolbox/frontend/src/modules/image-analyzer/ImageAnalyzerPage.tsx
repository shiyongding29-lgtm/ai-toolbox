import { useState, useRef } from 'react'
import { Typography, Upload, Button, Card, Tag, Spin, message, Descriptions } from 'antd'
import { InboxOutlined, PictureOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'

const { Title, Text, Paragraph } = Typography
const { Dragger } = Upload

export default function ImageAnalyzerPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleUpload = async (file: File) => {
    setLoading(true); setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/image/analyze', { method: 'POST', body: fd })
      const data = await r.json()
      if (data.code === 0) setResult(data.data)
      else message.error(data.msg || 'Failed')
    } catch { message.error('Analysis failed 分析失敗') }
    finally { setLoading(false) }
    return false
  }

  const props: UploadProps = {
    accept: 'image/*', maxCount: 1, showUploadList: false,
    beforeUpload: (file) => { handleUpload(file); return false },
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}><PictureOutlined /> Image Analyzer 圖片分析</Title>
      <Text type="secondary">Upload an image — AI describes content, objects, colors, and text  |  上傳圖片，AI 分析內容、物體、色彩和文字</Text>

      <Dragger {...props} style={{ marginTop: 16, borderRadius: 14 }}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Click or drag image here 點擊或拖拽圖片</p>
        <p className="ant-upload-hint">Supports PNG, JPG, GIF, WebP</p>
      </Dragger>

      {preview && (
        <Card style={{ marginTop: 16, borderRadius: 14, textAlign: 'center' }}>
          <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }} />
        </Card>
      )}

      {loading && <Spin style={{ margin: '24px auto', display: 'block' }} />}

      {result && (
        <Card title="Analysis Result 分析結果" style={{ marginTop: 16, borderRadius: 14 }}>
          <Descriptions column={1} size="small" bordered>
            {result.description && <Descriptions.Item label="Description 描述"><Paragraph>{result.description}</Paragraph></Descriptions.Item>}
            {result.objects && result.objects.length > 0 && <Descriptions.Item label="Objects 物體">{result.objects.map((o: string, i: number) => <Tag key={i} style={{ borderRadius: 100, margin: 2 }}>{o}</Tag>)}</Descriptions.Item>}
            {result.colors && <Descriptions.Item label="Colors 色彩">{result.colors}</Descriptions.Item>}
            {result.style && <Descriptions.Item label="Style 風格"><Tag color="purple" style={{ borderRadius: 100 }}>{result.style}</Tag></Descriptions.Item>}
            {result.text_in_image && <Descriptions.Item label="Text in Image 圖中文字"><Text code>{result.text_in_image}</Text></Descriptions.Item>}
            {result.quality_notes && <Descriptions.Item label="Quality 質量">{result.quality_notes}</Descriptions.Item>}
          </Descriptions>
          {result._meta && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {result._meta.format} | {result._meta.width}×{result._meta.height}px | {result._meta.mode} | {result._meta.size_kb}KB
              </Text>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
