import { useState } from 'react'
import { Image, StyleSheet, type StyleProp, type ImageStyle } from 'react-native'
import { useDownloads } from '@rawiaudio/shared/ui/hooks/useDownloads.ts'
import { colors } from '../theme.ts'

/**
 * L'illustration 16:9 d'un épisode (ADR-0009), décorative : le titre est toujours écrit à côté.
 * La copie gardée sur le téléphone si l'épisode est téléchargé, sinon l'adresse en ligne.
 * Si elle ne se charge pas (hors ligne, épisode non téléchargé), elle disparaît.
 */
export function EpisodeImage({ url, style }: { url: string; style?: StyleProp<ImageStyle> }) {
  const [, downloads] = useDownloads() // re-rendu à la fin d'un téléchargement : la copie locale prend le relais
  const source = downloads.imageSource(url)
  // L'adresse en échec, et pas un simple booléen : une autre adresse (copie locale, autre épisode) retente sa chance.
  const [failed, setFailed] = useState<string | null>(null)
  if (failed === source) return null
  return (
    <Image
      source={{ uri: source }}
      accessibilityIgnoresInvertColors
      accessible={false}
      onError={() => setFailed(source)}
      style={[styles.image, style]}
    />
  )
}

const styles = StyleSheet.create({
  // Coins arrondis comme sur le site ; le fond tient la place pendant le chargement.
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: colors.carte },
})
