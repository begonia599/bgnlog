import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { ChevronDown, Github, Mail, Sparkles } from 'lucide-react'
import { settingsApi } from '@/api'
import { DiscordPresence } from './DiscordPresence'

const defaultTitle = 'Hello, World.'
const defaultSubtitle = '思考、记录、分享'
const defaultAvatarUrl = ''
const defaultNickname = ''
const defaultBio = ''

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

const socialLinks = [
  { icon: Github, href: 'https://github.com/begonia599', label: 'GitHub' },
  { icon: Mail, href: 'mailto:begonia@bgnhub.me', label: 'Email' },
]

export function Hero() {
  const [hitokoto, setHitokoto] = useState('')
  const [title, setTitle] = useState(defaultTitle)
  const [subtitle, setSubtitle] = useState(defaultSubtitle)
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatarUrl)
  const [nickname, setNickname] = useState(defaultNickname)
  const [bio, setBio] = useState(defaultBio)
  const [discordId, setDiscordId] = useState('')

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
        if (s.hero_bio) setBio(s.hero_bio)
        if (s.discord_user_id) setDiscordId(s.discord_user_id)
      })
      .catch(() => {})
  }, [])

  const scrollToContent = () => {
    window.scrollTo({ top: window.innerHeight - 64, behavior: 'smooth' })
  }

  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden">
      {/* Decorative background shapes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="absolute bottom-32 right-16 w-96 h-96 rounded-full bg-accent/40 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-48 h-48 rounded-full bg-primary/[0.02] blur-2xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-6 md:flex-row md:gap-16 lg:gap-20">
        {/* Left — text content */}
        <div className="flex flex-1 flex-col items-center text-center md:items-start md:text-left">
          {/* Staggered title */}
          <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
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

          {/* Subtitle with decorative line */}
          <motion.div
            custom={0.7}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mb-6 flex items-center gap-3"
          >
            <Sparkles className="h-4 w-4 text-muted-foreground/50" />
            <p className="text-lg text-muted-foreground">{subtitle}</p>
          </motion.div>

          {/* Bio */}
          {bio && (
            <motion.p
              custom={0.9}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="mb-8 max-w-md text-sm leading-relaxed text-muted-foreground/80"
            >
              {bio}
            </motion.p>
          )}

          {/* Social links + location */}
          <motion.div
            className="flex items-center gap-4"
            custom={1.1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <div className="flex items-center gap-2.5">
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:scale-110"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </motion.div>

          {/* Discord Presence */}
          {discordId && (
            <motion.div
              custom={1.3}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              <DiscordPresence userId={discordId} />
            </motion.div>
          )}
        </div>

        {/* Right — avatar card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring' as const, stiffness: 200, damping: 20, delay: 0.2 }}
          className="flex flex-col items-center gap-5 flex-shrink-0"
        >
          {/* Avatar with glow */}
          <div className="relative group">
            <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-primary/20 via-accent/30 to-primary/10 blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-500" />
            <div className="relative h-40 w-40 rounded-full ring-[3px] ring-border/30 sm:h-48 sm:w-48 md:h-52 md:w-52 overflow-hidden bg-muted shadow-lg shadow-primary/5">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={nickname || 'Avatar'}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-5xl sm:text-6xl md:text-7xl select-none">👤</span>
              )}
            </div>
          </div>

          {/* Nickname + role badge */}
          {nickname && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, type: 'spring' as const, stiffness: 200, damping: 20 }}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="text-lg font-serif font-semibold tracking-wide">
                {nickname}
              </span>
              <span className="text-[11px] tracking-widest uppercase text-muted-foreground/50 font-medium">
                Blog Owner
              </span>
            </motion.div>
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
            className="max-w-md px-6 text-center text-sm text-muted-foreground/60 italic font-serif"
          >
            「{hitokoto}」
          </motion.p>
        )}
        <motion.button
          onClick={scrollToContent}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
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
