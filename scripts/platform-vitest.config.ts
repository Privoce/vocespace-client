import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'apps/platform/package.json'));
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      ...['react', 'react-dom'].map((name) => ({
        find: new RegExp(`^${name}(?=/|$)`),
        replacement: path.dirname(require.resolve(`${name}/package.json`)),
      })),
      { find: '@', replacement: path.join(root, 'apps/platform') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['scripts/tests/platform-auth-form.test.tsx'],
    clearMocks: true,
  },
});
