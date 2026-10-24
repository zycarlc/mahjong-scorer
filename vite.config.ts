import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ command }) => ({
  // 開發伺服器用自簽 HTTPS，區網 IP 才算安全環境，手機才能開鏡頭
  plugins: [preact(), ...(command === 'serve' ? [basicSsl()] : [])],
  base: './',
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
}));
