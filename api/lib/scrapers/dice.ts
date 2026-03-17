import axios from 'axios'
import type { JobListing, SearchConfig } from './types'
import { JSON_HEADERS, isWithinDays, matchesKeywords, normalizeJobType, truncate } from './utils'

const API = 'https://job-search-api.svc.dhigroupinc.com/v1/dice/jobs/search'

export async function scrapeDice(config: SearchConfig): Promise<JobListing[]> {
  const jobs: JobListing[] = []

  try {
    const params: Record<string, string | number> = {
      q: config.booleanKeywords,
      countryCode2: 'US',
      pageSize: 100,
      facets: 'employmentType|postedDate|workFromHomeAvailability|employerType|easyApply|isTemporary',
      fields: 'id,jobId,slug,title,company,employerType,workFromHomeAvailability,employmentType,postedDate,modifiedDate,applyDataRequired,jobLocation.displayName,salary,shortDescription,skills',
      culture: 'en',
      recommendations: 'true',
      isTelemetryEnabled: 'false',
      offset: 0,
    }

    if (config.remote) {
      params['filters.workFromHomeAvailability'] = 'Remote'
    } else if (config.location) {
      params.location = `${config.location.city}, ${config.location.state}`
      params.radius = String(config.location.radiusMiles)
    }

    const { data } = await axios.get(API, {
      params,
      headers: JSON_HEADERS,
      timeout: 12000,
    })

    const items = data?.data ?? []

    for (const item of items) {
      const title = item.title
      const company = item.company
      const location = item['jobLocation.displayName'] ?? (config.remote ? 'Remote' : '')
      const url = `https://www.dice.com/jobs/detail/${item.slug ?? item.jobId}`
      const postedAt = item.postedDate ? new Date(item.postedDate) : null

      if (!title || !company) continue
      if (!isWithinDays(postedAt, config.maxDaysOld)) continue
      if (!matchesKeywords(title + ' ' + (item.shortDescription ?? ''), config)) continue

      jobs.push({
        externalId: `dice:${item.jobId ?? item.id}`,
        source: 'dice',
        title,
        company,
        location,
        url,
        postedAt,
        salary: item.salary ?? null,
        jobType: normalizeJobType(item.employmentType?.[0]),
        isRemote: item.workFromHomeAvailability === 'Remote' || config.remote,
        description: truncate(item.shortDescription),
        tags: item.skills?.slice(0, 6) ?? [],
      })
    }
  } catch (err) {
    console.error('[dice] failed:', (err as Error).message)
  }

  return jobs
}
