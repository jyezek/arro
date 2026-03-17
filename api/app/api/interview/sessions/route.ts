// GET /api/interview/sessions — list interview sessions for the user
import { NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const user = await getOrCreateUser()

    const sessions = await db.interviewSession.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        status: true,
        questionsAnswered: true,
        avgConfidence: true,
        startedAt: true,
        completedAt: true,
        job: { select: { id: true, title: true, company: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ sessions })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[GET /api/interview/sessions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
