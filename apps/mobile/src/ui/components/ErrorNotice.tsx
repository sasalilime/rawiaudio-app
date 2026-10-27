import { StyleSheet, Text, View } from 'react-native'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { text } from '../theme.ts'
import { Button } from './Button.tsx'

/** Un chargement raté : ce qui s'est passé, et le bouton pour réessayer. */
export function ErrorNotice({ message, retry }: { message: string; retry: () => void }) {
  return (
    <View style={styles.notice}>
      <Text accessibilityRole="alert" style={text.body}>
        {message}
      </Text>
      <Button label={fr.retry} onPress={retry} secondary />
    </View>
  )
}

const styles = StyleSheet.create({
  notice: { gap: 12, alignItems: 'flex-start' },
})
