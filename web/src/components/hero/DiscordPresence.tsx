import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LanyardData {
  discord_status: 'online' | 'idle' | 'dnd' | 'offline'
  activities: Array<{
    name: string
    type: number
    state?: string
    details?: string
    application_id?: string
    assets?: {
      large_text?: string
      large_image?: string
      small_text?: string
      small_image?: string
    }
  }>
  listening_to_spotify: boolean
  spotify?: {
    song: string
    artist: string
    album: string
    album_art_url: string
  }
}

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  idle: 'bg-amber-400',
  dnd: 'bg-red-500',
  offline: 'bg-gray-400',
}

const statusLabels: Record<string, string> = {
  online: '在线',
  idle: '离开',
  dnd: '请勿打扰',
  offline: '离线',
}

// Activity type mapping: https://discord.com/developers/docs/topics/gateway-events#activity-object-activity-types
const activityVerbs: Record<number, string> = {
  0: '正在玩',    // Playing
  1: '正在直播',  // Streaming
  2: '正在听',    // Listening
  3: '正在看',    // Watching
  4: '',          // Custom
  5: '正在竞技',  // Competing
}

export function DiscordPresence({ userId }: { userId: string }) {
  const [data, setData] = useState<LanyardData | null>(null)

  useEffect(() => {
    if (!userId) return

    // Initial fetch
    fetch(`https://api.lanyard.rest/v1/users/${userId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data)
      })
      .catch(() => {})

    // WebSocket for real-time updates
    const ws = new WebSocket('wss://api.lanyard.rest/socket')
    let heartbeatInterval: ReturnType<typeof setInterval>

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      if (msg.op === 1) {
        // Hello — send init + start heartbeat
        ws.send(JSON.stringify({
          op: 2,
          d: { subscribe_to_id: userId },
        }))
        heartbeatInterval = setInterval(() => {
          ws.send(JSON.stringify({ op: 3 }))
        }, msg.d.heartbeat_interval)
      }

      if (msg.op === 0 && msg.d) {
        setData(msg.d)
      }
    }

    ws.onerror = () => ws.close()

    return () => {
      clearInterval(heartbeatInterval)
      ws.close()
    }
  }, [userId])

  if (!data) return null

  const status = data.discord_status
  // Get the primary non-custom activity
  const activity = data.activities?.find((a) => a.type !== 4)
  const customStatus = data.activities?.find((a) => a.type === 4)

  // Nothing interesting to show if offline with no activity
  if (status === 'offline' && !activity && !customStatus) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="flex items-center gap-2.5 rounded-full bg-secondary/80 backdrop-blur-sm px-3.5 py-2 text-xs"
      >
        {/* Status dot */}
        <span className="relative flex h-2 w-2">
          {status !== 'offline' && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${statusColors[status]}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${statusColors[status]}`} />
        </span>

        {/* Activity text */}
        <span className="text-muted-foreground">
          {data.listening_to_spotify && data.spotify ? (
            <>
              🎵 正在听{' '}
              <span className="font-medium text-foreground">{data.spotify.song}</span>
              {' — '}
              <span className="text-muted-foreground/70">{data.spotify.artist}</span>
            </>
          ) : activity ? (
            <>
              {activityVerbs[activity.type] || '正在'}{' '}
              <span className="font-medium text-foreground">{activity.name}</span>
              {activity.details && (
                <span className="text-muted-foreground/70"> · {activity.details}</span>
              )}
            </>
          ) : customStatus?.state ? (
            <span className="text-muted-foreground">{customStatus.state}</span>
          ) : (
            <span className="text-muted-foreground">{statusLabels[status]}</span>
          )}
        </span>
      </motion.div>
    </AnimatePresence>
  )
}
