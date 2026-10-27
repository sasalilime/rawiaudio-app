import { useEffect } from 'react'
import { SplashScreen, Stack, type ErrorBoundaryProps } from 'expo-router'
import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { UseCasesProvider } from '@rawiaudio/shared/ui/useCases.tsx'
import { useCases } from '../main.ts'
import { Button } from '../ui/components/Button.tsx'
import { MiniPlayer } from '../ui/components/MiniPlayer.tsx'
import { colors, fontFiles, fonts, text } from '../ui/theme.ts'

// L'écran de démarrage reste affiché jusqu'au chargement des polices : pas de texte qui change de police sous les yeux.
SplashScreen.preventAutoHideAsync().catch(() => undefined)

/** Cadre de tous les écrans : les cas d'usage assemblés dans main.ts, la pile d'écrans, et le lecteur en bas. */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontFiles)
  const ready = fontsLoaded || fontError !== null // en cas d'échec, les polices du système prennent le relais

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined)
  }, [ready])

  if (!ready) return null

  return (
    <UseCasesProvider value={useCases}>
      <StatusBar style="light" />
      <View style={styles.root}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.nuit },
            headerShadowVisible: false,
            headerTintColor: colors.ambre,
            headerTitle: '', // chaque écran porte son propre grand titre
            headerBackTitleStyle: { fontFamily: fonts.texte },
            contentStyle: { backgroundColor: colors.nuit },
          }}
        >
          {/* Le catalogue a son en-tête à lui, comme l'accueil du site. Son titre sert au bouton retour d'iOS. */}
          <Stack.Screen name="index" options={{ title: fr.appName, headerShown: false }} />
        </Stack>
        <MiniPlayer />
      </View>
    </UseCasesProvider>
  )
}

/** Un écran a planté : expo-router affiche ceci à la place de toute l'appli, au lieu d'un écran blanc. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={[styles.root, styles.crash]}>
      <Text accessibilityRole="alert" style={text.body}>
        {fr.screenError}
      </Text>
      <Button label={fr.retry} onPress={() => void retry()} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.nuit },
  crash: { justifyContent: 'center', padding: 24, gap: 20 },
})
