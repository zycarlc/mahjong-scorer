import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  base: './',
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
