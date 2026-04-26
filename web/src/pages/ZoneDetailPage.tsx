import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Shield, Lock, Globe, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { zoneApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { Zone, ZoneAccessDecision } from '@/types'

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
            <div className="mx-auto max-w-3xl px-6 py-20 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!zone) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-3xl px-6 py-20 text-center"
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
            className="mx-auto max-w-3xl px-6 py-20"
        >
            {/* back link */}
            <Link
                to="/zone"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> 专区
            </Link>

            {/* zone header */}
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

            {/* zone content — placeholder for now */}
            {isAllowed && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">欢迎进入 {zone.name}</CardTitle>
                        <CardDescription>此专区的内容功能正在建设中</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            后续将在此展示专区的专属内容、讨论和资源。
                        </p>
                    </CardContent>
                </Card>
            )}
        </motion.div>
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
                    title="访问受限"
                    description="你不满足该专区的访问条件："
                >
                    {zone.rules && zone.rules.length > 0 && (
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
