import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/api'
import type { UserProfile, OAuthAccount } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pencil, Save, X, User, Shield, Calendar, Camera, Loader2,
  KeyRound, Link2, Unlink, Eye, EyeOff, Check, AlertTriangle,
} from 'lucide-react'

// ─── GitHub Icon ─────────────────────────────────────────
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

// ─── Discord Icon ────────────────────────────────────────
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

// ─── Provider metadata ───────────────────────────────────
const providerMeta: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  github: {
    label: 'GitHub',
    icon: <GitHubIcon className="h-5 w-5" />,
    color: 'bg-[#24292e] dark:bg-[#333]',
  },
  discord: {
    label: 'Discord',
    icon: <DiscordIcon className="h-5 w-5" />,
    color: 'bg-[#5865F2]',
  },
}

// ─── Toast-like feedback ─────────────────────────────────
function FeedbackBanner({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        type === 'success'
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-destructive/10 text-destructive'
      }`}
    >
      {type === 'success' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      {message}
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════
// Tab 1: Profile
// ═══════════════════════════════════════════════════════════
function ProfileTab() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setFeedback(null)
  }

  const cancelEditing = () => setEditing(false)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const res = await authApi.uploadAvatar(file)
      setAvatarUrl(res.data.data.url)
    } catch {
      setFeedback({ msg: '头像上传失败', type: 'error' })
    } finally {
      setUploading(false)
    }
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
      setFeedback({ msg: '资料已更新', type: 'success' })
    } catch {
      setFeedback({ msg: '保存失败，请重试', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-24 w-24 rounded-full bg-muted" />
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="h-3 w-48 rounded bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {feedback && <FeedbackBanner message={feedback.msg} type={feedback.type} />}
      </AnimatePresence>

      {/* Avatar & basic info */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative group">
          <Avatar className="h-24 w-24 ring-2 ring-border/50">
            {(editing ? avatarUrl : profile?.avatar_url) && (
              <AvatarImage src={editing ? avatarUrl : profile?.avatar_url} />
            )}
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>

          {editing && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                type="button"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </button>
            </>
          )}
        </div>

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
        <div className="flex flex-wrap justify-center gap-3">
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

      <Separator />

      {editing ? (
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
            <Label>头像</Label>
            <p className="text-xs text-muted-foreground">
              点击上方头像选择图片，或手动输入 URL
            </p>
            <Input
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
            <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={saving}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              取消
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </motion.div>
      ) : (
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
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Tab 2: Security
// ═══════════════════════════════════════════════════════════
function SecurityTab() {
  const { user } = useAuth()
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Fetch hasPassword status via OAuth accounts endpoint
  useEffect(() => {
    authApi.getOAuthAccounts()
      .then((res) => setHasPassword(res.data.data.has_password))
      .catch(() => setHasPassword(true)) // default to requiring old pw
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    if (newPassword.length < 6) {
      setFeedback({ msg: '新密码至少需要 6 个字符', type: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ msg: '两次输入的密码不一致', type: 'error' })
      return
    }

    setSaving(true)
    try {
      await authApi.changePassword(hasPassword ? oldPassword : '', newPassword)
      setFeedback({ msg: hasPassword ? '密码已修改' : '密码已设置，现在可以使用用户名密码登录', type: 'success' })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setHasPassword(true)
    } catch {
      setFeedback({ msg: hasPassword ? '旧密码不正确' : '设置密码失败', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {feedback && <FeedbackBanner message={feedback.msg} type={feedback.type} />}
      </AnimatePresence>

      {/* Account info */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">账号信息</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">用户名</p>
            <p className="text-sm font-medium">{user?.username}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">角色</p>
            <p className="text-sm font-medium capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Password form */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">
            {hasPassword === false ? '设置密码' : '修改密码'}
          </h3>
        </div>

        {hasPassword === false && (
          <p className="text-xs text-muted-foreground bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg px-3 py-2">
            你当前通过第三方账号登录，尚未设置密码。设置密码后可以使用用户名 + 密码登录。
          </p>
        )}

        {hasPassword === null ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {hasPassword && (
              <div className="space-y-2">
                <Label htmlFor="old-password">当前密码</Label>
                <div className="relative">
                  <Input
                    id="old-password"
                    type={showOld ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="输入当前密码"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    onClick={() => setShowOld(!showOld)}
                  >
                    {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 个字符"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" disabled={saving}>
                <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                {saving ? '提交中...' : (hasPassword ? '修改密码' : '设置密码')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Tab 3: Linked Accounts
// ═══════════════════════════════════════════════════════════
function LinkedAccountsTab() {
  const { fetchUser } = useAuth()
  const [accounts, setAccounts] = useState<OAuthAccount[]>([])
  const [hasPassword, setHasPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unlinking, setUnlinking] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Link-existing form state (shown only when !hasPassword)
  const [linkUsername, setLinkUsername] = useState('')
  const [linkPassword, setLinkPassword] = useState('')
  const [linking, setLinking] = useState(false)
  const [showLinkPassword, setShowLinkPassword] = useState(false)

  const fetchAccounts = async () => {
    try {
      const res = await authApi.getOAuthAccounts()
      setAccounts(res.data.data.accounts || [])
      setHasPassword(res.data.data.has_password)
    } catch {
      setFeedback({ msg: '加载绑定账号失败', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // On mount: surface any bind_result returned from a prior bind redirect.
  useEffect(() => {
    const result = sessionStorage.getItem('oauth_bind_result')
    if (result) {
      sessionStorage.removeItem('oauth_bind_result')
      const map: Record<string, { msg: string; type: 'success' | 'error' }> = {
        success:        { msg: '绑定成功', type: 'success' },
        already_bound:  { msg: '该账号已绑定到当前用户', type: 'success' },
        conflict:       { msg: '绑定失败：该第三方账号已绑定到其他用户', type: 'error' },
        oauth_failed:   { msg: '第三方授权失败，请重试', type: 'error' },
        internal_error: { msg: '服务器内部错误，请稍后重试', type: 'error' },
      }
      setFeedback(map[result] || { msg: `绑定结果：${result}`, type: 'error' })
    }
    fetchAccounts()
  }, [])

  const handleUnlink = async (provider: string) => {
    setFeedback(null)
    setUnlinking(provider)
    try {
      await authApi.unlinkOAuth(provider)
      setAccounts((prev) => prev.filter((a) => a.provider !== provider))
      setFeedback({ msg: `已解绑 ${providerMeta[provider]?.label || provider}`, type: 'success' })
    } catch {
      setFeedback({ msg: '解绑失败：这可能是你唯一的登录方式，请先设置密码', type: 'error' })
    } finally {
      setUnlinking(null)
    }
  }

  // Bind mode — links the third-party account to the current user.
  const handleLink = async (provider: string) => {
    try {
      const redirectUri = `${window.location.origin}/oauth/callback`
      const res = await authApi.oauthBindAuthorize(provider, redirectUri)
      window.location.href = res.data.data.auth_url
    } catch {
      setFeedback({ msg: '无法连接到第三方服务', type: 'error' })
    }
  }

  // Link-existing — verify a local account's credentials and merge the
  // current OAuth-only user into it. Returns new tokens for the local account.
  const handleLinkExisting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkUsername || !linkPassword) return
    setLinking(true)
    setFeedback(null)
    try {
      const res = await authApi.linkExisting(linkUsername, linkPassword)
      const data = res.data.data
      // Switch identity: persist new tokens then refresh user state.
      localStorage.setItem('access_token', data.tokens.access_token)
      localStorage.setItem('refresh_token', data.tokens.refresh_token)
      await fetchUser()
      if (data.migration_error) {
        setFeedback({
          msg: `已关联到「${data.user.username}」，但部分博客数据迁移未完成（${data.migration_error}），请联系管理员`,
          type: 'error',
        })
      } else {
        setFeedback({ msg: `已成功关联到本地账号「${data.user.username}」`, type: 'success' })
      }
      setLinkUsername('')
      setLinkPassword('')
      // Refresh OAuth account list for the new (primary) identity.
      fetchAccounts()
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; message?: string } } }
      const msg = ax.response?.data?.error || ax.response?.data?.message || '关联失败，请检查用户名密码'
      setFeedback({ msg, type: 'error' })
    } finally {
      setLinking(false)
    }
  }

  // All possible providers
  const allProviders = ['github', 'discord']
  const linkedProviders = new Set(accounts.map((a) => a.provider))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {feedback && <FeedbackBanner message={feedback.msg} type={feedback.type} />}
      </AnimatePresence>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">已绑定的第三方账号</h3>
        </div>

        <p className="text-xs text-muted-foreground">
          绑定第三方账号后可以使用该账号快速登录。
          {!hasPassword && accounts.length > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              {' '}你尚未设置密码，解绑前请先在「账号安全」中设置密码。
            </span>
          )}
        </p>
      </div>

      <div className="space-y-3">
        {allProviders.map((provider) => {
          const meta = providerMeta[provider] || { label: provider, icon: null, color: 'bg-muted' }
          const linked = linkedProviders.has(provider)
          const account = accounts.find((a) => a.provider === provider)
          const isUnlinking = unlinking === provider
          const canUnlink = hasPassword || accounts.length > 1

          return (
            <motion.div
              key={provider}
              layout
              className="flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-muted/30"
            >
              {/* Provider icon */}
              <div className={`flex items-center justify-center h-10 w-10 rounded-lg text-white ${meta.color}`}>
                {meta.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{meta.label}</p>
                {linked && account ? (
                  <p className="text-xs text-muted-foreground truncate">
                    {account.email || `ID: ${account.provider_user_id}`}
                    {' · '}绑定于 {new Date(account.created_at).toLocaleDateString('zh-CN')}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">未绑定</p>
                )}
              </div>

              {/* Action button */}
              {linked ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUnlinking || !canUnlink}
                  onClick={() => handleUnlink(provider)}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  {isUnlinking ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Unlink className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  解绑
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLink(provider)}
                  className="shrink-0"
                >
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  去绑定
                </Button>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* ─── Link existing account (only for OAuth-only users) ─── */}
      {!hasPassword && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">关联已有账号</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              如果你之前已通过用户名/密码注册过本站账号，可以在这里输入凭证将当前第三方登录关联到那个账号。
              <span className="text-amber-600 dark:text-amber-400">
                {' '}关联后当前账号将被合并删除，所有文章/评论会迁移到目标账号。此操作不可撤销。
              </span>
            </p>

            <form onSubmit={handleLinkExisting} className="space-y-3 rounded-xl border p-4">
              <div className="space-y-1.5">
                <Label htmlFor="link-username">本地账号用户名</Label>
                <Input
                  id="link-username"
                  value={linkUsername}
                  onChange={(e) => setLinkUsername(e.target.value)}
                  autoComplete="username"
                  disabled={linking}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-password">密码</Label>
                <div className="relative">
                  <Input
                    id="link-password"
                    type={showLinkPassword ? 'text' : 'password'}
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={linking}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLinkPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showLinkPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button type="submit" size="sm" disabled={linking || !linkUsername || !linkPassword}>
                  {linking ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {linking ? '关联中...' : '确认关联'}
                </Button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════
export default function ProfilePage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-xl px-6 py-20"
    >
      <h1 className="text-2xl font-bold tracking-tight mb-8">个人设置</h1>

      <Card className="overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <Tabs defaultValue={0}>
            <TabsList className="w-full mb-6">
              <TabsTrigger value={0} className="flex-1 gap-1.5">
                <User className="h-3.5 w-3.5" />
                个人资料
              </TabsTrigger>
              <TabsTrigger value={1} className="flex-1 gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                账号安全
              </TabsTrigger>
              <TabsTrigger value={2} className="flex-1 gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                绑定账号
              </TabsTrigger>
            </TabsList>

            <TabsContent value={0}>
              <ProfileTab />
            </TabsContent>
            <TabsContent value={1}>
              <SecurityTab />
            </TabsContent>
            <TabsContent value={2}>
              <LinkedAccountsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  )
}
