import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

type WaitlistNotificationEmailProps = {
  email: string
  name?: string | null
  source?: string | null
  signedUpAt: string
}

const page = {
  backgroundColor: '#f4efe9',
  color: '#1f1a17',
  fontFamily: 'Arial, sans-serif',
  padding: '24px 0',
}

const card = {
  backgroundColor: '#ffffff',
  borderRadius: '20px',
  border: '1px solid #eadfd4',
  padding: '30px',
}

const label = {
  color: '#8b6b53',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  margin: '0 0 8px',
}

const value = {
  color: '#241b15',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
}

export default function WaitlistNotificationEmail({
  email,
  name,
  source,
  signedUpAt,
}: WaitlistNotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>New Arro waitlist signup: {email}</Preview>
      <Body style={page}>
        <Container style={{ maxWidth: '620px', margin: '0 auto', padding: '0 18px' }}>
          <Section style={card}>
            <Text style={{ ...label, color: '#e8650a' }}>New waitlist signup</Text>
            <Heading
              style={{
                color: '#17120f',
                fontSize: '28px',
                letterSpacing: '-0.02em',
                margin: '0 0 24px',
              }}
            >
              Someone joined the Arro list.
            </Heading>

            <Section style={{ marginBottom: '18px' }}>
              <Text style={label}>Email</Text>
              <Text style={value}>{email}</Text>
            </Section>

            <Section style={{ marginBottom: '18px' }}>
              <Text style={label}>Name</Text>
              <Text style={value}>{name?.trim() || 'Not provided'}</Text>
            </Section>

            <Section style={{ marginBottom: '18px' }}>
              <Text style={label}>Source</Text>
              <Text style={value}>{source?.trim() || 'Unknown'}</Text>
            </Section>

            <Section>
              <Text style={label}>Signed up</Text>
              <Text style={value}>{signedUpAt}</Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
