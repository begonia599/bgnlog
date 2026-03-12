import { motion } from 'framer-motion'
import { Users } from 'lucide-react'

export default function FriendsPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl px-6 py-20"
        >
            <h1 className="text-2xl font-bold tracking-tight mb-2">友人</h1>
            <p className="text-sm text-muted-foreground/70 mb-16">
                海内存知己，天涯若比邻
            </p>

            <div className="flex flex-col items-center py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60 mb-6">
                    <Users className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-muted-foreground/60 text-sm">暂无友链</p>
                <p className="text-muted-foreground/40 text-xs mt-1">后续将在此展示友情链接</p>
            </div>
        </motion.div>
    )
}
