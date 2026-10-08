import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: {
    '@/app': fileURLToPath(new URL('./apps/web/app', import.meta.url)),
    '@/components': fileURLToPath(new URL('./apps/web/components', import.meta.url)),
    '@/styles': fileURLToPath(new URL('./apps/web/styles', import.meta.url)),
    '@': fileURLToPath(new URL('.', import.meta.url)),
    ...Object.fromEntries(['contracts', 'domain', 'client-sdk', 'server-core'].map((name) =>
      [`@vocespace/${name}`, fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url))])),
  } },
  test: { environment: 'jsdom', include: ['tests/**/*.test.{ts,tsx}'], clearMocks: true },
});
