import { NextRequest, NextResponse } from 'next/server'
import { getAuthErrorResponse, requireAdminUser } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

function normalizeRole(value: unknown): 'user' | 'admin' | null {
  if (value === 'user' || value === 'admin') return value
  return null
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requireAdminUser()
    const { id } = await params
    const body = await req.json()

    const role = normalizeRole(body.role)
    const suspended = typeof body.suspended === 'boolean' ? body.suspended : null

    const data: { role?: 'user' | 'admin'; suspended?: boolean } = {}
    if (role) data.role = role
    if (suspended !== null) data.suspended = suspended

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    if (id === admin.id) {
      if (data.role && data.role !== 'admin') {
        return NextResponse.json({ error: 'Admins cannot remove their own admin access' }, { status: 400 })
      }
      if (data.suspended) {
        return NextResponse.json({ error: 'Admins cannot suspend themselves' }, { status: 400 })
      }
    }

    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        suspended: true,
        subscriptionStatus: true,
        creditBalance: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ user: updated })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[PATCH /api/admin/users/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
