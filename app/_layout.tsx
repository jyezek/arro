import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@/lib/tokenCache'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { deleteItem, getItem, setItem } from '@/lib/storage'
import { useEffect, useRef, useState } from 'react'
import 'react-native-reanimated'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { apiRequest } from '@/lib/api'

SplashScreen.preventAutoHideAsync()

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env file')
}

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(tabs)',
}

export default function RootLayout() {
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ClerkLoaded>
        <GestureHandlerRootView style={styles.root}>
          <BottomSheetModalProvider>
            <StatusBar style="light" />
            <InitialLayout />
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </ClerkLoaded>
    </ClerkProvider>
  )
}

function InitialLayout() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null)
  const intentHandled = useRef(false)

  useEffect(() => {
    let cancelled = false

    const syncOnboardingState = async () => {
      if (!isLoaded) return

      if (!isSignedIn) {
        await deleteItem('onboarding_complete')
        if (!cancelled) setOnboardingComplete(false)
        return
      }

      const localValue = await getItem('onboarding_complete')
      if (cancelled) return
      if (localValue === 'true') {
        setOnboardingComplete(true)
        return
      }

      try {
        const token = await getToken()
        const data = await apiRequest<{ profile: { onboardingComplete: boolean } }>('/api/profile', {}, token)
        if (cancelled) return
        const complete = Boolean(data.profile?.onboardingComplete)
        setOnboardingComplete(complete)
        if (complete) await setItem('onboarding_complete', 'true')
        else await deleteItem('onboarding_complete')
      } catch {
        if (!cancelled) setOnboardingComplete(false)
      }
    }

    void syncOnboardingState()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded, isSignedIn])

  useEffect(() => {
    if (!isLoaded) return
    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === 'onboarding'

    if (!isSignedIn) {
      SplashScreen.hideAsync()
      if (!inAuthGroup) {
        router.replace('/(auth)/sign-in')
      }
      return
    }

    if (onboardingComplete === null) return
    SplashScreen.hideAsync()

    if (inAuthGroup) {
      router.replace(onboardingComplete ? '/(tabs)' : '/onboarding')
    } else if (!inOnboarding && !onboardingComplete) {
      router.replace('/onboarding')
    } else if (inOnboarding && onboardingComplete) {
      router.replace('/(tabs)')
      // Check for a post-signup purchase intent stored during sign-up
      if (!intentHandled.current) {
        intentHandled.current = true
        void getItem('pending_intent').then(async (pendingIntent) => {
          if (!pendingIntent) return
          await deleteItem('pending_intent')
          // Brief delay to let the tabs navigation settle before pushing a modal
          setTimeout(() => {
            if (pendingIntent === 'credits') {
              router.push('/credits')
            } else {
              router.push(`/upgrade?plan=${pendingIntent}`)
            }
          }, 400)
        })
      }
    }
  }, [isLoaded, isSignedIn, segments, onboardingComplete, router])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="job/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="resume/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="prep-kit/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="research/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="admin" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="settings/resume" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="settings/preferences" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="interview/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="interview/new" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="interview/debrief/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="job-links/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="upgrade" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
      <Stack.Screen name="credits" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
    </Stack>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
