import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, Plus, Trash2, Shield, ShieldCheck, Globe, Lock, ChevronRight, ImagePlus, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { zoneApi, uploadApi } from '@/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog'
import type { Zone, ZoneRule, ZoneRuleKind } from '@/types'

// ────────────────────────────────────────────────────
// Zone list page — admin inline management via dialog
// ────────────────────────────────────────────────────

export default function ZonePage() {
    const { isAdmin } = useAuth()
    const [zones, setZones] = useState<Zone[]>([])
    const [loading, setLoading] = useState(true)

    // admin dialogs
    const [showCreate, setShowCreate] = useState(false)
    const [editingZone, setEditingZone] = useState<Zone | null>(null)

    const fetchZones = useCallback(async () => {
        try {
            const res = isAdmin
                ? await zoneApi.listAdmin()
                : await zoneApi.list()
            setZones(res.data.data ?? [])
        } catch {
            /* swallow */
        } finally {
            setLoading(false)
        }
    }, [isAdmin])

    useEffect(() => { fetchZones() }, [fetchZones])

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl px-4 sm:px-6 py-20"
        >
            {/* header */}
            <div className="flex items-end justify-between mb-12">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight mb-2">专区</h1>
                    <p className="text-sm text-muted-foreground/70">
                        独立主题的内容聚合
                    </p>
                </div>
                {isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => setShowCreate(true)} className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        新建专区
                    </Button>
                )}
            </div>

            {/* zone grid */}
            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                    {[1, 2].map(i => (
                        <div key={i} className="h-36 rounded-xl bg-secondary/40 animate-pulse" />
                    ))}
                </div>
            ) : zones.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    <AnimatePresence mode="popLayout">
                        {zones.map(z => (
                            <ZoneCard
                                key={z.id}
                                zone={z}
                                isAdmin={isAdmin}
                                onManage={() => setEditingZone(z)}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* admin: create dialog */}
            {isAdmin && (
                <CreateZoneDialog
                    open={showCreate}
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); fetchZones() }}
                />
            )}

            {/* admin: edit/rules dialog */}
            {isAdmin && editingZone && (
                <ManageZoneDialog
                    zone={editingZone}
                    onClose={() => setEditingZone(null)}
                    onUpdated={() => { setEditingZone(null); fetchZones() }}
                />
            )}
        </motion.div>
    )
}

// ── zone card ──

function ZoneCard({ zone, isAdmin, onManage }: { zone: Zone; isAdmin: boolean; onManage: () => void }) {
    const navigate = useNavigate()
    const isPublic = zone.visibility === 'public'
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
        >
            <Card className="group relative h-full transition-colors hover:ring-foreground/20 cursor-pointer overflow-hidden" onClick={() => navigate(`/zone/${zone.slug}`)}>
                {zone.cover_image_url && (
                    <div className="h-28 w-full overflow-hidden">
                        <img src={zone.cover_image_url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                )}
                <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                            {isPublic
                                ? <Globe className="h-4 w-4 text-muted-foreground/50" />
                                : <Lock className="h-4 w-4 text-muted-foreground/50" />}
                            <CardTitle className="line-clamp-1">{zone.name}</CardTitle>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    {zone.description && (
                        <CardDescription className="line-clamp-2 mt-1">{zone.description}</CardDescription>
                    )}
                </CardHeader>
                <CardContent className="flex items-center gap-2 pt-0">
                    {!isPublic && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                            <Shield className="h-3 w-3" />
                            需要验证
                        </Badge>
                    )}
                    {isAdmin && zone.rules && zone.rules.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                            {zone.rules.length} 条规则
                        </Badge>
                    )}
                    {isAdmin && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto h-7 text-xs text-muted-foreground"
                            onClick={(e) => { e.stopPropagation(); onManage() }}
                        >
                            管理
                        </Button>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    )
}

// ── empty state ──

function EmptyState() {
    return (
        <div className="flex flex-col items-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60 mb-6">
                <LayoutGrid className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground/60 text-sm">暂无专区</p>
            <p className="text-muted-foreground/40 text-xs mt-1">这里将提供按主题组织的特色内容入口</p>
        </div>
    )
}

// ── create dialog ──

function CoverUpload({ url, onChange }: { url: string; onChange: (url: string) => void }) {
    const [uploading, setUploading] = useState(false)
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const res = await uploadApi.upload(file)
            onChange(res.data.data.url)
        } catch { /* */ }
        finally { setUploading(false); e.target.value = '' }
    }
    const inputId = `cover-upload-${Math.random().toString(36).slice(2, 8)}`
    return (
        <div className="grid gap-2">
            <Label>封面图片</Label>
            {url ? (
                <div className="relative rounded-lg overflow-hidden h-32 bg-secondary">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                        className="absolute top-1.5 right-1.5 rounded-full bg-background/80 p-1 hover:bg-background transition-colors"
                        onClick={() => onChange('')}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            ) : (
                <label
                    htmlFor={inputId}
                    className="flex flex-col items-center justify-center h-24 rounded-lg border border-dashed cursor-pointer hover:bg-secondary/30 transition-colors"
                >
                    <ImagePlus className="h-5 w-5 text-muted-foreground/40 mb-1" />
                    <span className="text-xs text-muted-foreground/50">{uploading ? '上传中…' : '点击上传封面'}</span>
                </label>
            )}
            <input id={inputId} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </div>
    )
}

function CreateZoneDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
    const [slug, setSlug] = useState('')
    const [name, setName] = useState('')
    const [desc, setDesc] = useState('')
    const [cover, setCover] = useState('')
    const [visibility, setVisibility] = useState<'gated' | 'public'>('gated')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const reset = () => { setSlug(''); setName(''); setDesc(''); setCover(''); setVisibility('gated'); setError('') }

    const handleCreate = async () => {
        if (!slug.trim() || !name.trim()) { setError('slug 和名称为必填'); return }
        setSubmitting(true)
        try {
            await zoneApi.create({ slug: slug.trim(), name: name.trim(), description: desc, cover_image_url: cover || undefined, visibility })
            reset()
            onCreated()
        } catch (e: any) {
            setError(e?.response?.data?.message || '创建失败')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>新建专区</DialogTitle>
                    <DialogDescription>创建一个新的内容专区</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <CoverUpload url={cover} onChange={setCover} />
                    <div className="grid gap-2">
                        <Label>Slug（URL 路径）</Label>
                        <Input placeholder="my-zone" value={slug} onChange={e => setSlug(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>名称</Label>
                        <Input placeholder="我的专区" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>简介</Label>
                        <Input placeholder="可选描述" value={desc} onChange={e => setDesc(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>可见性</Label>
                        <div className="flex gap-2">
                            <Button
                                type="button" size="sm"
                                variant={visibility === 'gated' ? 'default' : 'outline'}
                                onClick={() => setVisibility('gated')}
                                className="gap-1.5"
                            >
                                <Lock className="h-3.5 w-3.5" /> 需要验证
                            </Button>
                            <Button
                                type="button" size="sm"
                                variant={visibility === 'public' ? 'default' : 'outline'}
                                onClick={() => setVisibility('public')}
                                className="gap-1.5"
                            >
                                <Globe className="h-3.5 w-3.5" /> 公开
                            </Button>
                        </div>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter>
                    <DialogClose><Button variant="ghost">取消</Button></DialogClose>
                    <Button onClick={handleCreate} disabled={submitting}>{submitting ? '创建中…' : '创建'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ── rule kind display helpers ──

const RULE_KIND_LABELS: Record<ZoneRuleKind, string> = {
    discord_guild_member: '服务器成员',
    discord_guild_role: '服务器角色',
    discord_guild_boost: '服务器加速',
    discord_guild_join_days: '加入天数',
    discord_account_age: '账号年龄',
    discord_connection: '第三方关联',
}

const RULE_KIND_OPTIONS: { value: ZoneRuleKind; label: string; hint: string }[] = [
    { value: 'discord_guild_member', label: '服务器成员', hint: '用户须是指定 Discord 服务器的成员' },
    { value: 'discord_guild_role', label: '服务器角色', hint: '用户须拥有指定服务器的某个角色' },
    { value: 'discord_guild_boost', label: '服务器加速者', hint: '用户须正在加速指定服务器 (Nitro Boost)' },
    { value: 'discord_guild_join_days', label: '加入时长', hint: '用户须加入指定服务器满 N 天' },
    { value: 'discord_account_age', label: '账号年龄', hint: 'Discord 账号须注册满 N 天' },
    { value: 'discord_connection', label: '第三方关联', hint: '用户须在 Discord 关联指定平台 (Steam/Twitch 等)' },
]

const needsGuildId = (k: ZoneRuleKind) => ['discord_guild_member', 'discord_guild_role', 'discord_guild_boost', 'discord_guild_join_days'].includes(k)
const needsRoleId = (k: ZoneRuleKind) => k === 'discord_guild_role'
const needsValue = (k: ZoneRuleKind) => ['discord_guild_join_days', 'discord_account_age'].includes(k)
const needsValueStr = (k: ZoneRuleKind) => k === 'discord_connection'

function ruleDescription(r: ZoneRule): string {
    if (r.description) return r.description
    switch (r.kind) {
        case 'discord_guild_member': return `服务器 ${r.guild_id} 的成员`
        case 'discord_guild_role': return `服务器 ${r.guild_id} 中拥有角色 ${r.role_id}`
        case 'discord_guild_boost': return `正在加速服务器 ${r.guild_id}`
        case 'discord_guild_join_days': return `加入服务器 ${r.guild_id} 满 ${r.value} 天`
        case 'discord_account_age': return `Discord 账号注册满 ${r.value} 天`
        case 'discord_connection': return `已关联 ${r.value_str} 平台`
        default: return r.kind
    }
}

// ── manage (edit + rules) dialog ──

function ManageZoneDialog({ zone, onClose, onUpdated }: { zone: Zone; onClose: () => void; onUpdated: () => void }) {
    const [name, setName] = useState(zone.name)
    const [desc, setDesc] = useState(zone.description)
    const [cover, setCover] = useState(zone.cover_image_url || '')
    const [visibility, setVisibility] = useState(zone.visibility)
    const [ruleLogic, setRuleLogic] = useState<'or' | 'and'>(zone.rule_logic || 'or')
    const [rules, setRules] = useState<ZoneRule[]>(zone.rules ?? [])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // new rule form
    const [ruleKind, setRuleKind] = useState<ZoneRuleKind>('discord_guild_member')
    const [ruleGuildId, setRuleGuildId] = useState('')
    const [ruleRoleId, setRuleRoleId] = useState('')
    const [ruleValue, setRuleValue] = useState('')
    const [ruleValueStr, setRuleValueStr] = useState('')
    const [ruleDesc, setRuleDesc] = useState('')
    const [ruleLabel, setRuleLabel] = useState('')
    const [addingRule, setAddingRule] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            await zoneApi.update(zone.id, { name, description: desc, cover_image_url: cover || undefined, visibility, rule_logic: ruleLogic })
            onUpdated()
        } catch (e: any) {
            setError(e?.response?.data?.message || '保存失败')
        } finally {
            setSaving(false)
        }
    }

    const canAddRule = () => {
        if (needsGuildId(ruleKind) && !ruleGuildId.trim()) return false
        if (needsRoleId(ruleKind) && !ruleRoleId.trim()) return false
        if (needsValue(ruleKind) && (!ruleValue.trim() || parseInt(ruleValue) <= 0)) return false
        if (needsValueStr(ruleKind) && !ruleValueStr.trim()) return false
        return true
    }

    const handleAddRule = async () => {
        if (!canAddRule()) return
        setAddingRule(true)
        try {
            const res = await zoneApi.addRule(zone.id, {
                kind: ruleKind,
                guild_id: needsGuildId(ruleKind) ? ruleGuildId.trim() : undefined,
                role_id: needsRoleId(ruleKind) ? ruleRoleId.trim() : undefined,
                value: needsValue(ruleKind) ? parseInt(ruleValue) : undefined,
                value_str: needsValueStr(ruleKind) ? ruleValueStr.trim() : undefined,
                description: ruleDesc.trim() || undefined,
                label: ruleLabel.trim() || undefined,
            })
            setRules(prev => [...prev, res.data.data])
            setRuleGuildId(''); setRuleRoleId(''); setRuleValue(''); setRuleValueStr(''); setRuleDesc(''); setRuleLabel('')
        } catch (e: any) {
            setError(e?.response?.data?.message || '添加规则失败')
        } finally {
            setAddingRule(false)
        }
    }

    const handleDeleteRule = async (ruleId: number) => {
        try {
            await zoneApi.deleteRule(zone.id, ruleId)
            setRules(prev => prev.filter(r => r.id !== ruleId))
        } catch { /* swallow */ }
    }

    const handleDelete = async () => {
        if (!confirm('确定要删除这个专区吗？此操作不可恢复。')) return
        try {
            await zoneApi.delete(zone.id)
            onUpdated()
        } catch { /* swallow */ }
    }

    return (
        <Dialog open onOpenChange={v => { if (!v) onClose() }}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>管理专区</DialogTitle>
                    <DialogDescription>编辑专区信息和访问规则</DialogDescription>
                </DialogHeader>

                {/* basic info */}
                <div className="grid gap-4 py-2">
                    <CoverUpload url={cover} onChange={setCover} />
                    <div className="grid gap-2">
                        <Label>名称</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>简介</Label>
                        <Input value={desc} onChange={e => setDesc(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>可见性</Label>
                        <div className="flex gap-2">
                            <Button type="button" size="sm" variant={visibility === 'gated' ? 'default' : 'outline'} onClick={() => setVisibility('gated')} className="gap-1.5">
                                <Lock className="h-3.5 w-3.5" /> 需要验证
                            </Button>
                            <Button type="button" size="sm" variant={visibility === 'public' ? 'default' : 'outline'} onClick={() => setVisibility('public')} className="gap-1.5">
                                <Globe className="h-3.5 w-3.5" /> 公开
                            </Button>
                        </div>
                    </div>
                </div>

                {/* access rules */}
                <div className="border-t pt-4 mt-2">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> 访问规则
                        </h3>
                        <div className="flex items-center gap-1 rounded-lg border p-0.5">
                            <button
                                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${ruleLogic === 'or' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={() => setRuleLogic('or')}
                            >
                                满足任一 (OR)
                            </button>
                            <button
                                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${ruleLogic === 'and' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={() => setRuleLogic('and')}
                            >
                                全部满足 (AND)
                            </button>
                        </div>
                    </div>

                    {rules.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 mb-3">
                            暂无规则 — 任何登录用户均可访问
                        </p>
                    ) : (
                        <div className="space-y-2 mb-4">
                            {rules.map((r, i) => (
                                <div key={r.id} className="flex items-start gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs">
                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <Badge variant="outline" className="text-[10px] shrink-0">
                                                {RULE_KIND_LABELS[r.kind] || r.kind}
                                            </Badge>
                                            {r.label && <span className="text-muted-foreground/60 truncate">({r.label})</span>}
                                        </div>
                                        <span className="text-muted-foreground truncate">{ruleDescription(r)}</span>
                                    </div>
                                    {i < rules.length - 1 && (
                                        <span className="text-[9px] font-mono text-muted-foreground/40 shrink-0 self-center">
                                            {ruleLogic === 'or' ? 'OR' : 'AND'}
                                        </span>
                                    )}
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive self-center" onClick={() => handleDeleteRule(r.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* add rule form */}
                    <div className="rounded-lg border border-dashed p-3 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">添加规则</p>
                        <div className="flex flex-wrap gap-1.5">
                            {RULE_KIND_OPTIONS.map(opt => (
                                <Button
                                    key={opt.value}
                                    type="button"
                                    size="sm"
                                    variant={ruleKind === opt.value ? 'default' : 'outline'}
                                    onClick={() => { setRuleKind(opt.value); setRuleGuildId(''); setRuleRoleId(''); setRuleValue(''); setRuleValueStr('') }}
                                    className="text-[11px] h-7"
                                    title={opt.hint}
                                >
                                    {opt.label}
                                </Button>
                            ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground/60">
                            {RULE_KIND_OPTIONS.find(o => o.value === ruleKind)?.hint}
                        </p>
                        <div className="grid gap-2">
                            {needsGuildId(ruleKind) && (
                                <Input placeholder="Discord 服务器 ID (Guild ID)" value={ruleGuildId} onChange={e => setRuleGuildId(e.target.value)} className="h-8 text-xs font-mono" />
                            )}
                            {needsRoleId(ruleKind) && (
                                <Input placeholder="Discord 角色 ID (Role ID)" value={ruleRoleId} onChange={e => setRuleRoleId(e.target.value)} className="h-8 text-xs font-mono" />
                            )}
                            {needsValue(ruleKind) && (
                                <Input type="number" min={1} placeholder={ruleKind === 'discord_account_age' ? '最少天数（如 30）' : '最少加入天数（如 7）'} value={ruleValue} onChange={e => setRuleValue(e.target.value)} className="h-8 text-xs" />
                            )}
                            {needsValueStr(ruleKind) && (
                                <Input placeholder="平台类型（如 steam / twitch / youtube / github）" value={ruleValueStr} onChange={e => setRuleValueStr(e.target.value)} className="h-8 text-xs" />
                            )}
                            <Input placeholder="显示描述（可选，展示给用户看）" value={ruleDesc} onChange={e => setRuleDesc(e.target.value)} className="h-8 text-xs" />
                            <Input placeholder="管理备注（可选，仅管理员可见）" value={ruleLabel} onChange={e => setRuleLabel(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" onClick={handleAddRule} disabled={addingRule || !canAddRule()}>
                            <Plus className="h-3 w-3" /> {addingRule ? '添加中…' : '添加规则'}
                        </Button>
                    </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                    <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1.5 mr-auto">
                        <Trash2 className="h-3.5 w-3.5" /> 删除专区
                    </Button>
                    <DialogClose><Button variant="ghost">取消</Button></DialogClose>
                    <Button onClick={handleSave} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
