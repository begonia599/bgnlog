import { motion } from 'framer-motion'
import { Lightbulb } from 'lucide-react'

export default function ThinkingPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl px-6 py-20"
        >
            <h1 className="text-2xl font-bold tracking-tight mb-2">思考</h1>
            <p className="text-sm text-muted-foreground/70 mb-16">
                写下一些碎片化的想法
            </p>

            <div className="flex flex-col items-center py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60 mb-6">
                    <Lightbulb className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-muted-foreground/60 text-sm">暂无思考</p>
                <p className="text-muted-foreground/40 text-xs mt-1">这里将展示一些碎片化的想法与感悟</p>
            </div>
        </motion.div>
    )
}
