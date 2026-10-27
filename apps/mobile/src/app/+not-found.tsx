import { Link } from 'expo-router'
import { ScrollView, Text } from 'react-native'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { screen, text } from '../ui/theme.ts'

/** Adresse inconnue, par exemple un lien rawi:// d'une ancienne version : retour au catalogue. */
export default function NotFoundScreen() {
  return (
    <ScrollView contentContainerStyle={screen.content}>
      <Text accessibilityRole="header" style={text.title}>
        {fr.pageNotFound}
      </Text>
      <Link href="/" style={text.link}>
        {fr.backToCatalog}
      </Link>
    </ScrollView>
  )
}
