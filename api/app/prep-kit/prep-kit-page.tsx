'use client'

import { useEffect, useState } from 'react'
import { DM_Sans } from 'next/font/google'
import styles from './prep-kit-page.module.css'
import WaitlistForm from '../components/waitlist-form'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
})

type PrepKitPageProps = {
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

type Tab = 'cover' | 'screening' | 'followup' | 'negotiation'

const tabs: { id: Tab; label: string }[] = [
  { id: 'cover', label: 'Cover letter' },
  { id: 'screening', label: 'Screening Q&A' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'negotiation', label: 'Negotiation' },
]

const tabContent: Record<Tab, { title: string; body: React.ReactNode }> = {
  cover: {
    title: 'Cover Letter — Senior PM, Stripe',
    body: (
      <>
        <p>Hi [Hiring Manager],</p>
        <p>
          I&apos;m applying for the Senior PM role at Stripe. My background spans product launches, cross-functional alignment, and growth — and I&apos;ve specifically been following Stripe&apos;s expansion into the mid-market developer segment.
        </p>
        <p>
          In my most recent role, I led a platform launch that aligned design, engineering, and three regional sales teams under a two-week deadline. That experience is directly relevant to how Stripe operates at scale — shipping fast, keeping stakeholders aligned, and holding high quality bars even under pressure.
        </p>
        <p>
          I&apos;d love to bring that execution style to the Growth team. Happy to connect at your convenience.
        </p>
        <p>Best,<br />Alex</p>
      </>
    ),
  },
  screening: {
    title: 'Screening Q&A — Senior PM, Stripe',
    body: (
      <>
        <div className="qa-block">
          <p className="qa-q">Q: &quot;Why Stripe?&quot;</p>
          <p className="qa-a">I&apos;ve tracked Stripe&apos;s product thinking for years — the API-first philosophy, the obsession with developer experience, and the recent moves into the mid-market. That&apos;s the intersection I want to be building in.</p>
        </div>
        <div className="qa-block">
          <p className="qa-q">Q: &quot;What&apos;s your PM superpower?&quot;</p>
          <p className="qa-a">I close the gap between what users say they need and what will actually move the metric. I do that with fast qualitative signals, then structured experiments.</p>
        </div>
        <div className="qa-block">
          <p className="qa-q">Q: &quot;Describe a time you shipped under pressure.&quot;</p>
          <p className="qa-a">Our Q4 OEM platform launch required aligning three regional teams and two internal functions in under two weeks. I ran daily standups, pre-agreed go/no-go criteria, and we hit the date with zero critical bugs.</p>
        </div>
      </>
    ),
  },
  followup: {
    title: 'Follow-up Email — Senior PM, Stripe',
    body: (
      <>
        <p><strong>Subject:</strong> Following up — Senior PM, Stripe</p>
        <p>Hi [Name],</p>
        <p>
          Thank you for the conversation on [date]. I left with a much clearer picture of the Growth team&apos;s priorities for Q3 — particularly the push into mid-market API tooling.
        </p>
        <p>
          It reinforced why I&apos;m excited about this role specifically. The intersection of developer experience and growth metrics is exactly where I want to be working, and the team&apos;s approach to shipping incrementally resonates with how I work best.
        </p>
        <p>
          I&apos;d love to continue the conversation whenever you have a moment. Happy to answer any follow-up questions in the meantime.
        </p>
        <p>Best,<br />Alex</p>
      </>
    ),
  },
  negotiation: {
    title: 'Negotiation Notes — Senior PM, Stripe',
    body: (
      <>
        <div className="neg-section">
          <p className="neg-label">COMP TARGET</p>
          <p>Based on Stripe&apos;s published comp ranges and recent raises for this level (L5), target base: <strong>$185–210k</strong>. Equity at 0.05–0.1% typical for this band.</p>
        </div>
        <div className="neg-section">
          <p className="neg-label">LEVERAGE POINTS</p>
          <ul>
            <li>Competing offer if applicable — mention without revealing specifics</li>
            <li>Demonstrated metric impact from last role (40% drop-off reduction)</li>
            <li>Cross-functional leadership with documented outcome (Q4 launch on time)</li>
          </ul>
        </div>
        <div className="neg-section">
          <p className="neg-label">TALKING POINTS</p>
          <p>Lead with excitement about the role, then anchor the conversation on market data. Ask for time to review the written offer before responding verbally. Request equity refresh schedule in writing.</p>
        </div>
      </>
    ),
  },
}

const featurePoints = [
  { title: 'Full kit, one tap', desc: 'Cover letter, screening answers, follow-up, negotiation notes. Not just a resume.', tint: 'orange' },
  { title: 'Built from your actual background', desc: 'Every document pulls directly from your master profile. Consistent, on-brand.', tint: 'green' },
  { title: 'Job-specific every time', desc: 'Reads the job description and tailors the language, tone, and examples.', tint: 'blue' },
  { title: 'Ready to send', desc: 'Formatted, professional, and actually good. Not a template.', tint: 'amber' },
]

export default function PrepKitPage({ appBaseUrl, waitlistMode }: PrepKitPageProps) {
  const signUpHref = buildHref(appBaseUrl, '/sign-up')
  const signInHref = buildHref(appBaseUrl, '/sign-in')
  const [activeTab, setActiveTab] = useState<Tab>('cover')
  const [animating, setAnimating] = useState(false)

  const pageStyle = {
    ['--marketing-font-body' as string]: dmSans.style.fontFamily,
    ['--marketing-font-display' as string]: `'Geist', ${dmSans.style.fontFamily}`,
  }

  function switchTab(tab: Tab) {
    if (tab === activeTab) return
    setAnimating(true)
    setTimeout(() => {
      setActiveTab(tab)
      setAnimating(false)
    }, 200)
  }

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

  const crossPromo = ALL_FEATURES.filter((f) => f.href !== '/prep-kit')
  const content = tabContent[activeTab]

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
          <a href="/prep-kit" className={`${styles.navLink} ${styles.navLinkActive}`}>Prep kit</a>
          <a href="/jobs" className={styles.navLink}>Job feed</a>
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
              Prep kit
            </div>
            <h1 className={styles.heroTitle}>
              Everything your application needs.
              <span className={styles.accent}> One tap.</span>
            </h1>
            <p className={styles.heroDeck}>
              Cover letter, screening answers, follow-up emails — all generated from your master profile and the job description. A full application kit for every role, in seconds.
            </p>
            <div className={styles.heroActions}>
              {waitlistMode ? (
                <WaitlistForm source="prep-kit" ctaLabel="Join the waitlist" placeholder="Your email" />
              ) : (
                <a href={signUpHref} className={styles.primaryCta}>
                  Start free — no card needed
                  <ArrowMark size={15} />
                </a>
              )}
            </div>
            <div className={styles.heroProof}>
              {['4 documents per role', 'Built from your profile', 'Job-specific language'].map((item, i, arr) => (
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

          {/* Demo */}
          <div className={styles.heroRight}>
            <div className={styles.demoShell}>
              {/* Document header */}
              <div className={styles.demoHeader}>
                <div className={styles.demoHeaderLeft}>
                  <div className={styles.demoDocIcon}>
                    <ArrowMark size={13} />
                  </div>
                  <div>
                    <div className={styles.demoDocTitle}>{content.title}</div>
                    <div className={styles.demoDocMeta}>Senior PM · Stripe · Generated just now</div>
                  </div>
                </div>
                <div className={styles.demoHeaderRight}>
                  <span className={styles.demoBadge}>Ready</span>
                </div>
              </div>

              {/* Tabs */}
              <div className={styles.tabBar}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
                    onClick={() => switchTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className={`${styles.docContent} ${animating ? styles.docContentFade : ''}`}>
                {content.body}
              </div>

              {/* Footer row */}
              <div className={styles.demoFooter}>
                <span className={styles.demoFooterNote}>4 of 4 documents ready</span>
                <span className={styles.demoExportBtn}>Export DOCX</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature points */}
      <section className={styles.featuresSection}>
        <div className={styles.sectionWrap}>
          <div className={`${styles.eyebrow} ${styles.reveal}`}>
            <span className={styles.eyebrowLine} />
            What you get
          </div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
            Not just a resume.
            <br />
            <span className={styles.accent}>A complete application.</span>
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
              <WaitlistForm source="prep-kit-bottom" ctaLabel="Notify me" placeholder="Your email address" />
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
