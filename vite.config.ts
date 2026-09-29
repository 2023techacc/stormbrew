import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig(({ mode }) => ({
  // Relative asset paths so the same build works inside the Android app,
  // on GitHub Pages (served from /stormbrew/), and from a local file server.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  test: {
    // `vitest --mode balance` runs the balance report instead of the tests.
    include: mode === 'balance' ? ['tests/balance/*.ts'] : ['tests/**/*.test.ts'],
  },
}));
