// POST /api/track — record a client-side analytics event from the Expo app.
// Only a fixed allowlist of events is accepted to prevent arbitrary data injection.
import { NextRequest, NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { track } from '@/lib/analytics'

const ALLOWED_EVENTS = new Set([
  'onboarding_completed',
  'upgrade_prompted',
  'resume_uploaded',
  'onboarding_step_viewed',
])

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const { event, properties } = await req.json() as {
      event: string
      properties?: Record<string, unknown>
    }

    if (!ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
    }

    // Enrich onboarding_completed with the signup path from the user record
    const enriched = { ...properties }
    if (event === 'onboarding_completed' && user.masterResumeSource) {
      enriched.signupSource = user.masterResumeSource
    }

    track(user.id, event, enriched)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/track]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
