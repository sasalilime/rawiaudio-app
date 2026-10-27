import { useState } from 'react'
import { router } from 'expo-router'
import { AccessibilityInfo, ScrollView, Text } from 'react-native'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useAccount } from '@rawiaudio/shared/ui/hooks/useAccount.ts'
import { Button } from '../ui/components/Button.tsx'
import { TextField } from '../ui/components/TextField.tsx'
import { useAuthAction } from '../ui/hooks/useAuthAction.ts'
import { accountHref } from '../ui/routes.ts'
import { screen, text } from '../ui/theme.ts'

/** Se connecter (ADR-0012) : l'adresse e-mail, puis le code de 6 chiffres reçu. L'app n'utilise pas le lien de l'e-mail. */
export default function SignInScreen() {
  const [state, session] = useAccount()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  // Après « Renvoyer un code » : rien d'autre ne change à l'écran, on le dit.
  const [resent, setResent] = useState(false)
  const { pending, error, run, clearError } = useAuthAction<'send' | 'verify' | 'resend'>()
  const busy = pending !== null

  function sendCode() {
    if (!busy) void run('send', () => session.requestLogin(email))
  }

  async function verify() {
    if (busy) return
    // dismissTo revient à l'écran du compte d'où l'on vient, sans l'empiler une seconde fois ; à défaut, il remplace celui-ci.
    if (await run('verify', () => session.verifyCode(code))) router.dismissTo(accountHref)
  }

  async function resend(sentTo: string) {
    setCode('') // une nouvelle demande annule le code précédent
    setResent(false)
    if (await run('resend', () => session.requestLogin(sentTo))) {
      setResent(true)
      AccessibilityInfo.announceForAccessibility(fr.codeResent)
    }
  }

  function changeEmail() {
    setCode('')
    setResent(false)
    clearError()
    session.restart()
  }

  const errorText = error !== null && (
    <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={text.body}>
      {error}
    </Text>
  )

  // automaticallyAdjustKeyboardInsets (iOS) : le contenu défile au-dessus du clavier. Android redimensionne l'écran
  // (softwareKeyboardLayoutMode « resize », le réglage par défaut d'Expo).
  return (
    <ScrollView contentContainerStyle={screen.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text accessibilityRole="header" style={text.title}>
        {fr.signIn}
      </Text>

      {state.status === 'codeSent' ? (
        <>
          <Text style={text.body}>{fr.codeSentTo(state.email)}</Text>
          {resent && (
            <Text accessibilityLiveRegion="polite" style={text.meta}>
              {fr.codeResent}
            </Text>
          )}
          <TextField
            label={fr.codeLabel}
            value={code}
            // Un code collé ou proposé par le clavier peut porter des espaces : on ne garde que les chiffres.
            onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            onSubmitEditing={() => void verify()}
          />
          {errorText}
          <Button label={fr.verifyCode} onPress={() => void verify()} disabled={busy} busy={pending === 'verify'} />
          <Text style={text.meta}>{fr.checkSpam}</Text>
          <Button
            label={fr.resendCode}
            onPress={() => void resend(state.email)}
            secondary
            disabled={busy}
            busy={pending === 'resend'}
          />
          <Button label={fr.changeEmail} onPress={changeEmail} secondary disabled={busy} />
        </>
      ) : (
        <>
          <Text style={text.body}>{fr.signInIntro}</Text>
          <TextField
            label={fr.emailLabel}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={sendCode}
          />
          {errorText}
          <Button label={fr.sendCode} onPress={sendCode} disabled={busy} busy={pending === 'send'} />
        </>
      )}
    </ScrollView>
  )
}
