import axios from 'axios'
import * as cheerio from 'cheerio'
import type { JobListing, SearchConfig } from './types'
import { BROWSER_HEADERS, isWithinDays, matchesKeywords, parseRelativeDate, truncate } from './utils'

export async function scrapeZipRecruiter(config: SearchConfig): Promise<JobListing[]> {
  const jobs: JobListing[] = []

  for (const keyword of config.keywords.slice(0, 2)) {
    try {
      const params: Record<string, string> = {
        search: keyword,
        days: String(config.maxDaysOld),
      }

      if (config.remote) {
        params['refine_by_location_type'] = 'only_remote'
      } else if (config.location) {
        params.location = `${config.location.city}, ${config.location.state}`
        params.radius = String(config.location.radiusMiles)
      }

      const url = `https://www.ziprecruiter.com/jobs-search?${new URLSearchParams(params)}`
      const { data } = await axios.get(url, {
        headers: BROWSER_HEADERS,
        timeout: 15000,
      })

      const $ = cheerio.load(data)

      // Try multiple selector patterns (ZipRecruiter A/B tests layouts)
      const selectors = [
        'article.job_result',
        '[data-testid="job-card"]',
        '.job_result_list article',
        'li[data-job-id]',
      ]

      let found = false
      for (const selector of selectors) {
        const cards = $(selector)
        if (!cards.length) continue
        found = true

        cards.each((_, el) => {
          const $el = $(el)

          const title = $el.find('[data-testid="job-title"], .job_title, h2.title').text().trim()
          const company = $el.find('[data-testid="company-name"], .hiring_company_text, .company_name').text().trim()
          const location = $el.find('[data-testid="job-location"], .location').text().trim()
          const jobUrl = $el.find('a[href*="/jobs/"]').first().attr('href') ?? ''
          const dateText = $el.find('time, [datetime], .posted_time').attr('datetime')
            ?? $el.find('.posted_time').text().trim()

          if (!title || !jobUrl) return

          const fullUrl = jobUrl.startsWith('http') ? jobUrl : `https://www.ziprecruiter.com${jobUrl}`
          const postedAt = dateText ? (dateText.match(/^\d{4}/) ? new Date(dateText) : parseRelativeDate(dateText)) : null
          if (!isWithinDays(postedAt, config.maxDaysOld)) return
          if (!matchesKeywords(title, config)) return

          const idMatch = fullUrl.match(/\/jobs\/([^?/]+)/)
          const externalId = `ziprecruiter:${idMatch ? idMatch[1] : Buffer.from(fullUrl).toString('base64').slice(0, 16)}`

          jobs.push({
            externalId,
            source: 'ziprecruiter',
            title,
            company: company || 'Unknown',
            location,
            url: fullUrl.split('?')[0],
            postedAt,
            salary: $el.find('.compensation, [data-testid="salary"]').text().trim() || null,
            jobType: null,
            isRemote: location.toLowerCase().includes('remote') || config.remote,
            description: truncate($el.find('.job_description, [data-testid="snippet"]').text().trim()),
            tags: [],
          })
        })
        break
      }

      if (!found) {
        console.warn('[ziprecruiter] no matching card selector found')
      }
    } catch (err) {
      console.error(`[ziprecruiter] keyword "${keyword}" failed:`, (err as Error).message)
    }
  }

  return jobs
}
