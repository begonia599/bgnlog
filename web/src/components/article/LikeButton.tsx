import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { articleApi } from '@/api'

interface LikeButtonProps {
  slug: string
  /** Initial values from the article payload. Remount (key) when the article changes. */
  count: number
  liked: boolean
  /** Whether the viewer is logged in; anonymous clicks show a login hint instead. */
  canLike: boolean
}

export function LikeButton({ slug, count, liked, canLike }: LikeButtonProps) {
  const [state, setState] = useState({ count, liked })
  const [pending, setPending] = useState(false)
  const [showLoginHint, setShowLoginHint] = useState(false)
  const reduceMotion = useReducedMotion()

  const toggle = async () => {
    if (!canLike) {
      setShowLoginHint(true)
      return
    }
    if (pending) return
    const prev = state
    // Optimistic flip; reconcile with the server's authoritative count below.
    setState({ liked: !prev.liked, count: Math.max(0, prev.count + (prev.liked ? -1 : 1)) })
    setPending(true)
    try {
      const res = await articleApi.toggleLike(slug)
      setState({ liked: res.data.data.liked, count: res.data.data.like_count })
    } catch {
      setState(prev)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-16 flex flex-col items-center gap-3">
      <motion.button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={state.liked}
        aria-label={state.liked ? '取消点赞' : '点赞'}
        whileTap={reduceMotion ? undefined : { scale: 0.9 }}
        className={`flex h-14 w-14 items-center justify-center rounded-full ring-1 transition-colors ${
          state.liked
            ? 'bg-rose-500/10 text-rose-500 ring-rose-500/30'
            : 'bg-card text-muted-foreground ring-border/60 hover:text-rose-500 hover:ring-rose-500/30'
        }`}
      >
        {/* Remount on toggle so the heart pops in. */}
        <motion.span
          key={state.liked ? 'liked' : 'unliked'}
          initial={reduceMotion ? false : { scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className="flex"
        >
          <Heart className={`h-6 w-6 ${state.liked ? 'fill-current' : ''}`} aria-hidden />
        </motion.span>
      </motion.button>

      <p className="text-sm text-muted-foreground tabular-nums">
        {state.count > 0 ? (
          <>
            <span className="font-medium text-foreground">{state.count.toLocaleString()}</span> 人觉得很赞
          </>
        ) : (
          '成为第一个点赞的人'
        )}
      </p>

      {showLoginHint && !canLike && (
        <p className="text-xs text-muted-foreground/70">
          登录后可以点赞 ·{' '}
          <Link to="/login" className="text-foreground hover:underline underline-offset-2">
            去登录
          </Link>
        </p>
      )}
    </div>
  )
}
