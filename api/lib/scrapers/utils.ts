import type { SearchConfig } from './types'

export const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
}

export const JSON_HEADERS = {
  ...BROWSER_HEADERS,
  'Accept': 'application/json, text/plain, */*',
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function parseRelativeDate(text: string): Date | null {
  if (!text) return null
  const t = text.toLowerCase().trim()
  const now = new Date()
  if (t.includes('just now') || t.includes('today') || t.includes('hour')) return now
  const match = t.match(/(\d+)\s*(day|week|month|minute)/i)
  if (!match) return null
  const n = parseInt(match[1])
  const unit = match[2].toLowerCase()
  if (unit === 'minute') return new Date(now.getTime() - n * 60000)
  if (unit === 'hour') return new Date(now.getTime() - n * 3600000)
  if (unit === 'day') return new Date(now.getTime() - n * 86400000)
  if (unit === 'week') return new Date(now.getTime() - n * 7 * 86400000)
  if (unit === 'month') return new Date(now.getTime() - n * 30 * 86400000)
  return null
}

export function isWithinDays(date: Date | null, maxDays: number): boolean {
  if (!date) return true // include jobs with unknown date
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - maxDays)
  return date >= cutoff
}

export function matchesKeywords(text: string, config: SearchConfig): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return config.keywords.some(k => lower.includes(k.toLowerCase()))
}

export function truncate(text: string | null | undefined, maxLen = 800): string | null {
  if (!text) return null
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

export function deduplicateByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

export function normalizeJobType(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.toLowerCase()
  if (t.includes('full')) return 'full-time'
  if (t.includes('part')) return 'part-time'
  if (t.includes('contract') || t.includes('freelance')) return 'contract'
  if (t.includes('intern')) return 'internship'
  if (t.includes('remote')) return 'remote'
  return raw.toLowerCase()
}
