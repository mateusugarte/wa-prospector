/**
 * Script para aplicar o schema no Supabase via conexão direta PostgreSQL.
 * Uso: node scripts/apply-schema.js
 *
 * Requer a variável DATABASE_URL no backend/.env:
 * DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * Encontre a connection string em:
 * Supabase Dashboard → Project Settings → Database → Connection string → URI (Transaction Pooler)
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../../supabase/schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[apply-schema] Erro: DATABASE_URL não encontrada no .env');
  console.error('Adicione ao backend/.env:');
  console.error('DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres');
  console.error('\nEncontre em: Supabase Dashboard → Project Settings → Database → Connection string');
  process.exit(1);
}

async function apply() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('[apply-schema] Conectado ao banco. Aplicando schema...');
    await client.query(sql);
    console.log('[apply-schema] Schema aplicado com sucesso!');
  } catch (err) {
    console.error('[apply-schema] Erro ao aplicar schema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

apply();
