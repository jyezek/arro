import { useSignUp } from '@clerk/clerk-expo'
import { Link, useRouter, useLocalSearchParams } from 'expo-router'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { useState } from 'react'
import { Colors, FontSize, Radius, Spacing, wm } from '@/constants/Colors'
import { deleteItem, setItem } from '@/lib/storage'

type ClerkErrorLike = {
  errors?: Array<{
    code?: string
    message?: string
    longMessage?: string
  }>
}

type VerificationAttemptResult = {
  status: string
  createdSessionId?: string | null
  requiredFields?: string[]
  missingFields?: string[]
  unverifiedFields?: string[]
}

type SignUpResourceLike = VerificationAttemptResult & {
  create: (params: Record<string, unknown>) => Promise<unknown>
  prepareEmailAddressVerification: (params: { strategy: 'email_code' }) => Promise<unknown>
  attemptEmailAddressVerification: (params: { code: string }) => Promise<VerificationAttemptResult>
  update?: (params: Record<string, unknown>) => Promise<unknown>
  preparePhoneNumberVerification?: (params?: { strategy?: 'phone_code' }) => Promise<unknown>
  attemptPhoneNumberVerification?: (params: { code: string }) => Promise<VerificationAttemptResult>
}

function getClerkErrorMessage(err: unknown, fallback: string): string {
  const clerkErr = err as ClerkErrorLike
  const detail = clerkErr?.errors?.[0]
  return detail?.longMessage ?? detail?.message ?? (err instanceof Error ? err.message : fallback)
}

function formatFieldLabel(field: string): string {
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
}

function getVerificationMessage(result: VerificationAttemptResult): string {
  const missing = Array.from(new Set([
    ...(result.missingFields ?? []),
    ...(result.unverifiedFields ?? []),
  ]))

  if (missing.length > 0) {
    return `Verification incomplete. Still needed: ${missing.map(formatFieldLabel).join(', ')}.`
  }

  const required = result.requiredFields ?? []
  if (required.length > 0) {
    return `Verification incomplete. Required fields: ${required.map(formatFieldLabel).join(', ')}.`
  }

  return `Verification incomplete: ${result.status}. Request a new code and try again.`
}

function includesPhoneField(fields?: string[]): boolean {
  return (fields ?? []).some(field => ['phone_number', 'phoneNumber'].includes(field))
}

function needsPhoneNumber(result: VerificationAttemptResult): boolean {
  return includesPhoneField(result.requiredFields)
    || includesPhoneField(result.missingFields)
    || includesPhoneField(result.unverifiedFields)
}

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp()
  const router = useRouter()
  const { plan, intent } = useLocalSearchParams<{ plan?: string; intent?: string }>()
  const signUpResource = signUp as SignUpResourceLike | undefined

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [verificationStage, setVerificationStage] = useState<'email' | 'phone' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const startPhoneVerification = async (rawPhoneNumber: string) => {
    const normalizedPhoneNumber = rawPhoneNumber.trim()
    if (!normalizedPhoneNumber) {
      setError('Phone number is required by your Clerk configuration. Enter a phone number in E.164 format, like +15551234567.')
      return
    }

    if (!signUpResource) {
      setError('Sign up is not ready yet.')
      return
    }

    try {
      if (typeof signUpResource.update === 'function') {
        await signUpResource.update({ phoneNumber: normalizedPhoneNumber })
      } else {
        await signUpResource.create({ phoneNumber: normalizedPhoneNumber })
      }
      if (typeof signUpResource.preparePhoneNumberVerification !== 'function') {
        setError('Phone verification is not available in the current Clerk SDK.')
        return
      }
      await signUpResource.preparePhoneNumberVerification({ strategy: 'phone_code' })
      setPhoneNumber(normalizedPhoneNumber)
      setPhoneCode('')
      setVerificationStage('phone')
      setInfo(`We sent a verification code to ${normalizedPhoneNumber}.`)
    } catch (err: unknown) {
      if (__DEV__) console.warn('[sign-up phone prepare]', err)
      setError(getClerkErrorMessage(err, 'Could not send phone verification code'))
    }
  }

  const onSignUp = async () => {
    if (!isLoaded || loading || !signUpResource) return

    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPhoneNumber = phoneNumber.trim()

    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !password) {
      setError('First name, last name, email, and password are required.')
      return
    }

    setLoading(true)
    setError('')
    setInfo('')
    try {
      await deleteItem('onboarding_complete')
      await signUpResource.create({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        emailAddress: trimmedEmail,
        ...(trimmedPhoneNumber ? { phoneNumber: trimmedPhoneNumber } : {}),
        password,
      })
      await signUpResource.prepareEmailAddressVerification({ strategy: 'email_code' })
      setVerificationStage('email')
      setEmail(trimmedEmail)
      setPhoneNumber(trimmedPhoneNumber)
      setInfo(`We sent a 6-digit code to ${trimmedEmail}.`)
    } catch (err: unknown) {
      if (__DEV__) console.warn('[sign-up create]', err)
      const msg = getClerkErrorMessage(err, 'Sign up failed')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const onVerify = async () => {
    if (!isLoaded || loading || !signUpResource) return
    setLoading(true)
    setError('')
    setInfo('')
    try {
      const result = await signUpResource.attemptEmailAddressVerification({ code: code.trim() })
      if (result.status === 'complete') {
        await deleteItem('onboarding_complete')
        // Store intent so _layout can redirect after onboarding completes
        const pendingIntent = plan ?? intent
        if (pendingIntent) await setItem('pending_intent', pendingIntent)
        await setActive({ session: result.createdSessionId })
        router.replace('/onboarding')
      } else if (needsPhoneNumber(result)) {
        await startPhoneVerification(phoneNumber)
      } else {
        if (__DEV__) console.warn('[sign-up verify result]', result)
        setError(getVerificationMessage(result))
      }
    } catch (err: unknown) {
      if (__DEV__) console.warn('[sign-up verify]', err)
      const msg = getClerkErrorMessage(err, 'Verification failed')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const onResend = async () => {
    if (!isLoaded || loading || !signUpResource) return
    setLoading(true)
    setError('')
    setInfo('')
    try {
      await signUpResource.prepareEmailAddressVerification({ strategy: 'email_code' })
      setInfo(`We sent a fresh code to ${email}.`)
    } catch (err: unknown) {
      if (__DEV__) console.warn('[sign-up resend]', err)
      const msg = getClerkErrorMessage(err, 'Could not resend verification code')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const onVerifyPhone = async () => {
    if (!isLoaded || loading || !signUpResource || typeof signUpResource.attemptPhoneNumberVerification !== 'function') return
    setLoading(true)
    setError('')
    setInfo('')
    try {
      const result = await signUpResource.attemptPhoneNumberVerification({ code: phoneCode.trim() })
      if (result.status === 'complete') {
        await deleteItem('onboarding_complete')
        const pendingIntent = plan ?? intent
        if (pendingIntent) await setItem('pending_intent', pendingIntent)
        await setActive({ session: result.createdSessionId })
        router.replace('/onboarding')
      } else {
        if (__DEV__) console.warn('[sign-up phone verify result]', result)
        setError(getVerificationMessage(result))
      }
    } catch (err: unknown) {
      if (__DEV__) console.warn('[sign-up phone verify]', err)
      setError(getClerkErrorMessage(err, 'Phone verification failed'))
    } finally {
      setLoading(false)
    }
  }

  const onResendPhone = async () => {
    if (!isLoaded || loading) return
    setLoading(true)
    setError('')
    setInfo('')
    try {
      await startPhoneVerification(phoneNumber)
    } finally {
      setLoading(false)
    }
  }

  if (verificationStage === 'email') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>

          {info ? (
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>{info}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="Verification code"
            placeholderTextColor={wm(0.25)}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoFocus
          />
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
            onPress={onVerify}
            disabled={loading || code.trim().length < 6}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnText}>Verify email</Text>
            }
          </Pressable>

          <View style={styles.verifyActions}>
            <Pressable onPress={onResend} disabled={loading}>
              <Text style={styles.secondaryLink}>Resend code</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setVerificationStage(null)
                setCode('')
                setError('')
                setInfo('')
                void deleteItem('onboarding_complete')
              }}
              disabled={loading}
            >
              <Text style={styles.secondaryLink}>Use a different email</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    )
  }

  if (verificationStage === 'phone') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          <Text style={styles.title}>Verify your phone</Text>
          <Text style={styles.subtitle}>Clerk requires a verified phone number for this sign-up.</Text>

          {info ? (
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>{info}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="+15551234567"
            placeholderTextColor={wm(0.25)}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoFocus={!phoneNumber}
          />
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
            onPress={() => void startPhoneVerification(phoneNumber)}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnText}>{phoneCode ? 'Send a new code' : 'Send phone code'}</Text>
            }
          </Pressable>

          <TextInput
            style={styles.input}
            placeholder="SMS verification code"
            placeholderTextColor={wm(0.25)}
            value={phoneCode}
            onChangeText={setPhoneCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
          />
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
            onPress={onVerifyPhone}
            disabled={loading || phoneCode.trim().length < 6}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnText}>Verify phone</Text>
            }
          </Pressable>

          <View style={styles.verifyActions}>
            <Pressable onPress={onResendPhone} disabled={loading}>
              <Text style={styles.secondaryLink}>Resend code</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setVerificationStage('email')
                setPhoneCode('')
                setError('')
                setInfo('')
              }}
              disabled={loading}
            >
              <Text style={styles.secondaryLink}>Back to email</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoArrow}>→</Text>
          </View>
          <Text style={styles.wordmark}>
            arr<Text style={styles.wordmarkO}>o</Text>
          </Text>
        </View>

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Your career, forward.</Text>

        {info ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>{info}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="First name"
              placeholderTextColor={wm(0.25)}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Last name"
              placeholderTextColor={wm(0.25)}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={wm(0.25)}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Phone number (optional unless required by Clerk)"
            placeholderTextColor={wm(0.25)}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={wm(0.25)}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
            onPress={onSignUp}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnText}>Create account — it&apos;s free</Text>
            }
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </Link>
        </View>

        <Text style={styles.terms}>
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  inner: {
    flexGrow: 1,
    paddingHorizontal: Spacing[7],
    justifyContent: 'center',
    gap: Spacing[4],
    paddingVertical: Spacing[9],
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  logoMark: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  logoArrow: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  wordmark: {
    fontSize: FontSize['3xl'], fontWeight: '600',
    color: wm(0.9), letterSpacing: -0.6,
  },
  wordmarkO: { color: Colors.orange },
  title: {
    fontSize: FontSize.hero, fontWeight: '600',
    color: wm(0.9), letterSpacing: -0.5,
  },
  subtitle: { fontSize: FontSize.md, color: wm(0.4) },
  errorBanner: {
    backgroundColor: 'rgba(226,75,74,0.1)', borderRadius: Radius.input,
    padding: Spacing[4], borderWidth: 1, borderColor: 'rgba(226,75,74,0.2)',
  },
  infoBanner: {
    backgroundColor: 'rgba(232,101,10,0.1)', borderRadius: Radius.input,
    padding: Spacing[4], borderWidth: 1, borderColor: 'rgba(232,101,10,0.2)',
  },
  errorText: { color: Colors.red, fontSize: FontSize.base },
  infoText: { color: Colors.orange, fontSize: FontSize.base },
  form: { gap: Spacing[3] },
  row: { flexDirection: 'row', gap: Spacing[3] },
  input: {
    backgroundColor: wm(0.05),
    borderRadius: Radius.inputLg,
    borderWidth: 1, borderColor: wm(0.1),
    paddingHorizontal: Spacing[6], paddingVertical: 13,
    fontSize: FontSize.md, color: wm(0.85),
  },
  btn: {
    backgroundColor: Colors.orange, borderRadius: Radius.card,
    paddingVertical: 15, alignItems: 'center', marginTop: Spacing[2],
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '600' },
  verifyActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing[3],
    marginTop: Spacing[1],
  },
  secondaryLink: { color: Colors.orange, fontSize: FontSize.base, fontWeight: '500' },
  footer: {
    flexDirection: 'row', justifyContent: 'center', marginTop: Spacing[5],
  },
  footerText: { color: wm(0.35), fontSize: FontSize.base },
  footerLink: { color: Colors.orange, fontSize: FontSize.base, fontWeight: '600' },
  terms: {
    textAlign: 'center', color: wm(0.25),
    fontSize: FontSize.sm, lineHeight: 16, marginTop: Spacing[3],
  },
})
