import { db } from '@/lib/db'
import type { SearchConfig, ScrapeResult } from './types'
import { deduplicateByUrl } from './utils'
import { scrapeLinkedIn } from './linkedin'
import { scrapeIndeed } from './indeed'
import { scrapeDice } from './dice'
import { scrapeRemoteOK } from './remoteok'
import { scrapeRemotive } from './remotive'
import { scrapeTheMuse } from './themuse'
import { scrapeJobicy } from './jobicy'
import { scrapeArbeitnow } from './arbeitnow'
import { scrapeUSAJobs } from './usajobs'
import { scrapeZipRecruiter } from './ziprecruiter'
import { scrapeConfiguredAtsFeeds } from './ats'
import { getRemoteRegionPolicy, isAllowedJobListing } from '@/lib/job-search'

export type { SearchConfig, ScrapeResult }

interface RunScrapersResult {
  total: number
  newCount: number
  results: ScrapeResult[]
}

export async function runAllScrapers(
  userId: string,
  config: SearchConfig
): Promise<RunScrapersResult> {
  const remotePolicy = getRemoteRegionPolicy()
  const includeInternationalBoards = config.location?.country && config.location.country.toUpperCase() !== 'US'

  // Run all scrapers in parallel — failures are isolated
  const scraperTasks = [
    scrapeLinkedIn(config).then(jobs => ({ source: 'linkedin', jobs })),
    scrapeIndeed(config).then(jobs => ({ source: 'indeed', jobs })),
    scrapeDice(config).then(jobs => ({ source: 'dice', jobs })),
    scrapeRemoteOK(config).then(jobs => ({ source: 'remoteok', jobs })),
    scrapeRemotive(config).then(jobs => ({ source: 'remotive', jobs })),
    scrapeTheMuse(config).then(jobs => ({ source: 'themuse', jobs })),
    scrapeJobicy(config).then(jobs => ({ source: 'jobicy', jobs })),
    scrapeUSAJobs(config).then(jobs => ({ source: 'usajobs', jobs })),
    scrapeZipRecruiter(config).then(jobs => ({ source: 'ziprecruiter', jobs })),
    scrapeConfiguredAtsFeeds(config).then(jobs => ({ source: 'ats', jobs })),
  ]

  if (includeInternationalBoards) {
    scraperTasks.push(scrapeArbeitnow(config).then(jobs => ({ source: 'arbeitnow', jobs })))
  }

  const scraperResults = await Promise.allSettled(scraperTasks)

  const results: ScrapeResult[] = []
  let totalNew = 0

  for (const result of scraperResults) {
    if (result.status === 'rejected') {
      results.push({ source: 'unknown', count: 0, newCount: 0, error: String(result.reason) })
      continue
    }

    const { source, jobs: raw } = result.value
    const regionFiltered = raw.filter(job =>
      isAllowedJobListing({
        isRemote: job.isRemote,
        location: job.location,
        description: job.description,
        tags: job.tags,
        policy: remotePolicy,
      })
    )
    const deduped = deduplicateByUrl(regionFiltered)
    let newCount = 0

    // Upsert each job — skip if already exists for this user
    for (const job of deduped) {
      try {
        const existing = await db.job.findFirst({
          where: { userId, externalId: job.externalId, source: job.source },
          select: { id: true },
        })

        if (!existing) {
          await db.job.create({
            data: {
              userId,
              externalId: job.externalId,
              source: job.source,
              title: job.title,
              company: job.company,
              location: job.location,
              url: job.url,
              salary: job.salary,
              isRemote: job.isRemote,
              jobType: job.isRemote ? 'remote' : (job.jobType ?? null),
              description: job.description,
              tags: job.tags,
              postedAt: job.postedAt,
            } as Parameters<typeof db.job.create>[0]['data'],
          })
          newCount++
        } else {
          // Update description/salary if we now have them
          if (job.description || job.salary) {
            await db.job.update({
              where: { id: existing.id },
              data: {
                ...(job.description && { description: job.description }),
                ...(job.salary && { salary: job.salary }),
                ...(job.location && { location: job.location }),
                isRemote: job.isRemote,
                ...(job.postedAt && { postedAt: job.postedAt }),
              },
            })
          }
        }
      } catch (err) {
        console.error(`[${source}] upsert failed for ${job.externalId}:`, (err as Error).message)
      }
    }

    results.push({ source, count: deduped.length, newCount })
    totalNew += newCount
  }

  return {
    total: results.reduce((sum, r) => sum + r.count, 0),
    newCount: totalNew,
    results,
  }
}
