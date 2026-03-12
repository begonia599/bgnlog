import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { articleApi, categoryApi, tagApi } from '@/api'
import type { Article, Category, Tag } from '@/types'
import { ArticleCard } from '@/components/article/ArticleCard'
import { Pagination } from '@/components/common/Pagination'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function PostsPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const page = parseInt(searchParams.get('page') || '1')
    const categoryFilter = searchParams.get('category') || ''
    const tagFilter = searchParams.get('tag') || ''

    const [articles, setArticles] = useState<Article[]>([])
    const [total, setTotal] = useState(0)
    const [categories, setCategories] = useState<Category[]>([])
    const [tags, setTags] = useState<Tag[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        categoryApi.list().then((res) => setCategories(res.data.data || []))
        tagApi.list().then((res) => setTags(res.data.data || []))
    }, [])

    useEffect(() => {
        setLoading(true)
        articleApi
            .list({ page, page_size: 10, category: categoryFilter, tag: tagFilter })
            .then((res) => {
                const data = res.data.data
                setArticles(data.items || [])
                setTotal(data.pagination.total)
            })
            .finally(() => setLoading(false))
    }, [page, categoryFilter, tagFilter])

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams)
        if (value) {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        params.delete('page')
        setSearchParams(params)
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl px-6 py-20"
        >
            <h1 className="text-2xl font-bold tracking-tight mb-2">文稿</h1>
            <p className="text-sm text-muted-foreground/70 mb-12">
                思考，记录，分享
            </p>

            {/* Filters */}
            {(categories.length > 0 || tags.length > 0) && (
                <div className="mb-10 flex flex-wrap gap-2">
                    <button
                        onClick={() => setSearchParams({})}
                        className={cn(
                            'rounded-full px-3 py-1 text-xs transition-all duration-200',
                            !categoryFilter && !tagFilter
                                ? 'bg-foreground text-background'
                                : 'bg-secondary text-muted-foreground hover:text-foreground',
                        )}
                    >
                        全部
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => updateFilter('category', categoryFilter === cat.slug ? '' : cat.slug)}
                            className={cn(
                                'rounded-full px-3 py-1 text-xs transition-all duration-200',
                                categoryFilter === cat.slug
                                    ? 'bg-foreground text-background'
                                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {cat.name}
                        </button>
                    ))}
                    {tags.map((tag) => (
                        <button
                            key={tag.id}
                            onClick={() => updateFilter('tag', tagFilter === tag.slug ? '' : tag.slug)}
                            className={cn(
                                'rounded-full px-3 py-1 text-xs transition-all duration-200',
                                tagFilter === tag.slug
                                    ? 'bg-foreground text-background'
                                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                            )}
                        >
                            # {tag.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Article list */}
            {loading ? (
                <div className="space-y-12">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse">
                            <div className="h-3 w-24 rounded bg-muted mb-3" />
                            <div className="h-5 w-3/4 rounded bg-muted mb-3" />
                            <div className="h-3 w-full rounded bg-muted" />
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    <div className="space-y-0">
                        {articles.map((article, i) => (
                            <ArticleCard key={article.id} article={article} index={i} />
                        ))}
                    </div>

                    {articles.length === 0 && (
                        <p className="py-20 text-center text-muted-foreground">暂无文稿</p>
                    )}

                    <Pagination
                        page={page}
                        total={total}
                        pageSize={10}
                        onChange={(p) => {
                            const params = new URLSearchParams(searchParams)
                            params.set('page', String(p))
                            setSearchParams(params)
                        }}
                    />
                </>
            )}
        </motion.div>
    )
}
