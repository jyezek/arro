import { NextRequest, NextResponse } from 'next/server'
import { getAuthErrorResponse, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { cleanOptionalString, cleanStringList, computeCompanyInitials, computeDetailScore } from '@/lib/profile'
import { buildMasterResumeSnapshot } from '@/lib/master-resume'

function sanitizeExperience(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.slice(0, 20).flatMap(raw => {
    if (!raw || typeof raw !== 'object') return []

    const item = raw as Record<string, unknown>
    const roleTitle = cleanOptionalString(item.roleTitle, 150)
    const company = cleanOptionalString(item.company, 100)
    const startDate = cleanOptionalString(item.startDate, 30)
    const isCurrent = Boolean(item.isCurrent)
    const endDate = isCurrent ? null : cleanOptionalString(item.endDate, 30)

    if (!roleTitle || !company || !startDate) return []

    return [{
      id: cleanOptionalString(item.id, 80),
      roleTitle,
      company,
      startDate,
      endDate,
      isCurrent,
      description: cleanOptionalString(item.description, 5000),
      bullets: cleanStringList(item.bullets, 20, 500),
    }]
  })
}

function sanitizeEducation(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.slice(0, 12).flatMap(raw => {
    if (!raw || typeof raw !== 'object') return []

    const item = raw as Record<string, unknown>
    const institution = cleanOptionalString(item.institution, 120)
    if (!institution) return []

    return [{
      degree: cleanOptionalString(item.degree, 120),
      institution,
      fieldOfStudy: cleanOptionalString(item.fieldOfStudy, 120),
      graduationYear: cleanOptionalString(item.graduationYear, 20),
    }]
  })
}

function sanitizeProfileBody(body: Record<string, unknown>) {
  return {
    firstName: cleanOptionalString(body.firstName, 50),
    lastName: cleanOptionalString(body.lastName, 50),
    phone: cleanOptionalString(body.phone, 30),
    location: cleanOptionalString(body.location, 100),
    linkedinUrl: cleanOptionalString(body.linkedinUrl, 300),
    portfolioUrl: cleanOptionalString(body.portfolioUrl, 300),
    masterResumeText: cleanOptionalString(body.masterResumeText, 120000),
    masterResumeSource: cleanOptionalString(body.masterResumeSource, 40),
    experience: sanitizeExperience(body.experience),
    education: sanitizeEducation(body.education),
    skills: cleanStringList(body.skills, 40, 60),
  }
}

export async function GET() {
  try {
    const user = await getOrCreateUser()
    const profile = await buildMasterResumeSnapshot(user.id)
    return NextResponse.json({ profile })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[GET /api/profile]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const body = await req.json()
    const payload = sanitizeProfileBody(body)

    await db.$transaction(async tx => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          phone: payload.phone,
          location: payload.location,
          linkedinUrl: payload.linkedinUrl,
          portfolioUrl: payload.portfolioUrl,
          masterResumeText: payload.masterResumeText,
          masterResumeSource: payload.masterResumeSource,
        },
      })

      const existingExperience = await tx.experience.findMany({
        where: { userId: user.id },
        select: { id: true },
      })
      const keepExperienceIds = payload.experience.flatMap(item => item.id ? [item.id] : [])
      const existingIds = new Set(existingExperience.map(item => item.id))

      if (keepExperienceIds.length > 0) {
        await tx.experience.deleteMany({
          where: {
            userId: user.id,
            id: { notIn: keepExperienceIds.filter(id => existingIds.has(id)) },
          },
        })
      } else {
        await tx.experience.deleteMany({ where: { userId: user.id } })
      }

      for (const item of payload.experience) {
        const detailScore = computeDetailScore(item.bullets, item.startDate, item.endDate, item.isCurrent)

        if (item.id && existingIds.has(item.id)) {
          await tx.experience.update({
            where: { id: item.id },
            data: {
              roleTitle: item.roleTitle,
              company: item.company,
              companyInitials: computeCompanyInitials(item.company),
              startDate: item.startDate,
              endDate: item.endDate,
              isCurrent: item.isCurrent,
              description: item.description,
              detailScore,
            },
          })

          await tx.bullet.deleteMany({ where: { experienceId: item.id } })
          if (item.bullets.length > 0) {
            await tx.bullet.createMany({
              data: item.bullets.map(text => ({
                experienceId: item.id as string,
                text,
                source: 'user_written',
                accepted: true,
              })),
            })
          }
          continue
        }

        const created = await tx.experience.create({
          data: {
            userId: user.id,
            roleTitle: item.roleTitle,
            company: item.company,
            companyInitials: computeCompanyInitials(item.company),
            startDate: item.startDate,
            endDate: item.endDate,
            isCurrent: item.isCurrent,
            description: item.description,
            detailScore,
          },
        })

        if (item.bullets.length > 0) {
          await tx.bullet.createMany({
            data: item.bullets.map(text => ({
              experienceId: created.id,
              text,
              source: 'user_written',
              accepted: true,
            })),
          })
        }
      }

      await tx.education.deleteMany({ where: { userId: user.id } })
      if (payload.education.length > 0) {
        await tx.education.createMany({
          data: payload.education.map(item => ({
            userId: user.id,
            degree: item.degree,
            institution: item.institution,
            fieldOfStudy: item.fieldOfStudy,
            graduationYear: item.graduationYear,
          })),
        })
      }

      await tx.skill.deleteMany({ where: { userId: user.id } })
      if (payload.skills.length > 0) {
        await tx.skill.createMany({
          data: payload.skills.map(name => ({
            userId: user.id,
            name,
            category: 'other',
          })),
        })
      }
    })

    const profile = await buildMasterResumeSnapshot(user.id)
    return NextResponse.json({ profile })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[PUT /api/profile]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
