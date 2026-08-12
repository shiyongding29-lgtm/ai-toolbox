import { Modal, Button, Space } from 'antd'

interface ConfirmModalProps {
  open: boolean
  title?: string
  content?: string
  okText?: string
  cancelText?: string
  danger?: boolean
  loading?: boolean
  onOk: () => void
  onCancel: () => void
}

export function ConfirmModal({ open, title = 'Confirm 確認', content = 'Are you sure? 確定嗎？', okText = 'OK 確定', cancelText = 'Cancel 取消', danger = false, loading = false, onOk, onCancel }: ConfirmModalProps) {
  return (
    <Modal open={open} title={title} onCancel={onCancel} width={420}
      footer={
        <Space>
          <Button onClick={onCancel} style={{ borderRadius: 100 }} disabled={loading}>{cancelText}</Button>
          <Button type="primary" danger={danger} onClick={onOk} loading={loading} style={{ borderRadius: 100 }}>{okText}</Button>
        </Space>
      }
    >
      <p style={{ fontSize: 14, opacity: 0.85 }}>{content}</p>
    </Modal>
  )
}

export default ConfirmModal
