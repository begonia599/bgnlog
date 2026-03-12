import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Comment } from '@/types'
import { commentApi } from '@/api'
import { useAuth } from '@/contexts/AuthContext'
import { CommentItem } from './CommentItem'
import { CommentForm } from './CommentForm'
import { MessageCircle } from 'lucide-react'

interface CommentListProps {
  slug: string
  comments: Comment[]
  onRefresh: () => void
}

function buildTree(comments: Comment[]): Comment[] {
  const map = new Map<number, Comment>()
  const roots: Comment[] = []

  comments.forEach((c) => {
    map.set(c.id, { ...c, children: [] })
  })

  map.forEach((c) => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children!.push(c)
    } else {
      roots.push(c)
    }
  })

  return roots
}

export function CommentList({ slug, comments, onRefresh }: CommentListProps) {
  const { user } = useAuth()
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const tree = buildTree(comments)

  const handleSubmit = useCallback(async (content: string, parentId?: number) => {
    await commentApi.create(slug, { content, parent_id: parentId })
    setReplyTo(null)
    onRefresh()
  }, [slug, onRefresh])

  const handleDelete = useCallback(async (id: number) => {
    await commentApi.delete(id)
    onRefresh()
  }, [onRefresh])

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">
        评论 ({comments.length})
      </h3>

      {user ? (
        <CommentForm onSubmit={(content) => handleSubmit(content)} />
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-secondary/50 px-4 py-3.5">
          <MessageCircle className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          <p className="text-sm text-muted-foreground">
            登录后即可参与评论 ·{' '}
            <Link to="/login" className="text-foreground font-medium hover:underline underline-offset-2">
              去登录
            </Link>
          </p>
        </div>
      )}

      <div className="space-y-4">
        {tree.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={user?.id}
            currentUserRole={user?.role}
            replyTo={replyTo}
            onReply={setReplyTo}
            onSubmitReply={(content, parentId) => handleSubmit(content, parentId)}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">暂无评论</p>
      )}
    </div>
  )
}

