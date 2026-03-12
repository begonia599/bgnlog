import { useState, useEffect } from 'react'
import { categoryApi, tagApi } from '@/api'
import type { Category, Tag } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'

export default function AdminPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [newTagName, setNewTagName] = useState('')

  const fetchData = () => {
    categoryApi.list().then((res) => setCategories(res.data.data || []))
    tagApi.list().then((res) => setTags(res.data.data || []))
  }

  useEffect(() => { fetchData() }, [])

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
