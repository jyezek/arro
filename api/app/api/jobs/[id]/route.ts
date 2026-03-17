// GET    /api/jobs/[id] — fetch single job detail
// PATCH  /api/jobs/[id] — update job flags (isSaved, isHidden, status, notes)
// DELETE /api/jobs/[id] — delete a job
import { NextRequest, NextResponse } from 'next/server'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { track } from '@/lib/analytics'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params

    const job = await db.job.findUnique({
      where: { id },
      include: {
        generatedResumes: { orderBy: { createdAt: 'desc' }, take: 1 },
        prepKits: { orderBy: { createdAt: 'desc' }, take: 1 },
        companyResearchItems: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, job.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ job })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[GET /api/jobs/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params
    const body = await req.json()

    // Verify ownership
    const job = await db.job.findUnique({ where: { id }, select: { userId: true } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, job.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const allowed = ['isSaved', 'isHidden', 'isSeen', 'status', 'notes', 'nextStep', 'appliedAt']
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const updated = await db.job.update({ where: { id }, data })

    if (data.isSaved === true) {
      track(user.id, 'job_saved', { jobId: id })
    }

    return NextResponse.json({ job: updated })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[PATCH /api/jobs/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params

    const job = await db.job.findUnique({ where: { id }, select: { userId: true } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, job.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await db.job.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[DELETE /api/jobs/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
