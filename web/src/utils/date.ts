import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export function formatDate(date: string | null | undefined): string {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD')
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

export function timeAgo(date: string): string {
  return dayjs(date).fromNow()
}
