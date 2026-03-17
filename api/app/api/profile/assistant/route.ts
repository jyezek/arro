import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { buildMasterResumeSnapshot, buildUserSummaryForAssistant, generateRoleAssistantResponse } from '@/lib/master-resume'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const body = await req.json() as {
      roleId?: string
      role?: {
        roleTitle?: string
        company?: string
        startDate?: string
        endDate?: string | null
        description?: string | null
        bullets?: string[]
      }
      additionalContext?: string
    }

    const snapshot = await buildMasterResumeSnapshot(user.id)
    const existingRole = body.roleId
      ? snapshot.experience.find(item => item.id === body.roleId)
      : null

    const role = existingRole ?? (
      body.role?.roleTitle?.trim() && body.role.company?.trim() && body.role.startDate?.trim()
        ? {
            id: 'draft',
            roleTitle: body.role.roleTitle.trim(),
            company: body.role.company.trim(),
            startDate: body.role.startDate.trim(),
            endDate: body.role.endDate?.trim() || null,
            isCurrent: !body.role.endDate?.trim(),
            description: body.role.description?.trim() || null,
            bullets: (body.role.bullets ?? []).map(item => item.trim()).filter(Boolean),
            detailScore: 0,
          }
        : null
    )

    if (!role) {
      return NextResponse.json({ error: 'A valid role is required' }, { status: 400 })
    }

    const assistant = await generateRoleAssistantResponse(client, {
      role: {
        roleTitle: role.roleTitle,
        company: role.company,
        startDate: role.startDate,
        endDate: role.endDate,
        description: role.description,
        bullets: role.bullets,
      },
      userSummary: buildUserSummaryForAssistant(snapshot),
      additionalContext: body.additionalContext,
    })

    return NextResponse.json({ assistant })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/profile/assistant]', err)
    return NextResponse.json({ error: (err as Error).message ?? 'Assistant request failed' }, { status: 500 })
  }
}
