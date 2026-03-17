import { SignIn } from '@clerk/nextjs'
import styles from '../../auth-page.module.css'

export default function SignInPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={`${styles.panel} ${styles.intro}`}>
          <div>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowLine} />
              Arro access
            </div>
            <h1 className={styles.title}>
              Sign in to
              <span className={styles.accent}> Arro</span>
            </h1>
            <p className={styles.deck}>
              Pick up where you left off: matched jobs, tailored resumes, prep kits, and interview practice all stay attached to your profile.
            </p>
            <div className={styles.points}>
              <div className={styles.point}>
                <span className={styles.pointDot}>1</span>
                <p className={styles.pointText}>Your master resume stays in sync across every application.</p>
              </div>
              <div className={styles.point}>
                <span className={styles.pointDot}>2</span>
                <p className={styles.pointText}>Re-open any prep kit or interview session without rebuilding context.</p>
              </div>
              <div className={styles.point}>
                <span className={styles.pointDot}>3</span>
                <p className={styles.pointText}>Everything in Arro compounds as you use it more.</p>
              </div>
            </div>
          </div>
          <a href="/" className={styles.homeLink}>
            Return to marketing site
          </a>
        </section>

        <section className={`${styles.panel} ${styles.authCard}`}>
          <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
        </section>
      </div>
    </main>
  )
}
