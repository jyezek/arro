import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import {
  buildMasterResumeSnapshot,
  ExtractedMasterResumeSchema,
  extractStructuredResume,
  mergeExtractedResumes,
  replaceMasterResume,
  snapshotToExtractedMasterResume,
} from '@/lib/master-resume'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const body = await req.json() as {
      resumeText?: string
      source?: string
      extracted?: unknown
      merge?: boolean
    }

    const resumeText = body.resumeText?.trim()
    const source = body.source?.trim() || 'text'
    const merge = Boolean(body.merge)

    if (!resumeText && !body.extracted) {
      return NextResponse.json({ error: 'resumeText or extracted data is required' }, { status: 400 })
    }

    const extracted = body.extracted
      ? ExtractedMasterResumeSchema.parse(body.extracted)
      : await extractStructuredResume(client, resumeText as string)

    const finalExtracted = merge
      ? mergeExtractedResumes([
          snapshotToExtractedMasterResume(await buildMasterResumeSnapshot(user.id)),
          extracted,
        ])
      : extracted

    const existingText = merge ? (user.masterResumeText ?? '').trim() : ''
    const mergedResumeText = merge
      ? [existingText, resumeText ?? ''].filter(Boolean).join('\n\n---\n\n')
      : (resumeText ?? user.masterResumeText ?? '')

    await replaceMasterResume(user.id, finalExtracted, {
      masterResumeText: mergedResumeText,
      masterResumeSource: merge ? `${source}_merged` : source,
    })

    const profile = await buildMasterResumeSnapshot(user.id)
    return NextResponse.json({ profile, extracted: finalExtracted })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/profile/import]', err)
    return NextResponse.json({ error: (err as Error).message ?? 'Import failed' }, { status: 500 })
  }
}
