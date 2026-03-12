import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { articleApi } from '@/api'
import type { Article } from '@/types'
import { ArticleCard } from '@/components/article/ArticleCard'
import { Pagination } from '@/components/common/Pagination'
import { SearchBar } from '@/components/common/SearchBar'
import { motion } from 'framer-motion'

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1')

  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!q) return
    setLoading(true)
    articleApi
      .search(q, page)
      .then((res) => {
        const data = res.data.data
        setArticles(data.items || [])
        setTotal(data.pagination.total)
      })
      .finally(() => setLoading(false))
  }, [q, page])

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-6">搜索</h1>

        <div className="mb-8">
          <SearchBar
            onSearch={(query) => {
              setSearchParams({ q: query })
            }}
            placeholder="搜索文章..."
          />
        </div>

        {q && (
          <p className="text-sm text-muted-foreground mb-6">
            搜索 "{q}" 找到 {total} 篇文章
          </p>
        )}

        {loading ? (
          <div className="space-y-8 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-6">
                <div className="h-4 w-32 bg-muted rounded mb-3" />
                <div className="h-6 w-3/4 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {articles.map((article, i) => (
              <ArticleCard key={article.id} article={article} index={i} />
            ))}
          </div>
        )}

        {!loading && q && articles.length === 0 && (
          <p className="text-center text-muted-foreground py-12">未找到相关文章</p>
        )}

        <Pagination
          page={page}
          total={total}
          pageSize={10}
          onChange={(p) => setSearchParams({ q, page: String(p) })}
        />
      </motion.div>
    </div>
  )
}
