export interface JobListing {
  externalId: string
  source: string
  title: string
  company: string
  location: string
  url: string
  postedAt: Date | null
  salary: string | null
  jobType: string | null
  isRemote: boolean
  description: string | null
  tags: string[]
}

export interface SearchConfig {
  keywords: string[]
  booleanKeywords: string
  location: {
    city: string
    state: string
    country: string
    fullName: string
    radiusMiles: number
  } | null
  remote: boolean
  hybrid: boolean
  maxDaysOld: number
  seniorityKeywords: string[]
  employmentTypes: string[]
}

export interface ScrapeResult {
  source: string
  count: number
  newCount: number
  error?: string
}

// ─── Role keyword mapping ─────────────────────────────────────────────────────

const ROLE_KEYWORDS: Record<string, string[]> = {
  'Product Design': ['product designer', 'ux designer', 'ui designer', 'product design', 'ui/ux'],
  'Product Management': ['product manager', 'technical product manager', 'product owner', 'digital product'],
  'UX Research': ['ux researcher', 'user researcher', 'ux research', 'design researcher'],
  'Engineering': ['software engineer', 'frontend engineer', 'backend engineer', 'full stack engineer', 'web developer'],
  'Design Systems': ['design systems', 'design engineer', 'design technologist'],
  'Marketing Tech': ['marketing technology', 'martech', 'marketing operations', 'growth engineer', 'marketing engineer'],
  'Operations': ['operations manager', 'program manager', 'business operations', 'project manager'],
  'Consulting': ['consultant', 'management consultant', 'strategy consultant'],
}

const SENIORITY_KEYWORDS: Record<string, string[]> = {
  'Mid-level': ['mid', ' ii ', ' 2 ', 'associate'],
  'Senior': ['senior', 'sr.', ' sr '],
  'Staff / Principal': ['staff', 'principal', 'lead', 'tech lead'],
  'Director+': ['director', 'vp of', 'vice president', 'head of', 'cto', 'cpo', 'cdo'],
}

export function buildSearchConfig(user: {
  location: string | null
  workPreference: string | null
  employmentTypes: string[]
  targetRoleTypes: string[]
  targetSeniority: string[]
}): SearchConfig {
  // Build keyword list from target role types
  const keywords = user.targetRoleTypes.length > 0
    ? user.targetRoleTypes.flatMap(r => ROLE_KEYWORDS[r] ?? [r.toLowerCase()])
    : ['product manager', 'software engineer', 'designer'] // default fallback

  const booleanKeywords = `(${[...new Set(keywords)].map(k => `"${k}"`).join(' OR ')})`

  // Parse location from "City, State" format
  const locationParts = user.location?.split(',').map(s => s.trim()) ?? []
  const city = locationParts[0] ?? ''
  const state = locationParts[1] ?? ''

  const remote = user.workPreference === 'remote'
  const hybrid = user.workPreference === 'hybrid'

  // Seniority filter keywords
  const seniorityKeywords = user.targetSeniority.flatMap(s => SENIORITY_KEYWORDS[s] ?? [])

  return {
    keywords: [...new Set(keywords)],
    booleanKeywords,
    location: city ? { city, state, country: 'US', fullName: `${city}, ${state}`, radiusMiles: 30 } : null,
    remote,
    hybrid,
    maxDaysOld: 7,
    seniorityKeywords,
    employmentTypes: user.employmentTypes,
  }
}
