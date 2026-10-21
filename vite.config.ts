import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Static hosts such as Cloudflare Pages serve from the domain root. GitHub
// Pages project sites override this with /<repository-name>/ in their workflow.
const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({ base, plugins: [react()] })
