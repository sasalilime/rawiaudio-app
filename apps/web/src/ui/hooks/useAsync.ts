import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ok'; data: T }

/**
 * Charge une donnée au montage et quand key change ; annule la requête si la page est quittée avant.
 * Renvoie aussi retry, pour le bouton « Réessayer ».
 */
export function useAsync<T>(key: string, load: (signal: AbortSignal) => Promise<T>): [AsyncState<T>, () => void] {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    load(controller.signal).then(
      (data) => setState({ status: 'ok', data }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error })
      },
    )
    return () => controller.abort()
  }, [key, attempt]) // load change à chaque rendu : seule key (ou retry) décide de recharger

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return [state, retry]
}
