import { AFTER_FIRST_UNLOCK, deleteItemAsync, getItemAsync, setItemAsync, type SecureStoreOptions } from 'expo-secure-store'

const KEY = 'rawi.session'

// AFTER_FIRST_UNLOCK : la suite d'une série démarre écran verrouillé et appelle l'API avec le jeton ;
// le réglage par défaut (WHEN_UNLOCKED) refuserait alors de le lire. Sans effet sur Android.
const OPTIONS: SecureStoreOptions = { keychainAccessible: AFTER_FIRST_UNLOCK }

/**
 * Le jeton de session dans le trousseau du téléphone (ADR-0012). A la forme du TokenStore de shared/http,
 * sans l'importer : infra ne prend du code partagé que le cœur (architecture.test.ts). main.ts vérifie l'accord des types.
 */
export function createSecureTokenStore() {
  return {
    get: () => getItemAsync(KEY, OPTIONS),
    set: (token: string) => setItemAsync(KEY, token, OPTIONS),
    clear: () => deleteItemAsync(KEY, OPTIONS),
  }
}
