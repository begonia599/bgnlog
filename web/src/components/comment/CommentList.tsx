import { useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Comment } from '@/types'
import { commentApi } from '@/api'
import { useAuth } from '@/contexts/AuthContext'
import { CommentThread, type ReplyTarget, type Thread } from './CommentItem'
import { CommentForm } from './CommentForm'
import { MessageCircle } from 'lucide-react'

interface CommentListProps {
  slug: string
  comments: Comment[]
  onRefresh: () => void
}

/**
 * Groups a flat comment list into threads: every comment without a (living)
 * parent is a root; everything else is flattened under its top-most ancestor
 * so the UI stays two levels deep no matter how deep the reply chain goes.
 * The API returns comments oldest-first, so replies keep chronological order.
 */
function buildThreads(comments: Comment[]): Thread[] {
  const byId = new Map<number, Comment>()
  comments.forEach((c) => byId.set(c.id, c))

  const isRoot = (c: Comment) => !c.parent_id || !byId.has(c.parent_id)
  const rootOf = (c: Comment): Comment => {
    let cur = c
    const seen = new Set<number>()
    while (!isRoot(cur) && !seen.has(cur.id)) {
      seen.add(cur.id)
      cur = byId.get(cur.parent_id!)!
    }
    return cur
  }

  const threads = new Map<number, Thread>()
  comments.forEach((c) => {
    if (isRoot(c)) threads.set(c.id, { root: c, replies: [] })
  })
  comments.forEach((c) => {
    if (isRoot(c)) return
    const root = rootOf(c)
    const thread = threads.get(root.id)
    if (!thread) return
    const parent = byId.get(c.parent_id!)
    thread.replies.push({
      ...c,
      replyToName: parent && parent.id !== root.id ? parent.username : undefined,
    })
  })
  return [...threads.values()]
}

export function CommentList({ slug, comments, onRefresh }: CommentListProps) {
  const { user } = useAuth()
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const threads = useMemo(() => buildThreads(comments), [comments])

  const expand = useCallback((rootId: number) => {
    setExpanded((prev) => (prev.has(rootId) ? prev : new Set(prev).add(rootId)))
  }, [])

  const toggleExpanded = useCallback((rootId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(rootId)) next.delete(rootId)
      else next.add(rootId)
      return next
    })
  }, [])

  const startReply = useCallback(
    (target: ReplyTarget | null) => {
      setReplyTarget(target)
      if (target) expand(target.rootId)
    },
    [expand],
  )

  const handleSubmit = useCallback(
    async (content: string, parentId?: number) => {
      await commentApi.create(slug, { content, parent_id: parentId })
      // Keep the thread open so the freshly posted reply is visible.
      if (replyTarget) expand(replyTarget.rootId)
      setReplyTarget(null)
      onRefresh()
    },
    [slug, onRefresh, replyTarget, expand],
  )

  const handleDelete = useCallback(
    async (id: number) => {
      await commentApi.delete(id)
      onRefresh()
    },
    [onRefresh],
  )

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

      <div className="space-y-5">
        {threads.map((thread) => (
          <CommentThread
            key={thread.root.id}
            thread={thread}
            currentUserId={user?.id}
            currentUserRole={user?.role}
            expanded={expanded.has(thread.root.id)}
            onToggleExpanded={toggleExpanded}
            replyTarget={replyTarget}
            onReply={startReply}
            onSubmitReply={handleSubmit}
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
