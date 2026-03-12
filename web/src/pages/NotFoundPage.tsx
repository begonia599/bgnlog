import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-24 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground/30 mb-4">404</h1>
      <p className="text-lg text-muted-foreground mb-8">页面未找到</p>
      <Link to="/" className={cn(buttonVariants({ variant: 'outline' }))}>
        返回首页
      </Link>
    </div>
  )
}
