'use client'

import { useEffect, useMemo, useState } from 'react'
import { DM_Sans } from 'next/font/google'
import styles from './marketing-home.module.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
})

type MarketingHomeProps = {
  appBaseUrl: string
}

type FeatureCard = {
  title: string
  description: string
  tag: string
  tint: 'orange' | 'blue' | 'green' | 'amber' | 'neutral'
  featured?: boolean
}

type Point = {
  title: string
  description: string
}

type Plan = {
  tier: string
  price: string
  unit: string
  cadence: string
  cta: string
  href: string
  variant: 'default' | 'featured' | 'warm'
  badge?: string
  features: Array<{ label: string; included: boolean }>
}

const heroCards: FeatureCard[] = [
  {
    title: 'Master resume',
    description:
      'One comprehensive profile. Every application pulls from it — tailored, relevant, sharp. Never write the same thing twice.',
    tag: 'The foundation of everything',
    tint: 'orange',
    featured: true,
  },
  {
    title: 'Smart job feed',
    description:
      '50+ sources. Ranked by how well each role actually matches your background. No noise, no wasted time.',
    tag: 'Match scores from your profile',
    tint: 'blue',
  },
  {
    title: 'Instant prep kit',
    description:
      'Tailored resume, cover letter, screening answers, follow-ups — generated for each role in one tap.',
    tag: 'Seconds, not hours',
    tint: 'green',
  },
  {
    title: 'Interview copilot',
    description:
      'Practice with a voice AI, get real-time coaching. Pause and ask the copilot anything. Walk in knowing exactly what to say.',
    tag: 'Our most powerful feature',
    tint: 'amber',
  },
]

const resumePoints: Point[] = [
  {
    title: 'Your complete career story',
    description:
      'Upload your resume — or build from scratch with AI assistance. Arro extracts every role, every achievement, every skill. The more detail, the better everything else works.',
  },
  {
    title: 'AI digs deeper',
    description:
      "Most people undersell themselves on paper. Arro's deep dive asks the questions a great career coach would — surfacing achievements you forgot to mention and turning them into sharp bullet points.",
  },
  {
    title: 'Tailored automatically, every time',
    description:
      'When you apply to a role, Arro reads the job description and selects the most relevant pieces of your master resume. The result is a resume that feels written for that specific job — because it was.',
  },
]

const featureGrid: FeatureCard[] = [
  {
    title: 'Smart job feed',
    description:
      'Aggregated from 50+ sources and ranked by match score — not recency. You see the roles most likely to want you, first. Built-in LinkedIn URL builder for recent postings.',
    tag: '50+ sources',
    tint: 'blue',
  },
  {
    title: 'Tailored resume — per job',
    description:
      'Every application gets its own resume. Arro reads the job description, selects the most relevant sections of your master profile, and outputs a document that reads like it was written for that role specifically.',
    tag: '1-tap generation',
    tint: 'orange',
  },
  {
    title: 'Full application prep kit',
    description:
      'Cover letter, screening question answers, follow-up emails, negotiation notes — all generated from your master profile and the job description. Everything a complete application needs.',
    tag: '4 documents, 1 tap',
    tint: 'green',
  },
  {
    title: 'Company overview',
    description:
      "Know who you're walking in to meet. Culture, team structure, day-in-the-life breakdown — generated before every interview so you ask the right questions and say the right things.",
    tag: 'Research, automated',
    tint: 'amber',
  },
  {
    title: 'Voice practice interview',
    description:
      'A full conversational interview powered by AI — trained on the job description, your resume, and your prep kit. Feels like the real thing because it is built from the real context.',
    tag: 'Powered by your prep kit',
    tint: 'orange',
  },
  {
    title: 'Job tracker',
    description:
      'Every job you save or apply to lives in one place — with its prep kit, tailored resume, and interview history attached. See exactly where every application stands.',
    tag: 'Full application pipeline',
    tint: 'neutral',
  },
]

const interviewPoints: Point[] = [
  {
    title: 'Fully personalized interview',
    description:
      'Built from your tailored resume, the company overview, and the job description. The questions feel real because they are based on what that interviewer is actually likely to ask.',
  },
  {
    title: 'Live copilot cues',
    description:
      'Real-time feedback as you speak — confidence score, pacing, response length, and cues like “rambling,” “add more detail,” and relevant topics pulled from your master resume.',
  },
  {
    title: 'Pause and ask anything',
    description:
      'Hit pause mid-interview and chat with the copilot directly. Ask for feedback on your last answer, request a hint for the next question, or get talking points from your master resume.',
  },
  {
    title: 'Always-on listening',
    description:
      'No tap-to-speak. The interview flows like a real conversation. Arro listens, responds, and coaches — you focus on your answers, not the interface.',
  },
]

const proofItems = [
  'Upload once, apply everywhere',
  'Resume tailored per job in seconds',
  'Real-time interview coaching',
]

function buildHref(appBaseUrl: string, path: string): string {
  if (!appBaseUrl) return path
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${appBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

function getFeatureTintClass(tint: FeatureCard['tint']): string {
  switch (tint) {
    case 'orange':
      return styles.tintOrange
    case 'blue':
      return styles.tintBlue
    case 'green':
      return styles.tintGreen
    case 'amber':
      return styles.tintAmber
    default:
      return styles.tintNeutral
  }
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

function CloseMark() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
      <path d="M2.5 2.5l3 3M5.5 2.5l-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export default function MarketingHome({ appBaseUrl }: MarketingHomeProps) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [activeSection, setActiveSection] = useState('')

  const signUpHref = buildHref(appBaseUrl, '/sign-up')
  const signInHref = buildHref(appBaseUrl, '/sign-in')
  const freeHref = signUpHref
  const proHref = buildHref(
    appBaseUrl,
    billing === 'annual' ? '/sign-up?plan=pro_annual' : '/sign-up?plan=pro_monthly',
  )
  const creditsHref = buildHref(appBaseUrl, '/sign-up?intent=credits')

  const plans = useMemo<Plan[]>(
    () => [
      {
        tier: 'Free',
        price: '$0',
        unit: '/mo',
        cadence: 'Forever. No card required.',
        cta: 'Start for free',
        href: freeHref,
        variant: 'default',
        features: [
          { label: 'Master resume builder', included: true },
          { label: '3 tailored resumes', included: true },
          { label: '20 credits / month', included: true },
          { label: '1 prep kit', included: true },
          { label: 'Limited job feed', included: false },
          { label: 'Priority support', included: false },
        ],
      },
      {
        tier: 'Pro',
        price: billing === 'annual' ? '$18' : '$24',
        unit: '/mo',
        cadence: billing === 'annual' ? 'Billed $216/year · cancel anytime' : 'Billed monthly · cancel anytime',
        cta: billing === 'annual' ? 'Start Pro — $18/month' : 'Start Pro — $24/month',
        href: proHref,
        variant: 'featured',
        badge: 'Most popular',
        features: [
          { label: 'Unlimited resumes + prep kits', included: true },
          { label: '100 credits per month', included: true },
          { label: 'Full job feed — all sources', included: true },
          { label: 'Practice interviews + copilot', included: true },
          { label: 'Company overviews', included: true },
          { label: 'Priority support', included: true },
        ],
      },
      {
        tier: 'Credits',
        price: 'Pay',
        unit: ' as you go',
        cadence: 'Top up whenever. Credits never expire.',
        cta: 'Buy credits',
        href: creditsHref,
        variant: 'warm',
        features: [
          { label: '50 credits — $4.99', included: true },
          { label: '150 credits — $11.99 · 20% off', included: true },
          { label: '500 credits — $34.99 · 30% off', included: true },
          { label: 'Works on any plan', included: true },
          { label: 'No subscription needed', included: true },
          { label: 'Interview (20) · Prep kit (15) · Resume (5)', included: false },
        ],
      },
    ],
    [billing, creditsHref, freeHref, proHref],
  )

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

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('section[id]'))
    const updateActiveSection = () => {
      let current = ''
      sections.forEach((section) => {
        if (window.scrollY >= section.offsetTop - 140) {
          current = section.id
        }
      })
      setActiveSection(current)
    }

    updateActiveSection()
    window.addEventListener('scroll', updateActiveSection, { passive: true })
    return () => window.removeEventListener('scroll', updateActiveSection)
  }, [])

  const pageStyle = {
    ['--marketing-font-body' as string]: dmSans.style.fontFamily,
    ['--marketing-font-display' as string]: `'Geist', ${dmSans.style.fontFamily}`,
  }

  return (
    <main className={`${styles.page} ${dmSans.className}`} style={pageStyle}>
      <style jsx global>{`
        @font-face {
          font-family: 'Geist';
          src: url('https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist-sans/Geist-Regular.woff2')
            format('woff2');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Geist';
          src: url('https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist-sans/Geist-Medium.woff2')
            format('woff2');
          font-weight: 500;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Geist';
          src: url('https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist-sans/Geist-SemiBold.woff2')
            format('woff2');
          font-weight: 600;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Geist';
          src: url('https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist-sans/Geist-Bold.woff2')
            format('woff2');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        html {
          scroll-behavior: smooth;
        }
      `}</style>

      <nav className={styles.nav}>
        <a href="#top" className={styles.navLogo}>
          <span className={styles.logoMark}>
            <ArrowMark />
          </span>
          <span className={styles.wordmark}>arro</span>
        </a>

        <div className={styles.navLinks}>
          {[
            ['#resume', 'Master resume'],
            ['#features', 'Features'],
            ['#interview', 'Interview'],
            ['#pricing', 'Pricing'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className={`${styles.navLink} ${activeSection && href === `#${activeSection}` ? styles.navLinkActive : ''}`}
            >
              {label}
            </a>
          ))}
        </div>

        <div className={styles.navRight}>
          <a href={signInHref} className={styles.navSignIn}>
            Sign in
          </a>
          <a href={freeHref} className={styles.navCta}>
            Start free
          </a>
        </div>
      </nav>

      <div className={styles.heroWrap} id="top">
        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.kicker}>
              <span className={styles.kickerLine} />
              AI-powered job search
            </div>

            <h1 className={styles.heroTitle}>
              Every other
              <br />
              candidate is
              <br />
              <span className={styles.accent}>winging it.</span>
              <br />
              <span className={styles.dim}>You won&apos;t be.</span>
            </h1>

            <p className={styles.heroDeck}>
              Arro gives you a <strong>master resume</strong> that tailors itself to every job, an AI that preps your
              applications in seconds, and a <strong>practice interview with a live copilot</strong> — so you walk in
              knowing exactly what to say.
            </p>

            <div className={styles.heroActions}>
              <a href={freeHref} className={styles.primaryCta}>
                Start free — no card needed
                <ArrowMark size={15} />
              </a>
              <a href="#resume" className={styles.ghostCta}>
                See how it works
              </a>
            </div>

            <div className={styles.heroProof}>
              {proofItems.map((item, index) => (
                <div key={item} className={styles.proofCluster}>
                  <span className={styles.proofItem}>
                    <span className={styles.proofCheck}>
                      <CheckMark />
                    </span>
                    {item}
                  </span>
                  {index < proofItems.length - 1 ? <span className={styles.proofDot} /> : null}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.heroRight}>
            <div className={styles.heroCards}>
              {heroCards.map((card) => (
                <article
                  key={card.title}
                  className={`${styles.heroCard} ${card.featured ? styles.heroCardFeatured : ''}`}
                >
                  <div className={styles.heroCardTop}>
                    <span className={`${styles.heroCardIcon} ${getFeatureTintClass(card.tint)}`}>
                      <ArrowMark size={12} />
                    </span>
                    <span className={styles.heroCardTitle}>{card.title}</span>
                  </div>
                  <p className={styles.heroCardDescription}>{card.description}</p>
                  <span className={`${styles.heroCardTag} ${getFeatureTintClass(card.tint)}`}>{card.tag}</span>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className={styles.resumeSection} id="resume">
        <div className={styles.sectionWrap}>
          <div className={styles.resumeGrid}>
            <div className={`${styles.resumeContent} ${styles.reveal}`}>
              <div className={styles.eyebrow}>
                <span className={styles.eyebrowLine} />
                Master resume
              </div>
              <h2 className={styles.sectionTitle}>
                One profile.
                <br />
                <span className={styles.accent}>Every</span> application.
              </h2>
              <p className={styles.sectionDeck}>
                Most candidates submit the same resume to every job. That&apos;s why they don&apos;t hear back. Arro
                works differently.
              </p>

              <div className={styles.resumePoints}>
                {resumePoints.map((point, index) => (
                  <div key={point.title} className={styles.resumePoint}>
                    <span className={styles.resumeNumber}>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <h3 className={styles.pointTitle}>{point.title}</h3>
                      <p className={styles.pointDescription}>{point.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${styles.resumeVisual} ${styles.reveal}`}>
              <div className={styles.resumeLabel}>Master resume → tailored output</div>
              <div className={`${styles.resumeJob} ${styles.resumeJobActive}`}>
                <div className={`${styles.resumeLogo} ${styles.tintOrange}`}>Fi</div>
                <div>
                  <div className={styles.resumeRole}>Senior Product Designer</div>
                  <div className={styles.resumeCompany}>Figma · Tailoring now…</div>
                </div>
                <div className={styles.resumeMatch}>94% match</div>
              </div>

              <div className={styles.resumeDivider}>
                <span>Pulled from master resume</span>
              </div>

              <div className={styles.resumeBullets}>
                <div className={`${styles.resumeBullet} ${styles.resumeBulletHighlight}`}>
                  <span className={styles.resumeBulletDot}>·</span>
                  Led digital activations for Toyota, VW, Porsche across web and mobile — selected because the role
                  requires OEM-scale systems thinking.
                </div>
                <div className={`${styles.resumeBullet} ${styles.resumeBulletHighlight}`}>
                  <span className={styles.resumeBulletDot}>·</span>
                  Built an Airtable workflow saving 6+ hrs/week — demonstrates product-minded engineering, relevant to
                  Figma&apos;s design-engineering culture.
                </div>
                <div className={styles.resumeBullet}>
                  <span className={styles.resumeBulletDot}>·</span>
                  Co-founded Donor Registry Committee — shows cross-functional leadership.
                </div>
              </div>

              <div className={styles.resumeAltJobs}>
                <div className={`${styles.resumeJob} ${styles.resumeJobMuted}`}>
                  <div className={styles.resumeLogo}>Li</div>
                  <div>
                    <div className={styles.resumeRole}>Product Manager, Growth</div>
                    <div className={styles.resumeCompany}>Linear · Different selection</div>
                  </div>
                  <div className={styles.resumeMatch}>88%</div>
                </div>
                <div className={`${styles.resumeJob} ${styles.resumeJobMutedMore}`}>
                  <div className={styles.resumeLogo}>Ve</div>
                  <div>
                    <div className={styles.resumeRole}>Technical PM</div>
                    <div className={styles.resumeCompany}>Vercel · Different selection</div>
                  </div>
                  <div className={styles.resumeMatch}>85%</div>
                </div>
              </div>

              <div className={styles.resumeNote}>
                <strong>Why this works:</strong> Same person, three different resumes — each one surfacing the
                experience most relevant to that specific role. This is what a top recruiter does manually. Arro does
                it instantly.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.featuresSection} id="features">
        <div className={styles.sectionWrap}>
          <div className={`${styles.eyebrow} ${styles.reveal}`}>
            <span className={styles.eyebrowLine} />
            Everything you need
          </div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
            Built for people who
            <br />
            take this <span className={styles.accent}>seriously.</span>
          </h2>
          <p className={`${styles.sectionDeck} ${styles.reveal}`}>
            Every feature exists to give you an edge over candidates who are just uploading the same PDF everywhere.
          </p>

          <div className={styles.featureGrid}>
            {featureGrid.map((feature) => (
              <article key={feature.title} className={`${styles.featureCard} ${styles.reveal}`}>
                <span className={`${styles.featureIcon} ${getFeatureTintClass(feature.tint)}`}>
                  <ArrowMark size={12} />
                </span>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
                <span className={`${styles.featureTag} ${getFeatureTintClass(feature.tint)}`}>{feature.tag}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.interviewSection} id="interview">
        <div className={styles.sectionWrap}>
          <div className={styles.interviewGrid}>
            <div className={`${styles.phoneShell} ${styles.reveal}`}>
              <div className={styles.phoneTop}>
                <div className={styles.phoneHeaderRow}>
                  <div>
                    <div className={styles.phoneJob}>Senior Product Designer</div>
                    <div className={styles.phoneCompany}>Figma · Practice interview</div>
                  </div>
                  <div className={styles.phoneStatusRow}>
                    <span className={styles.phoneTimer}>12:34</span>
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
                <div className={`${styles.bubble} ${styles.bubbleAi}`}>
                  <div className={`${styles.bubbleSpeaker} ${styles.bubbleSpeakerAi}`}>ARRO AI</div>
                  Tell me about a project where you had to align design, engineering, and stakeholders under a tight
                  deadline.
                </div>
                <div className={`${styles.bubble} ${styles.bubbleUser}`}>
                  <div className={`${styles.bubbleSpeaker} ${styles.bubbleSpeakerUser}`}>YOU</div>
                  One that stands out was an OEM program rollout where we had multiple launch dependencies. I started
                  by framing the delivery risk...
                </div>
              </div>

              <div className={styles.copilotPanel}>
                <div className={styles.copilotHeader}>
                  <span className={styles.copilotDot} />
                  INTERVIEW COPILOT
                </div>

                <div className={styles.metricList}>
                  {[
                    ['Confidence', '74%', styles.metricOrange, '74%'],
                    ['Pace', '82%', styles.metricGreen, 'Good'],
                    ['Length', '38%', styles.metricNeutral, '38%'],
                  ].map(([label, width, tone, value]) => (
                    <div key={label} className={styles.metricRow}>
                      <span className={styles.metricLabel}>{label}</span>
                      <span className={styles.metricTrack}>
                        <span className={`${styles.metricFill} ${tone}`} style={{ width }} />
                      </span>
                      <span className={styles.metricValue}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.cueStack}>
                  <div className={`${styles.cueCard} ${styles.cueCardOrange}`}>
                    <div className={styles.cueType}>FROM YOUR RESUME</div>
                    <div className={styles.cueText}>Use one of these topic anchors to tighten the answer.</div>
                    <div className={styles.cueChips}>
                      <span className={styles.cueChip}>Toyota launch</span>
                      <span className={styles.cueChip}>VW activation</span>
                      <span className={styles.cueChip}>Airtable workflow</span>
                    </div>
                  </div>
                  <div className={`${styles.cueCard} ${styles.cueCardGreen}`}>
                    <div className={styles.cueType}>STRONG START</div>
                    <div className={styles.cueText}>Good structure. Add a measurable outcome before you close.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${styles.interviewContent} ${styles.reveal}`}>
              <div className={styles.eyebrow}>
                <span className={styles.eyebrowLine} />
                Practice interview + copilot
              </div>
              <h2 className={styles.sectionTitle}>
                Walk in knowing
                <br />
                exactly what
                <br />
                to <span className={styles.accent}>say.</span>
              </h2>
              <p className={styles.sectionDeck}>
                Other candidates hope for the best. You practiced with an AI that knows the role, your background, and
                what interviewers at this specific company are looking for.
              </p>

              <div className={styles.interviewPoints}>
                {interviewPoints.map((point) => (
                  <div key={point.title} className={styles.interviewPoint}>
                    <span className={styles.interviewPointIcon}>
                      <ArrowMark size={12} />
                    </span>
                    <div>
                      <h3 className={styles.pointTitle}>{point.title}</h3>
                      <p className={styles.pointDescription}>{point.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.pricingSection} id="pricing">
        <div className={styles.sectionWrap}>
          <div className={`${styles.eyebrow} ${styles.reveal}`}>
            <span className={styles.eyebrowLine} />
            Pricing
          </div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
            Start free.
            <br />
            Pay when it&apos;s <span className={styles.accent}>worth it.</span>
          </h2>
          <p className={`${styles.sectionDeck} ${styles.reveal}`}>
            Most people get hired on the free plan. Upgrade when you&apos;re applying seriously — or top up credits
            for the features that need more AI.
          </p>

          <div className={`${styles.pricingToggleRow} ${styles.reveal}`}>
            <div className={styles.toggleShell}>
              <button
                type="button"
                className={`${styles.toggleButton} ${billing === 'monthly' ? styles.toggleButtonActive : ''}`}
                onClick={() => setBilling('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`${styles.toggleButton} ${billing === 'annual' ? styles.toggleButtonActive : ''}`}
                onClick={() => setBilling('annual')}
              >
                Annual
              </button>
            </div>
            {billing === 'annual' ? <span className={styles.savePill}>Save 25%</span> : null}
          </div>

          <div className={`${styles.planGrid} ${styles.reveal}`}>
            {plans.map((plan) => (
              <article
                key={plan.tier}
                className={`${styles.planCard} ${
                  plan.variant === 'featured'
                    ? styles.planCardFeatured
                    : plan.variant === 'warm'
                      ? styles.planCardWarm
                      : ''
                }`}
              >
                {plan.badge ? <div className={styles.planBadge}>{plan.badge}</div> : null}
                <div className={styles.planTier}>{plan.tier}</div>
                <div className={styles.planPrice}>
                  {plan.price}
                  <span className={styles.planUnit}>{plan.unit}</span>
                </div>
                <div className={styles.planCadence}>{plan.cadence}</div>
                <div className={styles.planDivider} />
                <ul className={styles.planFeatureList}>
                  {plan.features.map((feature) => (
                    <li
                      key={feature.label}
                      className={`${styles.planFeature} ${feature.included ? '' : styles.planFeatureMuted}`}
                    >
                      <span className={feature.included ? styles.planIconCheck : styles.planIconClose}>
                        {feature.included ? <CheckMark /> : <CloseMark />}
                      </span>
                      {feature.label}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  className={`${styles.planButton} ${
                    plan.variant === 'featured'
                      ? styles.planButtonSolid
                      : plan.variant === 'warm'
                        ? styles.planButtonWarm
                        : styles.planButtonOutline
                  }`}
                >
                  {plan.cta}
                </a>
              </article>
            ))}
          </div>

          <p className={`${styles.pricingNote} ${styles.reveal}`}>
            Free plan includes 20 credits/month · Pro includes 100 credits/month · Credits roll over one cycle ·{' '}
            <a href="#pricing">Full credit breakdown</a>
          </p>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerWrap}>
          <div className={styles.footerTop}>
            <div>
              <a href="#top" className={styles.footerBrand}>
                <span className={styles.footerMark}>
                  <ArrowMark size={13} />
                </span>
                <span className={styles.footerWordmark}>arro</span>
              </a>
              <p className={styles.footerTagline}>
                Your career, forward. AI-powered job search for people who take getting hired seriously.
              </p>
              <a href={freeHref} className={styles.footerStart}>
                Start free
                <ArrowMark size={12} />
              </a>
            </div>

            <div>
              <div className={styles.footerTitle}>Product</div>
              <div className={styles.footerLinks}>
                <a href="/jobs">Job feed</a>
                <a href="/resume">Resume builder</a>
                <a href="/interview">Interview copilot</a>
                <a href="/prep-kit">Prep kit</a>
                <a href="#pricing">Pricing</a>
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
