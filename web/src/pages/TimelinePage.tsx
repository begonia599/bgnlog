import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { articleApi } from '@/api'
import type { Article } from '@/types'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { formatDate } from '@/utils/date'

interface MonthGroup {
    label: string
    articles: Article[]
}

function groupByMonth(articles: Article[]): MonthGroup[] {
    const map = new Map<string, Article[]>()
    articles.forEach((a) => {
        const d = new Date(a.published_at || a.created_at)
        const key = `${d.getFullYear()}年${d.getMonth() + 1}月`
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(a)
    })
    return Array.from(map.entries()).map(([label, articles]) => ({ label, articles }))
}

export default function TimelinePage() {
    const [articles, setArticles] = useState<Article[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        articleApi
            .list({ page: 1, page_size: 100 })
            .then((res) => setArticles(res.data.data.items || []))
            .finally(() => setLoading(false))
    }, [])

    const groups = groupByMonth(articles)

    if (loading) {
        return (
            <div className="mx-auto max-w-2xl px-6 py-20 animate-pulse">
                <div className="h-8 w-32 bg-muted rounded mb-16" />
                <div className="space-y-8">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="space-y-3">
                            <div className="h-4 w-20 bg-muted rounded" />
                            <div className="h-3 w-3/4 bg-muted rounded" />
                            <div className="h-3 w-1/2 bg-muted rounded" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl px-6 py-20"
        >
            <h1 className="text-2xl font-bold tracking-tight mb-2">时光</h1>
            <p className="text-sm text-muted-foreground/70 mb-16">
                记录过去的岁月
            </p>

            {groups.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60 mb-6">
                        <Clock className="h-7 w-7 text-muted-foreground/40" />
                    </div>
                    <p className="text-muted-foreground/60 text-sm">暂无内容</p>
                </div>
            ) : (
                <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/40" />

                    <div className="space-y-12">
                        {groups.map((group, gi) => (
                            <motion.div
                                key={group.label}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: gi * 0.05 }}
                            >
                                {/* Month marker */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="h-[15px] w-[15px] rounded-full bg-primary/80 ring-4 ring-background z-10 shrink-0" />
                                    <h2 className="text-lg font-semibold tracking-tight">{group.label}</h2>
                                </div>

                                {/* Articles in this month */}
                                <div className="ml-[30px] space-y-3">
                                    {group.articles.map((article) => (
                                        <Link
                                            key={article.id}
                                            to={`/article/${article.slug}`}
                                            className="group flex items-baseline gap-3 py-1"
                                        >
                                            <time className="font-mono text-xs text-muted-foreground/50 shrink-0 w-12">
                                                {formatDate(article.published_at || article.created_at).slice(5)}
                                            </time>
                                            <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                                                {article.title}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    )
}
