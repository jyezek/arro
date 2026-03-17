// GET /api/user — bootstrap or fetch the current authenticated user
// PATCH /api/user — update mutable profile fields
import { NextRequest, NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  cleanOptionalString,
  cleanStringList,
  normalizeEmploymentTypes,
  normalizeEquityImportance,
  normalizeSalaryFlexibility,
  normalizeWorkPreference,
  parseRelocationPreference,
  parseSalaryInput,
} from '@/lib/profile'

const ALLOWED_FIELDS = new Set([
  'firstName', 'lastName', 'phone', 'location', 'portfolioUrl', 'linkedinUrl',
  'targetSalary', 'salaryFlexibility', 'workPreference', 'employmentTypes',
  'targetRoleTypes', 'targetSeniority', 'targetIndustries', 'willingToRelocate',
  'equityImportance',
])

export async function GET() {
  try {
    const user = await getOrCreateUser()
    return NextResponse.json({ user })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[GET /api/user]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const body = await req.json()

    // Only allow whitelisted fields
    const data: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(body)) {
      if (!ALLOWED_FIELDS.has(key)) continue

      if (key === 'firstName' || key === 'lastName') data[key] = cleanOptionalString(val, 50)
      else if (key === 'phone') data[key] = cleanOptionalString(val, 30)
      else if (key === 'location') data[key] = cleanOptionalString(val, 100)
      else if (key === 'portfolioUrl' || key === 'linkedinUrl') data[key] = cleanOptionalString(val, 300)
      else if (key === 'targetSalary') data[key] = parseSalaryInput(val)
      else if (key === 'salaryFlexibility') data[key] = normalizeSalaryFlexibility(val)
      else if (key === 'workPreference') data[key] = normalizeWorkPreference(val)
      else if (key === 'employmentTypes') data[key] = normalizeEmploymentTypes(val)
      else if (key === 'targetRoleTypes') data[key] = cleanStringList(val, 12, 80)
      else if (key === 'targetSeniority') data[key] = cleanStringList(val, 6, 60)
      else if (key === 'targetIndustries') data[key] = cleanStringList(val, 12, 60)
      else if (key === 'willingToRelocate') data[key] = parseRelocationPreference(val)
      else if (key === 'equityImportance') data[key] = normalizeEquityImportance(val)
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const updated = await db.user.update({ where: { id: user.id }, data })
    return NextResponse.json({ user: updated })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[PATCH /api/user]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
