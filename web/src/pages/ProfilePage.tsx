import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/api'
import type { UserProfile } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { motion } from 'framer-motion'
import { Pencil, Save, X, User, Shield, Calendar } from 'lucide-react'

export default function ProfilePage() {
    const { user } = useAuth()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)

    // Edit form state
    const [nickname, setNickname] = useState('')
    const [bio, setBio] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')

    useEffect(() => {
        authApi.getProfile()
            .then((res) => {
                const p = res.data.data
                setProfile(p)
                setNickname(p.nickname || '')
                setBio(p.bio || '')
                setAvatarUrl(p.avatar_url || '')
            })
            .finally(() => setLoading(false))
    }, [])

    const startEditing = () => {
        if (profile) {
            setNickname(profile.nickname || '')
            setBio(profile.bio || '')
            setAvatarUrl(profile.avatar_url || '')
        }
        setEditing(true)
    }

    const cancelEditing = () => {
        setEditing(false)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await authApi.updateProfile({
                nickname: nickname || undefined,
                bio: bio || undefined,
                avatar_url: avatarUrl || undefined,
            })
            setProfile(res.data.data)
            setEditing(false)
        } catch (err) {
            console.error('Failed to update profile', err)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-xl px-6 py-20 animate-pulse">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-24 w-24 rounded-full bg-muted" />
                    <div className="h-5 w-32 rounded bg-muted" />
                    <div className="h-3 w-48 rounded bg-muted" />
                </div>
            </div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-xl px-6 py-20"
        >
            <h1 className="text-2xl font-bold tracking-tight mb-8">个人资料</h1>

            <Card className="overflow-hidden">
                <CardContent className="pt-8 pb-6">
                    {/* Avatar & basic info */}
                    <div className="flex flex-col items-center gap-4 mb-8">
                        <Avatar className="h-24 w-24 ring-2 ring-border/50">
                            {(editing ? avatarUrl : profile?.avatar_url) && (
                                <AvatarImage src={editing ? avatarUrl : profile?.avatar_url} />
                            )}
                            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                                {user?.username?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                        </Avatar>

                        {!editing && (
                            <div className="text-center">
                                <h2 className="text-xl font-semibold">
                                    {profile?.nickname || user?.username}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    @{user?.username}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Info badges */}
                    {!editing && (
                        <div className="flex flex-wrap justify-center gap-3 mb-8">
                            <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                                <Shield className="h-3 w-3" />
                                {user?.role}
                            </div>
                            <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                ID: {user?.id}
                            </div>
                            {profile?.updated_at && (
                                <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    更新于 {new Date(profile.updated_at).toLocaleDateString('zh-CN')}
                                </div>
                            )}
                        </div>
                    )}

                    <Separator className="mb-6" />

                    {editing ? (
                        /* Edit form */
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-5"
                        >
                            <div className="space-y-2">
                                <Label htmlFor="nickname">昵称</Label>
                                <Input
                                    id="nickname"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="输入你的昵称"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="avatar_url">头像 URL</Label>
                                <Input
                                    id="avatar_url"
                                    value={avatarUrl}
                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                    placeholder="https://example.com/avatar.jpg"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="bio">个人简介</Label>
                                <Textarea
                                    id="bio"
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    placeholder="写点什么介绍自己..."
                                    rows={3}
                                    className="resize-none"
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={cancelEditing}
                                    disabled={saving}
                                >
                                    <X className="h-3.5 w-3.5 mr-1.5" />
                                    取消
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    <Save className="h-3.5 w-3.5 mr-1.5" />
                                    {saving ? '保存中...' : '保存'}
                                </Button>
                            </div>
                        </motion.div>
                    ) : (
                        /* Display mode */
                        <div className="space-y-4">
                            {profile?.bio ? (
                                <div>
                                    <p className="text-xs text-muted-foreground/70 mb-1.5">简介</p>
                                    <p className="text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground/50 italic">
                                    还没有个人简介，点击编辑添加吧
                                </p>
                            )}

                            <div className="flex justify-end pt-2">
                                <Button variant="outline" size="sm" onClick={startEditing}>
                                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                    编辑资料
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    )
}
