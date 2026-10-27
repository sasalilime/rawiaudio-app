import { useSyncExternalStore } from 'react'
import type { AccountSession, AccountState } from '../../core/useCases/accountSession.ts'
import { useUseCases } from '../useCases.tsx'

/** L'état de la connexion, re-rendu à chaque changement, et la session pour agir dessus. */
export function useAccount(): [AccountState, AccountSession] {
  const { account } = useUseCases()
  return [useSyncExternalStore(account.subscribe, account.getSnapshot), account]
}
