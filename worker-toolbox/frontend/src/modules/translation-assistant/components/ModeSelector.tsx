import { Radio, Select } from 'antd'

interface Props {
  mode: string
  onChange: (mode: string) => void
}

const ALL_MODES = [
  { value: 'translate_zh_en', label: '中→英' },
  { value: 'translate_en_zh', label: '英→中' },
  { value: 'polish', label: '润色' },
  { value: 'rewrite', label: '改写' },
  { value: 'style_casual', label: '正式→口语' },
  { value: 'style_formal', label: '口语→正式' },
  { value: 'expand', label: '扩写' },
  { value: 'summarize', label: '缩写' },
  { value: 'generate_reply', label: '生成回复' },
]

function ModeSelector({ mode, onChange }: Props) {
  return (
    <>
      <Radio.Group value={mode} onChange={(e) => onChange(e.target.value)}
        style={{ marginBottom: 8 }}
      >
        <Radio.Button value="translate_zh_en">中→英</Radio.Button>
        <Radio.Button value="translate_en_zh">英→中</Radio.Button>
        <Radio.Button value="polish">润色</Radio.Button>
        <Radio.Button value="rewrite">改写</Radio.Button>
      </Radio.Group>
      <Select value={mode} onChange={onChange} style={{ width: 200, marginLeft: 8 }}
        options={ALL_MODES}
      />
    </>
  )
}

export default ModeSelector
