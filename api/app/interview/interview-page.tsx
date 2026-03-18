'use client'

import { useEffect, useRef, useState } from 'react'
import { DM_Sans } from 'next/font/google'
import styles from './interview-page.module.css'
import WaitlistForm from '../components/waitlist-form'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
})

type InterviewPageProps = {
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

const demoData = [
  {
    q: 'Tell me about a time you aligned cross-functional stakeholders under a tight deadline.',
    a: 'One that stands out is our Q4 OEM platform launch. I had to align design, engineering, and three regional teams in under two weeks — and we hit launch on time.',
    cueType: 'FROM YOUR RESUME',
    cue: 'Use the Toyota rollout metric — it directly answers this.',
    confidence: 74,
    pace: 82,
  },
  {
    q: "How do you make product decisions when you don't have enough data?",
    a: "I start by defining exactly what question I need to answer, then find the fastest, cheapest signal — even 5 user conversations. I'm comfortable committing with incomplete data when the cost of reversing is low.",
    cueType: 'STRONG STRUCTURE',
    cue: 'Good framework. Add a concrete example to land it harder.',
    confidence: 88,
    pace: 76,
  },
  {
    q: 'Where do you see the biggest opportunity in this market space?',
    a: "The mid-market is underserved by both enterprise tools and point solutions. That's where this product is best positioned to win — complex needs, but can't justify enterprise pricing.",
    cueType: 'HIGH CONFIDENCE',
    cue: 'Excellent answer. Add a metric to make it unignorable.',
    confidence: 92,
    pace: 85,
  },
]

const featurePoints = [
  {
    title: 'Personalized questions',
    desc: 'Built from the job description, your resume, and company research. Not generic.',
    tint: 'orange',
  },
  {
    title: 'Live copilot cues',
    desc: 'Real-time confidence scoring, pacing feedback, and topic suggestions pulled from your master resume.',
    tint: 'green',
  },
  {
    title: 'Pause and ask anything',
    desc: 'Mid-interview, open the copilot chat. Ask for a hint, request feedback on your last answer, or get talking points.',
    tint: 'blue',
  },
  {
    title: 'Always-on listening',
    desc: "No tap-to-speak. The interview flows like a real conversation.",
    tint: 'amber',
  },
]

// Animation phases: 0=question, 1=answer, 2=copilot, 3=fade
type Phase = 0 | 1 | 2 | 3

export default function InterviewPage({ appBaseUrl, waitlistMode }: InterviewPageProps) {
  const signUpHref = buildHref(appBaseUrl, '/sign-up')
  const signInHref = buildHref(appBaseUrl, '/sign-in')

  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>(0)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pageStyle = {
    ['--marketing-font-body' as string]: dmSans.style.fontFamily,
    ['--marketing-font-display' as string]: `'Geist', ${dmSans.style.fontFamily}`,
  }

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    function schedule(delay: number, fn: () => void) {
      timerRef.current = setTimeout(() => {
        if (!pausedRef.current) fn()
        else {
          // retry until unpaused
          const poll = setInterval(() => {
            if (!pausedRef.current) {
              clearInterval(poll)
              fn()
            }
          }, 200)
        }
      }, delay)
    }

    if (phase === 0) {
      // question visible — wait, then show answer
      schedule(2500, () => setPhase(1))
    } else if (phase === 1) {
      // answer visible — wait, then show copilot
      schedule(2000, () => setPhase(2))
    } else if (phase === 2) {
      // copilot visible — wait, then fade and advance
      schedule(3000, () => setPhase(3))
    } else if (phase === 3) {
      // fading — advance to next
      schedule(600, () => {
        setCurrentIndex((i) => (i + 1) % demoData.length)
        setPhase(0)
      })
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [phase, currentIndex])

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

  const current = demoData[currentIndex]
  const crossPromo = ALL_FEATURES.filter((f) => f.href !== '/interview')

  const confidenceColor = current.confidence >= 85 ? 'green' : current.confidence >= 70 ? 'orange' : 'amber'
  const paceColor = current.pace >= 80 ? 'green' : 'orange'

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
          <a href="/interview" className={`${styles.navLink} ${styles.navLinkActive}`}>Interview</a>
          <a href="/resume" className={styles.navLink}>Resume</a>
          <a href="/prep-kit" className={styles.navLink}>Prep kit</a>
          <a href="/jobs" className={styles.navLink}>Job feed</a>
        </div>
        {!waitlistMode ? (
          <div className={styles.navRight}>
            <a href={signInHref} className={styles.navSignIn}>Sign in</a>
            <a href={signUpHref} className={styles.navCta}>Start free</a>
          </div>
        ) : null}
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroLeft}>
            <div className={styles.kicker}>
              <span className={styles.kickerLine} />
              Interview copilot
            </div>
            <h1 className={styles.heroTitle}>
              Walk into every interview knowing exactly
              <span className={styles.accent}> what to say.</span>
            </h1>
            <p className={styles.heroDeck}>
              Arro runs a full practice interview, gives you real-time coaching, and lets you pause to ask the copilot anything — personalized to the exact role you&apos;re applying for.
            </p>
            <div className={styles.heroActions}>
              {waitlistMode ? (
                <WaitlistForm source="interview" ctaLabel="Join the waitlist" placeholder="Your email" />
              ) : (
                <a href={signUpHref} className={styles.primaryCta}>
                  Start free — no card needed
                  <ArrowMark size={15} />
                </a>
              )}
            </div>
            <div className={styles.heroProof}>
              {['Voice AI, no typing', 'Real-time confidence coaching', 'Built from the actual job description'].map((item, i, arr) => (
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
          <div
            className={styles.heroRight}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className={`${styles.phoneShell} ${phase === 3 ? styles.phoneFade : ''}`}>
              <div className={styles.phoneTop}>
                <div className={styles.phoneHeaderRow}>
                  <div>
                    <div className={styles.phoneJob}>Senior Product Manager</div>
                    <div className={styles.phoneCompany}>Stripe · Practice interview</div>
                  </div>
                  <div className={styles.phoneStatusRow}>
                    <span className={styles.phoneTimer}>08:42</span>
                    <span className={styles.phoneLive}>
                      <span className={styles.liveDot} />
                      Live
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.orbRow}>
                <div className={styles.orbStack}>
                  <div className={styles.aiOrb}>
                    <span className={styles.orbRing} />
                    <span className={styles.orbRing} />
                    <span className={styles.orbRing} />
                    <ArrowMark size={18} />
                  </div>
                  <span className={styles.orbLabelAi}>ARRO AI</span>
                </div>
                <div className={styles.orbStack}>
                  <div className={styles.userOrb}>
                    <div className={styles.waveBars}>
                      <span className={styles.waveBarShort} />
                      <span className={styles.waveBarMid} />
                      <span className={styles.waveBarTall} />
                      <span className={styles.waveBarMid} />
                      <span className={styles.waveBarShort} />
                    </div>
                  </div>
                  <span className={styles.orbLabelUser}>YOU</span>
                </div>
              </div>

              <div className={styles.transcript}>
                {/* AI Question — always visible once phase >= 0 */}
                <div className={`${styles.bubble} ${styles.bubbleAi} ${styles.bubbleReveal} ${phase >= 0 && phase < 3 ? styles.bubbleVisible : ''}`}>
                  <div className={`${styles.bubbleSpeaker} ${styles.bubbleSpeakerAi}`}>ARRO AI</div>
                  {current.q}
                </div>
                {/* User Answer — visible once phase >= 1 */}
                <div className={`${styles.bubble} ${styles.bubbleUser} ${styles.bubbleReveal} ${phase >= 1 && phase < 3 ? styles.bubbleVisible : ''}`}>
                  <div className={`${styles.bubbleSpeaker} ${styles.bubbleSpeakerUser}`}>YOU</div>
                  {current.a}
                </div>
              </div>

              {/* Copilot panel — slides up at phase 2 */}
              <div className={`${styles.copilotPanel} ${phase >= 2 && phase < 3 ? styles.copilotPanelVisible : ''}`}>
                <div className={styles.copilotHeader}>
                  <span className={styles.copilotDot} />
                  INTERVIEW COPILOT
                </div>

                <div className={styles.metricList}>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Confidence</span>
                    <span className={styles.metricTrack}>
                      <span
                        className={`${styles.metricFill} ${confidenceColor === 'green' ? styles.metricGreen : confidenceColor === 'orange' ? styles.metricOrange : styles.metricAmber}`}
                        style={{ width: `${current.confidence}%` }}
                      />
                    </span>
                    <span className={styles.metricValue}>{current.confidence}%</span>
                  </div>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Pace</span>
                    <span className={styles.metricTrack}>
                      <span
                        className={`${styles.metricFill} ${paceColor === 'green' ? styles.metricGreen : styles.metricOrange}`}
                        style={{ width: `${current.pace}%` }}
                      />
                    </span>
                    <span className={styles.metricValue}>{current.pace}%</span>
                  </div>
                </div>

                <div className={styles.cueStack}>
                  <div className={`${styles.cueCard} ${current.cueType === 'HIGH CONFIDENCE' ? styles.cueCardGreen : styles.cueCardOrange}`}>
                    <div className={styles.cueType}>{current.cueType}</div>
                    <div className={styles.cueText}>{current.cue}</div>
                  </div>
                </div>
              </div>

              {/* Dots indicator */}
              <div className={styles.dotRow}>
                {demoData.map((_, i) => (
                  <span key={i} className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''}`} />
                ))}
              </div>
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
            Practice like the real thing.
            <br />
            <span className={styles.accent}>Coach along the way.</span>
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
              <WaitlistForm source="interview-bottom" ctaLabel="Notify me" placeholder="Your email address" />
            </>
          ) : (
            <>
              <h2 className={styles.footerCtaTitle}>Start free — the whole platform for $0</h2>
              <p className={styles.footerCtaDeck}>No card required. Upgrade when it&apos;s worth it.</p>
              <a href={signUpHref} className={styles.primaryCta}>
                Get started free
                <ArrowMark size={15} />
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
              <a href={signUpHref} className={styles.footerStart}>
                Start free <ArrowMark size={12} />
              </a>
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
