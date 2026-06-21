import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { articleApi } from '@/api'
import type { Article } from '@/types'
import { ArticleCard } from '@/components/article/ArticleCard'
import { Pagination } from '@/components/common/Pagination'
import { buttonVariants } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'
import { PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function NotesPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { isAdmin } = useAuth()
    const page = parseInt(searchParams.get('page') || '1')

    const [notes, setNotes] = useState<Article[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        articleApi
            .list({ page, page_size: 10, type: 'note' })
            .then((res) => {
                const data = res.data.data
                setNotes(data.items || [])
                setTotal(data.pagination.total)
            })
            .finally(() => setLoading(false))
    }, [page])

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl px-4 sm:px-6 py-20"
        >
            <div className="mb-16 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight mb-2">手记</h1>
                    <p className="text-sm text-muted-foreground/70">
                        记录日常的碎片与灵感
                    </p>
                </div>
                {isAdmin && (
                    <Link
                        to="/editor?type=note"
                        className={cn(
                            buttonVariants({ variant: 'outline', size: 'sm' }),
                            'rounded-full gap-1.5 shrink-0',
                        )}
                    >
                        <PenLine className="h-3.5 w-3.5" />
                        写手记
                    </Link>
                )}
            </div>

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
            ) : notes.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60 mb-6">
                        <PenLine className="h-7 w-7 text-muted-foreground/40" />
                    </div>
                    <p className="text-muted-foreground/60 text-sm">暂无手记</p>
                    <p className="text-muted-foreground/40 text-xs mt-1">这里将展示日常随笔与碎片记录</p>
                </div>
            ) : (
                <>
                    <div className="space-y-0">
                        {notes.map((note, i) => (
                            <ArticleCard key={note.id} article={note} index={i} />
                        ))}
                    </div>

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
