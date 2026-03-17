// GET  /api/jobs — list jobs for current user
// POST /api/jobs — manually add a job
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getAuthErrorResponse, getOrCreateUser, hasFullPlatformAccess } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  buildRemoteRegionPolicyLabel,
  getRemoteRegionPolicy,
  isAllowedJobListing,
} from '@/lib/job-search'

type JobSort = 'match' | 'newest' | 'oldest'
type JobPreset = 'all' | 'remote' | 'saved' | 'applied' | 'high_match'

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseSort(value: string | null): JobSort {
  if (value === 'newest' || value === 'oldest') return value
  return 'match'
}

function parsePreset(value: string | null): JobPreset {
  if (value === 'remote' || value === 'saved' || value === 'applied' || value === 'high_match') {
    return value
  }
  return 'all'
}

function parseMultiValue(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function asWhereArray(value: Prisma.JobWhereInput | Prisma.JobWhereInput[] | undefined): Prisma.JobWhereInput[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function createOrderBy(sort: JobSort): Prisma.JobOrderByWithRelationInput[] {
  if (sort === 'newest') {
    return [{ postedAt: 'desc' }, { createdAt: 'desc' }]
  }
  if (sort === 'oldest') {
    return [{ postedAt: 'asc' }, { createdAt: 'asc' }]
  }
  return [{ matchScore: 'desc' }, { postedAt: 'desc' }, { createdAt: 'desc' }]
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const { searchParams } = new URL(req.url)

    const q = searchParams.get('q')?.trim() ?? ''
    const legacyFilter = searchParams.get('filter')
    const preset = parsePreset(searchParams.get('preset') ?? legacyFilter)
    const sort = parseSort(searchParams.get('sort'))
    const jobType = searchParams.get('jobType')?.trim().toLowerCase() ?? 'all'
    const source = searchParams.get('source')?.trim().toLowerCase() ?? 'all'
    const postedWithinDays = parsePositiveInt(searchParams.get('postedWithinDays'))
    const minMatchScore = parsePositiveInt(searchParams.get('minMatchScore'))
    const statuses = parseMultiValue(searchParams.get('status'))
    const remoteOnly = searchParams.get('remoteOnly') === 'true' || preset === 'remote'

    const where: Prisma.JobWhereInput = {
      userId: user.id,
      isHidden: false,
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    }

    if (preset === 'saved') where.isSaved = true
    if (preset === 'applied' && statuses.length === 0) where.status = 'applied'
    if (preset === 'high_match' && !minMatchScore) where.matchScore = { gte: 70 }
    if (minMatchScore) where.matchScore = { gte: minMatchScore }
    if (source !== 'all') where.source = source
    if (statuses.length > 0) where.status = { in: statuses }
    if (postedWithinDays) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - postedWithinDays)
      where.postedAt = { gte: cutoff }
    }
    if (remoteOnly) {
      where.AND = [...asWhereArray(where.AND), { OR: [{ isRemote: true }, { jobType: 'remote' }] }]
    }
    if (jobType !== 'all') {
      if (jobType === 'remote') {
        where.AND = [...asWhereArray(where.AND), { OR: [{ isRemote: true }, { jobType: 'remote' }] }]
      } else {
        where.jobType = jobType
      }
    }

    const remotePolicy = getRemoteRegionPolicy()

    const [jobRows, applied, saved, newToday] = await Promise.all([
      db.job.findMany({
        where,
        orderBy: createOrderBy(sort),
        take: 250,
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          salary: true,
          jobType: true,
          matchScore: true,
          isSaved: true,
          source: true,
          savedAt: true,
          postedAt: true,
          description: true,
          isRemote: true,
          status: true,
          url: true,
          appliedAt: true,
          nextStep: true,
        },
      }),
      db.job.count({ where: { userId: user.id, status: 'applied' } }),
      db.job.count({ where: { userId: user.id, isSaved: true } }),
      db.job.count({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ])

    const fullAccess = hasFullPlatformAccess(user)
    const feedLimit = fullAccess ? 75 : 30

    const jobs = jobRows
      .filter((job) =>
        isAllowedJobListing({
          isRemote: job.isRemote || job.jobType === 'remote',
          location: job.location,
          description: job.description,
          tags: [],
          policy: remotePolicy,
        })
      )
      .slice(0, feedLimit)

    const sources = [...new Set(jobs.map((job) => job.source).filter((value): value is string => !!value))].sort()

    return NextResponse.json({
      jobs,
      stats: { newToday, applied, saved },
      facets: {
        sources,
        remotePolicyLabel: buildRemoteRegionPolicyLabel(remotePolicy),
      },
      feedLimited: !fullAccess,
    })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[GET /api/jobs]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    const body = await req.json()

    const job = await db.job.create({
      data: {
        userId: user.id,
        title: body.title,
        company: body.company,
        location: body.location,
        url: body.url,
        salary: body.salary,
        description: body.description,
        jobType: body.jobType,
        isRemote:
          body.jobType === 'remote' ||
          (typeof body.location === 'string' && body.location.toLowerCase().includes('remote')),
        source: 'manual',
        isSaved: true,
      },
    })

    return NextResponse.json({ job }, { status: 201 })
  } catch (err) {
    const authError = getAuthErrorResponse(err)
    if (authError) return authError
    console.error('[POST /api/jobs]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
