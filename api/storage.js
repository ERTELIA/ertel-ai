// api/storage.js
// Ponte entre o app ERTEL e o banco de dados Neon.
// A Vercel publica automaticamente qualquer arquivo dentro de /api como
// uma função (endpoint). Este endpoint responde em: SEUDOMINIO/api/storage

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Garante que a tabela existe (roda toda vez, mas é rápido e seguro repetir)
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS ertel_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureTable();

    if (req.method === 'GET') {
      const { key, prefix } = req.query;

      if (prefix !== undefined) {
        const rows = await sql`SELECT key FROM ertel_kv WHERE key LIKE ${prefix + '%'}`;
        return res.status(200).json({ keys: rows.map(r => r.key) });
      }

      if (!key) return res.status(400).json({ error: 'key é obrigatório' });
      const rows = await sql`SELECT value FROM ertel_kv WHERE key = ${key}`;
      if (rows.length === 0) return res.status(404).json({ error: 'not found' });
      return res.status(200).json({ key, value: rows[0].value });
    }

    if (req.method === 'POST') {
      const { key, value } = req.body || {};
      if (!key) return res.status(400).json({ error: 'key é obrigatório' });
      await sql`
        INSERT INTO ertel_kv (key, value, updated_at)
        VALUES (${key}, ${value}, now())
        ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = now()
      `;
      return res.status(200).json({ key, value });
    }

    if (req.method === 'DELETE') {
      const { key } = req.query;
      if (!key) return res.status(400).json({ error: 'key é obrigatório' });
      await sql`DELETE FROM ertel_kv WHERE key = ${key}`;
      return res.status(200).json({ key, deleted: true });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
}
