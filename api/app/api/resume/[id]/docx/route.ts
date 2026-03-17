import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser, hasFullPlatformAccess } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseStoredResumeContent, ResumeContentSchema } from '@/lib/application-artifacts'
import {
  buildResumeDocx,
  buildResumeDocumentData,
  type ResumeTemplate,
} from '@/lib/resume-document'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

const DocxRequestSchema = z.object({
  content: ResumeContentSchema.optional(),
  template: z.enum(['classic', 'modern', 'minimal']).optional(),
})

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params
    const body = DocxRequestSchema.parse(await req.json().catch(() => ({})))

    const resume = await db.generatedResume.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            location: true,
            linkedinUrl: true,
            portfolioUrl: true,
          },
        },
        job: { select: { company: true, title: true } },
      },
    })

    if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, resume.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const content = body.content ?? parseStoredResumeContent(resume.content)
    const template = (body.template ?? resume.template) as ResumeTemplate
    const documentData = buildResumeDocumentData({
      owner: resume.user,
      content,
      template,
    })

    const showBranding = !hasFullPlatformAccess(user)
    const buffer = await buildResumeDocx(documentData, { showBranding })
    const baseName = `${documentData.name}-${resume.job?.company ?? 'resume'}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const filename = `${baseName || 'resume'}.docx`

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/resume/:id/docx]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
