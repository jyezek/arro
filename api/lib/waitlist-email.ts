import { jsx } from 'react/jsx-runtime'
import WaitlistNotificationEmail from '@/emails/waitlist-notification-email'
import WaitlistWelcomeEmail from '@/emails/waitlist-welcome-email'
import {
  getResendClient,
  getResendFromEmail,
  getResendReplyTo,
  getWaitlistNotifyTo,
  getWaitlistSegmentId,
} from '@/lib/resend'

type WaitlistSignupPayload = {
  email: string
  name?: string | null
  source?: string | null
  appUrl: string
  isNewSignup: boolean
}

type ContactProperties = {
  waitlist_source: string | null
  signed_up_at: string
  signup_status: string
}

function splitName(name: string | null | undefined): { firstName?: string; lastName?: string } {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length === 0) return {}
  if (parts.length === 1) return { firstName: parts[0] }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function hasResendConfig() {
  return Boolean(getResendClient() && getResendFromEmail())
}

async function syncWaitlistContact(
  email: string,
  name: string | null | undefined,
  source: string | null | undefined,
  signedUpAt: string,
) {
  const resend = getResendClient()
  const segmentId = getWaitlistSegmentId()

  if (!resend) {
    return
  }

  const { firstName, lastName } = splitName(name)
  const properties: ContactProperties = {
    waitlist_source: source?.trim() || null,
    signed_up_at: signedUpAt,
    signup_status: 'waitlist',
  }

  const existing = await resend.contacts.get({ email })
  if (existing.error && existing.error.name !== 'not_found') {
    throw new Error(existing.error.message)
  }

  if (!existing.data) {
    const created = await resend.contacts.create({
      email,
      firstName,
      lastName,
      properties,
      segments: segmentId ? [{ id: segmentId }] : undefined,
    })

    if (created.error) {
      throw new Error(created.error.message)
    }

    return
  }

  const updated = await resend.contacts.update({
    email,
    firstName: firstName ?? null,
    lastName: lastName ?? null,
    properties,
  })

  if (updated.error) {
    throw new Error(updated.error.message)
  }

  if (!segmentId) {
    return
  }

  const segments = await resend.contacts.segments.list({ email, limit: 100 })
  if (segments.error) {
    throw new Error(segments.error.message)
  }

  const alreadyInSegment = segments.data?.data.some((segment) => segment.id === segmentId)
  if (alreadyInSegment) {
    return
  }

  const added = await resend.contacts.segments.add({ email, segmentId })
  if (added.error) {
    throw new Error(added.error.message)
  }
}

async function sendWelcomeEmail(
  email: string,
  name: string | null | undefined,
  appUrl: string,
) {
  const resend = getResendClient()
  const from = getResendFromEmail()
  const replyTo = getResendReplyTo()

  if (!resend || !from) {
    return
  }

  const firstName = splitName(name).firstName
  const result = await resend.emails.send({
    from,
    to: email,
    replyTo: replyTo ?? undefined,
    subject: 'You’re on the Arro waitlist',
    react: jsx(WaitlistWelcomeEmail, { appUrl, firstName }),
  })

  if (result.error) {
    throw new Error(result.error.message)
  }
}

async function sendInternalNotification(
  email: string,
  name: string | null | undefined,
  source: string | null | undefined,
  signedUpAt: string,
) {
  const resend = getResendClient()
  const from = getResendFromEmail()
  const notifyTo = getWaitlistNotifyTo()

  if (!resend || !from || !notifyTo) {
    return
  }

  const result = await resend.emails.send({
    from,
    to: notifyTo,
    subject: `New Arro waitlist signup: ${email}`,
    react: jsx(WaitlistNotificationEmail, {
      email,
      name,
      source,
      signedUpAt,
    }),
  })

  if (result.error) {
    throw new Error(result.error.message)
  }
}

export async function handleWaitlistEmails({
  email,
  name,
  source,
  appUrl,
  isNewSignup,
}: WaitlistSignupPayload) {
  if (!hasResendConfig()) {
    return
  }

  const signedUpAt = new Date().toISOString()
  const tasks: Promise<unknown>[] = [
    syncWaitlistContact(email, name, source, signedUpAt),
  ]

  if (isNewSignup) {
    tasks.push(sendWelcomeEmail(email, name, appUrl))
    tasks.push(sendInternalNotification(email, name, source, signedUpAt))
  }

  const results = await Promise.allSettled(tasks)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[waitlist email]', result.reason)
    }
  }
}
