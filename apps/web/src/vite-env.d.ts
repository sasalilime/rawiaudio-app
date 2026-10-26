/// <reference types="vite/client" />

// Variables lues au build. Les déclarer ici évite le type any de Vite.
interface ImportMetaEnv {
  /** URL de l'API ; absente en dev, où le relais de Vite sert /api. */
  readonly VITE_API_URL?: string
}
