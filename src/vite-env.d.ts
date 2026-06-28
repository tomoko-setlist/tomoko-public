/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: "local" | "stg" | "staging" | "preview" | "production"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.wasm?url' {
  const url: string
  export default url
}

declare module '*.js?url' {
  const url: string
  export default url
}
