// GET /api/prep-kit/[id] — fetch a prep kit
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { canAccessUserResource, getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  buildCandidateContext,
  generatePrepKitArtifact,
  generatePrepKitSectionArtifact,
  parseStoredPrepKitContent,
  prepKitUpdateDataFromContent,
  PREP_KIT_SECTION_KEYS,
  PrepKitContentSchema,
  type PrepKitSectionKey,
} from '@/lib/application-artifacts'

type Params = { params: Promise<{ id: string }> }

const client = new Anthropic()

const PrepKitPatchSchema = z.object({
  coverLetter: z.string().nullable().optional(),
  whyInterested: z.string().nullable().optional(),
  biggestStrength: z.string().nullable().optional(),
  elevatorPitch: z.string().nullable().optional(),
  preparationNotes: z.array(z.string()).optional(),
  salaryApproach: z.string().nullable().optional(),
  screeningAnswers: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  followUpEmails: z.array(z.object({
    stage: z.string(),
    sendAfter: z.string(),
    subject: z.string(),
    body: z.string(),
  })).optional(),
  companyBrief: z.object({
    overview: z.string().default(''),
    culture: z.string().default(''),
    recentNews: z.string().default(''),
    whyThisCompany: z.string().default(''),
  }).optional(),
  status: z.enum(['generating', 'draft', 'ready']).optional(),
})

const PrepKitRegenerateSchema = z.object({
  section: z.enum(['all', ...PREP_KIT_SECTION_KEYS]).default('all'),
})

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params

    const kit = await db.prepKit.findUnique({
      where: { id },
      include: { job: { select: { title: true, company: true } } },
    })

    if (!kit) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, kit.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({ kit })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[GET /api/prep-kit/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params
    const body = PrepKitPatchSchema.parse(await req.json())

    const existing = await db.prepKit.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        coverLetter: true,
        whyInterested: true,
        biggestStrength: true,
        elevatorPitch: true,
        preparationNotes: true,
        screeningAnswers: true,
        followUpEmails: true,
        negotiationNotes: true,
        companyResearch: true,
      },
    })

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, existing.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const currentContent = parseStoredPrepKitContent({
      coverLetter: body.coverLetter ?? existing.coverLetter,
      whyInterested: body.whyInterested ?? existing.whyInterested,
      biggestStrength: body.biggestStrength ?? existing.biggestStrength,
      elevatorPitch: body.elevatorPitch ?? existing.elevatorPitch,
      preparationNotes:
        body.preparationNotes !== undefined
          ? JSON.stringify(body.preparationNotes)
          : existing.preparationNotes,
      screeningAnswers:
        body.screeningAnswers !== undefined
          ? JSON.stringify(body.screeningAnswers)
          : existing.screeningAnswers,
      followUpEmails:
        body.followUpEmails !== undefined
          ? JSON.stringify(body.followUpEmails)
          : existing.followUpEmails,
      negotiationNotes: body.salaryApproach ?? existing.negotiationNotes,
      companyResearch:
        body.companyBrief !== undefined
          ? JSON.stringify(body.companyBrief)
          : existing.companyResearch,
    })
    const data: Record<string, unknown> = prepKitUpdateDataFromContent(currentContent)
    if (body.status) data.status = body.status

    const kit = await db.prepKit.update({
      where: { id },
      data,
      include: { job: { select: { title: true, company: true } } },
    })

    return NextResponse.json({ kit })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[PATCH /api/prep-kit/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getOrCreateUser()
    const { id } = await params
    const body = PrepKitRegenerateSchema.parse(await req.json().catch(() => ({})))

    const kit = await db.prepKit.findUnique({
      where: { id },
      include: {
        job: {
          select: { id: true, userId: true, title: true, company: true, description: true, salary: true },
        },
      },
    })

    if (!kit) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessUserResource(user, kit.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!kit.job) {
      return NextResponse.json({ error: 'Prep kit is not linked to a job' }, { status: 400 })
    }

    const candidate = await buildCandidateContext(user.id)
    const currentContent = parseStoredPrepKitContent(kit)

    const nextContent =
      body.section === 'all'
        ? await generatePrepKitArtifact(client, { candidate, job: kit.job })
        : PrepKitContentSchema.parse({
            ...currentContent,
            ...(await generatePrepKitSectionArtifact(client, {
              section: body.section as PrepKitSectionKey,
              candidate,
              job: kit.job,
              currentContent,
            })),
          })

    const updated = await db.prepKit.update({
      where: { id },
      data: {
        ...prepKitUpdateDataFromContent(nextContent),
        status: 'ready',
      },
      include: { job: { select: { title: true, company: true } } },
    })

    return NextResponse.json({ kit: updated })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/prep-kit/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
