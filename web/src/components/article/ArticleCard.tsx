import { Link, useNavigate } from 'react-router-dom'
import type { Article } from '@/types'
import { formatDate } from '@/utils/date'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { Pencil } from 'lucide-react'

interface ArticleCardProps {
  article: Article
  index?: number
}

export function ArticleCard({ article, index = 0 }: ArticleCardProps) {
  const { user, isEditor, isAdmin } = useAuth()
  const navigate = useNavigate()
  const canEdit = isEditor && (isAdmin || article.author_id === user?.id)

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigate(`/editor/${article.id}`)
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      className="group/card relative"
    >
      <Link to={`/article/${article.slug}`} className="group block py-8">
        <div className="flex flex-col gap-2 md:flex-row md:gap-8">
          {/* Date column */}
          <div className="flex-shrink-0 md:w-28">
            <time className="font-mono text-xs tracking-wider text-muted-foreground/60">
              {formatDate(article.published_at || article.created_at)}
            </time>
          </div>

          {/* Content column */}
          <div className="flex flex-1 flex-col gap-2.5">
            <h2 className="text-lg font-medium tracking-tight text-foreground/90 transition-colors duration-300 group-hover:text-foreground">
              {article.title}
            </h2>

            {article.excerpt && (
              <p className="text-sm leading-relaxed text-muted-foreground/70 line-clamp-2">
                {article.excerpt}
              </p>
            )}

            {article.tags && article.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap pt-1">
                {article.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] text-muted-foreground/70"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Subtle divider */}
        <div className="mt-8 h-px w-full bg-border/40" />
      </Link>

      {/* Edit button - visible on hover for editors */}
      {canEdit && (
        <button
          onClick={handleEdit}
          className="absolute right-0 top-8 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/0 transition-all duration-200 hover:bg-secondary hover:text-foreground group-hover/card:text-muted-foreground/50"
          title="编辑文章"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.article>
  )
}

