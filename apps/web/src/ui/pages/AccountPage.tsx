import { useEffect, useRef, useState } from 'react'
import { authMessage } from '@rawiaudio/shared/ui/authMessage.ts'
import { useAccount } from '@rawiaudio/shared/ui/hooks/useAccount.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { PageTitle } from '../components/PageTitle.tsx'
import { Link } from '../navigation.tsx'
import { signInPath } from '../router.ts'

/** « Mon compte » (ADR-0012) : l'adresse du compte, la déconnexion et la suppression du compte. */
export function AccountPage() {
  const [state, session] = useAccount()
  // main.tsx demande la session au démarrage ; arrivé ici sans réponse, on redemande en affichant « Chargement… »
  // plutôt que « impossible de vérifier » le temps que la réponse arrive.
  const [checking, setChecking] = useState(state.status === 'unknown')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleted, setDeleted] = useState(false)
  // Après une action, le bouton cliqué disparaît : le focus va au premier paragraphe du nouvel état.
  const [focusLead, setFocusLead] = useState(false)
  const leadRef = useRef<HTMLParagraphElement>(null)
  const alertRef = useRef<HTMLParagraphElement>(null)
  const deleteRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (checking) void session.load().finally(() => setChecking(false))
  }, [checking, session])

  useEffect(() => {
    if (message) alertRef.current?.focus()
  }, [message])

  useEffect(() => {
    if (!focusLead) return
    leadRef.current?.focus()
    setFocusLead(false)
  }, [focusLead])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setFocusLead(true)
    } catch (error) {
      setMessage(authMessage(error))
    } finally {
      setBusy(false)
    }
  }

  function cancelDelete() {
    setConfirming(false)
    deleteRef.current?.focus()
  }

  const lead = { ref: leadRef, tabIndex: -1, className: 'account-lead' }

  return (
    <>
      <Link href="/" className="back">
        {fr.backToCatalog}
      </Link>
      <PageTitle title={fr.account} className="page-heading">
        {fr.account}
      </PageTitle>

      {message && (
        <p ref={alertRef} role="alert" tabIndex={-1} className="form-alert">
          {message}
        </p>
      )}

      {deleted ? (
        <p role="status" {...lead}>
          {fr.accountDeleted}
        </p>
      ) : state.status === 'unknown' ? (
        checking || busy ? (
          <p role="status" {...lead}>
            {fr.loading}
          </p>
        ) : (
          <div className="auth-step">
            <p {...lead}>{fr.accountUnknown}</p>
            <button type="button" onClick={() => void run(() => session.load())}>
              {fr.retry}
            </button>
          </div>
        )
      ) : state.status === 'signedIn' ? (
        <div className="auth-step">
          <p {...lead}>{fr.signedInAs(state.account.email)}</p>
          <button type="button" className="secondary" disabled={busy} onClick={() => void run(() => session.logout())}>
            {fr.signOut}
          </button>
          <button
            ref={deleteRef}
            type="button"
            className="secondary"
            aria-expanded={confirming}
            onClick={() => setConfirming(!confirming)}
          >
            {fr.deleteAccount}
          </button>
          {confirming && (
            <div className="account-confirm" role="group" aria-labelledby="delete-account-warning">
              <p id="delete-account-warning">{fr.deleteAccountWarning}</p>
              <div className="auth-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await session.deleteAccount()
                      setDeleted(true)
                    })
                  }
                >
                  {fr.confirmDeleteAccount}
                </button>
                {/* Le focus va d'abord sur le choix sans conséquence. */}
                <button type="button" className="secondary" disabled={busy} autoFocus onClick={cancelDelete}>
                  {fr.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="auth-step">
          <p {...lead}>{fr.signInIntro}</p>
          <Link href={signInPath()} className="button-link">
            {fr.signIn}
          </Link>
        </div>
      )}
    </>
  )
}
