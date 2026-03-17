// GET /api/cron/cleanup-transcripts
// Runs daily at 2am — nulls transcript data older than 90 days.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  const [interviews, deepDives] = await Promise.all([
    db.interviewSession.updateMany({
      where: { createdAt: { lt: cutoff }, transcript: { not: null } },
      data: { transcript: null, copilotHistory: null },
    }),
    db.deepDiveSession.updateMany({
      where: { createdAt: { lt: cutoff }, conversationHistory: { not: null } },
      data: { conversationHistory: null },
    }),
  ])

  return NextResponse.json({
    cleaned: { interviews: interviews.count, deepDives: deepDives.count },
    cutoff: cutoff.toISOString(),
  })
}
