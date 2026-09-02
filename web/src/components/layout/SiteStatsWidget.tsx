import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Activity, X } from 'lucide-react'
import { statsApi } from '@/api'
import type { SiteStats } from '@/types'

const HIDDEN_KEY = 'site-stats-widget-hidden'
const VISIT_KEY = 'site-visit-recorded'
const CLOSE_DELAY_MS = 180

interface Uptime {
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** Ticks once a second while `running`; returns the elapsed time since `launchedAt`. */
function useUptime(launchedAt: string | undefined, running: boolean): Uptime | null {
  // `now` is only ever written from timer callbacks (never synchronously in
  // the effect or during render), which keeps the render pure. The zero-delay
  // timeout refreshes the value right after the panel opens.
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!running) return
    const update = () => setNow(Date.now())
    const first = window.setTimeout(update, 0)
    const id = window.setInterval(update, 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [running])

  return useMemo(() => {
    if (!launchedAt || now === 0) return null
    const start = new Date(launchedAt).getTime()
    if (Number.isNaN(start)) return null
    let rest = Math.max(0, Math.floor((now - start) / 1000))
    const days = Math.floor(rest / 86400)
    rest -= days * 86400
    const hours = Math.floor(rest / 3600)
    rest -= hours * 3600
    const minutes = Math.floor(rest / 60)
    const seconds = rest - minutes * 60
    return { days, hours, minutes, seconds }
  }, [launchedAt, now])
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * Collapsible floating panel docked to the left edge. Collapsed it is a slim
 * tab; hovering (or tapping / focusing on touch and keyboard) slides out the
 * panel with the site's running time and visit counters. The × hides it for
 * the rest of the browser session.
 */
export function SiteStatsWidget() {
  const [stats, setStats] = useState<SiteStats | null>(null)
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(() => sessionStorage.getItem(HIDDEN_KEY) === '1')
  const closeTimer = useRef<number | null>(null)
  const reduceMotion = useReducedMotion()

  // Record one visit per browser session, then load the counters.
  useEffect(() => {
    let cancelled = false
    const load = () =>
      statsApi
        .site()
        .then((res) => {
          if (!cancelled) setStats(res.data.data)
        })
        .catch(() => {})

    if (sessionStorage.getItem(VISIT_KEY)) {
      load()
    } else {
      sessionStorage.setItem(VISIT_KEY, '1')
      statsApi.visit().catch(() => {}).finally(load)
    }
    return () => {
      cancelled = true
    }
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }, [cancelClose])

  useEffect(() => cancelClose, [cancelClose])

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const uptime = useUptime(stats?.launched_at, open)

  const hide = () => {
    sessionStorage.setItem(HIDDEN_KEY, '1')
    setHidden(true)
  }

  if (hidden) return null

  const transition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.8 }

  return (
    <div
      className="fixed left-0 top-1/2 z-30 -translate-y-1/2"
      onMouseEnter={() => {
        cancelClose()
        setOpen(true)
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        cancelClose()
        setOpen(true)
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleClose()
      }}
    >
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.section
            key="panel"
            role="status"
            aria-label="站点运行统计"
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={transition}
            className="ml-3 w-60 rounded-2xl bg-card/95 p-4 shadow-xl ring-1 ring-border/50 backdrop-blur-md"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                站点状态
              </div>
              <button
                type="button"
                onClick={hide}
                aria-label="隐藏站点状态"
                title="本次访问不再显示"
                className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            <dl className="space-y-3">
              <div>
                <dt className="text-[11px] text-muted-foreground/70">已运行</dt>
                <dd className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
                  {uptime ? (
                    <>
                      <span className="text-base font-semibold">{uptime.days}</span>
                      <span className="mx-1 text-xs text-muted-foreground">天</span>
                      {pad2(uptime.hours)}:{pad2(uptime.minutes)}:{pad2(uptime.seconds)}
                    </>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </dd>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <dt className="text-[11px] text-muted-foreground/70">访问人次</dt>
                  <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-foreground">
                    {stats ? stats.total_visits.toLocaleString() : <span className="text-muted-foreground/50">—</span>}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-[11px] text-muted-foreground/70">今日</dt>
                  <dd className="mt-0.5 font-mono text-sm tabular-nums text-muted-foreground">
                    {stats ? stats.today_visits.toLocaleString() : '—'}
                  </dd>
                </div>
              </div>
            </dl>
          </motion.section>
        ) : (
          <motion.button
            key="tab"
            type="button"
            aria-label="展开站点运行统计"
            onClick={() => setOpen(true)}
            initial={{ x: -12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -12, opacity: 0 }}
            transition={transition}
            className="flex h-12 w-7 items-center justify-center rounded-r-xl bg-card/90 text-muted-foreground/70 shadow-md ring-1 ring-border/50 backdrop-blur-md transition-colors hover:text-foreground"
          >
            <Activity className="h-4 w-4" aria-hidden />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
