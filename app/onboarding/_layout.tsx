import { Stack } from 'expo-router'

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="parsing" options={{ gestureEnabled: false }} />
      <Stack.Screen name="review" />
      <Stack.Screen name="gap-fill" />
      <Stack.Screen name="done" options={{ gestureEnabled: false }} />
    </Stack>
  )
}
