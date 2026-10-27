import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, fonts } from '../theme.ts'

/** Bouton en pilule, comme sur le site : plein (action principale) ou bordé d'ambre (action secondaire). */
export function Button({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, pressed && styles.pressed]}
    >
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.ambre,
    backgroundColor: colors.ambre,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.75 },
  label: { color: colors.nuit, fontFamily: fonts.texteAppuye, fontSize: 18, lineHeight: 26, textAlign: 'center' },
  secondaryLabel: { color: colors.ambre },
})
