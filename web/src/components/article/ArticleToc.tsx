import { useEffect, useMemo, useState } from 'react'
import GithubSlugger from 'github-slugger'
import { cn } from '@/lib/utils'

interface TocItem {
  id: string
  text: string
  level: number
}

// Extract h1–h3 headings from Markdown, skipping fenced code blocks. Slugs are
// generated with github-slugger in document order, matching rehype-slug's ids.
function extractHeadings(markdown: string): TocItem[] {
  const slugger = new GithubSlugger()
  const items: TocItem[] = []
  let inFence = false

  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const m = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) continue

    const text = m[2]
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .trim()
    if (!text) continue

    items.push({ id: slugger.slug(text), text, level: m[1].length })
  }
  return items
}

export function ArticleToc({ content }: { content: string }) {
  const items = useMemo(() => extractHeadings(content), [content])
  const [active, setActive] = useState('')

  useEffect(() => {
    if (items.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          const top = visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0]
          setActive(top.target.id)
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    )
    items.forEach((it) => {
      const el = document.getElementById(it.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [items])

  // Not worth a floating TOC for one or zero headings.
  if (items.length < 2) return null

  return (
    <nav className="fixed top-28 left-[calc(50%+22rem)] hidden w-52 max-h-[70vh] overflow-auto xl:block">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/50">
        目录
      </p>
      <ul className="space-y-1 border-l border-border/40 text-sm">
        {items.map((it) => (
          <li key={it.id} style={{ paddingLeft: `${(it.level - 1) * 0.75 + 0.75}rem` }}>
            <a
              href={`#${it.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(it.id)?.scrollIntoView({ behavior: 'smooth' })
                history.replaceState(null, '', `#${it.id}`)
              }}
              className={cn(
                '-ml-px block border-l border-transparent py-0.5 transition-colors',
                active === it.id
                  ? 'border-foreground font-medium text-foreground'
                  : 'text-muted-foreground/60 hover:text-foreground',
              )}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
