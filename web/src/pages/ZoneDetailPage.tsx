import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Shield, Lock, Globe, AlertCircle, ExternalLink, Loader2, Plus, MessageSquare, Pin, EyeOff, ChevronRight, ImagePlus, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { zoneApi, zonePostApi, uploadApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Zone, ZoneAccessDecision, ZonePost } from '@/types'

export default function ZoneDetailPage() {
    const { slug } = useParams<{ slug: string }>()
    const { user } = useAuth()
    const navigate = useNavigate()

    const [zone, setZone] = useState<Zone | null>(null)
    const [access, setAccess] = useState<ZoneAccessDecision | null>(null)
    const [loading, setLoading] = useState(true)
    const [checking, setChecking] = useState(false)
    const [reauthLoading, setReauthLoading] = useState(false)

    const fetchZone = useCallback(async () => {
        if (!slug) return
        try {
            const res = await zoneApi.getBySlug(slug)
            setZone(res.data.data)
        } catch {
            setZone(null)
        } finally {
            setLoading(false)
        }
    }, [slug])

    const checkAccess = useCallback(async () => {
        if (!slug || !user) return
        setChecking(true)
        try {
            const res = await zoneApi.checkAccess(slug)
            setAccess(res.data.data)
        } catch {
            setAccess({ status: 'error', reason: '访问检查失败', evaluated_at: new Date().toISOString() })
        } finally {
            setChecking(false)
        }
    }, [slug, user])

    useEffect(() => { fetchZone() }, [fetchZone])

    useEffect(() => {
        if (zone && zone.visibility === 'gated' && user) {
            checkAccess()
        }
    }, [zone, user, checkAccess])

    const handleReauth = async () => {
        setReauthLoading(true)
        try {
            const redirectUri = `${window.location.origin}/oauth/callback?zone_slug=${slug}`
            const res = await zoneApi.requestReauth(redirectUri)
            window.location.href = res.data.data.auth_url
        } catch {
            setReauthLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!zone) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center"
            >
                <h1 className="text-xl font-bold mb-2">专区不存在</h1>
                <p className="text-sm text-muted-foreground mb-6">该专区可能已被删除或链接无效</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/zone')}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> 返回专区列表
                </Button>
            </motion.div>
        )
    }

    const isPublic = zone.visibility === 'public'
    const isAllowed = isPublic || access?.status === 'allowed'

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl px-4 sm:px-6 py-20"
        >
            {/* back link */}
            <Link
                to="/zone"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> 专区
            </Link>

            {/* zone header */}
            {zone.cover_image_url && (
                <div className="rounded-xl overflow-hidden h-40 mb-6 -mx-2">
                    <img src={zone.cover_image_url} alt="" className="h-full w-full object-cover" />
                </div>
            )}
            <div className="mb-10">
                <div className="flex items-center gap-2 mb-2">
                    {isPublic
                        ? <Globe className="h-4 w-4 text-muted-foreground/50" />
                        : <Lock className="h-4 w-4 text-muted-foreground/50" />}
                    <h1 className="text-2xl font-bold tracking-tight">{zone.name}</h1>
                </div>
                {zone.description && (
                    <p className="text-sm text-muted-foreground/70 mt-1">{zone.description}</p>
                )}
            </div>

            {/* access gate */}
            {!isPublic && !isAllowed && (
                <AccessGate
                    zone={zone}
                    access={access}
                    checking={checking}
                    user={!!user}
                    reauthLoading={reauthLoading}
                    onReauth={handleReauth}
                    onLogin={() => navigate('/login')}
                    onRetry={checkAccess}
                />
            )}

            {/* zone community */}
            {isAllowed && (
                <ZonePostList slug={slug!} />
            )}
        </motion.div>
    )
}

// ── zone post list + create ──

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    open: { label: '待处理', color: 'bg-blue-500/10 text-blue-600' },
    resolved: { label: '已解决', color: 'bg-green-500/10 text-green-600' },
    closed: { label: '已关闭', color: 'bg-muted text-muted-foreground' },
}

function ZonePostList({ slug }: { slug: string }) {
    const navigate = useNavigate()
    const [posts, setPosts] = useState<ZonePost[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)

    const fetchPosts = useCallback(async () => {
        setLoading(true)
        try {
            const res = await zonePostApi.listPosts(slug, page)
            setPosts(res.data.data.posts ?? [])
            setTotal(res.data.data.total)
        } catch { /* */ }
        finally { setLoading(false) }
    }, [slug, page])

    useEffect(() => { fetchPosts() }, [fetchPosts])

    const totalPages = Math.ceil(total / 20)

    return (
        <div className="space-y-4">
            {/* header */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                    讨论 <span className="text-muted-foreground/50">({total})</span>
                </h2>
                <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowCreate(v => !v)}>
                    <Plus className="h-3.5 w-3.5" /> 发帖
                </Button>
            </div>

            {/* create form */}
            {showCreate && (
                <CreatePostForm slug={slug} onCreated={() => { setShowCreate(false); setPage(1); fetchPosts() }} onCancel={() => setShowCreate(false)} />
            )}

            {/* post list */}
            {loading ? (
                <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
            ) : posts.length === 0 ? (
                <div className="py-16 text-center">
                    <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground/50">暂无帖子，成为第一个发帖的人吧</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {posts.map(post => (
                        <div
                            key={post.id}
                            className="group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-secondary/40 cursor-pointer"
                            onClick={() => navigate(`/zone/${slug}/post/${post.id}`)}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    {post.is_pinned && <Pin className="h-3 w-3 text-amber-500 shrink-0" />}
                                    <span className="text-sm font-medium truncate">{post.title}</span>
                                    <Badge className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${STATUS_LABELS[post.status]?.color || ''}`}>
                                        {STATUS_LABELS[post.status]?.label || post.status}
                                    </Badge>
                                </div>
                                {post.images && post.images.length > 0 && (
                                    <div className="flex gap-1.5 my-1">
                                        {post.images.slice(0, 3).map((url, i) => (
                                            <div key={i} className="w-14 h-14 rounded overflow-hidden border bg-secondary/30">
                                                <img src={url} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                        {post.images.length > 3 && (
                                            <div className="w-14 h-14 rounded border bg-secondary/30 flex items-center justify-center text-xs text-muted-foreground">
                                                +{post.images.length - 3}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                                    <span className="flex items-center gap-1">
                                        {post.is_anonymous && <EyeOff className="h-3 w-3" />}
                                        {post.author_name}
                                    </span>
                                    <span>·</span>
                                    <span>{new Date(post.created_at).toLocaleDateString('zh-CN')}</span>
                                    {post.comment_count > 0 && (
                                        <>
                                            <span>·</span>
                                            <span className="flex items-center gap-0.5">
                                                <MessageSquare className="h-3 w-3" />
                                                {post.comment_count}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/20 shrink-0 self-center transition-transform group-hover:translate-x-0.5" />
                        </div>
                    ))}
                </div>
            )}

            {/* pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 text-xs">上一页</Button>
                    <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
                    <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-7 text-xs">下一页</Button>
                </div>
            )}
        </div>
    )
}

function CreatePostForm({ slug, onCreated, onCancel }: { slug: string; onCreated: () => void; onCancel: () => void }) {
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [images, setImages] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [anonymous, setAnonymous] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return
        setUploading(true)
        try {
            for (const file of Array.from(files)) {
                const res = await uploadApi.upload(file)
                setImages(prev => [...prev, res.data.data.url])
            }
        } catch {
            setError('图片上传失败')
        } finally {
            setUploading(false)
            e.target.value = ''
        }
    }

    const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx))

    const handleSubmit = async () => {
        if (!title.trim() || !content.trim()) { setError('标题和内容不能为空'); return }
        setSubmitting(true)
        try {
            await zonePostApi.createPost(slug, { title: title.trim(), content: content.trim(), images: images.length > 0 ? images : undefined, is_anonymous: anonymous })
            onCreated()
        } catch (e: any) {
            setError(e?.response?.data?.message || '发帖失败')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Card>
            <CardContent className="pt-5 space-y-3">
                <div className="grid gap-1.5">
                    <Label className="text-xs">标题</Label>
                    <Input placeholder="简要描述你的问题或反馈" value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="grid gap-1.5">
                    <Label className="text-xs">内容</Label>
                    <Textarea placeholder="详细描述…" value={content} onChange={e => setContent(e.target.value)} rows={4} className="text-sm resize-none" />
                </div>
                {/* image upload */}
                <div className="space-y-2">
                    {images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {images.map((url, i) => (
                                <div key={i} className="relative group w-20 h-20 rounded-md overflow-hidden border">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <button onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <label className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                        <ImagePlus className="h-3.5 w-3.5" />
                        {uploading ? '上传中…' : '添加图片'}
                        <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" disabled={uploading} />
                    </label>
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="anon-post" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} className="h-3.5 w-3.5 rounded border-border" />
                    <label htmlFor="anon-post" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                        <EyeOff className="h-3 w-3" /> 匿名发布
                    </label>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 text-xs">取消</Button>
                    <Button size="sm" onClick={handleSubmit} disabled={submitting || uploading} className="h-7 text-xs">
                        {submitting ? '发布中…' : '发布'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

// ── access gate component ──

function AccessGate({
    zone,
    access,
    checking,
    user,
    reauthLoading,
    onReauth,
    onLogin,
    onRetry,
}: {
    zone: Zone
    access: ZoneAccessDecision | null
    checking: boolean
    user: boolean
    reauthLoading: boolean
    onReauth: () => void
    onLogin: () => void
    onRetry: () => void
}) {
    if (checking) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">正在检查访问权限…</span>
            </div>
        )
    }

    if (!user) {
        return (
            <GateCard
                icon={<Lock className="h-5 w-5" />}
                title="需要登录"
                description="该专区需要登录后才能访问"
            >
                <Button size="sm" onClick={onLogin}>前往登录</Button>
            </GateCard>
        )
    }

    if (!access) return null

    switch (access.status) {
        case 'need_link':
            return (
                <GateCard
                    icon={<Shield className="h-5 w-5" />}
                    title="需要关联 Discord"
                    description="该专区基于 Discord 身份验证，请先绑定你的 Discord 账号并授权必要权限。"
                >
                    <Button size="sm" className="gap-1.5" onClick={onReauth} disabled={reauthLoading}>
                        {reauthLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                        {reauthLoading ? '跳转中…' : '授权 Discord'}
                    </Button>
                </GateCard>
            )
        case 'need_reauth':
            return (
                <GateCard
                    icon={<Shield className="h-5 w-5" />}
                    title="需要重新授权"
                    description="你的 Discord 授权已过期或缺少必要权限，请重新授权以获取访问资格。"
                >
                    {access.missing_scopes && access.missing_scopes.length > 0 && (
                        <div className="flex gap-1.5 mb-3">
                            {access.missing_scopes.map(s => (
                                <Badge key={s} variant="secondary" className="text-[10px] font-mono">{s}</Badge>
                            ))}
                        </div>
                    )}
                    <Button size="sm" className="gap-1.5" onClick={onReauth} disabled={reauthLoading}>
                        {reauthLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                        {reauthLoading ? '跳转中…' : '重新授权 Discord'}
                    </Button>
                </GateCard>
            )
        case 'denied':
            return (
                <GateCard
                    icon={<AlertCircle className="h-5 w-5 text-destructive" />}
                    title={access.reason === 'no_rules_configured' ? '专区未开放' : '访问受限'}
                    description={access.reason === 'no_rules_configured'
                        ? '该专区尚未配置访问规则，暂时无法进入。'
                        : '你不满足该专区的访问条件：'}
                >
                    {access.reason !== 'no_rules_configured' && zone.rules && zone.rules.length > 0 && (
                        <div className="text-left w-full max-w-sm mb-3 space-y-1">
                            {zone.rules.map(r => (
                                <div key={r.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className="text-muted-foreground/40">•</span>
                                    {r.description || r.kind}
                                </div>
                            ))}
                            <p className="text-[10px] text-muted-foreground/50 pt-1">
                                {zone.rule_logic === 'and' ? '（须全部满足）' : '（满足任一即可）'}
                            </p>
                        </div>
                    )}
                    <Button size="sm" variant="outline" onClick={onRetry}>重新检查</Button>
                </GateCard>
            )
        case 'error':
            return (
                <GateCard
                    icon={<AlertCircle className="h-5 w-5 text-destructive" />}
                    title="检查失败"
                    description={access.reason || '访问权限检查时遇到错误，请稍后重试。'}
                >
                    <Button size="sm" variant="outline" onClick={onRetry}>重试</Button>
                </GateCard>
            )
        default:
            return null
    }
}

function GateCard({
    icon,
    title,
    description,
    children,
}: {
    icon: React.ReactNode
    title: string
    description: string
    children: React.ReactNode
}) {
    return (
        <Card className="border-dashed">
            <CardContent className="flex flex-col items-center text-center py-12">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/60 mb-4 text-muted-foreground">
                    {icon}
                </div>
                <h3 className="font-medium mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
                {children}
            </CardContent>
        </Card>
    )
}
