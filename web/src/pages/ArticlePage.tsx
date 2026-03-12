import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { articleApi, commentApi } from '@/api'
import type { Article, Comment } from '@/types'
import { ArticleContent } from '@/components/article/ArticleContent'
import { CommentList } from '@/components/comment/CommentList'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/utils/date'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { Pencil, Trash2 } from 'lucide-react'

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user, isEditor, isAdmin } = useAuth()
  const [article, setArticle] = useState<Article | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const canEdit = isEditor && article && (isAdmin || article.author_id === user?.id)
  const canDelete = isAdmin

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    articleApi.getBySlug(slug)
      .then((res) => setArticle(res.data.data))
      .finally(() => setLoading(false))
  }, [slug])

  const fetchComments = useCallback(() => {
    if (!slug) return
    commentApi.list(slug).then((res) => setComments(res.data.data || []))
  }, [slug])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleDelete = async () => {
    if (!article) return
    setDeleting(true)
    try {
      await articleApi.delete(article.id)
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Failed to delete article', err)
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 animate-pulse">
        <div className="h-10 w-3/4 bg-muted rounded mb-6" />
        <div className="h-3 w-1/3 bg-muted rounded mb-12" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-3 bg-muted rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-32 text-center">
        <h1 className="text-2xl font-semibold mb-2">文章未找到</h1>
        <p className="text-muted-foreground mb-6">请检查链接是否正确</p>
        <Link to="/" className="text-primary hover:underline">返回首页</Link>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-2xl px-6 py-20"
    >
      <article>
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-14"
        >
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight leading-tight sm:text-4xl mb-6 flex-1">
              {article.title}
            </h1>

            {/* Admin/Editor actions */}
            {(canEdit || canDelete) && (
              <div className="flex items-center gap-1 shrink-0 pt-1">
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(`/editor/${article.id}`)}
                    title="编辑文章"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="删除文章"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground/70">
            <span>{article.author_name}</span>
            <span className="text-border">·</span>
            <time className="font-mono text-xs tracking-wider">
              {formatDate(article.published_at || article.created_at)}
            </time>
            {article.category && (
              <>
                <span className="text-border">·</span>
                <Link
                  to={`/?category=${article.category.slug}`}
                  className="transition-colors hover:text-foreground"
                >
                  {article.category.name}
                </Link>
              </>
            )}
            <span className="text-border">·</span>
            <span>{article.view_count} 次阅读</span>
          </div>

          {article.tags && article.tags.length > 0 && (
            <div className="flex gap-1.5 mt-5 flex-wrap">
              {article.tags.map((tag) => (
                <Link
                  key={tag.id}
                  to={`/?tag=${tag.slug}`}
                  className="rounded-full bg-secondary/80 px-2.5 py-0.5 text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          )}
        </motion.header>

        {article.cover_image_url && (
          <motion.img
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            src={article.cover_image_url}
            alt={article.title}
            className="w-full rounded-xl mb-14 shadow-sm"
          />
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <ArticleContent content={article.content} />
        </motion.div>
      </article>

      <Separator className="my-16" />

      <CommentList slug={slug!} comments={comments} onRefresh={fetchComments} />

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-sm rounded-2xl bg-card p-6 ring-1 ring-border/50 shadow-xl"
          >
            <h3 className="text-lg font-semibold mb-2">确认删除</h3>
            <p className="text-sm text-muted-foreground mb-6">
              确定要删除文章「{article.title}」吗？此操作不可撤销。
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '删除中...' : '确认删除'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}

