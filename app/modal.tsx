import { View, Text, StyleSheet } from 'react-native'
import { Colors, FontSize, wm } from '@/constants/Colors'

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Arro</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },
  title: { fontSize: FontSize.hero, fontWeight: '600', color: wm(0.9) },
})
