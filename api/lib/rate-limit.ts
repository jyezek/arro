/**
 * Per-user sliding window rate limiter.
 *
 * Uses an in-process Map — works correctly in dev and single-instance deployments.
 * For multi-instance production (Vercel serverless), replace with @upstash/ratelimit:
 *   npm install @upstash/ratelimit @upstash/redis
 *   then swap rateLimit() to use the Upstash Ratelimit client with UPSTASH_REDIS_REST_URL
 *   and UPSTASH_REDIS_REST_TOKEN env vars.
 */

interface WindowEntry {
  count: number
  resetAt: number
}

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

// Per-feature limits — tuned to block abuse while not blocking normal use
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  match:           { limit: 3,  windowMs: 60_000 },    // 3 match runs / minute
  resume:          { limit: 10, windowMs: 60_000 },    // 10 resumes / minute
  prep_kit:        { limit: 5,  windowMs: 60_000 },    // 5 prep kits / minute
  interview_token: { limit: 5,  windowMs: 300_000 },   // 5 sessions / 5 min
  scrape:          { limit: 2,  windowMs: 60_000 },    // 2 scrape runs / minute
  default:         { limit: 60, windowMs: 60_000 },    // 60 req / minute for everything else
}

// In-process store: key = `userId:feature`
const windows = new Map<string, WindowEntry>()

// Prune stale entries every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of windows) {
    if (now >= entry.resetAt) windows.delete(key)
  }
}, 5 * 60_000)

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
  /** Seconds until reset — useful for Retry-After header */
  retryAfter: number
}

export function rateLimit(userId: string, feature: string): RateLimitResult {
  const config = RATE_LIMIT_CONFIGS[feature] ?? RATE_LIMIT_CONFIGS.default
  const key = `${userId}:${feature}`
  const now = Date.now()

  const entry = windows.get(key)

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + config.windowMs
    windows.set(key, { count: 1, resetAt })
    return { success: true, remaining: config.limit - 1, resetAt, retryAfter: 0 }
  }

  if (entry.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  entry.count++
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
    retryAfter: 0,
  }
}

/** Returns a 429 NextResponse with appropriate headers, or null if within limits. */
export function rateLimitResponse(result: RateLimitResult): Response | null {
  if (result.success) return null
  return new Response(
    JSON.stringify({ error: 'Too many requests', retryAfter: result.retryAfter }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  )
}
