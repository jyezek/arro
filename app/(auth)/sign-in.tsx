import { useSignIn } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useState } from 'react'
import { Colors, FontSize, Radius, Spacing, wm } from '@/constants/Colors'

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSignIn = async () => {
    if (!isLoaded || loading) return
    setLoading(true)
    setError('')
    try {
      const result = await signIn.create({ identifier: email, password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        router.replace('/(tabs)')
      } else {
        // Unexpected status — surface it so we can debug
        setError(`Sign in incomplete: ${result.status}. Check your Clerk dashboard settings.`)
      }
    } catch (err: unknown) {
      // Clerk errors have a .errors array with user-readable messages
      const clerkErr = err as { errors?: Array<{ message: string }> }
      const msg = clerkErr?.errors?.[0]?.message
        ?? (err instanceof Error ? err.message : 'Sign in failed')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoArrow}>→</Text>
          </View>
          <Text style={styles.wordmark}>
            arr<Text style={styles.wordmarkO}>o</Text>
          </Text>
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your Arro account</Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
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
            placeholder="Password"
            placeholderTextColor={wm(0.25)}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
            onPress={onSignIn}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnText}>Sign in</Text>
            }
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don&apos;t have an account? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Sign up</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing[7],
    justifyContent: 'center',
    gap: Spacing[4],
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  logoMark: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  logoArrow: { color: Colors.white, fontSize: 17, fontWeight: '700' },
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
    backgroundColor: 'rgba(226,75,74,0.1)',
    borderRadius: Radius.input,
    padding: Spacing[4],
    borderWidth: 1, borderColor: 'rgba(226,75,74,0.2)',
  },
  errorText: { color: Colors.red, fontSize: FontSize.base },
  form: { gap: Spacing[3] },
  input: {
    backgroundColor: wm(0.05),
    borderRadius: Radius.inputLg,
    borderWidth: 1, borderColor: wm(0.1),
    paddingHorizontal: Spacing[6],
    paddingVertical: 13,
    fontSize: FontSize.md,
    color: wm(0.85),
  },
  btn: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.card,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing[2],
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing[5] },
  footerText: { color: wm(0.35), fontSize: FontSize.base },
  footerLink: { color: Colors.orange, fontSize: FontSize.base, fontWeight: '600' },
})
