import { StyleSheet, View } from 'react-native'
import { colors } from '../theme.ts'

/** Barre de progression, annoncée par le lecteur d'écran. value et max dans la même unité. */
export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.rail}
    >
      <View style={[styles.fill, { width: `${percent}%` }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  rail: { height: 6, borderRadius: 3, backgroundColor: colors.trait, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.ambre },
})
