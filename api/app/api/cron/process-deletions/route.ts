// GET /api/cron/process-deletions
// Runs daily at 3am — permanently deletes accounts whose 30-day grace period
// has expired. Cascade deletes handle all related data via Prisma relations.
// Creates a DeletionLog entry for each purged account (GDPR audit trail).
import { NextRequest, NextResponse } from 'next/server'
import { createClerkClient } from '@clerk/backend'
import { db } from '@/lib/db'

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find all accounts whose grace period has passed
  const pendingUsers = await db.user.findMany({
    where: {
      pendingDeletionAt: { lte: now },
    },
    select: { id: true, clerkId: true, email: true },
  })

  if (!pendingUsers.length) {
    return NextResponse.json({ deleted: 0, timestamp: now.toISOString() })
  }

  let deleted = 0
  const errors: string[] = []

  for (const user of pendingUsers) {
    try {
      // Record the deletion before removing data (clerkId needed for audit)
      await db.deletionLog.create({
        data: {
          clerkId: user.clerkId,
          reason: 'user_requested',
        },
      })

      // Delete from Clerk — this invalidates all active sessions
      try {
        await clerk.users.deleteUser(user.clerkId)
      } catch (clerkErr) {
        // Clerk user may already be gone — log and continue with DB deletion
        console.error(`[process-deletions] Clerk delete failed for ${user.clerkId}`, clerkErr)
      }

      // Delete from DB — Cascade relations remove all associated data:
      // jobs, resumes, prep kits, interview sessions, credit ledger, etc.
      await db.user.delete({ where: { id: user.id } })

      deleted++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`${user.email}: ${message}`)
      console.error(`[process-deletions] Failed to delete user ${user.id}`, err)
    }
  }

  return NextResponse.json({
    deleted,
    errors: errors.length ? errors : undefined,
    timestamp: now.toISOString(),
  })
}
