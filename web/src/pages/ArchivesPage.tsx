import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { archiveApi } from '@/api'
import type { ArchiveItem } from '@/types'
import { motion } from 'framer-motion'

const monthNames = ['', '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

export default function ArchivesPage() {
  const [archives, setArchives] = useState<ArchiveItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    archiveApi
      .list()
      .then((res) => setArchives(res.data.data || []))
      .finally(() => setLoading(false))
  }, [])

  // Group by year
  const grouped = archives.reduce<Record<number, ArchiveItem[]>>((acc, item) => {
    if (!acc[item.year]) acc[item.year] = []
    acc[item.year].push(item)
    return acc
  }, {})

  const years = Object.keys(grouped).map(Number).sort((a, b) => b - a)

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight mb-10">归档</h1>

        {loading ? (
          <div className="animate-pulse space-y-6">
            {[1, 2].map((i) => (
              <div key={i}>
                <div className="h-6 w-20 bg-muted rounded mb-4" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-4 w-40 bg-muted rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {years.map((year) => (
              <div key={year}>
                <h2 className="text-xl font-semibold mb-4">{year}</h2>
                <div className="space-y-2 pl-4 border-l-2 border-border/40">
                  {grouped[year].map((item) => (
                    <Link
                      key={`${item.year}-${item.month}`}
                      to={`/?page=1`}
                      className="flex items-center gap-3 py-1 text-sm hover:text-primary transition-colors"
                    >
                      <span className="w-14 text-muted-foreground">{monthNames[item.month]}</span>
                      <span className="text-muted-foreground">—</span>
                      <span>{item.count} 篇文章</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && archives.length === 0 && (
          <p className="text-center text-muted-foreground py-12">暂无归档</p>
        )}
      </motion.div>
    </div>
  )
}
