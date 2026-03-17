// GET /api/research/[id] — fetch a company research artifact
import { NextRequest, NextResponse } from 'next/server'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params

    const research = await db.companyResearch.findUnique({
      where: { id },
      include: { job: { select: { title: true, company: true } } },
    })

    if (!research) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, research.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ research })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[GET /api/research/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
