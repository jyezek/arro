'use client'

import { useEffect, useRef, useState } from 'react'
import { DM_Sans } from 'next/font/google'
import styles from './jobs-page.module.css'
import WaitlistForm from '../components/waitlist-form'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
})

type JobsPageProps = {
  appBaseUrl: string
  waitlistMode: boolean
}

function buildHref(appBaseUrl: string, path: string): string {
  if (!appBaseUrl) return path
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${appBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

function ArrowMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7h7M7 4l3.5 3.5L7 11" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckMark() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
      <path d="M1.5 4l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ALL_FEATURES = [
  { href: '/interview', label: 'Interview copilot', tag: 'Practice', desc: 'Voice AI that knows the role and coaches you in real time.' },
  { href: '/resume', label: 'Resume builder', tag: 'Apply', desc: 'One profile, tailored for every job in seconds.' },
  { href: '/prep-kit', label: 'Prep kit', tag: 'Prepare', desc: 'Cover letter, screening answers, follow-up — one tap.' },
  { href: '/jobs', label: 'Smart job feed', tag: 'Discover', desc: '50+ sources, ranked by how well each role fits you.' },
]

type MockJob = {
  initial: string
  title: string
  company: string
  location: string
  posted: string
  match: number
  tags: string[]
  why?: string[]
}

const mockJobs: MockJob[] = [
  {
    initial: 'St',
    title: 'Senior Product Manager',
    company: 'Stripe',
    location: 'Remote (US)',
    posted: '2h ago',
    match: 94,
    tags: ['Remote', 'Full-time'],
    why: [
      'PM experience with API products aligns with their core platform',
      'Cross-functional leadership background matches team structure',
      'Growth/metrics focus fits their current roadmap',
    ],
  },
  {
    initial: 'Fi',
    title: 'Product Designer — Growth',
    company: 'Figma',
    location: 'San Francisco, CA',
    posted: '5h ago',
    match: 88,
    tags: ['Hybrid', 'Easy Apply'],
  },
  {
    initial: 'Li',
    title: 'Product Manager, Platform',
    company: 'Linear',
    location: 'Remote (US)',
    posted: '1d ago',
    match: 85,
    tags: ['Remote', 'Few applicants'],
  },
  {
    initial: 'Ve',
    title: 'Senior PM, Developer Tools',
    company: 'Vercel',
    location: 'Remote (US)',
    posted: '1d ago',
    match: 81,
    tags: ['Remote', 'Full-time'],
  },
  {
    initial: 'No',
    title: 'Growth Product Manager',
    company: 'Notion',
    location: 'New York, NY',
    posted: '2d ago',
    match: 76,
    tags: ['Hybrid', 'Full-time'],
  },
]

const featurePoints = [
  { title: '50+ sources', desc: 'LinkedIn, Indeed, Dice, RemoteOK, Remotive, and 45+ others. One feed.', tint: 'blue' },
  { title: 'Ranked by fit, not recency', desc: 'Your match score is calculated against your full background, not just keywords.', tint: 'orange' },
  { title: 'New postings first', desc: 'Freshest jobs from the past 24 hours surface first — fewest applicants, best odds.', tint: 'green' },
  { title: 'US-focused filtering', desc: "Automatically strips non-US postings unless you're open to international.", tint: 'amber' },
]

function getMatchColor(match: number): string {
  if (match >= 90) return styles.matchHigh
  if (match >= 80) return styles.matchMid
  return styles.matchLow
}

export default function JobsPage({ appBaseUrl, waitlistMode }: JobsPageProps) {
  const signUpHref = buildHref(appBaseUrl, '/sign-up')
  const signInHref = buildHref(appBaseUrl, '/sign-in')
  const [visible, setVisible] = useState(false)
  const [paused, setPaused] = useState(false)
  const [cycleKey, setCycleKey] = useState(0)
  const pausedRef = useRef(false)

  const pageStyle = {
    ['--marketing-font-body' as string]: dmSans.style.fontFamily,
    ['--marketing-font-display' as string]: `'Geist', ${dmSans.style.fontFamily}`,
  }

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  // Trigger initial stagger animation on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200)
    return () => clearTimeout(t)
  }, [])

  // Re-animate the feed every 8 seconds (unless paused)
  useEffect(() => {
    function schedule() {
      return setTimeout(() => {
        if (!pausedRef.current) {
          setVisible(false)
          setTimeout(() => {
            setCycleKey((k) => k + 1)
            setVisible(true)
          }, 400)
        }
        scheduleRef.current = schedule()
      }, 8000)
    }
    const scheduleRef: { current: ReturnType<typeof setTimeout> | null } = { current: null }
    scheduleRef.current = schedule()
    return () => {
      if (scheduleRef.current) clearTimeout(scheduleRef.current)
    }
  }, [])

  useEffect(() => {
    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>(`.${styles.reveal}`))
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const node = entry.target as HTMLElement
          const siblings = Array.from(node.parentElement?.querySelectorAll<HTMLElement>(`.${styles.reveal}`) ?? [])
          const index = siblings.indexOf(node)
          node.style.transitionDelay = `${Math.max(index, 0) * 0.08}s`
          node.classList.add(styles.visible)
          observer.unobserve(node)
        })
      },
      { threshold: 0.12 },
    )
    revealNodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  const crossPromo = ALL_FEATURES.filter((f) => f.href !== '/jobs')

  return (
    <main className={`${styles.page} ${dmSans.className}`} style={pageStyle}>
      <style jsx global>{`
        @font-face {
          font-family: 'Geist';
          src: url('https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist-sans/Geist-Regular.woff2') format('woff2');
          font-weight: 400; font-style: normal; font-display: swap;
        }
        @font-face {
          font-family: 'Geist';
          src: url('https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist-sans/Geist-Medium.woff2') format('woff2');
          font-weight: 500; font-style: normal; font-display: swap;
        }
        @font-face {
          font-family: 'Geist';
          src: url('https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist-sans/Geist-SemiBold.woff2') format('woff2');
          font-weight: 600; font-style: normal; font-display: swap;
        }
        @font-face {
          font-family: 'Geist';
          src: url('https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist-sans/Geist-Bold.woff2') format('woff2');
          font-weight: 700; font-style: normal; font-display: swap;
        }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* Nav */}
      <nav className={styles.nav}>
        <a href="/" className={styles.navLogo}>
          <span className={styles.logoMark}><ArrowMark /></span>
          <span className={styles.wordmark}>arro</span>
        </a>
        <div className={styles.navLinks}>
          <a href="/interview" className={styles.navLink}>Interview</a>
          <a href="/resume" className={styles.navLink}>Resume</a>
          <a href="/prep-kit" className={styles.navLink}>Prep kit</a>
          <a href="/jobs" className={`${styles.navLink} ${styles.navLinkActive}`}>Job feed</a>
        </div>
        <div className={styles.navRight}>
          <a href={signInHref} className={styles.navSignIn}>Sign in</a>
          <a href={signUpHref} className={styles.navCta}>Start free</a>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroLeft}>
            <div className={styles.kicker}>
              <span className={styles.kickerLine} />
              Smart job feed
            </div>
            <h1 className={styles.heroTitle}>
              Your personalized job feed from
              <span className={styles.accent}> 50+ sources.</span>
            </h1>
            <p className={styles.heroDeck}>
              Aggregated from LinkedIn, Indeed, Dice, and dozens more — then ranked by how well each role actually matches your background. See the jobs most likely to want you, first.
            </p>
            <div className={styles.heroActions}>
              {waitlistMode ? (
                <WaitlistForm source="jobs" ctaLabel="Join the waitlist" placeholder="Your email" />
              ) : (
                <a href={signUpHref} className={styles.primaryCta}>
                  Start free — no card needed
                  <ArrowMark size={15} />
                </a>
              )}
            </div>
            <div className={styles.heroProof}>
              {['50+ job sources', 'Ranked by real fit', 'New postings daily'].map((item, i, arr) => (
                <span key={item} className={styles.proofCluster}>
                  <span className={styles.proofItem}>
                    <span className={styles.proofCheck}><CheckMark /></span>
                    {item}
                  </span>
                  {i < arr.length - 1 && <span className={styles.proofDot} />}
                </span>
              ))}
            </div>
          </div>

          {/* Demo feed */}
          <div
            className={styles.heroRight}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className={styles.feedHeader}>
              <div className={styles.feedTitle}>Your matches — updated now</div>
              <div className={styles.feedMeta}>{mockJobs.length} roles · sorted by match</div>
            </div>

            <div className={styles.feedList} key={cycleKey}>
              {mockJobs.map((job, i) => (
                <div
                  key={`${cycleKey}-${i}`}
                  className={`${styles.jobCard} ${i === 0 ? styles.jobCardFeatured : ''} ${visible ? styles.jobCardVisible : ''}`}
                  style={{ transitionDelay: `${i * 0.08}s` }}
                >
                  <div className={styles.jobCardMain}>
                    <div className={styles.jobInitial}>{job.initial}</div>
                    <div className={styles.jobInfo}>
                      <div className={styles.jobTitle}>{job.title}</div>
                      <div className={styles.jobMeta}>{job.company} · {job.location}</div>
                      <div className={styles.tagRow}>
                        {job.tags.map((tag) => (
                          <span key={tag} className={`${styles.tag} ${tag === 'Remote' || tag === 'Few applicants' ? styles.tagGreen : tag === 'Easy Apply' ? styles.tagBlue : styles.tagNeutral}`}>
                            {tag}
                          </span>
                        ))}
                        <span className={styles.posted}>{job.posted}</span>
                      </div>
                    </div>
                    <div className={styles.matchCol}>
                      <div className={`${styles.matchScore} ${getMatchColor(job.match)}`}>{job.match}%</div>
                      <div className={styles.matchLabel}>match</div>
                      <div className={styles.matchTrack}>
                        <div
                          className={`${styles.matchFill} ${getMatchColor(job.match)}`}
                          style={{ width: `${job.match}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Featured expansion */}
                  {i === 0 && job.why && (
                    <div className={styles.whySection}>
                      <div className={styles.whyLabel}>Why this matches you</div>
                      <ul className={styles.whyList}>
                        {job.why.map((point, wi) => (
                          <li key={wi} className={styles.whyItem}>
                            <span className={styles.whyDot} />
                            {point}
                          </li>
                        ))}
                      </ul>
                      <a href={signUpHref} className={styles.viewJobBtn}>
                        View full prep kit <ArrowMark size={12} />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {paused && <div className={styles.pausedBadge}>Paused — hover off to resume</div>}
          </div>
        </div>
      </section>

      {/* Feature points */}
      <section className={styles.featuresSection}>
        <div className={styles.sectionWrap}>
          <div className={`${styles.eyebrow} ${styles.reveal}`}>
            <span className={styles.eyebrowLine} />
            How it works
          </div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
            Stop scrolling job boards.
            <br />
            <span className={styles.accent}>Let the right jobs find you.</span>
          </h2>
          <div className={styles.featureGrid}>
            {featurePoints.map((fp) => (
              <article key={fp.title} className={`${styles.featureCard} ${styles.reveal}`}>
                <span className={`${styles.featureIcon} ${
                  fp.tint === 'orange' ? styles.tintOrange
                  : fp.tint === 'green' ? styles.tintGreen
                  : fp.tint === 'blue' ? styles.tintBlue
                  : styles.tintAmber
                }`}>
                  <ArrowMark size={14} />
                </span>
                <h3 className={styles.featureTitle}>{fp.title}</h3>
                <p className={styles.featureDesc}>{fp.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-promo */}
      <section className={styles.crossPromo}>
        <div className={styles.sectionWrap}>
          <div className={`${styles.eyebrow} ${styles.reveal}`}>
            <span className={styles.eyebrowLine} />
            Also in Arro
          </div>
          <h2 className={`${styles.sectionTitleSm} ${styles.reveal}`}>The whole platform works together.</h2>
          <div className={styles.promoGrid}>
            {crossPromo.map((f) => (
              <a key={f.href} href={f.href} className={`${styles.promoCard} ${styles.reveal}`}>
                <span className={styles.promoTag}>{f.tag}</span>
                <div className={styles.promoLabel}>{f.label}</div>
                <p className={styles.promoDesc}>{f.desc}</p>
                <span className={styles.promoArrow}><ArrowMark size={13} /></span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className={styles.footerCta}>
        <div className={styles.footerCtaInner}>
          {waitlistMode ? (
            <>
              <h2 className={styles.footerCtaTitle}>Be first when we launch.</h2>
              <p className={styles.footerCtaDeck}>We&apos;re wrapping up final testing. Get notified the moment the doors open.</p>
              <WaitlistForm source="jobs-bottom" ctaLabel="Notify me" placeholder="Your email address" />
            </>
          ) : (
            <>
              <h2 className={styles.footerCtaTitle}>Start free — the whole platform for $0</h2>
              <p className={styles.footerCtaDeck}>No card required. Upgrade when it&apos;s worth it.</p>
              <a href={signUpHref} className={styles.primaryCta}>
                Get started free <ArrowMark size={15} />
              </a>
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerWrap}>
          <div className={styles.footerTop}>
            <div>
              <a href="/" className={styles.footerBrand}>
                <span className={styles.footerMark}><ArrowMark size={13} /></span>
                <span className={styles.footerWordmark}>arro</span>
              </a>
              <p className={styles.footerTagline}>Your career, forward. AI-powered job search for people who take getting hired seriously.</p>
              <a href={signUpHref} className={styles.footerStart}>Start free <ArrowMark size={12} /></a>
            </div>
            <div>
              <div className={styles.footerTitle}>Product</div>
              <div className={styles.footerLinks}>
                <a href="/interview">Interview copilot</a>
                <a href="/resume">Resume builder</a>
                <a href="/prep-kit">Prep kit</a>
                <a href="/jobs">Job feed</a>
              </div>
            </div>
            <div>
              <div className={styles.footerTitle}>Company</div>
              <div className={styles.footerLinks}>
                <a href="#">Blog</a>
                <a href="#">Changelog</a>
                <a href="#">Careers</a>
                <a href="#">Contact</a>
              </div>
            </div>
            <div>
              <div className={styles.footerTitle}>Legal</div>
              <div className={styles.footerLinks}>
                <a href="#">Privacy policy</a>
                <a href="#">Terms of service</a>
                <a href="#">Security</a>
                <a href="#">Status</a>
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span className={styles.footerCopy}>© {new Date().getFullYear()} Arro. All rights reserved.</span>
            <div className={styles.footerLegal}>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Status</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
