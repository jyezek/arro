import { Resend } from 'resend'

let resendClient: Resend | null | undefined

export function getResendClient(): Resend | null {
  if (resendClient !== undefined) {
    return resendClient
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    resendClient = null
    return resendClient
  }

  resendClient = new Resend(apiKey)
  return resendClient
}

export function getResendFromEmail(): string | null {
  return process.env.RESEND_FROM_EMAIL?.trim() || null
}

export function getWaitlistNotifyTo(): string | null {
  return process.env.WAITLIST_NOTIFY_TO?.trim() || null
}

export function getWaitlistSegmentId(): string | null {
  return process.env.RESEND_WAITLIST_SEGMENT_ID?.trim() || null
}

export function getResendReplyTo(): string | null {
  return process.env.RESEND_REPLY_TO?.trim() || null
}
