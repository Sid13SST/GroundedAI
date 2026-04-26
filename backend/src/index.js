import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ingestPDF, query as ragQuery } from './ragPipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
const TEMP_DIR = path.join(__dirname, '..', 'temp');

// Ensure temp directory exists
fs.mkdirSync(TEMP_DIR, { recursive: true });

const app = new Hono();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use('*', cors());
app.use('*', logger());

// ─── Frontend Static Files ─────────────────────────────────────────────────────
app.get('/', (c) => {
  const html = fs.readFileSync(path.join(FRONTEND_DIR, 'index.html'), 'utf-8');
  return c.html(html);
});
app.get('/style.css', (c) => {
  c.header('Content-Type', 'text/css');
  return c.body(fs.readFileSync(path.join(FRONTEND_DIR, 'style.css'), 'utf-8'));
});
app.get('/app.js', (c) => {
  c.header('Content-Type', 'application/javascript');
  return c.body(fs.readFileSync(path.join(FRONTEND_DIR, 'app.js'), 'utf-8'));
});

// ─── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ─── POST /upload-pdf ──────────────────────────────────────────────────────────
app.post('/upload-pdf', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || typeof file === 'string') {
      return c.json({ error: 'No PDF file provided.' }, 400);
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return c.json({ error: 'Only PDF files are accepted.' }, 400);
    }

    // Write upload to a temp file
    const tempPath = path.join(TEMP_DIR, `upload_${Date.now()}.pdf`);
    const buffer = await file.arrayBuffer();
    fs.writeFileSync(tempPath, Buffer.from(buffer));

    const result = await ingestPDF(tempPath);

    // Clean up temp file
    fs.unlinkSync(tempPath);

    return c.json({ success: true, filename: file.name, ...result });
  } catch (err) {
    console.error('Upload error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── POST /ask ─────────────────────────────────────────────────────────────────
app.post('/ask', async (c) => {
  try {
    const { query, history = [] } = await c.req.json();
    if (!query || typeof query !== 'string' || !query.trim()) {
      return c.json({ error: 'A non-empty query string is required.' }, 400);
    }

    const result = await ragQuery(query.trim(), history);
    return c.json(result);
  } catch (err) {
    console.error('Ask error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`\n🚀 GroundedAI running at http://localhost:${info.port}`);
  console.log(`📄 Open http://localhost:${info.port} in your browser\n`);
});
