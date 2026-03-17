// POST /api/scrape — trigger job scraping for the authenticated user
// Uses user preferences to build search config, runs all scrapers in parallel
import { NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { runAllScrapers } from '@/lib/scrapers'
import { buildSearchConfig } from '@/lib/scrapers/types'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const maxDuration = 300 // 5 minutes — scraping takes time

export async function POST() {
  try {
    const user = await getOrCreateUser()

    const limited = rateLimitResponse(rateLimit(user.id, 'scrape'))
    if (limited) return limited

    // Build search config from user preferences
    const config = buildSearchConfig({
      location: user.location,
      workPreference: user.workPreference,
      employmentTypes: user.employmentTypes,
      targetRoleTypes: user.targetRoleTypes,
      targetSeniority: user.targetSeniority,
    })

    console.log(`[scrape] user=${user.id} keywords=${config.keywords.slice(0, 3).join(', ')} remote=${config.remote}`)

    const result = await runAllScrapers(user.id, config)

    return NextResponse.json({
      total: result.total,
      newCount: result.newCount,
      results: result.results,
    })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/scrape]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
