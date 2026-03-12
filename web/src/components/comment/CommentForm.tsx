import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void> | void
  onCancel?: () => void
  placeholder?: string
}

export function CommentForm({ onSubmit, onCancel, placeholder = '写下你的评论...' }: CommentFormProps) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(content.trim())
      setContent('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="resize-none"
      />
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!content.trim() || submitting}>
          {submitting ? '发送中...' : '发送'}
        </Button>
      </div>
    </form>
  )
}
