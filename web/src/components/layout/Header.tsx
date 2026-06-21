import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useState, useEffect, useRef } from 'react'
import { SearchBar } from '@/components/common/SearchBar'
import { motion, useMotionValueEvent, useScroll, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Sun, Moon, Search, X, UserCircle, ChevronDown, Menu } from 'lucide-react'

const navItems = [
  { label: '首页', path: '/' },
  { label: '文稿', path: '/posts' },
  { label: '手记', path: '/notes' },
  { label: '时光', path: '/timeline' },
  { label: '专区', path: '/zone' },
]

const moreItems = [
  { label: '友人', path: '/friends' },
  { label: '搜索', path: '/search' },
]

export function Header() {
  const { user, logout, isEditor } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [showSearch, setShowSearch] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [visible, setVisible] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()
  const lastScrollY = useRef(0)

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const delta = latest - lastScrollY.current
    if (latest < 50) {
      setVisible(true)
      setScrolled(false)
    } else {
      setScrolled(true)
      if (delta < -5) setVisible(true)
      else if (delta > 5) setVisible(false)
    }
    lastScrollY.current = latest
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch((s) => !s)
      }
      if (e.key === 'Escape') {
        setShowSearch(false)
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  // Run an action (navigate / logout) then close the mobile menu.
  const handleMobileAction = (action: () => void) => {
    action()
    setMobileMenuOpen(false)
  }
  const mobileItemClass =
    'text-left rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors'

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{
          y: visible ? 0 : -100,
          opacity: visible ? 1 : 0,
        }}
        transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
        className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4"
      >
        <nav
          className={cn(
            'flex items-center gap-0.5 rounded-full px-2 py-1.5',
            'bg-gradient-to-b from-white/80 to-white/60',
            'dark:from-zinc-900/70 dark:to-zinc-800/90',
            'backdrop-blur-md',
            'ring-1 ring-black/[0.06] dark:ring-white/[0.08]',
            'transition-shadow duration-300',
            scrolled && 'shadow-lg shadow-black/[0.04] dark:shadow-black/[0.2]',
          )}
        >
          {/* Logo + site name */}
          <Link to="/" className="flex items-center gap-1.5 rounded-full px-2 py-1 mr-1">
            <img src="/logo.png" alt="海棠小栈" className="h-5 w-5 rounded-sm" />
            <span className="text-sm font-serif font-semibold tracking-wide hidden sm:inline">海棠小栈</span>
          </Link>

          <span className="h-4 w-px bg-border/50 mx-0.5 hidden md:inline-block" />

          {/* Nav items — desktop only */}
          <div className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm transition-colors duration-200',
                  isActive(item.path)
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground/70 hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}

            {/* More dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'flex items-center gap-0.5 rounded-full px-3 py-1.5 text-sm',
                  'text-muted-foreground/70 hover:text-foreground transition-colors duration-200',
                  'outline-none',
                )}
              >
                更多
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-32 mt-2">
                {moreItems.map((item) => (
                  <DropdownMenuItem key={item.path} onClick={() => navigate(item.path)}>
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mx-0.5 h-4 w-px bg-border/60" />

          {/* Utility buttons */}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-8 w-8 p-0"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-8 w-8 p-0"
            onClick={toggleTheme}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center"
              >
                {theme === 'light' ? (
                  <Moon className="h-3.5 w-3.5" />
                ) : (
                  <Sun className="h-3.5 w-3.5" />
                )}
              </motion.span>
            </AnimatePresence>
          </Button>

          {/* User + login — desktop only */}
          <div className="hidden md:flex items-center">
          <div className="mx-0.5 h-4 w-px bg-border/60" />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'rounded-full h-8 gap-1.5 px-2',
                )}
              >
                <Avatar className="h-5 w-5">
                  {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                  <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                    {user.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs max-w-[60px] truncate hidden sm:inline">
                  {user.nickname || user.username}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 mt-2">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.nickname || user.username}</p>
                  <p className="text-xs text-muted-foreground">{user.role}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <UserCircle className="h-4 w-4 mr-2" />
                  个人资料
                </DropdownMenuItem>
                {isEditor && (
                  <DropdownMenuItem onClick={() => navigate('/editor')}>
                    写文章
                  </DropdownMenuItem>
                )}
                {isEditor && (
                  <DropdownMenuItem onClick={() => navigate('/drafts')}>
                    草稿箱
                  </DropdownMenuItem>
                )}
                {user.role === 'admin' && (
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    管理
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/login"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'rounded-full h-8 px-3 text-xs',
              )}
            >
              登录
            </Link>
          )}
          </div>

          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="菜单"
            aria-expanded={mobileMenuOpen}
            className="md:hidden flex items-center justify-center rounded-full h-8 w-8 ml-0.5 text-muted-foreground/80 hover:text-foreground transition-colors outline-none"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </nav>
      </motion.header>

      {/* Search overlay */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4"
          >
            <div
              className="absolute inset-0 bg-background/60 backdrop-blur-sm"
              onClick={() => setShowSearch(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
              className="relative w-full max-w-lg"
            >
              <div className="rounded-2xl bg-card/95 backdrop-blur-md p-4 ring-1 ring-border/50 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">搜索文章</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 rounded-full"
                    onClick={() => setShowSearch(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <SearchBar
                  onSearch={(q) => {
                    navigate(`/search?q=${encodeURIComponent(q)}`)
                    setShowSearch(false)
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <div
              className="absolute inset-0 bg-background/40 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
              className="absolute left-4 right-4 top-20 mx-auto max-w-xs"
            >
              <div className="rounded-2xl bg-card/95 backdrop-blur-md p-2 ring-1 ring-border/50 shadow-xl">
                <nav className="flex flex-col">
                  {[...navItems, ...moreItems].map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'rounded-xl px-4 py-2.5 text-sm transition-colors',
                        isActive(item.path)
                          ? 'bg-secondary text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>

                <div className="my-2 h-px bg-border/50" />

                {user ? (
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 px-4 py-2">
                      <Avatar className="h-6 w-6">
                        {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                        <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                          {user.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="leading-tight">
                        <p className="text-sm font-medium">{user.nickname || user.username}</p>
                        <p className="text-xs text-muted-foreground">{user.role}</p>
                      </div>
                    </div>
                    <button className={mobileItemClass} onClick={() => handleMobileAction(() => navigate('/profile'))}>
                      个人资料
                    </button>
                    {isEditor && (
                      <button className={mobileItemClass} onClick={() => handleMobileAction(() => navigate('/editor'))}>
                        写文章
                      </button>
                    )}
                    {isEditor && (
                      <button className={mobileItemClass} onClick={() => handleMobileAction(() => navigate('/drafts'))}>
                        草稿箱
                      </button>
                    )}
                    {user.role === 'admin' && (
                      <button className={mobileItemClass} onClick={() => handleMobileAction(() => navigate('/admin'))}>
                        管理
                      </button>
                    )}
                    <button className={mobileItemClass} onClick={() => handleMobileAction(() => logout())}>
                      退出登录
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="block rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
                  >
                    登录
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
