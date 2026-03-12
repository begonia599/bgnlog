import { motion } from 'framer-motion'
import { PenLine } from 'lucide-react'

export default function NotesPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl px-6 py-20"
        >
            <h1 className="text-2xl font-bold tracking-tight mb-2">手记</h1>
            <p className="text-sm text-muted-foreground/70 mb-16">
                记录日常的碎片与灵感
            </p>

            <div className="flex flex-col items-center py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60 mb-6">
                    <PenLine className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-muted-foreground/60 text-sm">暂无手记</p>
                <p className="text-muted-foreground/40 text-xs mt-1">这里将展示日常随笔与碎片记录</p>
            </div>
        </motion.div>
    )
}
