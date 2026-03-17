// PATCH /api/admin/users/:id/role
// Admin-only. Updates a user's role in Clerk privateMetadata (source of truth)
// and syncs the DB immediately. Change takes effect on the user's next request.
//
// To set roles manually without this endpoint:
//   Clerk Dashboard → Users → [select user] → Metadata → Private Metadata
//   Set: { "role": "admin" } | { "role": "tester" } | { "role": "user" }
import { NextRequest, NextResponse } from 'next/server'
import { createClerkClient } from '@clerk/backend'
import { getAuthErrorResponse, requireAdminUser } from '@/lib/auth'
import { db } from '@/lib/db'

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
const VALID_ROLES = ['user', 'tester', 'admin'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminUser()
    const { id } = await params
    const { role } = await req.json() as { role: string }

    if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      return NextResponse.json(
        { error: `role must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    if (id === admin.id && role !== 'admin') {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 403 })
    }

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, clerkId: true, role: true },
    })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Update Clerk privateMetadata — this is the source of truth
    await clerk.users.updateUserMetadata(target.clerkId, {
      privateMetadata: { role },
    })

    // Sync DB immediately so the change is visible without waiting for next login
    const updated = await db.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, role: true },
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[PATCH /api/admin/users/:id/role]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
