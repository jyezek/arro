import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Arro — Your career, forward.',
  description: 'AI-powered job search: tailored resumes, interview prep, and a real-time copilot.',
  icons: { icon: '/favicon.ico' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F0D0B',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

  const content = (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )

  if (!publishableKey) {
    return content
  }

  return <ClerkProvider publishableKey={publishableKey}>{content}</ClerkProvider>
}
