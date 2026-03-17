// POST /api/webhooks/clerk
// Syncs Clerk user lifecycle events to the database.
// Configure in Clerk dashboard: Webhooks → add endpoint → select user.created, user.updated, user.deleted
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type ClerkUserEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted'
  data: {
    id: string
    email_addresses?: Array<{ email_address: string }>
    first_name?: string | null
    last_name?: string | null
    deleted?: boolean
  }
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret || secret.startsWith('whsec_...')) {
    console.warn('[clerk-webhook] CLERK_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const headersList = await headers()
  const svixId = headersList.get('svix-id')
  const svixTimestamp = headersList.get('svix-timestamp')
  const svixSignature = headersList.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await req.text()
  let evt: ClerkUserEvent

  try {
    evt = new Webhook(secret).verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserEvent
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const { id: clerkId } = evt.data

  try {
    switch (evt.type) {
      case 'user.created':
      case 'user.updated': {
        const email = evt.data.email_addresses?.[0]?.email_address
        if (!email) break

        const firstName = evt.data.first_name ?? null
        const lastName = evt.data.last_name ?? null

        await db.user.upsert({
          where: { clerkId },
          create: {
            clerkId,
            email,
            firstName,
            lastName,
            creditBalance: 20,
            creditsIncludedMonthly: 20,
            lastCreditReset: new Date(),
          },
          update: {
            email,
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
          },
        })
        break
      }

      case 'user.deleted': {
        // Mark for async deletion — the cron/process-deletions job handles the actual purge
        await db.user.updateMany({
          where: { clerkId },
          data: { pendingDeletionAt: new Date() },
        })
        break
      }
    }
  } catch (err) {
    console.error('[clerk-webhook] failed to process event', evt.type, err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
