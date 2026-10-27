import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { screen, text, TOUCH_TARGET } from '../ui/theme.ts'

const SITE = 'https://rawiaudio.com'
const CONTACT = 'contact@rawiaudio.com'

// Le lien de confidentialité est exigé par Apple dans l'appli (règle 5.1.1(i), ADR-0013).
const LINKS = [
  { label: fr.website, url: SITE },
  { label: fr.privacy, url: `${SITE}/confidentialite` },
  { label: fr.legalNotice, url: `${SITE}/mentions-legales` },
]

/** Qui fait Rawi, et où le joindre : le site, la confidentialité, les mentions légales, l'adresse de contact. */
export default function AboutScreen() {
  return (
    <ScrollView contentContainerStyle={screen.content}>
      <Text accessibilityRole="header" style={text.title}>
        {fr.about}
      </Text>
      <Text style={text.body}>{fr.aboutText}</Text>

      <View>
        {LINKS.map((link) => (
          <Pressable key={link.url} accessibilityRole="link" onPress={() => void Linking.openURL(link.url)} style={styles.link}>
            <Text style={text.link}>{link.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text accessibilityRole="header" style={text.sectionTitle}>
        {fr.writeToUs}
      </Text>
      {/* L'adresse reste lisible et copiable : sans appli de messagerie, le lien ne s'ouvre pas. */}
      <Pressable
        accessibilityRole="link"
        onPress={() => Linking.openURL(`mailto:${CONTACT}`).catch(() => undefined)}
        style={styles.link}
      >
        <Text selectable style={text.link}>
          {CONTACT}
        </Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  link: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
})
