import type { Metadata } from 'next'
import MarketingHome from './marketing-home'

export const metadata: Metadata = {
  title: "Arro — Every other candidate is winging it. You won't be.",
  description:
    'AI-powered job search. Upload your resume once. Arro tailors every application, preps you for every interview, and gives you a real-time copilot in practice sessions.',
}

function normalizeBaseUrl(baseUrl: string | undefined): string {
  if (!baseUrl) return ''
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export default function HomePage() {
  const appBaseUrl = normalizeBaseUrl(process.env.EXPO_ORIGIN || process.env.NEXT_PUBLIC_APP_URL)

  return <MarketingHome appBaseUrl={appBaseUrl} />
}
