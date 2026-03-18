// POST /api/waitlist
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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

    await db.waitlistEntry.upsert({
      where: { email },
      create: { email, name, source },
      update: {},  // already on list — don't overwrite, just ack
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/waitlist]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
