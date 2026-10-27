import { useEffect, useRef, useState, type FormEvent } from 'react'
import { InvalidCodeError } from '@rawiaudio/shared/core/domain/errors.ts'
import { authMessage } from '@rawiaudio/shared/ui/authMessage.ts'
import { useAccount } from '@rawiaudio/shared/ui/hooks/useAccount.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { PageTitle } from '../components/PageTitle.tsx'
import { Link, navigate } from '../navigation.tsx'
import { accountPath, linkToken } from '../router.ts'

/**
 * Connexion par e-mail (ADR-0012) : l'adresse, puis le code reçu. Ouverte par le lien de l'e-mail
 * (/connexion#jeton=…), elle attend un clic : les antivirus des messageries ouvrent les liens, pas les boutons.
 */
export function SignInPage() {
  const [state, session] = useAccount()
  const [token, setToken] = useState(() => linkToken(location.hash))
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // Après « Renvoyer un code » : rien d'autre ne change à l'écran, on le dit.
  const [resent, setResent] = useState(false)
  const alertRef = useRef<HTMLParagraphElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  // Connecté (déjà, ou à l'instant) : la page du compte. replace efface aussi le jeton de l'adresse et de l'historique.
  useEffect(() => {
    if (state.status === 'signedIn') navigate(accountPath(), { replace: true })
  }, [state.status])

  useEffect(() => {
    if (message) alertRef.current?.focus()
  }, [message])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setMessage(null)
    setResent(false)
    try {
      await action()
    } catch (error) {
      if (token && error instanceof InvalidCodeError) {
        // Lien expiré ou déjà servi : on l'oublie et on propose le formulaire d'adresse.
        setToken(null)
        history.replaceState(null, '', location.pathname)
        setMessage(fr.linkInvalid)
      } else {
        setMessage(authMessage(error))
      }
    } finally {
      setBusy(false)
    }
  }

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(() => session.requestLogin(email))
  }

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(() => session.verifyCode(code))
  }

  function changeEmail() {
    setMessage(null)
    session.restart()
  }

  function resend(to: string) {
    void run(async () => {
      await session.requestLogin(to)
      setCode('')
      setResent(true)
      codeRef.current?.focus() // le bouton désactivé pendant l'envoi a perdu le focus
    })
  }

  if (state.status === 'signedIn') return null

  return (
    <>
      <Link href="/" className="back">
        {fr.backToCatalog}
      </Link>
      <PageTitle title={fr.signIn} className="page-heading">
        {fr.signIn}
      </PageTitle>

      {message && (
        <p ref={alertRef} role="alert" tabIndex={-1} className="form-alert">
          {message}
        </p>
      )}

      {token ? (
        <div className="auth-step">
          <p>{fr.linkIntro}</p>
          <button type="button" disabled={busy} onClick={() => void run(() => session.verifyLink(token))}>
            {fr.verifyCode}
          </button>
        </div>
      ) : state.status === 'codeSent' ? (
        <form className="auth-step" onSubmit={submitCode}>
          <p>{fr.codeSentTo(state.email)}</p>
          {resent && <p role="status">{fr.codeResent}</p>}
          <label htmlFor="sign-in-code">{fr.codeLabel}</label>
          {/* autoFocus : posé au montage, avant l'effet de PageTitle. À l'arrivée sur la page, le titre garde
              donc le focus ; quand le champ apparaît après l'envoi, c'est lui qui l'a. */}
          <input
            ref={codeRef}
            id="sign-in-code"
            className="code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            required
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <button type="submit" disabled={busy}>
            {fr.verifyCode}
          </button>
          <p className="auth-hint">{fr.checkSpam}</p>
          <div className="auth-actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => resend(state.email)}>
              {fr.resendCode}
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={changeEmail}>
              {fr.changeEmail}
            </button>
          </div>
        </form>
      ) : (
        <form className="auth-step" onSubmit={submitEmail}>
          <p>{fr.signInIntro}</p>
          <label htmlFor="sign-in-email">{fr.emailLabel}</label>
          <input
            id="sign-in-email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" disabled={busy}>
            {fr.sendCode}
          </button>
        </form>
      )}
    </>
  )
}
