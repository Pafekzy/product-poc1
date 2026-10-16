import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleApiRequest } from './src/server/api';

const apiPlugin = (): Plugin => ({
  name: 'vericommit-api-server',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost:3000'}`);
      if (url.pathname.startsWith('/api/')) {
        let rawBody = '';
        req.on('data', chunk => { rawBody += chunk; });
        req.on('end', async () => {
          try {
            const handled = await handleApiRequest(req, res, url, rawBody);
            if (!handled) next();
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: { code: 'INTERNAL_SERVER_ERROR', message: String(err) } }));
          }
        });
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    apiPlugin()
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true
  }
});
