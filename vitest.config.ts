import { defineConfig } from 'vitest/config'


export default defineConfig({
  resolve: {
    alias: [{ find: /\.css$/, replacement: '/dev/null' }],
  },
  test: {
    environment: 'jsdom',
    css: false,
    include: ['plugins/*/packages/*/tests/**/*.spec.ts', 'plugins/*/packages/*/tests/**/*.spec.tsx'],
  },
})
