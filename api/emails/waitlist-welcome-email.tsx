import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

type WaitlistWelcomeEmailProps = {
  appUrl: string
  firstName?: string | null
}

const page = {
  backgroundColor: '#16110d',
  color: '#f4ede6',
  fontFamily: 'Arial, sans-serif',
  padding: '32px 0',
}

const card = {
  backgroundColor: '#201813',
  border: '1px solid rgba(232, 101, 10, 0.18)',
  borderRadius: '24px',
  padding: '36px',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.28)',
}

const eyebrow = {
  color: '#ff9b57',
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  margin: '0 0 18px',
}

const heading = {
  color: '#fff6ef',
  fontSize: '34px',
  fontWeight: '700',
  letterSpacing: '-0.03em',
  lineHeight: '1.1',
  margin: '0 0 16px',
}

const bodyText = {
  color: '#dbc9ba',
  fontSize: '16px',
  lineHeight: '1.75',
  margin: '0 0 16px',
}

const featureCard = {
  backgroundColor: '#271e17',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '18px',
  padding: '18px',
}

const featureTitle = {
  color: '#fff1e5',
  fontSize: '14px',
  fontWeight: '700',
  margin: '0 0 8px',
}

const featureText = {
  color: '#c9b7a7',
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '0',
}

const button = {
  backgroundColor: '#e8650a',
  borderRadius: '12px',
  color: '#fff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '700',
  padding: '14px 22px',
  textDecoration: 'none',
}

const footer = {
  color: '#a59080',
  fontSize: '12px',
  lineHeight: '1.7',
  margin: '0',
}

export default function WaitlistWelcomeEmail({
  appUrl,
  firstName,
}: WaitlistWelcomeEmailProps) {
  const greetingName = firstName?.trim() ? firstName.trim() : 'there'

  return (
    <Html>
      <Head />
      <Preview>You’re on the Arro waitlist. We’ll send the best stuff first.</Preview>
      <Body style={page}>
        <Container style={{ maxWidth: '620px', margin: '0 auto', padding: '0 18px' }}>
          <Section style={card}>
            <Text style={eyebrow}>Arro waitlist</Text>
            <Heading style={heading}>You’re in, {greetingName}.</Heading>
            <Text style={bodyText}>
              Thanks for joining the Arro waitlist. We’ll send product updates, launch access, and
              the sharpest new features as they come online.
            </Text>
            <Text style={bodyText}>
              Arro is built to make the entire search feel unfair in the right direction:
              tailored resumes, real interview practice, and prep that actually uses your
              background instead of generic templates.
            </Text>

            <Section style={{ margin: '28px 0 12px' }}>
              <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
                <tbody>
                  <tr>
                    <td width="50%" style={{ paddingRight: '8px', verticalAlign: 'top' }}>
                      <Section style={featureCard}>
                        <Text style={featureTitle}>Tailored resumes</Text>
                        <Text style={featureText}>
                          One master resume. Every role gets a version that sounds intentionally
                          written for it.
                        </Text>
                      </Section>
                    </td>
                    <td width="50%" style={{ paddingLeft: '8px', verticalAlign: 'top' }}>
                      <Section style={featureCard}>
                        <Text style={featureTitle}>Live interview practice</Text>
                        <Text style={featureText}>
                          Practice with a real conversational interviewer that knows the company,
                          job, and your background.
                        </Text>
                      </Section>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section style={{ margin: '12px 0 28px' }}>
              <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
                <tbody>
                  <tr>
                    <td width="50%" style={{ paddingRight: '8px', verticalAlign: 'top' }}>
                      <Section style={featureCard}>
                        <Text style={featureTitle}>Prep kits that compound</Text>
                        <Text style={featureText}>
                          Cover letters, screening answers, follow-ups, and negotiation prep from
                          the same source of truth.
                        </Text>
                      </Section>
                    </td>
                    <td width="50%" style={{ paddingLeft: '8px', verticalAlign: 'top' }}>
                      <Section style={featureCard}>
                        <Text style={featureTitle}>Higher signal job search</Text>
                        <Text style={featureText}>
                          Find roles that fit your actual story, not just a keyword match.
                        </Text>
                      </Section>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Button href={appUrl} style={button}>
              Explore Arro
            </Button>

            <Hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '28px 0 20px' }} />

            <Text style={footer}>
              You’re receiving this because you joined the Arro waitlist from the site. We’ll keep
              the updates worth opening.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
