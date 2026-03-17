// GET /api/resume/[id] — fetch a generated resume
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  generateResumeArtifact,
  generateResumeSectionArtifact,
  parseStoredResumeContent,
  RESUME_SECTION_KEYS,
  ResumeContentSchema,
  serializeResumeContent,
  type ResumeSectionKey,
  buildCandidateContext,
} from '@/lib/application-artifacts'

type Params = { params: Promise<{ id: string }> }

const client = new Anthropic()

const ResumePatchSchema = z.object({
  content: ResumeContentSchema.optional(),
  template: z.string().trim().min(1).max(40).optional(),
  tailoredSections: z.array(z.string()).optional(),
  tailoringReason: z.string().nullable().optional(),
  status: z.enum(['generating', 'draft', 'ready']).optional(),
})

const ResumeRegenerateSchema = z.object({
  section: z.enum(['all', ...RESUME_SECTION_KEYS]).default('all'),
  template: z.string().trim().min(1).max(40).optional(),
})

function parseTailoredSections(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params

    const resume = await db.generatedResume.findUnique({
      where: { id },
      include: { job: { select: { title: true, company: true } } },
    })

    if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, resume.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ resume })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[GET /api/resume/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params
    const body = ResumePatchSchema.parse(await req.json())

    const existing = await db.generatedResume.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, existing.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data: Record<string, unknown> = {}
    if (body.content) data.content = serializeResumeContent(body.content)
    if (body.template) data.template = body.template
    if (body.tailoredSections) data.tailoredSections = JSON.stringify(body.tailoredSections)
    if (body.tailoringReason !== undefined) data.tailoringReason = body.tailoringReason
    if (body.status) data.status = body.status

    const resume = await db.generatedResume.update({
      where: { id },
      data,
      include: { job: { select: { title: true, company: true } } },
    })

    return NextResponse.json({ resume })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[PATCH /api/resume/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params
    const body = ResumeRegenerateSchema.parse(await req.json().catch(() => ({})))

    const resume = await db.generatedResume.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            id: true,
            userId: true,
            title: true,
            company: true,
            description: true,
            tags: true,
            location: true,
            jobType: true,
            salary: true,
          },
        },
      },
    })

    if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, resume.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!resume.job) {
      return NextResponse.json({ error: 'Resume is not linked to a job' }, { status: 400 })
    }

    const candidate = await buildCandidateContext(user.id)
    const currentContent = parseStoredResumeContent(resume.content)

    let nextContent = currentContent
    let nextTailoredSections = new Set<string>(parseTailoredSections(resume.tailoredSections))
    let nextTailoringReason = resume.tailoringReason ?? ''

    if (body.section === 'all') {
      const generated = await generateResumeArtifact(client, {
        candidate,
        job: resume.job,
      })

      nextContent = generated
      nextTailoredSections = new Set(generated.tailoredSections ?? [])
      nextTailoringReason = generated.tailoringReason ?? ''
    } else {
      const generated = await generateResumeSectionArtifact(client, {
        section: body.section as ResumeSectionKey,
        candidate,
        job: resume.job,
        currentContent,
      })

      nextContent = ResumeContentSchema.parse({
        ...currentContent,
        ...generated,
      })
      nextTailoredSections.add(body.section)
    }

    const updated = await db.generatedResume.update({
      where: { id },
      data: {
        content: serializeResumeContent(nextContent),
        template: body.template ?? resume.template,
        tailoredSections: JSON.stringify(Array.from(nextTailoredSections)),
        tailoringReason: nextTailoringReason || null,
        status: 'ready',
      },
      include: { job: { select: { title: true, company: true } } },
    })

    return NextResponse.json({ resume: updated })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/resume/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
