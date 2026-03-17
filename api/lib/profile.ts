const ACTION_VERBS = [
  'built',
  'created',
  'designed',
  'drove',
  'executed',
  'grew',
  'improved',
  'increased',
  'launched',
  'led',
  'managed',
  'optimized',
  'owned',
  'reduced',
  'shipped',
  'scaled',
]

export function cleanOptionalString(value: unknown, maxLen = 200): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim().slice(0, maxLen)
  return cleaned.length ? cleaned : null
}

export function cleanStringList(value: unknown, maxItems = 12, maxLen = 80): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const items: string[] = []

  for (const raw of value) {
    if (typeof raw !== 'string') continue
    const cleaned = raw.trim().slice(0, maxLen)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push(cleaned)
    if (items.length >= maxItems) break
  }

  return items
}

export function normalizeWorkPreference(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '-')
  if (normalized === 'remote') return 'remote'
  if (normalized === 'hybrid') return 'hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'onsite'
  return null
}

export function normalizeEmploymentTypes(value: unknown): string[] {
  const values = Array.isArray(value) ? value : []
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const raw of values) {
    if (typeof raw !== 'string') continue
    const val = raw.trim().toLowerCase()
    const mapped =
      val === 'full-time' || val === 'full time' ? 'full-time' :
      val === 'part-time' || val === 'part time' ? 'part-time' :
      val === 'contract' ? 'contract' :
      val === 'freelance' ? 'freelance' :
      null

    if (!mapped || seen.has(mapped)) continue
    seen.add(mapped)
    normalized.push(mapped)
  }

  return normalized
}

export function normalizeSalaryFlexibility(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '-')
  if (normalized === 'firm' || normalized === 'flexible' || normalized === 'negotiable') return normalized
  return null
}

export function normalizeEquityImportance(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '-')
  if (normalized === 'important' || normalized === 'nice-to-have' || normalized === 'not-a-factor') return normalized
  return null
}

export function parseSalaryInput(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampSalary(Math.round(value))
  }

  if (typeof value !== 'string') return null
  const digits = value.replace(/[^0-9]/g, '')
  if (!digits) return null
  return clampSalary(parseInt(digits, 10))
}

function clampSalary(value: number): number | null {
  if (!Number.isFinite(value)) return null
  if (value < 0) return 0
  if (value > 1000) return 1000
  return value
}

export function parseRelocationPreference(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'yes' || normalized === 'true') return true
  if (normalized === 'no' || normalized === 'false') return false
  return null
}

export function computeCompanyInitials(company: string): string {
  const words = company
    .split(/[\s/&,-]+/)
    .map(part => part.trim())
    .filter(Boolean)

  if (words.length === 0) return 'AR'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
}

export function computeDetailScore(bullets: string[], startDate: string | null, endDate: string | null, isCurrent: boolean): number {
  const bulletCount = bullets.length
  const bulletPoints =
    bulletCount >= 4 ? 45 :
    bulletCount === 3 ? 35 :
    bulletCount === 2 ? 25 :
    bulletCount === 1 ? 15 :
    0

  const metricPoints = Math.min(
    30,
    bullets.filter(bullet => /\d|%/.test(bullet)).length * 10
  )

  const verbPoints = Math.min(
    15,
    bullets.filter(bullet => {
      const firstWord = bullet.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
      return ACTION_VERBS.includes(firstWord)
    }).length * 5
  )

  const hasStart = Boolean(startDate?.trim())
  const hasEnd = isCurrent || Boolean(endDate?.trim())
  const datePoints = hasStart && hasEnd ? 10 : hasStart || hasEnd ? 5 : 0

  return Math.min(100, bulletPoints + metricPoints + verbPoints + datePoints)
}
