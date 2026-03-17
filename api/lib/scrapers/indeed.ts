import axios from 'axios'
import * as cheerio from 'cheerio'
import type { JobListing, SearchConfig } from './types'
import { BROWSER_HEADERS, isWithinDays, matchesKeywords, truncate } from './utils'

export async function scrapeIndeed(config: SearchConfig): Promise<JobListing[]> {
  const jobs: JobListing[] = []
  const queries = config.keywords.slice(0, 3) // top 3 keywords to avoid too many requests

  for (const keyword of queries) {
    try {
      const params: Record<string, string> = {
        q: keyword,
        sort: 'date',
        fromage: String(config.maxDaysOld),
        limit: '50',
      }

      if (config.remote) {
        params.remotejob = '1'
      } else if (config.location) {
        params.l = `${config.location.city}, ${config.location.state}`
        params.radius = String(config.location.radiusMiles)
      }

      const rssUrl = `https://www.indeed.com/rss?${new URLSearchParams(params)}`
      const { data } = await axios.get(rssUrl, {
        headers: { ...BROWSER_HEADERS, Accept: 'application/rss+xml, application/xml' },
        timeout: 12000,
      })

      const $ = cheerio.load(data, { xmlMode: true })

      $('item').each((_, el) => {
        const $el = $(el)
        const title = $el.find('title').text().trim()
        const company = $el.find('source').text().trim() || $el.find('author').text().trim()
        const location = $el.find('Indeed\\:jobLocation, jobLocation').text().trim()
        const url = $el.find('link').text().trim() || $el.find('guid').text().trim()
        const pubDate = $el.find('pubDate').text().trim()
        const desc = $el.find('description').text().trim()

        if (!title || !url) return

        const postedAt = pubDate ? new Date(pubDate) : null
        if (!isWithinDays(postedAt, config.maxDaysOld)) return
        if (!matchesKeywords(title + ' ' + desc, config)) return

        const jobKeyMatch = url.match(/jk=([a-f0-9]+)/i)
        const externalId = `indeed:${jobKeyMatch ? jobKeyMatch[1] : Buffer.from(url).toString('base64').slice(0, 16)}`

        if (jobs.find(j => j.externalId === externalId)) return

        jobs.push({
          externalId,
          source: 'indeed',
          title,
          company: company || 'Unknown',
          location: location || (config.remote ? 'Remote' : config.location?.fullName ?? ''),
          url: url.split('&')[0],
          postedAt,
          salary: null,
          jobType: null,
          isRemote: location.toLowerCase().includes('remote') || config.remote,
          description: truncate(desc.replace(/<[^>]*>/g, ''), 600),
          tags: [],
        })
      })
    } catch (err) {
      console.error(`[indeed] keyword "${keyword}" failed:`, (err as Error).message)
    }
  }

  return jobs
}
