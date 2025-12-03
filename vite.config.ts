
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Robustly check for API key in various env vars
    const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.API_KEY || '';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          // Reverting to `process.cwd()` as `__dirname` is not available in all Vite execution contexts.
          // `process.cwd()` reliably points to the project root.
          // @ts-ignore: `process.cwd()` is a standard Node.js API, but TypeScript might not have Node.js types configured.
          // Casting `process` to `any` bypasses this type checking issue.
          '@': path.resolve((process as any).cwd(), '.'),
        }
      }
    };
});