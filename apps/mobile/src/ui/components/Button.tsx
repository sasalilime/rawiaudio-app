import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { colors, fonts } from '../theme.ts'

/**
 * Bouton en pilule, comme sur le site : plein (action principale) ou bordé d'ambre (action secondaire).
 * disabled : inactif pendant un appel ; busy : c'est son action qui est en cours (indicateur, annoncé « occupé »).
 */
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
}: {
  label: string
  onPress: () => void
  secondary?: boolean
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, pressed && styles.pressed, disabled && styles.disabled, busy && styles.busy]}
    >
      {busy && <ActivityIndicator color={secondary ? colors.ambre : colors.nuit} />}
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
  disabled: { opacity: 0.6 },
  // L'indicateur à gauche du libellé ; flexShrink : un libellé long passe alors à la ligne au lieu de déborder.
  busy: { flexDirection: 'row', gap: 10 },
  label: { color: colors.nuit, fontFamily: fonts.texteAppuye, fontSize: 18, lineHeight: 26, textAlign: 'center', flexShrink: 1 },
  secondaryLabel: { color: colors.ambre },
})
