import { useNetworkState } from 'expo-network'

/**
 * Le téléphone se croit-il connecté ? Une indication seulement : une requête peut encore échouer.
 * Tant que le système ne sait pas (valeurs absentes au démarrage), on suppose la connexion, comme la PWA.
 */
export function useOnline(): boolean {
  const { isConnected, isInternetReachable } = useNetworkState()
  return isConnected !== false && isInternetReachable !== false
}
