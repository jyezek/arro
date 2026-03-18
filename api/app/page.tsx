import type { Metadata } from 'next'
import { resolveAppBaseUrl, resolveWaitlistMode } from './app-base-url'
import MarketingHome from './marketing-home'

export const metadata: Metadata = {
  title: "Arro — Every other candidate is winging it. You won't be.",
  description:
    'AI-powered job search. Upload your resume once. Arro tailors every application, preps you for every interview, and gives you a real-time copilot in practice sessions.',
}

export default function HomePage() {
  return <MarketingHome appBaseUrl={resolveAppBaseUrl()} waitlistMode={resolveWaitlistMode()} />
}
