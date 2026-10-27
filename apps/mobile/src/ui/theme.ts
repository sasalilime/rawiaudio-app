import { StyleSheet } from 'react-native'

// Palette et polices du site rawiaudio.com, les mêmes que la PWA (apps/web/src/ui/styles.css).
export const colors = {
  nuit: '#1F2A44',
  ambre: '#D4A24C',
  papier: '#F5F2EC',
  brume: '#A9AEBC',
  trait: 'rgba(212, 162, 76, 0.28)',
  carte: 'rgba(245, 242, 236, 0.05)', // fond d'une image en attente, comme sur le site
} as const

/** Noms internes des polices (assets/fonts/README.md). Jamais de fontWeight avec elles : Android changerait de police. */
export const fonts = {
  titre: 'Lalezar-Regular',
  texte: 'Literata-Regular',
  texteAppuye: 'Literata-SemiBold',
} as const

/** Chargées au démarrage par _layout.tsx. Metro remplace chaque require par l'identifiant du fichier. */
export const fontFiles = {
  [fonts.titre]: require<number>('../../assets/fonts/Lalezar-Regular.ttf'),
  [fonts.texte]: require<number>('../../assets/fonts/Literata-Regular.ttf'),
  [fonts.texteAppuye]: require<number>('../../assets/fonts/Literata-SemiBold.ttf'),
}

/**
 * Agrandissement maximal des grands numéros avec le réglage « grand texte » du téléphone. Ils sont décoratifs
 * (le libellé lu contient déjà le numéro), et un 52 points doublé casserait la ligne. Le texte, lui, suit le réglage.
 */
export const NUMBER_MAX_SCALE = 1.2

/** Taille minimale d'une cible tactile, en points : des mains d'enfant, un téléphone tenu d'une main. */
export const TOUCH_TARGET = 48

// Lalezar a de grandes jambes : une interligne trop serrée la rognerait sur Android.
export const text = StyleSheet.create({
  body: { color: colors.papier, fontFamily: fonts.texte, fontSize: 18, lineHeight: 30 },
  meta: { color: colors.brume, fontFamily: fonts.texte, fontSize: 15, lineHeight: 23 },
  title: { color: colors.papier, fontFamily: fonts.titre, fontSize: 40, lineHeight: 50 },
  sectionTitle: { color: colors.papier, fontFamily: fonts.titre, fontSize: 26, lineHeight: 34, marginTop: 32, marginBottom: 4 },
  number: { color: colors.ambre, fontFamily: fonts.titre, fontSize: 52, lineHeight: 60, fontVariant: ['tabular-nums'] },
  link: { color: colors.ambre, fontFamily: fonts.texte, fontSize: 17, lineHeight: 26, textDecorationLine: 'underline' },
})

/** Le contenu défilant d'un écran. */
export const screen = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
})
