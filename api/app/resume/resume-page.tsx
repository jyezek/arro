'use client'

import { useEffect, useState } from 'react'
import { DM_Sans } from 'next/font/google'
import styles from './resume-page.module.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
})

type ResumePageProps = {
  appBaseUrl: string
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

type Bullet = { text: string; relevant: boolean }
type Job = { title: string; company: string; match: number; initial: string; bullets: Bullet[] }

const jobs: Job[] = [
  {
    title: 'Senior PM',
    company: 'Stripe',
    match: 94,
    initial: 'St',
    bullets: [
      { text: 'Led Q4 OEM platform launch aligning design, eng, and 3 regional sales teams', relevant: true },
      { text: 'Built Airtable workflow saving 6+ hrs/week — demonstrates product-minded engineering', relevant: true },
      { text: 'Co-founded Donor Registry Committee, cross-functional leadership', relevant: false },
      { text: 'Drove 40% reduction in onboarding drop-off via A/B testing and funnel analysis', relevant: true },
      { text: 'Managed $2M product budget across 3 concurrent workstreams', relevant: false },
      { text: 'Shipped 3 major features with zero critical post-launch bugs', relevant: true },
    ],
  },
  {
    title: 'Product Designer',
    company: 'Figma',
    match: 88,
    initial: 'Fi',
    bullets: [
      { text: 'Led Q4 OEM platform launch aligning design, eng, and 3 regional sales teams', relevant: true },
      { text: 'Built Airtable workflow saving 6+ hrs/week — demonstrates product-minded engineering', relevant: true },
      { text: 'Co-founded Donor Registry Committee, cross-functional leadership', relevant: true },
      { text: 'Drove 40% reduction in onboarding drop-off via A/B testing and funnel analysis', relevant: false },
      { text: 'Managed $2M product budget across 3 concurrent workstreams', relevant: false },
      { text: 'Shipped 3 major features with zero critical post-launch bugs', relevant: true },
    ],
  },
  {
    title: 'Growth PM',
    company: 'Linear',
    match: 85,
    initial: 'Li',
    bullets: [
      { text: 'Led Q4 OEM platform launch aligning design, eng, and 3 regional sales teams', relevant: false },
      { text: 'Built Airtable workflow saving 6+ hrs/week — demonstrates product-minded engineering', relevant: true },
      { text: 'Co-founded Donor Registry Committee, cross-functional leadership', relevant: false },
      { text: 'Drove 40% reduction in onboarding drop-off via A/B testing and funnel analysis', relevant: true },
      { text: 'Managed $2M product budget across 3 concurrent workstreams', relevant: true },
      { text: 'Shipped 3 major features with zero critical post-launch bugs', relevant: true },
    ],
  },
]

const featurePoints = [
  { title: 'Upload once, use everywhere', desc: 'One master profile. Every application pulls from it. No re-writing.', tint: 'orange' },
  { title: 'AI digs deeper', desc: "Most people undersell themselves. Arro asks the questions a great career coach would.", tint: 'green' },
  { title: 'Tailored in seconds', desc: 'AI reads the job description and selects the most relevant sections. Always on-point.', tint: 'blue' },
  { title: 'Export as DOCX', desc: 'Download a clean, recruiter-ready Word document for any platform.', tint: 'amber' },
]

export default function ResumePage({ appBaseUrl }: ResumePageProps) {
  const signUpHref = buildHref(appBaseUrl, '/sign-up')
  const signInHref = buildHref(appBaseUrl, '/sign-in')
  const [selectedJob, setSelectedJob] = useState(0)

  const pageStyle = {
    ['--marketing-font-body' as string]: dmSans.style.fontFamily,
    ['--marketing-font-display' as string]: `'Geist', ${dmSans.style.fontFamily}`,
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

  const current = jobs[selectedJob]
  const relevantBullets = current.bullets.filter((b) => b.relevant)
  const crossPromo = ALL_FEATURES.filter((f) => f.href !== '/resume')

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
          <a href="/resume" className={`${styles.navLink} ${styles.navLinkActive}`}>Resume</a>
          <a href="/prep-kit" className={styles.navLink}>Prep kit</a>
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
              Resume builder
            </div>
            <h1 className={styles.heroTitle}>
              One resume. Tailored for
              <span className={styles.accent}> every job</span> — automatically.
            </h1>
            <p className={styles.heroDeck}>
              Upload once. Arro reads every job description and pulls the most relevant pieces of your background. Every application gets a resume that reads like it was written for that specific role.
            </p>
            <div className={styles.heroActions}>
              <a href={signUpHref} className={styles.primaryCta}>
                Start free — no card needed
                <ArrowMark size={15} />
              </a>
            </div>
            <div className={styles.heroProof}>
              {['Upload once', 'Tailored per job in seconds', 'Export as DOCX'].map((item, i, arr) => (
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
            {/* Job selector */}
            <div className={styles.jobSelector}>
              {jobs.map((job, i) => (
                <button
                  key={job.company}
                  type="button"
                  className={`${styles.jobBtn} ${i === selectedJob ? styles.jobBtnActive : ''}`}
                  onClick={() => setSelectedJob(i)}
                >
                  <span className={styles.jobBtnInitial}>{job.initial}</span>
                  <span>
                    <span className={styles.jobBtnTitle}>{job.title}</span>
                    <span className={styles.jobBtnCompany}>{job.company}</span>
                  </span>
                  <span className={`${styles.jobBtnMatch} ${i === selectedJob ? styles.jobBtnMatchActive : ''}`}>{job.match}%</span>
                </button>
              ))}
            </div>

            {/* Resume panels */}
            <div className={styles.resumePanels}>
              {/* Master resume */}
              <div className={styles.resumePanel}>
                <div className={styles.panelLabel}>Master resume</div>
                <div className={styles.bulletList}>
                  {current.bullets.map((bullet, i) => (
                    <div
                      key={i}
                      className={`${styles.bulletRow} ${bullet.relevant ? styles.bulletHighlight : ''}`}
                    >
                      <span className={styles.bulletDot}>·</span>
                      <span className={styles.bulletText}>{bullet.text}</span>
                      {bullet.relevant && <span className={styles.bulletBadge}>Selected</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Arrow divider */}
              <div className={styles.arrowDivider}>
                <div className={styles.arrowLine} />
                <div className={styles.arrowHead}><ArrowMark size={16} /></div>
              </div>

              {/* Tailored output */}
              <div className={styles.resumePanel}>
                <div className={styles.panelLabel}>
                  Tailored for {current.title} at {current.company}
                  <span className={styles.matchBadge}>{current.match}% match</span>
                </div>
                <div className={styles.bulletList}>
                  {relevantBullets.map((bullet, i) => (
                    <div key={i} className={`${styles.bulletRow} ${styles.bulletTailored}`}>
                      <span className={styles.bulletDotOrange}>·</span>
                      <span className={styles.bulletTextTailored}>{bullet.text}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.panelNote}>
                  {relevantBullets.length} of {current.bullets.length} bullets selected — most relevant to this role
                </div>
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
            How it works
          </div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
            Your whole career story.
            <br />
            <span className={styles.accent}>Relevant every time.</span>
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
          <h2 className={styles.footerCtaTitle}>Start free — the whole platform for $0</h2>
          <p className={styles.footerCtaDeck}>No card required. Upgrade when it&apos;s worth it.</p>
          <a href={signUpHref} className={styles.primaryCta}>
            Get started free <ArrowMark size={15} />
          </a>
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
