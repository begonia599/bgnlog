import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { ChevronDown, Github } from 'lucide-react'
import { settingsApi } from '@/api'

const defaultTitle = 'Hello, World.'
const defaultSubtitle = '思考、记录、分享'
const defaultAvatarUrl = ''
const defaultNickname = ''

const charVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 20,
      delay: 0.3 + i * 0.04,
    },
  }),
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 200, damping: 20, delay },
  }),
}

const socialIcons = [
  {
    icon: Github,
    href: 'https://github.com',
    label: 'GitHub',
  },
]

export function Hero() {
  const [hitokoto, setHitokoto] = useState('')
  const [title, setTitle] = useState(defaultTitle)
  const [subtitle, setSubtitle] = useState(defaultSubtitle)
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatarUrl)
  const [nickname, setNickname] = useState(defaultNickname)

  useEffect(() => {
    fetch('https://v1.hitokoto.cn/?c=d&c=i&c=k')
      .then((r) => r.json())
      .then((data) => setHitokoto(data.hitokoto || ''))
      .catch(() => setHitokoto('生活明朗，万物可爱。'))

    settingsApi.getHero()
      .then((res) => {
        const s = res.data.data
        if (s.hero_title) setTitle(s.hero_title)
        if (s.hero_subtitle) setSubtitle(s.hero_subtitle)
        if (s.hero_avatar_url) setAvatarUrl(s.hero_avatar_url)
        if (s.hero_nickname) setNickname(s.hero_nickname)
      })
      .catch(() => {})
  }, [])

  const scrollToContent = () => {
    window.scrollTo({ top: window.innerHeight - 64, behavior: 'smooth' })
  }

  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden">
      <div className="mx-auto flex w-full max-w-4xl flex-col-reverse items-center gap-10 px-6 md:flex-row md:gap-16">
        {/* Left — text */}
        <div className="flex flex-1 flex-col items-center text-center md:items-start md:text-left">
          {/* Staggered title */}
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            {title.split('').map((char, i) => (
              <motion.span
                key={i}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={charVariants}
                className="inline-block"
                style={{ whiteSpace: char === ' ' ? 'pre' : undefined }}
              >
                {char}
              </motion.span>
            ))}
          </h1>

          {/* Subtitle */}
          <motion.p
            custom={0.8}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mb-8 text-lg text-muted-foreground"
          >
            {subtitle}
          </motion.p>

          {/* Social icons */}
          <motion.div
            className="flex items-center gap-3"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.08, delayChildren: 1.0 } },
            }}
          >
            {socialIcons.map(({ icon: Icon, href, label }) => (
              <motion.a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                variants={{
                  hidden: { opacity: 0, scale: 0.5 },
                  visible: {
                    opacity: 1,
                    scale: 1,
                    transition: { type: 'spring' as const, stiffness: 400, damping: 15 },
                  },
                }}
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
              </motion.a>
            ))}
          </motion.div>
        </div>

        {/* Right — avatar + nickname */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring' as const, stiffness: 200, damping: 20, delay: 0.2 }}
          className="flex flex-col items-center gap-4 flex-shrink-0"
        >
          <div className="relative group">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/30 via-accent/30 to-primary/10 blur-md opacity-60 group-hover:opacity-80 transition-opacity" />
            <div className="relative h-36 w-36 rounded-full ring-2 ring-border/40 sm:h-44 sm:w-44 md:h-48 md:w-48 flex items-center justify-center overflow-hidden bg-muted">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={nickname || 'Avatar'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-5xl sm:text-6xl md:text-7xl select-none">👤</span>
              )}
            </div>
          </div>

          {nickname && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, type: 'spring' as const, stiffness: 200, damping: 20 }}
              className="text-base font-medium text-muted-foreground tracking-wide"
            >
              {nickname}
            </motion.p>
          )}
        </motion.div>
      </div>

      {/* Bottom — hitokoto + scroll hint */}
      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-4">
        {hitokoto && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.6 }}
            className="max-w-md px-6 text-center text-sm text-muted-foreground/70 italic"
          >
            「{hitokoto}」
          </motion.p>
        )}
        <motion.button
          onClick={scrollToContent}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          aria-label="向下滚动"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          >
            <ChevronDown className="h-5 w-5" />
          </motion.div>
        </motion.button>
      </div>
    </section>
  )
}
