import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, EyeOff, MessageSquare, Pin, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { zonePostApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import type { ZonePost, ZoneComment } from '@/types'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    open: { label: '待处理', color: 'bg-blue-500/10 text-blue-600' },
    resolved: { label: '已解决', color: 'bg-green-500/10 text-green-600' },
    closed: { label: '已关闭', color: 'bg-muted text-muted-foreground' },
}

export default function ZonePostDetailPage() {
    const { slug, postId } = useParams<{ slug: string; postId: string }>()
    const { user, isAdmin } = useAuth()
    const navigate = useNavigate()

    const [post, setPost] = useState<ZonePost | null>(null)
    const [comments, setComments] = useState<ZoneComment[]>([])
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        if (!slug || !postId) return
        setLoading(true)
        try {
            const [pRes, cRes] = await Promise.all([
                zonePostApi.getPost(slug, Number(postId)),
                zonePostApi.listComments(slug, Number(postId)),
            ])
            setPost(pRes.data.data)
            setComments(cRes.data.data ?? [])
        } catch {
            setPost(null)
        } finally {
            setLoading(false)
        }
    }, [slug, postId])

    useEffect(() => { fetchData() }, [fetchData])

    // --- comment form ---
    const [commentText, setCommentText] = useState('')
    const [commentAnon, setCommentAnon] = useState(false)
    const [replyTo, setReplyTo] = useState<number | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const handleComment = async () => {
        if (!commentText.trim() || !slug || !postId) return
        setSubmitting(true)
        try {
            const res = await zonePostApi.createComment(slug, Number(postId), {
                content: commentText.trim(),
                parent_id: replyTo ?? undefined,
                is_anonymous: commentAnon,
            })
            setComments(prev => [...prev, res.data.data])
            setCommentText('')
            setReplyTo(null)
            if (post) setPost({ ...post, comment_count: post.comment_count + 1 })
        } catch { /* */ }
        finally { setSubmitting(false) }
    }

    const handleDeleteComment = async (id: number) => {
        if (!slug || !postId) return
        try {
            await zonePostApi.deleteComment(slug, Number(postId), id)
            setComments(prev => prev.filter(c => c.id !== id))
            if (post) setPost({ ...post, comment_count: Math.max(0, post.comment_count - 1) })
        } catch { /* */ }
    }

    const handleStatusChange = async (status: string) => {
        if (!slug || !postId) return
        try {
            await zonePostApi.updateStatus(slug, Number(postId), status)
            if (post) setPost({ ...post, status: status as ZonePost['status'] })
        } catch { /* */ }
    }

    const handleTogglePin = async () => {
        if (!slug || !postId || !post) return
        try {
            await zonePostApi.togglePin(slug, Number(postId), !post.is_pinned)
            setPost({ ...post, is_pinned: !post.is_pinned })
        } catch { /* */ }
    }

    const handleDelete = async () => {
        if (!slug || !postId || !confirm('确定要删除这个帖子吗？')) return
        try {
            await zonePostApi.deletePost(slug, Number(postId))
            navigate(`/zone/${slug}`, { replace: true })
        } catch { /* */ }
    }

    if (loading) {
        return (
            <div className="py-24 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
            </div>
        )
    }

    if (!post) {
        return (
            <div className="mx-auto max-w-2xl px-6 py-24 text-center">
                <p className="text-muted-foreground">帖子不存在或无权限访问</p>
                <Link to={`/zone/${slug}`} className="text-sm text-primary hover:underline mt-3 inline-block">返回专区</Link>
            </div>
        )
    }

    const st = STATUS_MAP[post.status]

    return (
        <motion.div
            className="mx-auto max-w-2xl px-6 py-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* back */}
            <Link
                to={`/zone/${slug}`}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> 返回专区
            </Link>

            {/* post */}
            <Card className="mb-6">
                <CardContent className="pt-5 space-y-3">
                    <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                {post.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                <h1 className="text-lg font-semibold">{post.title}</h1>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                                <span className="flex items-center gap-1">
                                    {post.is_anonymous && <EyeOff className="h-3 w-3" />}
                                    {post.author_name}
                                </span>
                                <span>·</span>
                                <span>{new Date(post.created_at).toLocaleString('zh-CN')}</span>
                                <Badge className={`text-[10px] px-1.5 py-0 h-4 ${st?.color || ''}`}>
                                    {st?.label || post.status}
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{post.content}</p>

                    {/* actions */}
                    {(post.is_owner || isAdmin) && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                            {post.status === 'open' && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleStatusChange('resolved')}>标为已解决</Button>
                            )}
                            {post.status === 'resolved' && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleStatusChange('open')}>重新打开</Button>
                            )}
                            {(post.is_owner || isAdmin) && post.status !== 'closed' && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleStatusChange('closed')}>关闭</Button>
                            )}
                            {isAdmin && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleTogglePin}>
                                    {post.is_pinned ? '取消置顶' : '置顶'}
                                </Button>
                            )}
                            {(post.is_owner || isAdmin) && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={handleDelete}>
                                    <Trash2 className="h-3 w-3 mr-1" /> 删除
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* comments */}
            <div className="space-y-4">
                <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" /> 评论 ({comments.length})
                </h2>

                {comments.length === 0 && (
                    <p className="text-xs text-muted-foreground/40 py-4 text-center">暂无评论</p>
                )}

                {comments.map(c => (
                    <div key={c.id} className={`rounded-lg bg-secondary/30 px-4 py-3 space-y-1 ${c.parent_id ? 'ml-6 border-l-2 border-border' : ''}`}>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                            <span className="flex items-center gap-1">
                                {c.is_anonymous && <EyeOff className="h-3 w-3" />}
                                <span className="font-medium text-foreground/70">{c.author_name}</span>
                            </span>
                            <span>·</span>
                            <span>{new Date(c.created_at).toLocaleString('zh-CN')}</span>
                            <div className="ml-auto flex items-center gap-1">
                                <button className="text-muted-foreground/40 hover:text-foreground text-[11px]" onClick={() => setReplyTo(c.id)}>
                                    回复
                                </button>
                                {(c.is_owner || isAdmin) && (
                                    <button className="text-muted-foreground/40 hover:text-destructive text-[11px]" onClick={() => handleDeleteComment(c.id)}>
                                        删除
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{c.content}</p>
                    </div>
                ))}

                {/* comment form */}
                {user && post.status !== 'closed' && (
                    <div className="space-y-2 pt-2">
                        {replyTo && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>回复 #{replyTo}</span>
                                <button className="text-primary hover:underline" onClick={() => setReplyTo(null)}>取消</button>
                            </div>
                        )}
                        <Textarea
                            placeholder="写下你的评论…"
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            rows={3}
                            className="text-sm resize-none"
                        />
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="anon-comment" checked={commentAnon} onChange={e => setCommentAnon(e.target.checked)} className="h-3.5 w-3.5 rounded border-border" />
                                <label htmlFor="anon-comment" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                                    <EyeOff className="h-3 w-3" /> 匿名
                                </label>
                            </div>
                            <Button size="sm" onClick={handleComment} disabled={submitting || !commentText.trim()} className="h-7 text-xs">
                                {submitting ? '发送中…' : '发送评论'}
                            </Button>
                        </div>
                    </div>
                )}

                {post.status === 'closed' && (
                    <p className="text-xs text-muted-foreground/50 text-center py-3">该帖子已关闭，不再接受评论</p>
                )}
            </div>
        </motion.div>
    )
}
