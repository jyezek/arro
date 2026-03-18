'use client'

import { useState } from 'react'
import styles from './waitlist-form.module.css'

type WaitlistFormProps = {
  source?: string
  placeholder?: string
  ctaLabel?: string
  size?: 'default' | 'compact'
}

export default function WaitlistForm({
  source,
  placeholder = 'Enter your email',
  ctaLabel = 'Join waitlist',
  size = 'default',
}: WaitlistFormProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: source ?? null }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Something went wrong')
      }
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className={`${styles.success} ${size === 'compact' ? styles.compact : ''}`}>
        <span className={styles.successIcon}>✓</span>
        <span className={styles.successText}>You&apos;re on the list — we&apos;ll be in touch soon.</span>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${styles.form} ${size === 'compact' ? styles.compact : ''}`}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        required
        className={styles.input}
        disabled={status === 'loading'}
      />
      <button
        type="submit"
        disabled={status === 'loading' || !email.trim()}
        className={styles.btn}
      >
        {status === 'loading' ? (
          <span className={styles.spinner} />
        ) : (
          ctaLabel
        )}
      </button>
      {status === 'error' && (
        <p className={styles.error}>{errorMsg}</p>
      )}
    </form>
  )
}
