import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/30 dark:border-border/20">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          {/* Nav links */}
          <nav className="flex items-center gap-6 text-sm text-muted-foreground/70">
            <Link to="/" className="transition-colors hover:text-foreground">
              首页
            </Link>
            <Link to="/archives" className="transition-colors hover:text-foreground">
              归档
            </Link>
            <Link to="/search" className="transition-colors hover:text-foreground">
              搜索
            </Link>
          </nav>

          {/* Tech stack */}
          <p className="text-xs text-muted-foreground/40">
            Go + React + Tailwind
          </p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground/40">
            &copy; {new Date().getFullYear()} Blog. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
