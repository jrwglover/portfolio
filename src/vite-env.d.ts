/// <reference types="vite/client" />

declare module '*.mmd?raw' {
  const src: string;
  export default src;
}
