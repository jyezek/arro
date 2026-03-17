import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseStoredResumeContent, ResumeContentSchema } from '@/lib/application-artifacts'
import {
  buildResumeDocumentData,
  renderResumeHtml,
  type ResumeTemplate,
} from '@/lib/resume-document'

type Params = { params: Promise<{ id: string }> }

const PreviewRequestSchema = z.object({
  content: ResumeContentSchema.optional(),
  template: z.enum(['classic', 'modern', 'minimal']).optional(),
})

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params
    const body = PreviewRequestSchema.parse(await req.json().catch(() => ({})))

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

    return NextResponse.json({ html: renderResumeHtml(documentData) })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/resume/:id/preview]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
