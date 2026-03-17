import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Colors, FontSize, Radius, Spacing, wm } from '@/constants/Colors'

export default function ResumePreviewFrame({
  html,
  loading,
}: {
  html: string | null
  loading?: boolean
}) {
  return (
    <View style={styles.fallback}>
      {loading ? <ActivityIndicator color={Colors.orange} /> : null}
      <Text style={styles.title}>Preview is available on web</Text>
      <Text style={styles.text}>
        The exported PDF uses the same web preview renderer. Save your edits, then open this screen in web to verify layout and export.
      </Text>
      {html ? <Text style={styles.text}>A rendered preview is ready.</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: {
    minHeight: 240,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: wm(0.08),
    backgroundColor: wm(0.03),
    padding: Spacing[6],
    justifyContent: 'center',
    gap: Spacing[3],
  },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: wm(0.88) },
  text: { fontSize: FontSize.base, lineHeight: 20, color: wm(0.5) },
})
