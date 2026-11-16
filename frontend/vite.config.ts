import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Per-checkout overrides live in .env.local (see scripts/worktree-setup.sh).
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const port = env.VITE_PORT ? Number(env.VITE_PORT) : undefined

  return {
    plugins: [react(), tailwindcss()],
    // strictPort: fail loudly instead of silently drifting to a port that the
    // backend's CORS settings or another worktree's frontend may be using.
    server: { port, strictPort: port !== undefined },
    preview: { port, strictPort: port !== undefined },
  }
})
