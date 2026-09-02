import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Comment } from '@/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { timeAgo } from '@/utils/date'
import { CommentForm } from './CommentForm'

/** A reply flattened under its root comment. `replyToName` is set when it
 *  answers another reply rather than the root itself. */
export interface ReplyView extends Comment {
  replyToName?: string
}

/** One top-level comment plus every reply beneath it, in chronological order. */
export interface Thread {
  root: Comment
  replies: ReplyView[]
}

/** Which comment the viewer is replying to, and which thread it lives in. */
export interface ReplyTarget {
  rootId: number
  comment: Comment
}

interface CommentBodyProps {
  comment: ReplyView
  compact?: boolean
  canReply: boolean
  canDelete: boolean
  onReply: () => void
  onDelete: () => void
}

function CommentBody({ comment, compact = false, canReply, canDelete, onReply, onDelete }: CommentBodyProps) {
  return (
    <div className="flex gap-3">
      <Avatar className={`${compact ? 'h-6 w-6' : 'h-8 w-8'} shrink-0`}>
        <AvatarFallback className={compact ? 'text-[10px]' : 'text-xs'}>
          {comment.username[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium">{comment.username}</span>
          {comment.replyToName && (
            <span className="text-xs text-muted-foreground">
              回复 <span className="text-foreground/80">@{comment.replyToName}</span>
            </span>
          )}
          <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
        </div>

        <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">{comment.content}</p>

        {(canReply || canDelete) && (
          <div className="mt-1 flex gap-2">
            {canReply && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={onReply}>
                回复
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive" onClick={onDelete}>
                删除
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface CommentThreadProps {
  thread: Thread
  currentUserId?: number
  currentUserRole?: string
  expanded: boolean
  onToggleExpanded: (rootId: number) => void
  replyTarget: ReplyTarget | null
  onReply: (target: ReplyTarget | null) => void
  onSubmitReply: (content: string, parentId: number) => Promise<void> | void
  onDelete: (id: number) => void
}

/**
 * A root comment with its replies folded underneath. Replies are hidden
 * behind a "N 条追评" toggle until opened; replying anywhere in the thread
 * opens it and shows the form at the bottom.
 */
export function CommentThread({
  thread,
  currentUserId,
  currentUserRole,
  expanded,
  onToggleExpanded,
  replyTarget,
  onReply,
  onSubmitReply,
  onDelete,
}: CommentThreadProps) {
  const { root, replies } = thread
  const canReply = currentUserId !== undefined
  const canDelete = (c: Comment) => currentUserRole === 'admin' || currentUserId === c.user_id
  const isReplying = replyTarget?.rootId === root.id
  const target = (comment: Comment): ReplyTarget => ({ rootId: root.id, comment })

  return (
    <div>
      <CommentBody
        comment={root}
        canReply={canReply}
        canDelete={canDelete(root)}
        onReply={() => onReply(replyTarget?.comment.id === root.id ? null : target(root))}
        onDelete={() => onDelete(root.id)}
      />

      {(replies.length > 0 || isReplying) && (
        <div className="ml-11 mt-2">
          {replies.length > 0 && !expanded && (
            <button
              type="button"
              onClick={() => onToggleExpanded(root.id)}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              {replies.length} 条追评
            </button>
          )}

          <AnimatePresence initial={false}>
            {expanded && replies.length > 0 && (
              <motion.div
                key="replies"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-3 border-l-2 border-border/40 pl-4 pt-1">
                  {replies.map((reply) => (
                    <CommentBody
                      key={reply.id}
                      comment={reply}
                      compact
                      canReply={canReply}
                      canDelete={canDelete(reply)}
                      onReply={() => onReply(replyTarget?.comment.id === reply.id ? null : target(reply))}
                      onDelete={() => onDelete(reply.id)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onToggleExpanded(root.id)}
                  className="mt-2 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                  收起追评
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {isReplying && replyTarget && (
            <div className="mt-3 border-l-2 border-border/40 pl-4">
              <CommentForm
                onSubmit={(content) => onSubmitReply(content, replyTarget.comment.id)}
                onCancel={() => onReply(null)}
                placeholder={`回复 @${replyTarget.comment.username}...`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
