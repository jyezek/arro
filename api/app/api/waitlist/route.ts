// POST /api/waitlist
import { NextRequest, NextResponse } from 'next/server'
import { resolveAppBaseUrl } from '@/app/app-base-url'
import { db } from '@/lib/db'
import { handleWaitlistEmails } from '@/lib/waitlist-email'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; name?: string; source?: string }
    const email = body.email?.trim().toLowerCase()
    const name = body.name?.trim() || null
    const source = body.source?.trim() || null

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    let isNewSignup = false

    const existing = await db.waitlistEntry.findUnique({
      where: { email },
      select: { id: true },
    })

    if (!existing) {
      try {
        await db.waitlistEntry.create({
          data: { email, name, source },
        })
        isNewSignup = true
      } catch (err) {
        if (!isUniqueConstraintError(err)) {
          throw err
        }
      }
    }

    await handleWaitlistEmails({
      email,
      name,
      source,
      appUrl: resolveAppBaseUrl(),
      isNewSignup,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/waitlist]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
