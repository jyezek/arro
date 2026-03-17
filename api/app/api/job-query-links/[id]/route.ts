// DELETE /api/job-query-links/[id]
import { NextRequest, NextResponse } from 'next/server'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params

    const link = await db.jobQueryLink.findUnique({ where: { id } })
    if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, link.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.jobQueryLink.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[DELETE /api/job-query-links/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
