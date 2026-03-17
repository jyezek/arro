import axios from 'axios'
import type { JobListing, SearchConfig } from './types'
import { isWithinDays, matchesKeywords, truncate } from './utils'

export async function scrapeUSAJobs(config: SearchConfig): Promise<JobListing[]> {
  const jobs: JobListing[] = []

  try {
    const headers: Record<string, string> = {
      'Host': 'data.usajobs.gov',
      'User-Agent': process.env.USAJOBS_EMAIL ?? 'jobs@example.com',
      'Authorization-Key': process.env.USAJOBS_API_KEY ?? '',
    }

    const params: Record<string, string | number> = {
      Keyword: config.keywords.slice(0, 3).join(' OR '),
      ResultsPerPage: 50,
      SortField: 'OpenDate',
      SortDirection: 'Desc',
    }

    if (config.remote) {
      params.RemoteIndicator = 'True'
    } else if (config.location) {
      params.LocationName = `${config.location.city}, ${config.location.state}`
      params.Radius = String(config.location.radiusMiles)
    }

    const { data } = await axios.get('https://data.usajobs.gov/api/search', {
      params,
      headers,
      timeout: 12000,
    })

    const items = data?.SearchResult?.SearchResultItems ?? []

    for (const item of items) {
      const pos = item.MatchedObjectDescriptor
      if (!pos) continue

      const title = pos.PositionTitle
      const company = pos.OrganizationName
      if (!title || !company) continue

      const postedAt = pos.PublicationStartDate ? new Date(pos.PublicationStartDate) : null
      if (!isWithinDays(postedAt, config.maxDaysOld)) continue

      const text = `${title} ${pos.UserArea?.Details?.JobSummary ?? ''}`
      if (!matchesKeywords(text, config)) continue

      const location = pos.PositionLocationDisplay ?? pos.PositionLocation?.[0]?.LocationName ?? ''
      const isRemote = location.toLowerCase().includes('remote') || pos.PositionRemuneration?.[0]?.RangeType === 'Per Year'

      const salaryMin = pos.PositionRemuneration?.[0]?.MinimumRange
      const salaryMax = pos.PositionRemuneration?.[0]?.MaximumRange
      const salary = salaryMin ? `$${Math.round(salaryMin / 1000)}k–$${Math.round(salaryMax / 1000)}k/yr` : null

      jobs.push({
        externalId: `usajobs:${pos.PositionID}`,
        source: 'usajobs',
        title,
        company,
        location,
        url: pos.ApplyURI?.[0] ?? pos.PositionURI,
        postedAt,
        salary,
        jobType: 'full-time',
        isRemote,
        description: truncate(pos.UserArea?.Details?.JobSummary),
        tags: ['government'],
      })
    }
  } catch (err) {
    console.error('[usajobs] failed:', (err as Error).message)
  }

  return jobs
}
