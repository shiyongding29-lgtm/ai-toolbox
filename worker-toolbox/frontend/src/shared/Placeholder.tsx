import { Skeleton } from 'antd'

export function LoadingSkeleton() {
  return (
    <div style={{ padding: '20px 0' }}>
      <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 1 }} />
      <Skeleton active title={false} paragraph={{ rows: 3 }} style={{ marginTop: 16 }} />
      <Skeleton active title={false} paragraph={{ rows: 5 }} style={{ marginTop: 16 }} />
    </div>
  )
}

export function EmptyState({ icon, title, desc }: { icon?: React.ReactNode; title: string; desc?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.6 }}>
      {icon && <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>}
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      {desc && <div style={{ fontSize: 12, color: '#8b949e' }}>{desc}</div>}
    </div>
  )
}
