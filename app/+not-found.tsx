import { Stack, useRouter } from 'expo-router'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Colors, FontSize, wm } from '@/constants/Colors'

export default function NotFoundScreen() {
  const router = useRouter()
  return (
    <>
      <Stack.Screen options={{ title: 'Not found', headerShown: false }} />
      <View style={styles.container}>
        <Text style={styles.title}>Page not found</Text>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.link}>
          <Text style={styles.linkText}>Go home</Text>
        </Pressable>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark, gap: 16 },
  title: { fontSize: FontSize.lg, color: wm(0.45) },
  link: { paddingVertical: 10 },
  linkText: { fontSize: FontSize.md, color: Colors.orange, fontWeight: '500' },
})
