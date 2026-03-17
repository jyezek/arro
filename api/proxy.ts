import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextFetchEvent, NextRequest, NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/stripe/webhook',
  '/api/webhooks/(.*)',
  '/api/cron/(.*)',
  '/api/health',
])

const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)'])

const ALLOWED_ORIGINS = [
  process.env.EXPO_ORIGIN ?? 'http://localhost:8081',
  'http://localhost:3000',
  'http://localhost:3001',
]

function getCorsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

// Clerk handles auth but not CORS — proxy() below wraps it
const clerkHandler = clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth()

  if (isPublicRoute(req)) return NextResponse.next()

  if (!userId) {
    const { redirectToSignIn } = await auth()
    return redirectToSignIn({ returnBackUrl: req.url })
  }

  const onboardingComplete = (sessionClaims?.metadata as Record<string, unknown>)?.onboardingComplete
  if (!onboardingComplete && !isOnboardingRoute(req)) {
    return NextResponse.redirect(new URL('/onboarding', req.url))
  }

  return NextResponse.next()
})

// Outer proxy: intercepts OPTIONS before Clerk, then injects CORS on all API responses
export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  const origin = req.headers.get('origin') ?? ''
  const isApi = req.nextUrl.pathname.startsWith('/api/')
  const cors = getCorsHeaders(origin)

  // Short-circuit preflight — Clerk must never see OPTIONS
  if (req.method === 'OPTIONS' && isApi) {
    return new NextResponse(null, { status: 204, headers: cors })
  }

  const res = (await clerkHandler(req, event)) ?? NextResponse.next()

  // Stamp CORS headers on every API response (auth'd or public)
  if (isApi) {
    Object.entries(cors).forEach(([k, v]) => res.headers.set(k, v))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
