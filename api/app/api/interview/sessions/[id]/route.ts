// GET /api/interview/sessions/[id] — fetch a single session including debrief
import { NextRequest, NextResponse } from 'next/server'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params

    const session = await db.interviewSession.findUnique({
      where: { id },
      include: {
        job: { select: { id: true, title: true, company: true } },
      },
    })

    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, session.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const debrief = session.debrief
      ? (JSON.parse(session.debrief) as {
          overallScore: number
          strengths: string[]
          improvements: string[]
          summary: string
        })
      : null

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        questionsAnswered: session.questionsAnswered,
        avgConfidence: session.avgConfidence,
        durationSeconds: session.durationSeconds,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        job: session.job,
        debrief,
      },
    })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[GET /api/interview/sessions/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
