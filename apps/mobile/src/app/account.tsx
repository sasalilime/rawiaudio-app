import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useAccount } from '@rawiaudio/shared/ui/hooks/useAccount.ts'
import { Button } from '../ui/components/Button.tsx'
import { ErrorNotice } from '../ui/components/ErrorNotice.tsx'
import { announce, useAuthAction } from '../ui/hooks/useAuthAction.ts'
import { signInHref } from '../ui/routes.ts'
import { colors, screen, text } from '../ui/theme.ts'

/** Mon compte : l'adresse connectée, la déconnexion, et la suppression du compte, exigée par Apple (ADR-0012). */
export default function AccountScreen() {
  const [state, session] = useAccount()
  const { pending, error, run, clearError } = useAuthAction<'signOut' | 'delete'>()
  const busy = pending !== null
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleted, setDeleted] = useState(false)

  // Session inconnue à l'ouverture (vérification du démarrage encore en route, ou échouée hors ligne) : on la vérifie,
  // puis à chaque « Réessayer ». load ne lève jamais : en cas d'échec, l'état reste « unknown ».
  const [checking, setChecking] = useState(() => session.getSnapshot().status === 'unknown')
  useEffect(() => {
    if (checking) void session.load().finally(() => setChecking(false))
  }, [checking, session])

  function askDelete() {
    clearError()
    setConfirmingDelete(true)
    announce(fr.deleteAccountWarning)
  }

  function cancelDelete() {
    clearError()
    setConfirmingDelete(false)
  }

  async function deleteAccount() {
    if (!(await run('delete', () => session.deleteAccount()))) return
    setConfirmingDelete(false)
    setDeleted(true)
    announce(fr.accountDeleted)
  }

  return (
    <ScrollView contentContainerStyle={screen.content}>
      <Text accessibilityRole="header" style={text.title}>
        {fr.account}
      </Text>

      {state.status === 'unknown' &&
        (checking ? (
          <Text accessibilityLiveRegion="polite" style={text.meta}>
            {fr.loading}
          </Text>
        ) : (
          <ErrorNotice message={fr.accountUnknown} retry={() => setChecking(true)} />
        ))}

      {state.status === 'signedOut' && (
        <>
          {deleted && (
            <Text accessibilityLiveRegion="polite" style={text.body}>
              {fr.accountDeleted}
            </Text>
          )}
          <Text style={text.body}>{fr.signInIntro}</Text>
          {/* router.push et non <Link asChild> : le style du bouton dépend de pressed (CLAUDE.md). */}
          <Button
            label={fr.signIn}
            onPress={() => {
              setDeleted(false) // le message de suppression ne doit pas revenir à la prochaine déconnexion
              router.push(signInHref)
            }}
          />
        </>
      )}

      {state.status === 'signedIn' && (
        <>
          <Text style={text.body}>{fr.signedInAs(state.account.email)}</Text>
          {error !== null && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={text.body}>
              {error}
            </Text>
          )}
          {confirmingDelete ? (
            <View style={styles.confirm}>
              <Text accessibilityLiveRegion="polite" style={text.body}>
                {fr.deleteAccountWarning}
              </Text>
              <Button
                label={fr.confirmDeleteAccount}
                onPress={() => void deleteAccount()}
                disabled={busy}
                busy={pending === 'delete'}
              />
              <Button label={fr.cancel} onPress={cancelDelete} secondary disabled={busy} />
            </View>
          ) : (
            <>
              <Button
                label={fr.signOut}
                onPress={() => void run('signOut', () => session.logout())}
                secondary
                disabled={busy}
                busy={pending === 'signOut'}
              />
              <Button label={fr.deleteAccount} onPress={askDelete} secondary disabled={busy} />
            </>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  confirm: { gap: 12, padding: 16, borderWidth: 1, borderColor: colors.trait, borderRadius: 12 },
})
