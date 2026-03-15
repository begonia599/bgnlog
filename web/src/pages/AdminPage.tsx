import { useState, useEffect, useRef } from 'react'
import { categoryApi, tagApi, settingsApi, authApi } from '@/api'
import type { Category, Tag } from '@/types'
import type { HeroSettings } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Save, Camera, Loader2, Check } from 'lucide-react'

export default function AdminPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [newTagName, setNewTagName] = useState('')

  // Hero settings
  const [heroTitle, setHeroTitle] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [heroAvatarUrl, setHeroAvatarUrl] = useState('')
  const [heroSaving, setHeroSaving] = useState(false)
  const [heroSaved, setHeroSaved] = useState(false)
  const [heroUploading, setHeroUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const fetchData = () => {
    categoryApi.list().then((res) => setCategories(res.data.data || []))
    tagApi.list().then((res) => setTags(res.data.data || []))
  }

  useEffect(() => {
    fetchData()
    settingsApi.getHero().then((res) => {
      const s = res.data.data
      setHeroTitle(s.hero_title || '')
      setHeroSubtitle(s.hero_subtitle || '')
      setHeroAvatarUrl(s.hero_avatar_url || '')
    }).catch(() => {})
  }, [])

  const handleSaveHero = async () => {
    setHeroSaving(true)
    try {
      await settingsApi.updateHero({
        hero_title: heroTitle,
        hero_subtitle: heroSubtitle,
        hero_avatar_url: heroAvatarUrl,
      })
      setHeroSaved(true)
      setTimeout(() => setHeroSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save hero settings', err)
    } finally {
      setHeroSaving(false)
    }
  }

  const handleHeroAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setHeroUploading(true)
    try {
      const res = await authApi.uploadAvatar(file)
      setHeroAvatarUrl(res.data.data.url)
    } catch (err) {
      console.error('Failed to upload avatar', err)
    } finally {
      setHeroUploading(false)
    }
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    await categoryApi.create({ name: newCatName, description: newCatDesc })
    setNewCatName('')
    setNewCatDesc('')
    fetchData()
  }

  const handleDeleteCategory = async (id: number) => {
    await categoryApi.delete(id)
    fetchData()
  }

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTagName.trim()) return
    await tagApi.create(newTagName)
    setNewTagName('')
    fetchData()
  }

  const handleDeleteTag = async (id: number) => {
    await tagApi.delete(id)
    fetchData()
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-8">管理</h1>

        {/* Hero / Site Settings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">站点设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div className="h-20 w-20 rounded-full overflow-hidden ring-2 ring-border/50 bg-muted flex items-center justify-center">
                  {heroAvatarUrl ? (
                    <img src={heroAvatarUrl} alt="头像" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl text-muted-foreground">👤</span>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleHeroAvatarUpload}
                />
                <button
                  type="button"
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={heroUploading}
                >
                  {heroUploading ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </button>
              </div>
              <div className="flex-1 space-y-3">
                <div className="space-y-1">
                  <Label>首页标题</Label>
                  <Input
                    value={heroTitle}
                    onChange={(e) => setHeroTitle(e.target.value)}
                    placeholder="Hello, World."
                  />
                </div>
                <div className="space-y-1">
                  <Label>首页副标题</Label>
                  <Input
                    value={heroSubtitle}
                    onChange={(e) => setHeroSubtitle(e.target.value)}
                    placeholder="思考、记录、分享"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>头像 URL</Label>
              <Input
                value={heroAvatarUrl}
                onChange={(e) => setHeroAvatarUrl(e.target.value)}
                placeholder="点击上方头像上传，或手动输入 URL"
              />
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveHero}
                disabled={heroSaving}
              >
                {heroSaved ? (
                  <><Check className="h-3.5 w-3.5 mr-1.5" />已保存</>
                ) : (
                  <><Save className="h-3.5 w-3.5 mr-1.5" />{heroSaving ? '保存中...' : '保存设置'}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">分类管理</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleCreateCategory} className="space-y-3">
                <div className="space-y-1">
                  <Label>名称</Label>
                  <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="分类名称" />
                </div>
                <div className="space-y-1">
                  <Label>描述</Label>
                  <Input value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} placeholder="可选描述" />
                </div>
                <Button type="submit" size="sm">添加分类</Button>
              </form>

              <Separator />

              <div className="space-y-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between py-1">
                    <div>
                      <span className="text-sm font-medium">{cat.name}</span>
                      {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={() => handleDeleteCategory(cat.id)}>
                      删除
                    </Button>
                  </div>
                ))}
                {categories.length === 0 && <p className="text-sm text-muted-foreground">暂无分类</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">标签管理</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleCreateTag} className="flex gap-2">
                <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="标签名称" />
                <Button type="submit" size="sm">添加</Button>
              </form>

              <Separator />

              <div className="flex gap-2 flex-wrap">
                {tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
                    {tag.name}
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </Badge>
                ))}
                {tags.length === 0 && <p className="text-sm text-muted-foreground">暂无标签</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  )
}
