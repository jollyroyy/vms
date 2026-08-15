import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const env = { ...process.env };
try { const r = dotenv.config(); if (r.parsed) Object.assign(env, r.parsed); } catch {}
const SUPABASE_URL = env.VITE_SUPABASE_URL ?? '';
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const ORT_DIR = join(ROOT, 'public', 'ort');

// Dev-only: onnxruntime-web loads its WASM runtime via a runtime dynamic
// import() of /ort/ort-wasm-*.mjs. Vite's import-analysis rewrites that fetch
// to a ?import request, and the transform middleware then refuses public-dir
// files ("should not be imported from source code"), which surfaces as
// "Failed to fetch dynamically imported module" and "no available backend
// found". This middleware runs before Vite's transform middleware and serves
// the files straight off disk with the correct MIME type.
function ortAssetsMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = req.url ?? '';
  const pathOnly = url.split('?')[0];
  if (!pathOnly.startsWith('/ort/')) { next(); return; }
  const fileName = pathOnly.slice('/ort/'.length);
  if (fileName.includes('/') || fileName.includes('..') || !existsSync(join(ORT_DIR, fileName))) {
    next();
    return;
  }
  res.setHeader('Content-Type', fileName.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
  res.end(readFileSync(join(ORT_DIR, fileName)));
}

// Dev-only plugin — bypasses RLS recursion via service_role key.
function apiProxyPlugin(): ReturnType<typeof react> {
  return {
    name: 'api-proxy',
    configureServer(server) {
      server.middlewares.use(ortAssetsMiddleware);
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        try {
          const url = req.url ?? '';
          if (!SUPABASE_URL || !SERVICE_KEY) {
            console.error('[api-proxy] Missing env SUPABASE_URL or SERVICE_KEY');
            if (url.startsWith('/api/')) { res.writeHead(500).end('Proxy not configured'); return; }
            next(); return;
          }

          // Only touch /api/* requests. Setting Content-Type here for every
          // response would make Vite serve static modules (e.g. the ORT wasm
          // loader in public/ort/) as application/json, and browsers reject
          // those for ES module imports.
          if (!url.startsWith('/api/')) { next(); return; }

          const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          res.setHeader('Content-Type', 'application/json');

          // GET /api/hosts/:deptId — list profiles by department
          const hostsMatch = url.match(/^\/api\/hosts\/(.+)$/);
          if (hostsMatch) {
            const { data, error } = await admin.from('profiles').select('id, full_name, email, role').eq('department_id', hostsMatch[1]!).order('full_name');
            if (error) { res.writeHead(500).end(JSON.stringify({ error: error.message })); return; }
            res.end(JSON.stringify(data ?? []));
            return;
          }

          // POST /api/departments — create department (bypasses RLS recursion)
          if (url === '/api/departments' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => body += chunk);
            req.on('end', async () => {
              try {
                const { name, code } = JSON.parse(body);
                if (!name || !code) { res.writeHead(400).end(JSON.stringify({ error: 'name and code required' })); return; }
                const { data, error } = await admin.from('departments').insert({ name, code }).select().single();
                if (error) { res.writeHead(500).end(JSON.stringify({ error: error.message })); return; }
                res.end(JSON.stringify(data));
              } catch (e) {
                res.writeHead(500).end(JSON.stringify({ error: e instanceof Error ? e.message : 'Bad request' }));
              }
            });
            return;
          }

          // PUT /api/departments/:id — update department
          const deptPutMatch = url.match(/^\/api\/departments\/([a-f0-9-]+)$/);
          if (deptPutMatch && req.method === 'PUT') {
            const id = deptPutMatch[1]!;
            let body = '';
            req.on('data', (chunk) => body += chunk);
            req.on('end', async () => {
              try {
                const { name, code } = JSON.parse(body);
                if (!name || !code) { res.writeHead(400).end(JSON.stringify({ error: 'name and code required' })); return; }
                const { data, error } = await admin.from('departments').update({ name, code }).eq('id', id).select().single();
                if (error) { res.writeHead(500).end(JSON.stringify({ error: error.message })); return; }
                res.end(JSON.stringify(data));
              } catch (e) {
                res.writeHead(500).end(JSON.stringify({ error: e instanceof Error ? e.message : 'Bad request' }));
              }
            });
            return;
          }

          // DELETE /api/departments/:id — delete department (with FK safety)
          const deptDeleteMatch = url.match(/^\/api\/departments\/([a-f0-9-]+)$/);
          if (deptDeleteMatch && req.method === 'DELETE') {
            const id = deptDeleteMatch[1]!;
            try {
              // First, unlink profiles that reference this department
              await admin.from('profiles').update({ department_id: null, role: 'staff' }).eq('department_id', id);
              const { error } = await admin.from('departments').delete().eq('id', id);
              if (error) { res.writeHead(500).end(JSON.stringify({ error: error.message })); return; }
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.writeHead(500).end(JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to delete department' }));
            }
            return;
          }

          next();
        } catch (e) {
          console.error('[api-proxy] Error:', e);
          res.writeHead(500).end('Internal error');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiProxyPlugin()],
  server: {
    port: parseInt(env.PORT || '5173', 10),
    allowedHosts: ['5173-itgbyrum77hhmtwn4sujd-a6830051.sg1.manus.computer'],
  },
});
