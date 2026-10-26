import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  addEventListener('online', onChange)
  addEventListener('offline', onChange)
  return () => {
    removeEventListener('online', onChange)
    removeEventListener('offline', onChange)
  }
}

/** Le navigateur se croit-il connecté ? Une indication seulement : une requête peut encore échouer. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine)
}
