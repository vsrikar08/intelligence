import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

const workDir = process.env.ROWBOAT_WORKDIR
if (!workDir) throw new Error('Set ROWBOAT_WORKDIR to the local Patchy intelligence directory.')
const state = JSON.parse(fs.readFileSync(path.join(workDir, 'instance.json'), 'utf8'))
const token = fs.readFileSync(path.join(workDir, 'server-key'), 'utf8').trim()
const port = Number(process.env.ROWBOAT_WEB_PORT || 5174)
const origin = `http://127.0.0.1:${port}`

// This dev-only same-origin bridge preserves the authenticated backend and
// rejects cross-site calls before adding its key (2026-09-27).
export default mergeConfig(base, defineConfig({
  plugins: [{
    name: 'local-rowboat-browser',
    transformIndexHtml: html => html.replace('/src/main.tsx', '/src/browser.ts'),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.headers.host !== `127.0.0.1:${port}` ||
            (req.headers.origin && req.headers.origin !== origin) ||
            req.headers['sec-fetch-site'] === 'cross-site') {
          res.statusCode = 403
          res.end('Local same-origin requests only.')
          return
        }
        next()
      })
      server.httpServer?.prependListener('upgrade', (req, socket) => {
        if (req.headers.host !== `127.0.0.1:${port}` || req.headers.origin !== origin) socket.destroy()
      })
    },
  }],
  server: {
    host: '127.0.0.1', port, strictPort: true, cors: false,
    proxy: {
      '/rowboat': {
        target: state.url, ws: true,
        rewrite: p => p.replace(/^\/rowboat/, ''),
        headers: { authorization: `Bearer ${token}` },
      },
    },
  },
}))
