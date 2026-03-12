import type { Comment } from '@/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { timeAgo } from '@/utils/date'
import { CommentForm } from './CommentForm'

interface CommentItemProps {
  comment: Comment
  currentUserId?: number
  currentUserRole?: string
  replyTo: number | null
  onReply: (id: number | null) => void
  onSubmitReply: (content: string, parentId: number) => void
  onDelete: (id: number) => void
  depth?: number
}

export function CommentItem({
  comment,
  currentUserId,
  currentUserRole,
  replyTo,
  onReply,
  onSubmitReply,
  onDelete,
  depth = 0,
}: CommentItemProps) {
  const canDelete = currentUserRole === 'admin' || currentUserId === comment.user_id

  return (
    <div className={depth > 0 ? 'ml-8 border-l-2 border-border/40 pl-4' : ''}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">
            {comment.username[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{comment.username}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>

          <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">{comment.content}</p>

          <div className="mt-1.5 flex gap-2">
            {currentUserId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={() => onReply(replyTo === comment.id ? null : comment.id)}
              >
                回复
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-destructive"
                onClick={() => onDelete(comment.id)}
              >
                删除
              </Button>
            )}
          </div>

          {replyTo === comment.id && (
            <div className="mt-3">
              <CommentForm
                onSubmit={(content) => onSubmitReply(content, comment.id)}
                onCancel={() => onReply(null)}
                placeholder={`回复 ${comment.username}...`}
              />
            </div>
          )}
        </div>
      </div>

      {comment.children && comment.children.length > 0 && (
        <div className="mt-4 space-y-4">
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              replyTo={replyTo}
              onReply={onReply}
              onSubmitReply={onSubmitReply}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
