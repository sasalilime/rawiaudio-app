import { useCallback, useState } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'
import { authMessage } from '@rawiaudio/shared/ui/authMessage.ts'

/**
 * Une action de compte à la fois (envoyer le code, se déconnecter…) : laquelle est en cours, pour rendre les boutons
 * inactifs, et le message du dernier échec. run rend true si l'action a réussi.
 */
export function useAuthAction<Name extends string>() {
  const [pending, setPending] = useState<Name | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (name: Name, action: () => Promise<void>): Promise<boolean> => {
    setPending(name)
    setError(null)
    try {
      await action()
      return true
    } catch (cause) {
      const message = authMessage(cause)
      setError(message)
      announce(message)
      return false
    } finally {
      setPending(null)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { pending, error, run, clearError }
}

/**
 * Lit un message qui vient d'apparaître. VoiceOver ne le fait pas seul, même pour un texte en rôle « alert » ;
 * sur Android, c'est accessibilityLiveRegion, sur le texte affiché, qui s'en charge.
 */
export function announce(message: string) {
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message)
}
