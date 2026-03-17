// GET  /api/job-query-links — list saved query links
// POST /api/job-query-links — create a new query link
import { NextRequest, NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildQueryUrl, type Platform, type QueryParams } from '@/lib/job-query-url'

export async function GET() {
  try {
    const user = await getOrCreateUser()
    const links = await db.jobQueryLink.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, platform: true, params: true, url: true, createdAt: true },
    })
    return NextResponse.json({
      links: links.map((l) => ({ ...l, params: JSON.parse(l.params) as QueryParams })),
    })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[GET /api/job-query-links]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const body = await req.json() as { name?: string; platform?: Platform; params?: QueryParams }
    const { name, platform, params } = body

    if (!name?.trim() || !platform || !params?.keywords?.trim()) {
      return NextResponse.json({ error: 'name, platform, and params.keywords are required' }, { status: 400 })
    }

    const url = buildQueryUrl(platform, params)
    const link = await db.jobQueryLink.create({
      data: { userId: user.id, name: name.trim(), platform, params: JSON.stringify(params), url },
    })

    return NextResponse.json({ link: { ...link, params } }, { status: 201 })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/job-query-links]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
