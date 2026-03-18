import type { Metadata } from 'next'
import { resolveAppBaseUrl, resolveWaitlistMode } from './app-base-url'
import MarketingHome from './marketing-home'

export function generateMetadata(): Metadata {
  if (resolveWaitlistMode()) {
    return {
      title: 'Arro — Join the waitlist',
      description:
        'Join the waitlist for Arro, the AI job search copilot that helps you build your master resume, tailor applications, and practice interviews with context-aware coaching.',
    }
  }

  return {
    title: "Arro — Every other candidate is winging it. You won't be.",
    description:
      'AI-powered job search. Upload your resume once. Arro tailors every application, preps you for every interview, and gives you a real-time copilot in practice sessions.',
  }
}

export default function HomePage() {
  return <MarketingHome appBaseUrl={resolveAppBaseUrl()} waitlistMode={resolveWaitlistMode()} />
}
