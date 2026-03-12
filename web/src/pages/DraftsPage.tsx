import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { articleApi } from '@/api'
import type { Article } from '@/types'
import { Pagination } from '@/components/common/Pagination'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { formatDate } from '@/utils/date'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function DraftsPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    articleApi
      .drafts(page)
      .then((res) => {
        const data = res.data.data
        setArticles(data.items || [])
        setTotal(data.pagination.total)
      })
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">草稿箱</h1>
          <Link to="/editor" className={cn(buttonVariants())}>写文章</Link>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <Link
                key={article.id}
                to={`/editor/${article.slug}`}
                className="flex items-center justify-between p-4 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <h3 className="font-medium">{article.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    最后编辑于 {formatDate(article.updated_at)}
                  </p>
                </div>
                <Badge variant="outline">草稿</Badge>
              </Link>
            ))}
          </div>
        )}

        {!loading && articles.length === 0 && (
          <p className="text-center text-muted-foreground py-12">暂无草稿</p>
        )}

        <Pagination page={page} total={total} pageSize={10} onChange={setPage} />
      </motion.div>
    </div>
  )
}
