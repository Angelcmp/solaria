export const MATTER_TYPES: { value: string; label: string }[] = [
  { value: 'civil', label: 'Civil' },
  { value: 'laboral', label: 'Laboral' },
  { value: 'penal', label: 'Penal' },
  { value: 'mercantil', label: 'Mercantil' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'familiar', label: 'Familiar' },
  { value: 'otro', label: 'Otro' },
]

export function matterLabel(value: string): string {
  return MATTER_TYPES.find(t => t.value === value)?.label || value
}

export function formatDate(date: string): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function daysUntil(date: string): number {
  if (!date) return 0
  const target = new Date(date).setHours(0, 0, 0, 0)
  const today = new Date().setHours(0, 0, 0, 0)
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24))
}

export function deadlineLabel(days: number): string {
  if (days < 0) return `venció hace ${Math.abs(days)}d`
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  return `en ${days}d`
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = 60000
  const hour = 3600000
  const day = 86400000
  const week = 604800000
  const month = 2592000000
  if (diff < min) return 'ahora'
  if (diff < hour) return `${Math.round(diff / min)}m`
  if (diff < day) return `${Math.round(diff / hour)}h`
  if (diff < week) return `${Math.round(diff / day)}d`
  if (diff < month) return `${Math.round(diff / week)}s`
  return `${Math.round(diff / month)}M`
}

export function scaleBadge(count: number): string {
  if (count === 0) return '0'
  return count > 99 ? '99+' : count.toString()
}
