import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { colors, fonts } from '../theme.ts'

/** Un champ de saisie sous son libellé visible ; ce libellé est aussi le nom du champ pour le lecteur d'écran. */
export function TextField({ label, ...input }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      {/* Déjà lu comme nom du champ : masqué au lecteur d'écran pour ne pas l'entendre deux fois. */}
      <Text style={styles.label} accessibilityElementsHidden importantForAccessibility="no">
        {label}
      </Text>
      <TextInput accessibilityLabel={label} selectionColor={colors.ambre} style={styles.input} {...input} />
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: colors.papier, fontFamily: fonts.texteAppuye, fontSize: 17, lineHeight: 26 },
  // 52 de haut, comme les boutons : au-dessus de la cible de 48 points. Bordure brume : contraste de 3:1 au moins
  // sur la nuit, exigé pour le contour d'un champ (WCAG 1.4.11), que colors.trait n'atteint pas.
  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.brume,
    backgroundColor: colors.carte,
    color: colors.papier,
    fontFamily: fonts.texte,
    fontSize: 18,
  },
})
