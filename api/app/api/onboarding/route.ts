// POST /api/onboarding — persist preferences collected during onboarding flow
import { NextRequest, NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  cleanStringList,
  normalizeEmploymentTypes,
  normalizeEquityImportance,
  normalizeSalaryFlexibility,
  normalizeWorkPreference,
  parseRelocationPreference,
  parseSalaryInput,
} from '@/lib/profile'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const body = await req.json()

    const {
      salary,          // e.g. "$120k"
      salaryFlexibility, // "Firm" | "Flexible" | "Negotiable"
      workPreference,  // "Remote" | "Hybrid" | "On-site"
      employmentTypes, // string[]
      targetRoles,     // string[]
      seniority,       // string
      industries,      // string[]
      relocation,      // "Yes" | "No" | "Maybe"
      equity,          // "Important" | "Nice to have" | "Not a factor"
    } = body

    await db.user.update({
      where: { id: user.id },
      data: {
        targetSalary: parseSalaryInput(salary),
        salaryFlexibility: normalizeSalaryFlexibility(salaryFlexibility),
        workPreference: normalizeWorkPreference(workPreference),
        employmentTypes: normalizeEmploymentTypes(employmentTypes),
        targetRoleTypes: cleanStringList(targetRoles, 12, 80),
        targetSeniority: cleanStringList(Array.isArray(seniority) ? seniority : seniority ? [seniority] : [], 6, 60),
        targetIndustries: cleanStringList(industries, 12, 60),
        willingToRelocate: parseRelocationPreference(relocation),
        equityImportance: normalizeEquityImportance(equity),
        onboardingComplete: true,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/onboarding]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
