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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useState, useEffect, useRef } from 'react'
import { SearchBar } from '@/components/common/SearchBar'
import { motion, useMotionValueEvent, useScroll, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Sun, Moon, Search, X, UserCircle, ChevronDown } from 'lucide-react'

const navItems = [
  { label: '首页', path: '/' },
  { label: '文稿', path: '/posts' },
  { label: '手记', path: '/notes' },
  { label: '时光', path: '/timeline' },
  { label: '思考', path: '/thinking' },
]

const moreItems = [
  { label: '友人', path: '/friends' },
  { label: '归档', path: '/archives' },
  { label: '搜索', path: '/search' },
]

export function Header() {
  const { user, logout, isEditor } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [showSearch, setShowSearch] = useState(false)
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
      if (e.key === 'Escape') setShowSearch(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

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
          {/* Nav items */}
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

          <div className="mx-0.5 h-4 w-px bg-border/60" />

          {/* User */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'rounded-full h-8 gap-1.5 px-2',
                )}
              >
                <Avatar className="h-5 w-5">
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
    </>
  )
}
