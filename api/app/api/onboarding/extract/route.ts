import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { extractStructuredResume } from '@/lib/master-resume'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    await getOrCreateUser()
    const body = await req.json() as { text?: string }
    if (!body.text?.trim()) {
      return NextResponse.json({ error: 'No resume text provided' }, { status: 400 })
    }

    const extracted = await extractStructuredResume(client, body.text)
    return NextResponse.json({ extracted })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/onboarding/extract]', err)
    return NextResponse.json({ error: (err as Error).message ?? 'Extraction failed' }, { status: 500 })
  }
}
