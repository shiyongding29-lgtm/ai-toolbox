import ReactMarkdown from 'react-markdown'

interface MarkdownRendererProps {
  content: string
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null

  return (
    <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.8 }}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
