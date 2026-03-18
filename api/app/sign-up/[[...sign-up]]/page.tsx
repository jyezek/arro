import { redirect } from 'next/navigation'
import { SignUp } from '@clerk/nextjs'
import { resolveWaitlistMode } from '../../app-base-url'
import styles from '../../auth-page.module.css'

export default function SignUpPage() {
  if (resolveWaitlistMode()) {
    redirect('/')
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={`${styles.panel} ${styles.intro}`}>
          <div>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowLine} />
              Start free
            </div>
            <h1 className={styles.title}>
              Create your
              <span className={styles.accent}> Arro</span> account
            </h1>
            <p className={styles.deck}>
              Build a living master resume, generate role-specific application assets, and rehearse interviews with a copilot that knows your story.
            </p>
            <div className={styles.points}>
              <div className={styles.point}>
                <span className={styles.pointDot}>1</span>
                <p className={styles.pointText}>Upload your resume once and let Arro structure the raw material.</p>
              </div>
              <div className={styles.point}>
                <span className={styles.pointDot}>2</span>
                <p className={styles.pointText}>Generate tailored resumes and prep kits for each role in seconds.</p>
              </div>
              <div className={styles.point}>
                <span className={styles.pointDot}>3</span>
                <p className={styles.pointText}>Practice with a live interview copilot before the real conversation.</p>
              </div>
            </div>
          </div>
          <a href="/" className={styles.homeLink}>
            Return to marketing site
          </a>
        </section>

        <section className={`${styles.panel} ${styles.authCard}`}>
          <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
        </section>
      </div>
    </main>
  )
}
