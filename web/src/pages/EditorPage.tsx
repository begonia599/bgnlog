import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { articleApi, categoryApi, tagApi } from '@/api'
import type { Category, Tag } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ImageUpload } from '@/components/common/ImageUpload'
import MDEditor from '@uiw/react-md-editor'

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [coverFileId, setCoverFileId] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    categoryApi.list().then((res) => setCategories(res.data.data || []))
    tagApi.list().then((res) => setTags(res.data.data || []))
  }, [])

  useEffect(() => {
    if (isEdit) {
      articleApi.getBySlug(id!).then((res) => {
        const a = res.data.data
        setTitle(a.title)
        setContent(a.content)
        setExcerpt(a.excerpt)
        setCoverUrl(a.cover_image_url)
        setCoverFileId(a.cover_file_id)
        setCategoryId(a.category_id)
        setSelectedTagIds(a.tags?.map((t) => t.id) || [])
      })
    }
  }, [id, isEdit])

  const handleSave = async (status: 'draft' | 'published') => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const data = {
        title,
        content,
        excerpt,
        cover_image_url: coverUrl,
        cover_file_id: coverFileId,
        category_id: categoryId,
        tag_ids: selectedTagIds,
        status,
      }

      if (isEdit) {
        const article = (await articleApi.getBySlug(id!)).data.data
        await articleApi.update(article.id, data)
      } else {
        await articleApi.create(data)
      }
      navigate('/')
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">{isEdit ? '编辑文章' : '写文章'}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave('draft')} disabled={saving}>
            保存草稿
          </Button>
          <Button onClick={() => handleSave('published')} disabled={saving}>
            {saving ? '保存中...' : '发布'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文章标题"
            className="text-2xl font-semibold h-14 border-0 px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="space-y-2">
          <Label>摘要</Label>
          <Textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="简短描述文章内容..."
            rows={2}
            className="resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>分类</Label>
            <select
              value={categoryId || ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">无分类</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>封面图</Label>
            <div className="flex items-center gap-2">
              {coverUrl && <img src={coverUrl} alt="" className="h-9 w-16 object-cover rounded" />}
              <ImageUpload
                onUploaded={(url, fileId) => {
                  setCoverUrl(url)
                  setCoverFileId(fileId)
                }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>标签</Label>
          <div className="flex gap-1.5 flex-wrap">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={selectedTagIds.includes(tag.id) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>

        <div data-color-mode="light">
          <MDEditor
            value={content}
            onChange={(val) => setContent(val || '')}
            height={500}
            preview="live"
          />
        </div>
      </div>
    </div>
  )
}
